import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ScanResultView } from '@/components/ScanResultView'
import { useAppStore } from '@/store/useAppStore'

export function HistoryDetailScreen() {
  const navigate = useNavigate()
  const { scanId } = useParams()
  const currentUserId = useAppStore((state) => state.currentUserId)
  const scanHistory = useAppStore((state) => state.scanHistory)
  const scan = scanHistory.find((item) => item.id === scanId)

  useEffect(() => {
    if (!currentUserId) {
      navigate('/', { replace: true })
      return
    }
    if (!scan) {
      navigate('/history', { replace: true })
    }
  }, [currentUserId, navigate, scan])

  if (!scan) return null

  return (
    <ScanResultView
      imageData={scan.imageData}
      status={scan.status}
      detectedIngredients={scan.detectedIngredients}
      imageAssessment={scan.imageAssessment}
      analysisIssue={scan.analysisIssue}
      scannedAt={scan.scannedAt}
      footerActionLabel="기록 목록으로 돌아가기"
      onFooterAction={() => navigate('/history')}
    />
  )
}
