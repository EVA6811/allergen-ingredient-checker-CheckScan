import type { AnalysisResult, DetectedIngredient, RiskStatus } from '@/types'
import { buildAllergyProfileExtractionPrompt, buildIngredientAnalysisPrompt } from '@/lib/geminiPrompt'

const PRIMARY_MODEL = 'gemini-2.5-flash'
const QUOTA_FALLBACK_MODEL = 'gemini-2.5-flash-lite'
const DEFAULT_MODELS = [PRIMARY_MODEL, QUOTA_FALLBACK_MODEL, 'gemini-2.0-flash', 'gemini-1.5-flash']

type AllergyProfileExtractionResult = {
  allergies: string[]
  hasPositiveFindings: boolean
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

function splitDataUrl(dataUrl: string) {
  const [header, data] = dataUrl.split(',')
  const mimeType = header.match(/data:(.*);base64/)?.[1] ?? 'image/jpeg'
  return { data, mimeType }
}

function isAmbiguousIngredient(ingredient: DetectedIngredient) {
  const reason = ingredient.reason
  return [
    '관련 가능',
    '조건 불명확',
    '불명확',
    '조리 상태',
    '확인 필요',
    '단정',
    '근거가 없',
    '가능성',
    '추정',
    '범위',
  ].some((marker) => reason.includes(marker))
}

function isDirectRiskIngredient(ingredient: DetectedIngredient) {
  const reason = ingredient.reason
  return [
    '[정확히 일치]',
    '[명확한 파생물]',
    '정확히 일치',
    '명확한 파생',
    '직접 일치',
    '직접 관련',
    '원재료명에 표시',
    '원재료명에서 확인',
    '알레르기 표시',
    '포함되어',
  ].some((marker) => reason.includes(marker))
}

function normalizeRiskStatus(status: RiskStatus, detectedIngredients: DetectedIngredient[], hasIssue: boolean): RiskStatus {
  if (hasIssue) return 'warning'
  if (detectedIngredients.length === 0) return 'safe'
  if (detectedIngredients.some((ingredient) => isDirectRiskIngredient(ingredient) && !isAmbiguousIngredient(ingredient))) return 'danger'
  if (status === 'danger' && detectedIngredients.some((ingredient) => !isAmbiguousIngredient(ingredient))) return 'danger'
  return 'warning'
}

function createImageAssessmentIssue(imageAssessment: AnalysisResult['imageAssessment']): AnalysisResult['analysisIssue'] {
  if (!imageAssessment) return null

  const qualityText = imageAssessment.qualityIssues.join(' ')
  const reasonText = imageAssessment.reason
  const assessmentText = `${qualityText} ${reasonText}`

  if (!imageAssessment.isIngredientLabel) {
    return {
      type: 'not_ingredient_label',
      title: '성분표 사진이 아닙니다.',
      message: '원재료명, 알레르기 표시, 영양정보처럼 식품 성분을 확인할 수 있는 글자가 보이도록 다시 촬영하거나 업로드해 주세요.',
    }
  }

  if (imageAssessment.confidence === 'low') {
    const looksUnreadable =
      /흔들|초점|어두|잘림|작|부족|읽기|인식|품질|화질/.test(assessmentText) ||
      imageAssessment.qualityIssues.some((issue) => /흔들|초점|어두|잘림|작|부족|품질|화질/.test(issue))

    return {
      type: looksUnreadable ? 'low_image_quality' : 'insufficient_text',
      title: looksUnreadable ? '사진 품질을 확인해 주세요.' : '성분표 글자를 확인할 수 없습니다.',
      message: looksUnreadable
        ? '글자가 흔들리거나 흐려서 성분 분석을 확정할 수 없습니다. 성분표가 선명하게 보이도록 다시 촬영해 주세요.'
        : '성분표 여부가 불확실해 알레르기 성분을 판단하지 않았습니다. 원재료명이나 알레르기 표시가 보이는 사진을 사용해 주세요.',
    }
  }

  return null
}

function normalizeResult(value: unknown): AnalysisResult {
  const fallback: AnalysisResult = { status: 'safe', detectedIngredients: [] }

  if (!value || typeof value !== 'object') return fallback

  const source = value as Partial<AnalysisResult>
  const status = source.status === 'danger' || source.status === 'warning' || source.status === 'safe' ? source.status : 'safe'
  const imageAssessment =
    source.imageAssessment && typeof source.imageAssessment === 'object'
      ? {
          isIngredientLabel: Boolean(source.imageAssessment.isIngredientLabel),
          confidence:
            source.imageAssessment.confidence === 'high' ||
            source.imageAssessment.confidence === 'medium' ||
            source.imageAssessment.confidence === 'low'
              ? source.imageAssessment.confidence
              : 'low',
          qualityIssues: Array.isArray(source.imageAssessment.qualityIssues)
            ? source.imageAssessment.qualityIssues
                .map((item) => (typeof item === 'string' ? item.trim() : ''))
                .filter(Boolean)
                .slice(0, 6)
            : [],
          reason:
            typeof source.imageAssessment.reason === 'string' && source.imageAssessment.reason.trim()
              ? source.imageAssessment.reason.trim()
              : '이미지 신뢰도 정보를 확인했습니다.',
        }
      : undefined
  const issueCandidate = source.analysisIssue
  const analysisIssue =
    issueCandidate && typeof issueCandidate === 'object'
      ? {
          type:
            issueCandidate.type === 'not_ingredient_label' ||
            issueCandidate.type === 'low_image_quality' ||
            issueCandidate.type === 'insufficient_text' ||
            issueCandidate.type === 'api_error'
              ? issueCandidate.type
              : 'insufficient_text',
          title:
            typeof issueCandidate.title === 'string' && issueCandidate.title.trim()
              ? issueCandidate.title.trim()
              : '성분표를 확인할 수 없습니다.',
          message:
            typeof issueCandidate.message === 'string' && issueCandidate.message.trim()
              ? issueCandidate.message.trim()
              : '원재료명 또는 알레르기 표시가 보이도록 다시 촬영해 주세요.',
        }
      : null
  const detectedIngredients = Array.isArray(source.detectedIngredients)
    ? source.detectedIngredients
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const candidate = item as Partial<AnalysisResult['detectedIngredients'][number]>
          const box = Array.isArray(candidate.box2d) ? candidate.box2d.map(Number) : []
          if (typeof candidate.name !== 'string' || typeof candidate.reason !== 'string' || box.length !== 4) return null
          return {
            name: candidate.name,
            reason: candidate.reason,
            box2d: box.map((point) => Math.max(0, Math.min(1000, Number.isFinite(point) ? point : 0))) as [number, number, number, number],
          }
        })
        .filter(Boolean)
    : []

  const derivedAnalysisIssue = analysisIssue ?? createImageAssessmentIssue(imageAssessment)
  const normalizedIngredients = derivedAnalysisIssue ? [] : (detectedIngredients as AnalysisResult['detectedIngredients'])

  return {
    status: normalizeRiskStatus(status, normalizedIngredients, Boolean(derivedAnalysisIssue)),
    detectedIngredients: normalizedIngredients,
    imageAssessment,
    analysisIssue: derivedAnalysisIssue,
  }
}

