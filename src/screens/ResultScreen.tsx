import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { ScanResultView } from '@/components/ScanResultView'
import { useAppStore } from '@/store/useAppStore'

export function ResultScreen() {
  const navigate = useNavigate()
  const currentUserId = useAppStore((state) => state.currentUserId)
  const capturedImage = useAppStore((state) => state.capturedImage)
  const sourceImage = useAppStore((state) => state.sourceImage)
  const result = useAppStore((state) => state.analysisResult)
  const resetScan = useAppStore((state) => state.resetScan)

  useEffect(() => {
    if (!currentUserId) {
      navigate('/', { replace: true })
      return
    }
    if (!capturedImage || !result) {
      navigate('/camera', { replace: true })
    }
  }, [capturedImage, currentUserId, navigate, result])

  if (!capturedImage || !result) return null

  const handleRetry = () => {
    resetScan()
    navigate('/camera')
  }

  return (
    <ScanResultView
      imageData={sourceImage ?? capturedImage}
      status={result.status}
      detectedIngredients={result.detectedIngredients}
      imageAssessment={result.imageAssessment}
      analysisIssue={result.analysisIssue}
      footerActionLabel="다시 촬영하기"
      onFooterAction={handleRetry}
    />
  )
}
