import { XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { analyzeIngredientImage } from '@/lib/gemini'
import { createId } from '@/lib/ids'
import { speak } from '@/lib/speech'
import { useAppStore } from '@/store/useAppStore'
import type { AnalysisResult } from '@/types'

export function AnalyzingScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasStarted = useRef(false)
  const isCanceled = useRef(false)
  const returnMode = (location.state as { returnMode?: 'camera' | 'upload' } | null)?.returnMode === 'upload' ? 'upload' : 'camera'
  const currentUserId = useAppStore((state) => state.currentUserId)
  const capturedImage = useAppStore((state) => state.capturedImage)
  const sourceImage = useAppStore((state) => state.sourceImage)
  const allergies = useAppStore((state) => state.allergies)
  const accessibility = useAppStore((state) => state.accessibility)
  const setAnalysisResult = useAppStore((state) => state.setAnalysisResult)
  const setIsAnalyzing = useAppStore((state) => state.setIsAnalyzing)
  const addScanResult = useAppStore((state) => state.addScanResult)
  const showToast = useAppStore((state) => state.showToast)
  const resetScan = useAppStore((state) => state.resetScan)

  useEffect(() => {
    if (!capturedImage) {
      navigate('/camera', { replace: true })
      return
    }
    if (!currentUserId) {
      navigate('/', { replace: true })
      return
    }
    if (hasStarted.current) return
    hasStarted.current = true

    async function runAnalysis() {
      setIsAnalyzing(true)
      speak('성분표를 분석 중입니다. 잠시만 기다려 주세요.', accessibility.ttsEnabled)
      try {
        const result = await analyzeIngredientImage(capturedImage, allergies)
        if (isCanceled.current) return
        if (result.analysisIssue) {
          const message = `${result.analysisIssue.title} ${result.analysisIssue.message}`
          showToast(message, 'error')
          speak(message, accessibility.ttsEnabled)
          resetScan()
          navigate('/camera', { replace: true, state: { initialMode: returnMode } })
          return
        }

        setAnalysisResult(result)
        addScanResult({
          id: createId(),
          userId: currentUserId,
          imageData: sourceImage ?? capturedImage,
          status: result.status,
          detectedIngredients: result.detectedIngredients,
          imageAssessment: result.imageAssessment,
          analysisIssue: result.analysisIssue,
          scannedAt: new Date().toISOString(),
        })
        navigate('/result', { replace: true })
      } catch (error) {
        if (isCanceled.current) return
        const message = error instanceof Error ? error.message : '이미지 분석 중 오류가 발생했습니다.'
        console.error(error)
        showToast(message, 'error')
        const failedResult: AnalysisResult = {
          status: 'warning',
          imageAssessment: {
            isIngredientLabel: false,
            confidence: 'low',
            qualityIssues: ['API 오류'],
            reason: '이미지 분석 요청이 정상적으로 완료되지 않았습니다.',
          },
          analysisIssue: {
            type: 'api_error',
            title: '분석을 완료하지 못했습니다.',
            message,
          },
          detectedIngredients: [],
        }
        setAnalysisResult(failedResult)
        addScanResult({
          id: createId(),
          userId: currentUserId,
          imageData: sourceImage ?? capturedImage,
          status: failedResult.status,
          detectedIngredients: failedResult.detectedIngredients,
          imageAssessment: failedResult.imageAssessment,
          analysisIssue: failedResult.analysisIssue,
          scannedAt: new Date().toISOString(),
        })
        navigate('/result', { replace: true })
      } finally {
        setIsAnalyzing(false)
      }
    }

    void runAnalysis()
  }, [
    accessibility.ttsEnabled,
    addScanResult,
    allergies,
    capturedImage,
    currentUserId,
    navigate,
    resetScan,
    returnMode,
    setAnalysisResult,
    setIsAnalyzing,
    showToast,
    sourceImage,
  ])

  const handleCancel = () => {
    isCanceled.current = true
    setIsAnalyzing(false)
    resetScan()
    showToast('분석을 취소했습니다.', 'info')
    navigate('/camera', { replace: true, state: { initialMode: returnMode } })
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-black text-white">
      <div className="absolute left-0 right-0 top-0 z-20 flex justify-end p-5">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full border border-white/60 bg-white text-slate-950 shadow-xl hover:bg-red-50 hover:text-red-700"
          onClick={handleCancel}
        >
          <XCircle className="h-6 w-6" />
          분석 취소
        </Button>
      </div>
      {capturedImage && <img src={capturedImage} alt="촬영된 성분표" className="absolute inset-0 h-full w-full object-cover opacity-75" />}
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" />
      <div className="absolute inset-x-6 top-1/2 aspect-[3/4] max-h-[72svh] -translate-y-1/2 overflow-hidden rounded-[28px] border border-lime-200/70 md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2">
        <motion.div
          className="absolute left-0 right-0 h-1 bg-lime-300 shadow-[0_0_24px_8px_rgba(190,242,100,0.65)]"
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(190,242,100,0.12),transparent)]" />
      </div>
      <div className="absolute bottom-12 left-0 right-0 px-6 text-center">
        <p className="text-sm font-medium text-lime-100">이미지 유형과 글자 인식 품질을 확인하는 중</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">분석 중...</h1>
      </div>
    </main>
  )
}