function normalizeAllergyProfileResult(value: unknown): AllergyProfileExtractionResult {
  const fallback: AllergyProfileExtractionResult = {
    allergies: [],
    hasPositiveFindings: false,
    confidence: 'low',
    notes: '이미지에서 명확한 알레르기 항목을 찾지 못했습니다.',
  }

  if (!value || typeof value !== 'object') return fallback

  const source = value as Partial<AllergyProfileExtractionResult>
  const allergies = Array.isArray(source.allergies)
    ? Array.from(
        new Set(
          source.allergies
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0 && item.length <= 40),
        ),
      )
    : []
  const confidence = source.confidence === 'high' || source.confidence === 'medium' || source.confidence === 'low' ? source.confidence : 'low'
  const hasPositiveFindings = typeof source.hasPositiveFindings === 'boolean' ? source.hasPositiveFindings : allergies.length > 0
  const notes = typeof source.notes === 'string' && source.notes.trim() ? source.notes.trim() : fallback.notes

  return { allergies, hasPositiveFindings, confidence, notes }
}

function extractJson(text: string) {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) return fenced[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)

  throw new Error('AI 응답에서 JSON 객체를 찾지 못했습니다.')
}

function getModelFallbacks() {
  return Array.from(new Set([import.meta.env.VITE_GEMINI_MODEL || PRIMARY_MODEL, ...DEFAULT_MODELS].filter(Boolean)))
}

function isQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()
  return message.includes('RESOURCE_EXHAUSTED') || message.includes('429') || lowerMessage.includes('quota')
}

function getGeminiErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  if (isQuotaError(error)) {
    const retrySeconds = message.match(/retry(?:Delay)?["']?\s*:\s*["']?(\d+(?:\.\d+)?)s?/i)?.[1]
    return retrySeconds
      ? `Gemini API 사용량 한도를 초과했습니다. 약 ${Math.ceil(Number(retrySeconds))}초 후 다시 시도하거나 API 할당량/결제 설정을 확인해 주세요.`
      : 'Gemini API 사용량 한도를 초과했습니다. 잠시 후 다시 시도하거나 API 할당량/결제 설정을 확인해 주세요.'
  }

  if (message.includes('API_KEY') || lowerMessage.includes('api key')) {
    return 'Gemini API 키를 확인해 주세요. .env의 VITE_GEMINI_API_KEY 설정이 필요합니다.'
  }

  return message
}

export async function analyzeIngredientImage(imageDataUrl: string, allergies: string[]): Promise<AnalysisResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const { data, mimeType } = splitDataUrl(imageDataUrl)
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })
  const models = getModelFallbacks()
  const prompt = buildIngredientAnalysisPrompt(allergies)

  let rawText = ''
  let lastError: unknown = null

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      })
      rawText = response.text ?? ''
      break
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const canTryNextModel = message.includes('NOT_FOUND') || message.includes('not found') || message.includes('not supported')
      const canTryQuotaFallback = isQuotaError(error) && model !== QUOTA_FALLBACK_MODEL && models.includes(QUOTA_FALLBACK_MODEL)
      if (canTryQuotaFallback) {
        console.warn(`Gemini quota exceeded for ${model}. Retrying with ${QUOTA_FALLBACK_MODEL}.`)
        continue
      }
      if (!canTryNextModel) throw new Error(getGeminiErrorMessage(error))
    }
  }

  if (!rawText) {
    throw new Error(lastError ? getGeminiErrorMessage(lastError) : 'Gemini 모델 호출에 실패했습니다.')
  }

  try {
    return normalizeResult(JSON.parse(extractJson(rawText)))
  } catch (error) {
    throw new Error(error instanceof Error ? `AI 응답 JSON 파싱 실패: ${error.message}` : 'AI 응답 JSON 파싱에 실패했습니다.')
  }
}

export async function extractAllergiesFromProfileImage(imageDataUrl: string): Promise<AllergyProfileExtractionResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const { data, mimeType } = splitDataUrl(imageDataUrl)
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })
  const models = getModelFallbacks()
  const prompt = buildAllergyProfileExtractionPrompt()

  let rawText = ''
  let lastError: unknown = null

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      })
      rawText = response.text ?? ''
      break
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const canTryNextModel = message.includes('NOT_FOUND') || message.includes('not found') || message.includes('not supported')
      const canTryQuotaFallback = isQuotaError(error) && model !== QUOTA_FALLBACK_MODEL && models.includes(QUOTA_FALLBACK_MODEL)
      if (canTryQuotaFallback) {
        console.warn(`Gemini quota exceeded for ${model}. Retrying with ${QUOTA_FALLBACK_MODEL}.`)
        continue
      }
      if (!canTryNextModel) throw new Error(getGeminiErrorMessage(error))
    }
  }

  if (!rawText) {
    throw new Error(lastError ? getGeminiErrorMessage(lastError) : 'Gemini 모델 호출에 실패했습니다.')
  }

  try {
    return normalizeAllergyProfileResult(JSON.parse(extractJson(rawText)))
  } catch (error) {
    console.warn('AI allergy profile response parse failed', error)
    return {
      allergies: [],
      hasPositiveFindings: false,
      confidence: 'low',
      notes: '검사표를 읽었지만 자동 입력할 양성 항목을 확정하지 못했습니다. 필요하면 직접 선택해 주세요.',
    }
  }
}
