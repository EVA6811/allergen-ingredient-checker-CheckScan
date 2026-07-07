import { ArrowLeft, Camera, MonitorSmartphone, ShieldCheck, Smartphone, TabletSmartphone, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store/useAppStore'

type TestMode = 'camera' | 'upload'
type MobileFrameId = 'small' | 'regular' | 'large'

const MOBILE_FRAMES: Record<
  MobileFrameId,
  {
    id: MobileFrameId
    label: string
    description: string
    width: number
    height: number
    Icon: typeof Smartphone
  }
> = {
  small: {
    id: 'small',
    label: '소형 모바일',
    description: '가장 좁은 모바일 폭에서 버튼 겹침과 촬영 영역을 확인합니다.',
    width: 320,
    height: 568,
    Icon: Smartphone,
  },
  regular: {
    id: 'regular',
    label: '일반 모바일',
    description: '일반적인 스마트폰 화면에서 촬영/업로드 화면을 확인합니다.',
    width: 360,
    height: 740,
    Icon: MonitorSmartphone,
  },
  large: {
    id: 'large',
    label: '대형 모바일',
    description: '큰 스마트폰 화면에서 상단/하단 조작 영역을 확인합니다.',
    width: 390,
    height: 844,
    Icon: TabletSmartphone,
  },
}

const FRAME_LIST = Object.values(MOBILE_FRAMES)

export function MobileTestScreen() {
  const navigate = useNavigate()
  const { frameId } = useParams()
  const [mode, setMode] = useState<TestMode>('camera')
  const accounts = useAppStore((state) => state.accounts)
  const currentUserId = useAppStore((state) => state.currentUserId)
  const accessibility = useAppStore((state) => state.accessibility)
  const showToast = useAppStore((state) => state.showToast)
  const account = accounts.find((item) => item.id === currentUserId)
  const isAdmin = Boolean(account?.isAdmin)
  const selectedFrame = useMemo(() => {
    if (!frameId) return null
    return MOBILE_FRAMES[frameId as MobileFrameId] ?? null
  }, [frameId])

  useEffect(() => {
    if (!currentUserId) {
      navigate('/', { replace: true })
      return
    }

    if (!isAdmin) {
      showToast('모바일 화면 테스트는 관리자 계정에서만 사용할 수 있습니다.', 'error')
      navigate('/camera', { replace: true })
      return
    }

    if (frameId && !selectedFrame) {
      showToast('지원하지 않는 모바일 테스트 크기입니다.', 'error')
      navigate('/mobile-test', { replace: true })
    }
  }, [currentUserId, frameId, isAdmin, navigate, selectedFrame, showToast])

  if (!currentUserId || !isAdmin) return null

  if (selectedFrame) {
    return (
      <main className="min-h-svh bg-slate-950 px-4 py-5 text-white">
        <div className="mx-auto w-full max-w-5xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate('/mobile-test')}>
              <ArrowLeft className="h-6 w-6" />
              모바일 테스트 화면으로 돌아가기
            </Button>
            <Badge variant="secondary" className="gap-2 px-3 py-1.5">
              <ShieldCheck className="h-5 w-5" />
              관리자 전용
            </Badge>
          </header>

          <Card className="mb-5 border-white/10 bg-white/10 text-white">
            <CardHeader>
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-400 text-emerald-950">
                <selectedFrame.Icon className="h-8 w-8" />
              </div>
              <CardTitle>{selectedFrame.label}</CardTitle>
              <CardDescription className="text-white/70">
                {selectedFrame.width} x {selectedFrame.height} 화면에서 현재 글자 크기 설정({accessibility.fontScale})을 적용한 화면을 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={mode === 'camera' ? 'default' : 'secondary'} onClick={() => setMode('camera')}>
                  <Camera className="h-6 w-6" />
                  촬영 화면
                </Button>
                <Button type="button" variant={mode === 'upload' ? 'default' : 'secondary'} onClick={() => setMode('upload')}>
                  <Upload className="h-6 w-6" />
                  업로드 화면
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="rounded-lg border border-white/10 bg-white/10 p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{mode === 'camera' ? '촬영 화면 테스트' : '업로드 화면 테스트'}</h2>
                <p className="text-sm text-white/65">{selectedFrame.description}</p>
              </div>
              <Badge variant="outline" className="border-white/25 text-white">
                {mode === 'camera' ? '촬영' : '업로드'}
              </Badge>
            </div>

            <div className="overflow-x-auto pb-2">
              <div
                className="mx-auto overflow-hidden rounded-[24px] border border-white/20 bg-black shadow-xl"
                style={{ width: selectedFrame.width, height: selectedFrame.height }}
              >
                <iframe
                  title={`${selectedFrame.label} ${mode}`}
                  src={`/camera?mobileTest=1&mode=${mode}&frame=${selectedFrame.id}`}
                  className="h-full w-full border-0"
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-slate-950 px-4 py-5 text-white">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate('/profile')}>
            <ArrowLeft className="h-6 w-6" />
            프로필로 돌아가기
          </Button>
          <Badge variant="secondary" className="gap-2 px-3 py-1.5">
            <ShieldCheck className="h-5 w-5" />
            관리자 전용
          </Badge>
        </header>

        <Card className="mb-5 border-white/10 bg-white/10 text-white">
          <CardHeader>
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-400 text-emerald-950">
              <Smartphone className="h-8 w-8" />
            </div>
            <CardTitle>모바일 화면 테스트</CardTitle>
            <CardDescription className="text-white/70">
              확인할 모바일 크기를 선택하면 해당 화면으로 이동합니다. 한 번에 하나의 테스트 화면만 표시합니다.
            </CardDescription>
          </CardHeader>
        </Card>

        <section className="grid gap-4 md:grid-cols-3">
          {FRAME_LIST.map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => navigate(`/mobile-test/${frame.id}`)}
              className="rounded-lg border border-white/10 bg-white/10 p-5 text-left shadow-2xl transition hover:border-emerald-300 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <frame.Icon className="mb-4 h-10 w-10 text-emerald-300" />
              <h2 className="text-lg font-semibold">{frame.label}</h2>
              <p className="mt-1 text-sm text-white/65">
                {frame.width} x {frame.height}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/75">{frame.description}</p>
            </button>
          ))}
        </section>
      </div>
    </main>
  )
}
