import { ArrowLeft, CalendarClock, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/store/useAppStore'
import type { RiskStatus } from '@/types'

const STATUS_META: Record<RiskStatus, { label: string; badge: 'danger' | 'warning' | 'safe' }> = {
  danger: { label: '위험', badge: 'danger' },
  warning: { label: '주의', badge: 'warning' },
  safe: { label: '안전', badge: 'safe' },
}

function getHistorySummary(scan: {
  status: RiskStatus
  detectedIngredients: { name: string }[]
  analysisIssue?: { title: string; message: string } | null
}) {
  if (scan.analysisIssue) {
    return {
      title: scan.analysisIssue.title,
      detail: scan.analysisIssue.message,
    }
  }

  if (scan.status === 'danger') {
    return {
      title: `위험 성분 ${scan.detectedIngredients.length}개`,
      detail: scan.detectedIngredients.map((item) => item.name).join(', '),
    }
  }

  if (scan.status === 'warning') {
    return {
      title: `확인 필요 성분 ${scan.detectedIngredients.length}개`,
      detail: scan.detectedIngredients.map((item) => item.name).join(', ') || '관련 가능성이 있지만 확정 근거가 부족합니다.',
    }
  }

  return {
    title: '위험 성분 없음',
    detail: '현재 프로필 기준으로 피해야 할 성분을 찾지 못했습니다.',
  }
}

export function HistoryScreen() {
  const navigate = useNavigate()
  const currentUserId = useAppStore((state) => state.currentUserId)
  const scanHistory = useAppStore((state) => state.scanHistory)
  const clearHistory = useAppStore((state) => state.clearHistory)
  const deleteScanResult = useAppStore((state) => state.deleteScanResult)
  const showToast = useAppStore((state) => state.showToast)

  useEffect(() => {
    if (!currentUserId) navigate('/', { replace: true })
  }, [currentUserId, navigate])

  if (!currentUserId) return null

  const handleClear = () => {
    clearHistory()
    showToast('스캔 기록을 모두 삭제했습니다.', 'info')
  }

  const handleDeleteOne = (scanId: string) => {
    deleteScanResult(scanId)
    showToast('선택한 스캔 기록을 삭제했습니다.', 'info')
  }

  return (
    <main className="min-h-svh bg-slate-50 px-4 py-5 text-slate-950">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/camera')}>
            <ArrowLeft className="h-7 w-7" />
            <span className="sr-only">카메라로 돌아가기</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-normal">스캔 기록</h1>
            <p className="text-sm text-muted-foreground">기록을 선택하면 원본 이미지와 분석 결과를 다시 볼 수 있습니다.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleClear} disabled={scanHistory.length === 0}>
            <Trash2 className="h-6 w-6" />
            모두 삭제
          </Button>
        </header>

        {scanHistory.length === 0 ? (
          <Alert>
            <CalendarClock className="mb-3 h-8 w-8" />
            <AlertTitle>저장된 기록이 없습니다</AlertTitle>
            <AlertDescription>성분표를 촬영하거나 업로드해서 분석하면 이곳에 기록됩니다.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {scanHistory.map((scan) => {
              const summary = getHistorySummary(scan)
              return (
                <Card key={scan.id} className="overflow-hidden transition hover:border-primary/50 hover:shadow-md">
                  <CardContent className="flex gap-4 p-4">
                    <button type="button" className="flex min-w-0 flex-1 gap-4 text-left" onClick={() => navigate(`/history/${scan.id}`)}>
                      <img src={scan.imageData} alt="스캔 썸네일" className="h-24 w-20 shrink-0 rounded-md bg-black object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Badge variant={scan.analysisIssue ? 'warning' : STATUS_META[scan.status].badge}>
                            {scan.analysisIssue ? '확인 필요' : STATUS_META[scan.status].label}
                          </Badge>
                          <time className="text-xs text-muted-foreground">{new Date(scan.scannedAt).toLocaleString('ko-KR')}</time>
                        </div>
                        <p className="text-sm font-semibold">{summary.title}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{summary.detail}</p>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-slate-500 hover:text-red-700"
                      onClick={() => handleDeleteOne(scan.id)}
                    >
                      <Trash2 className="h-6 w-6" />
                      <span className="sr-only">선택한 기록 삭제</span>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
