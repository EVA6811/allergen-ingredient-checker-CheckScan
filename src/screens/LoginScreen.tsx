import { KeyRound, LogIn, Search, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store/useAppStore'

type AuthMode = 'login' | 'register' | 'findId' | 'findPassword'

const modeCopy: Record<AuthMode, { title: string; description: string; submit: string }> = {
  login: {
    title: '로그인',
    description: '개인 계정으로 검사 설정과 스캔 기록을 불러옵니다.',
    submit: '로그인',
  },
  register: {
    title: '계정 생성',
    description: '아이디, 비밀번호, 이름, 전화번호를 등록한 뒤 개인 설정을 시작합니다.',
    submit: '계정 생성 후 설정하기',
  },
  findId: {
    title: '아이디 찾기',
    description: '가입할 때 입력한 이름과 전화번호가 일치하면 아이디 일부를 보여줍니다.',
    submit: '아이디 확인',
  },
  findPassword: {
    title: '비밀번호 찾기',
    description: '이름, 전화번호, 전체 아이디가 일치하면 비밀번호 일부를 보여줍니다.',
    submit: '비밀번호 확인',
  },
}

export function LoginScreen() {
  const navigate = useNavigate()
  const currentUserId = useAppStore((state) => state.currentUserId)
  const allergies = useAppStore((state) => state.allergies)
  const login = useAppStore((state) => state.login)
  const register = useAppStore((state) => state.register)
  const findUsername = useAppStore((state) => state.findUsername)
  const findPassword = useAppStore((state) => state.findPassword)
  const showToast = useAppStore((state) => state.showToast)
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [lookupValue, setLookupValue] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUserId) return
    navigate(allergies.length > 0 ? '/camera' : '/profile', { replace: true })
  }, [allergies.length, currentUserId, navigate])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setLookupValue(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (mode === 'findId') {
      const result = findUsername(name, phone)
      setLookupValue(result.ok ? result.maskedValue ?? null : null)
      showToast(result.message, result.ok ? 'info' : 'error')
      return
    }

    if (mode === 'findPassword') {
      const result = findPassword(username, name, phone)
      setLookupValue(result.ok ? result.maskedValue ?? null : null)
      showToast(result.message, result.ok ? 'info' : 'error')
      return
    }

    const result = mode === 'login' ? login(username, password) : register(username, password, name, phone)
    showToast(result.message, result.ok ? 'info' : 'error')
    if (!result.ok) return
    navigate('/profile')
  }

  const needsNamePhone = mode === 'register' || mode === 'findId' || mode === 'findPassword'
  const needsUsername = mode === 'login' || mode === 'register' || mode === 'findPassword'
  const needsPassword = mode === 'login' || mode === 'register'

  return (
    <main className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_top_left,#bbf7d0_0,#f8fafc_36%,#eef2ff_100%)] p-5">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>체크스캔 (CheckScan)</CardTitle>
          <CardDescription className="mt-2">
            계정별로 알레르기 설정, 접근성 설정, 업로드 사진과 스캔 기록을 저장합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            <Button type="button" variant={mode === 'login' ? 'default' : 'ghost'} onClick={() => switchMode('login')}>
              <LogIn className="h-6 w-6" />
              로그인
            </Button>
            <Button type="button" variant={mode === 'register' ? 'default' : 'ghost'} onClick={() => switchMode('register')}>
              <UserPlus className="h-6 w-6" />
              계정 생성
            </Button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2">
            <Button type="button" variant={mode === 'findId' ? 'secondary' : 'outline'} onClick={() => switchMode('findId')}>
              <Search className="h-6 w-6" />
              아이디 찾기
            </Button>
            <Button
              type="button"
              variant={mode === 'findPassword' ? 'secondary' : 'outline'}
              onClick={() => switchMode('findPassword')}
            >
              <KeyRound className="h-6 w-6" />
              비밀번호 찾기
            </Button>
          </div>

          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-base font-semibold text-slate-950">{modeCopy[mode].title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{modeCopy[mode].description}</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {needsNamePhone && (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">이름</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                    autoComplete="name"
                    placeholder="예: 홍길동"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">전화번호</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="예: 010-1234-5678"
                  />
                </label>
              </>
            )}

            {needsUsername && (
              <label className="block space-y-2">
                <span className="text-sm font-medium">아이디</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                  autoComplete="username"
                  placeholder="예: minsu"
                />
              </label>
            )}

            {needsPassword && (
              <label className="block space-y-2">
                <span className="text-sm font-medium">비밀번호</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="4자 이상"
                />
              </label>
            )}

            {lookupValue && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" aria-live="polite">
                <span className="text-emerald-700">{mode === 'findId' ? '확인된 아이디' : '확인된 비밀번호'}</span>
                <strong className="ml-2 text-base">{lookupValue}</strong>
              </div>
            )}

            <Button className="w-full" size="lg" type="submit">
              {modeCopy[mode].submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
