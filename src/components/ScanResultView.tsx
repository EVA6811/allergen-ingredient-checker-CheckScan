import { AlertTriangle, CheckCircle2, RefreshCcw, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { speak } from '@/lib/speech'
import { useAppStore } from '@/store/useAppStore'
import type { AnalysisIssue, DetectedIngredient, ImageAssessment, RiskStatus } from '@/types'

type ScanResultViewProps = {
  imageData: string
  status: RiskStatus
  detectedIngredients: DetectedIngredient[]
  imageAssessment?: ImageAssessment
  analysisIssue?: AnalysisIssue | null
  footerActionLabel: string
  onFooterAction: () => void
  scannedAt?: string
}

const STATUS_COPY: Record<RiskStatus, { title: string; description: string; variant: 'destructive' | 'warning' | 'safe'; label: string }> = {
  danger: {
    title: '위험 성분 발견',
    description: '선택한 알레르기 또는 식이 제한과 직접 관련된 성분이 있습니다.',
    variant: 'destructive',
    label: '위험',
  },
  warning: {
    title: '주의 필요',
    description: '확인이 필요한 성분이 있거나 분석 신뢰도가 충분하지 않습니다.',
    variant: 'warning',
    label: '주의',
  },
  safe: {
    title: '안전',
    description: '현재 선택한 프로필 기준으로 위험 성분을 찾지 못했습니다.',
    variant: 'safe',
    label: '안전',
  },
}

const STATUS_ICON = {
  danger: ShieldAlert,
  warning: AlertTriangle,
  safe: CheckCircle2,
}

const RESULT_BACKGROUND: Record<RiskStatus, string> = {
  danger: 'bg-red-700 text-white',
  warning: 'bg-amber-400 text-slate-950',
  safe: 'bg-emerald-300 text-emerald-950',
}

const SOFT_RESULT_BACKGROUND: Record<RiskStatus, string> = {
  danger: 'bg-red-50 text-red-950',
  warning: 'bg-amber-50 text-amber-950',
  safe: 'bg-emerald-50 text-emerald-950',
}

const VISUAL_ICON: Record<RiskStatus, string> = {
  danger: '⚠️',
  warning: '!',
  safe: '✅',
}

const ISSUE_ICON: Record<AnalysisIssue['type'], string> = {
  not_ingredient_label: '？',
  low_image_quality: '!',
  insufficient_text: '!',
  api_error: '!',
}

const FONT_SCALE = {
  normal: {
    body: 'text-base',
    detail: 'text-sm',
    headline: 'text-3xl md:text-4xl',
    icon: 'text-7xl md:text-8xl',
  },
  large: {
    body: 'text-lg',
    detail: 'text-base',
    headline: 'text-4xl md:text-5xl',
    icon: 'text-8xl md:text-9xl',
  },
  xlarge: {
    body: 'text-xl',
    detail: 'text-lg',
    headline: 'text-5xl md:text-6xl',
    icon: 'text-8xl md:text-9xl',
  },
}

function getConclusion(status: RiskStatus, count: number, issue?: AnalysisIssue | null) {
  if (issue) {
    return {
      headline: issue.title,
      body: issue.message,
    }
  }

  if (status === 'danger') {
    return {
      headline: '섭취를 피하는 것이 좋습니다.',
      body: `사용자 프로필과 직접 관련된 위험 성분 ${count}개가 감지되었습니다. 제품 섭취 전 성분표를 다시 확인하고, 필요하면 전문가에게 문의하세요.`,
    }
  }

  if (status === 'warning') {
    return {
      headline: '추가 확인이 필요합니다.',
      body:
        count > 0
          ? `사용자 프로필과 관련 가능성이 있는 성분 ${count}개가 감지되었습니다. 조리 상태, 파생물 여부, 표시 기준이 불명확할 수 있습니다.`
          : '이미지 품질이나 표시 정보가 충분하지 않아 안전 여부를 확정하기 어렵습니다.',
    }
  }

  return {
    headline: '현재 설정 기준으로 뚜렷한 위험 성분은 없습니다.',
    body: '다만 OCR 분석 결과이므로 실제 섭취 전 제품 포장지의 원재료명과 알레르기 표시를 직접 확인하세요.',
  }
}

function getVisualHeadline(status: RiskStatus, detectedIngredients: DetectedIngredient[], issue?: AnalysisIssue | null) {
  if (issue) return issue.title
  const firstName = detectedIngredients[0]?.name
  if (status === 'danger') return firstName ? `주의! ${firstName}이(가) 포함되어 있습니다!` : '주의! 위험 성분이 포함되어 있습니다!'
  if (status === 'warning') return '주의가 필요한 성분이 있습니다'
  return '설정하신 위험 성분이 없습니다'
}

function getSpokenResult(status: RiskStatus, detectedIngredients: DetectedIngredient[], issue?: AnalysisIssue | null) {
  if (issue) return `${issue.title} ${issue.message}`
  const names = detectedIngredients.map((ingredient) => ingredient.name).filter(Boolean).join(', ')
  if (status === 'danger') return names ? `주의. ${names}이(가) 포함되어 있습니다. 섭취를 피하는 것이 좋습니다.` : '주의. 위험 성분이 감지되었습니다.'
  if (status === 'warning') return names ? `주의가 필요합니다. ${names} 성분을 확인해 주세요.` : '주의가 필요합니다. 제품 성분표를 다시 확인해 주세요.'
  return '설정하신 위험 성분이 없습니다.'
}

function getIngredientRiskBadge(ingredient: DetectedIngredient, status: RiskStatus) {
  const reason = ingredient.reason
  if (reason.includes('정확히 일치') || reason.includes('직접')) {
    return {
      label: '직접 일치',
      description: '프로필 조건과 바로 연결되는 성분입니다.',
      className: 'border-red-200 bg-red-50 text-red-700',
    }
  }

  if (reason.includes('파생')) {
    return {
      label: '파생 성분',
      description: '프로필 조건에서 유래한 성분으로 볼 수 있습니다.',
      className: 'border-red-200 bg-red-50 text-red-700',
    }
  }

  if (
    reason.includes('관련 가능') ||
    reason.includes('조건 불명확') ||
    reason.includes('불명확') ||
    reason.includes('확인 필요') ||
    reason.includes('조리 상태') ||
    reason.includes('단정')
  ) {
    return {
      label: '확인 필요',
      description: '조건과의 관계를 추가로 확인해야 합니다.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    }
  }

  return status === 'danger'
    ? {
        label: '위험 성분',
        description: '프로필 기준으로 피해야 할 가능성이 높은 성분입니다.',
        className: 'border-red-200 bg-red-50 text-red-700',
      }
    : {
        label: '관련 가능성',
        description: '프로필 조건과 관련 가능성이 있어 확인이 필요합니다.',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
      }
}

function getIngredientSummary(detectedIngredients: DetectedIngredient[], issue?: AnalysisIssue | null) {
  if (issue) return issue.title
  if (detectedIngredients.length === 0) return '위험 성분 없음'
  return detectedIngredients
    .slice(0, 3)
    .map((ingredient) => ingredient.name)
    .join(', ')
}

export function ScanResultView({
  imageData,
  status,
  detectedIngredients,
  imageAssessment,
  analysisIssue,
  footerActionLabel,
  onFooterAction,
  scannedAt,
}: ScanResultViewProps) {
  const hasIssue = Boolean(analysisIssue)
  const copy = hasIssue
    ? {
        title: '이미지 확인 필요',
        description: analysisIssue?.message ?? '성분표 이미지인지 확인이 필요합니다.',
        variant: 'warning' as const,
        label: '확인 필요',
      }
    : STATUS_COPY[status]
  const conclusion = getConclusion(status, detectedIngredients.length, analysisIssue)
  const Icon = STATUS_ICON[status]
  const accessibility = useAppStore((state) => state.accessibility)
  const scale = FONT_SCALE[accessibility.fontScale]
  const resultBackground = accessibility.highContrast ? RESULT_BACKGROUND[status] : SOFT_RESULT_BACKGROUND[status]
  const visualHeadline = getVisualHeadline(status, detectedIngredients, analysisIssue)
  const visualIcon = analysisIssue ? ISSUE_ICON[analysisIssue.type] : VISUAL_ICON[status]

  useEffect(() => {
    speak(getSpokenResult(status, detectedIngredients, analysisIssue), accessibility.ttsEnabled)
  }, [accessibility.ttsEnabled, analysisIssue, detectedIngredients, status])

  return (
    <main className={`min-h-svh px-4 py-5 ${resultBackground}`}>
      <div className="mx-auto w-full max-w-5xl">
        <motion.section
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 grid gap-4 rounded-lg border border-current/20 bg-white/15 p-5 shadow-xl backdrop-blur md:grid-cols-[auto,1fr]"
          aria-live="polite"
        >
          <div className={`${scale.icon} leading-none`} aria-hidden="true">
            {visualIcon}
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <p className={`font-black leading-tight tracking-normal ${scale.headline}`}>{visualHeadline}</p>
            <p className={`mt-3 max-w-3xl font-semibold leading-7 ${scale.body}`}>{conclusion.headline}</p>
          </div>
        </motion.section>

        <Alert variant={copy.variant} className="mb-4 text-left">
          <div className="flex gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <AlertTitle>{copy.title}</AlertTitle>
              <AlertDescription>
                {copy.description}
                {scannedAt && <span className="mt-1 block text-xs opacity-75">{new Date(scannedAt).toLocaleString('ko-KR')}</span>}
              </AlertDescription>
            </div>
          </div>
        </Alert>

        <section className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-950 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">판정</p>
            <p className={`mt-2 font-bold ${scale.body}`}>{copy.label}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-950 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">감지 성분</p>
            <p className={`mt-2 font-bold ${scale.body}`}>{hasIssue ? '분석 취소 대상' : `${detectedIngredients.length}개`}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-950 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">핵심 항목</p>
            <p className={`mt-2 truncate font-bold ${scale.body}`} title={getIngredientSummary(detectedIngredients, analysisIssue)}>
              {getIngredientSummary(detectedIngredients, analysisIssue)}
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
          <section className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-normal">종합 결론</h2>
              <Badge variant={status === 'danger' ? 'danger' : 'secondary'}>{copy.label}</Badge>
            </div>
            <p className={`font-semibold text-slate-950 ${scale.body}`}>{conclusion.headline}</p>
            <p className={`mt-2 leading-6 text-slate-600 ${scale.detail}`}>{conclusion.body}</p>
          </section>

          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-normal">{hasIssue ? '이미지 신뢰도' : '감지된 성분'}</h2>
            <p className={`mt-1 text-muted-foreground ${scale.detail}`}>
              {hasIssue ? '분석 전 이미지가 성분표인지, 글자를 읽을 수 있는지 확인한 결과입니다.' : '선택한 알레르기/식이 제한과 연관된 항목입니다.'}
            </p>
          </div>
          <div className="space-y-3">
            {hasIssue ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <p className={`font-semibold ${scale.body}`}>{analysisIssue?.title}</p>
                <p className={`mt-2 leading-6 ${scale.detail}`}>{analysisIssue?.message}</p>
                {imageAssessment && (
                  <div className={`mt-4 space-y-2 border-t border-amber-200 pt-3 ${scale.detail}`}>
                    <p>성분표 판단: {imageAssessment.isIngredientLabel ? '가능성이 있음' : '성분표로 보기 어려움'}</p>
                    <p>신뢰도: {imageAssessment.confidence}</p>
                    {imageAssessment.qualityIssues.length > 0 && <p>품질 이슈: {imageAssessment.qualityIssues.join(', ')}</p>}
                    <p>{imageAssessment.reason}</p>
                  </div>
                )}
              </div>
            ) : detectedIngredients.length > 0 ? (
              detectedIngredients.map((ingredient, index) => {
                const riskBadge = getIngredientRiskBadge(ingredient, status)
                return (
                  <div key={`${ingredient.name}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{ingredient.name}</h3>
                      <span className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${riskBadge.className}`}>
                        {riskBadge.label}
                      </span>
                    </div>
                    <p className={`mb-2 leading-6 text-slate-700 ${scale.detail}`}>{riskBadge.description}</p>
                    <p className={`leading-6 text-slate-600 ${scale.detail}`}>{ingredient.reason}</p>
                  </div>
                )
              })
            ) : (
              <div className={`rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 ${scale.detail}`}>
                위험 성분이 감지되지 않았습니다.
              </div>
            )}
          </div>
          <Button className="mt-5 w-full" size="lg" onClick={onFooterAction}>
            <RefreshCcw className="h-4 w-4" />
            {footerActionLabel}
          </Button>
        </section>

        <section className="mt-4">
          <h2 className="mb-3 text-lg font-semibold tracking-normal">분석한 이미지</h2>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative min-h-[420px] overflow-hidden rounded-lg border border-white/20 bg-black shadow-2xl"
          >
            <img src={imageData} alt="분석된 성분표" className="h-full max-h-[78svh] min-h-[420px] w-full object-contain" />
          </motion.div>
        </section>
      </div>
    </main>
  )
}
