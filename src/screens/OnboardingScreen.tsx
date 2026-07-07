import { Camera, Eye, FileImage, Loader2, LogOut, Plus, ShieldCheck, Smartphone, Type, Volume2, X } from 'lucide-react'
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Webcam from 'react-webcam'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ALLERGY_PRESETS } from '@/constants/allergyPresets'
import { extractAllergiesFromProfileImage } from '@/lib/gemini'
import { normalizeImageFile } from '@/lib/imageProcessing'
import { speak } from '@/lib/speech'
import { useAppStore } from '@/store/useAppStore'
import type { AccessibilitySettings } from '@/types'

const profileCameraConstraints: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
}

export function OnboardingScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const webcamRef = useRef<Webcam>(null)
  const accounts = useAppStore((state) => state.accounts)
  const currentUserId = useAppStore((state) => state.currentUserId)
  const allergies = useAppStore((state) => state.allergies)
  const accessibility = useAppStore((state) => state.accessibility)
  const setAllergies = useAppStore((state) => state.setAllergies)
  const setAccessibility = useAppStore((state) => state.setAccessibility)
  const logout = useAppStore((state) => state.logout)
  const showToast = useAppStore((state) => state.showToast)
  const [selected, setSelected] = useState<string[]>(allergies)
  const [customValue, setCustomValue] = useState('')
  const [accessibilityDraft, setAccessibilityDraft] = useState<AccessibilitySettings>(accessibility)
  const [isProfileCameraOpen, setIsProfileCameraOpen] = useState(false)
  const [isExtractingAllergies, setIsExtractingAllergies] = useState(false)
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null)
  const [profileExtractionNote, setProfileExtractionNote] = useState<string | null>(null)

  const account = accounts.find((item) => item.id === currentUserId)
  const isAdmin = Boolean(account?.isAdmin)
  const isEmbedded = (() => {
    try {
      return window.self !== window.top
    } catch {
      return true
    }
  })()
  const isMobileTestContext = new URLSearchParams(location.search).get('mobileTest') === '1' || isEmbedded
  const customItems = useMemo(() => selected.filter((item) => !ALLERGY_PRESETS.includes(item as (typeof ALLERGY_PRESETS)[number])), [selected])

  if (!currentUserId) {
    navigate('/', { replace: true })
    return null
  }

  const addCustomItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = customValue.trim()
    if (!normalized) return
    if (selected.includes(normalized)) {
      showToast('이미 추가된 항목입니다.', 'info')
      setCustomValue('')
      return
    }
    setSelected((current) => [...current, normalized])
    setCustomValue('')
  }

  const removeItem = (item: string) => {
    setSelected((current) => current.filter((value) => value !== item))
  }

  const mergeExtractedAllergies = (items: string[]) => {
    const normalizedItems = items.map((item) => item.trim()).filter(Boolean)
    if (normalizedItems.length === 0) return 0

    const next = [...selected]
    normalizedItems.forEach((item) => {
      if (!next.some((value) => value.toLowerCase() === item.toLowerCase())) {
        next.push(item)
      }
    })
    setSelected(next)
    return next.length - selected.length
  }

  const analyzeProfileImage = async (imageData: string) => {
    setProfileImagePreview(imageData)
    setIsExtractingAllergies(true)
    setProfileExtractionNote(null)
    try {
      const result = await extractAllergiesFromProfileImage(imageData)
      const addedCount = mergeExtractedAllergies(result.allergies)
      setProfileExtractionNote(result.notes)
      if (result.allergies.length === 0) {
        showToast(result.hasPositiveFindings ? '자동 입력할 항목을 확정하지 못했습니다.' : result.notes, 'info')
        return
      }
      showToast(addedCount > 0 ? `${addedCount}개 항목을 자동 입력했습니다.` : '이미 선택된 항목과 동일합니다.', 'info')
      speak('알레르기 항목을 자동 입력했습니다. 저장 버튼을 눌러 확정해 주세요.', accessibilityDraft.ttsEnabled)
    } catch (error) {
      const message = error instanceof Error ? error.message : '알레르기 사진 분석 중 오류가 발생했습니다.'
      showToast(message, 'error')
      setProfileExtractionNote(message)
    } finally {
      setIsExtractingAllergies(false)
    }
  }

  const handleProfileImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const normalizedImage = await normalizeImageFile(file)
      await analyzeProfileImage(normalizedImage)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '이미지를 읽을 수 없습니다.', 'error')
    }
  }

  const captureProfileImage = () => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) {
      showToast('카메라 화면을 캡처할 수 없습니다. 브라우저 카메라 권한을 확인해 주세요.', 'error')
      return
    }
    void analyzeProfileImage(imageSrc)
  }

  const updateAccessibility = (patch: Partial<AccessibilitySettings>) => {
    setAccessibilityDraft((current) => ({
      ...current,
      ...patch,
    }))
  }

  const updateFontScale = (fontScale: AccessibilitySettings['fontScale']) => {
    setAccessibilityDraft((current) => ({
      ...current,
      fontScale,
      largeText: fontScale !== 'normal',
    }))
  }

  const testSpeech = () => {
    if (!accessibilityDraft.ttsEnabled) {
      showToast('음성 안내를 먼저 켜 주세요.', 'info')
      return
    }
    speak('음성 안내가 활성화되었습니다. 분석 결과를 소리로 안내합니다.', true)
  }

  const handleSave = () => {
    if (selected.length === 0) {
      showToast('알레르기나 식이 제한을 1개 이상 선택해 주세요.', 'error')
      return false
    }
    setAllergies(selected)
    setAccessibility(accessibilityDraft)
    showToast('개인 설정을 저장했습니다.', 'info')
    return true
  }

  const handleGoToCamera = () => {
    if (selected.length === 0) {
      showToast('촬영 화면으로 이동하려면 알레르기나 식이 제한을 1개 이상 저장해 주세요.', 'error')
      return
    }
    handleSave()
    navigate('/camera')
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <main className="flex min-h-svh items-start justify-center bg-[radial-gradient(circle_at_top_left,#d9f99d_0,#f8fafc_34%,#f8fafc_100%)] p-5 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {isAdmin && !isMobileTestContext && (
                <Button variant="outline" size="sm" onClick={() => navigate('/mobile-test')}>
                  <Smartphone className="h-5 w-5" />
                  모바일 테스트
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
                로그아웃
              </Button>
            </div>
          </div>
          <div>
            <CardTitle>개인 알레르기 설정</CardTitle>
            <CardDescription className="mt-2">{account?.username} 계정에 저장할 알레르기와 식이 제한을 선택하세요.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">프리셋</Badge>
              <span className="text-sm text-muted-foreground">주요 알레르기 유발 물질과 식이 제한</span>
            </div>
            <ToggleGroup type="multiple" value={selected} onValueChange={setSelected} className="justify-start">
              {ALLERGY_PRESETS.map((preset) => (
                <ToggleGroupItem key={preset} value={preset} size="sm" aria-label={`${preset} 선택`}>
                  {preset}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">직접 입력</Badge>
              <span className="text-sm text-muted-foreground">예: 두유, 새우, 생 갑각류, 아스파탐</span>
            </div>
            <form className="flex gap-2" onSubmit={addCustomItem}>
              <input
                value={customValue}
                onChange={(event) => setCustomValue(event.target.value)}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                placeholder="개인 알레르기 또는 제한 조건"
                aria-label="커스텀 알레르기 입력"
              />
              <Button type="submit" size="icon" aria-label="추가">
                <Plus className="h-6 w-6" />
              </Button>
            </form>
            {customItems.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customItems.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => removeItem(item)}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                  >
                    {item}
                    <X className="h-5 w-5" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">자동 입력</Badge>
                  <span className="text-sm font-medium text-emerald-950">알레르기 검사표 또는 관련 사진</span>
                </div>
                <p className="mt-2 text-sm leading-5 text-emerald-900">
                  검사표, 병원 문서, 보호자 메모 사진에서 명확한 알레르기/식이 제한 항목만 추출해 현재 목록에 추가합니다.
                </p>
              </div>
              {isExtractingAllergies && <Loader2 className="mt-1 h-7 w-7 shrink-0 animate-spin text-emerald-700" />}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
              <Button
                type="button"
                variant="outline"
                className="bg-white"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtractingAllergies}
              >
                <FileImage className="h-6 w-6" />
                사진 업로드
              </Button>
              <Button
                type="button"
                variant={isProfileCameraOpen ? 'secondary' : 'outline'}
                className={isProfileCameraOpen ? '' : 'bg-white'}
                onClick={() => setIsProfileCameraOpen((current) => !current)}
                disabled={isExtractingAllergies}
              >
                <Camera className="h-6 w-6" />
                {isProfileCameraOpen ? '카메라 닫기' : '사진 촬영'}
              </Button>
            </div>

            {isProfileCameraOpen && (
              <div className="space-y-3 rounded-lg border border-emerald-200 bg-white p-3">
                <div className="overflow-hidden rounded-md bg-black">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={profileCameraConstraints}
                    className="aspect-video w-full object-cover"
                  />
                </div>
                <Button type="button" className="w-full" onClick={captureProfileImage} disabled={isExtractingAllergies}>
                  <Camera className="h-6 w-6" />
                  검사표 촬영 후 자동 입력
                </Button>
              </div>
            )}

            {profileImagePreview && (
              <div className="grid gap-3 rounded-lg border border-emerald-200 bg-white p-3 sm:grid-cols-[112px,1fr]">
                <img src={profileImagePreview} alt="자동 입력에 사용한 알레르기 정보 사진" className="h-28 w-full rounded-md object-cover sm:w-28" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">분석한 사진</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {profileExtractionNote ?? '분석 결과가 이 화면의 선택 목록에 자동 반영됩니다.'}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white text-primary shadow-sm">
                <Eye className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">노약자 및 시각 약자 지원</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">계정별로 저장되며 분석 중 안내와 결과 화면에 적용됩니다.</p>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Volume2 className="h-6 w-6 text-slate-600" />
                TTS 음성 안내
              </span>
              <input
                type="checkbox"
                checked={accessibilityDraft.ttsEnabled}
                onChange={(event) => updateAccessibility({ ttsEnabled: event.target.checked })}
                className="h-5 w-5 accent-emerald-600"
                aria-label="TTS 음성 안내 사용"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Eye className="h-6 w-6 text-slate-600" />
                고대비 결과 화면
              </span>
              <input
                type="checkbox"
                checked={accessibilityDraft.highContrast}
                onChange={(event) => updateAccessibility({ highContrast: event.target.checked })}
                className="h-5 w-5 accent-emerald-600"
                aria-label="고대비 결과 화면 사용"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Type className="h-6 w-6 text-slate-600" />
                글자 크기
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'normal', label: '기본', iconClassName: 'h-5 w-5', labelClassName: 'text-sm' },
                  { value: 'large', label: '크게', iconClassName: 'h-7 w-7', labelClassName: 'text-base' },
                  { value: 'xlarge', label: '아주 크게', iconClassName: 'h-9 w-9', labelClassName: 'text-lg' },
                ].map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant={accessibilityDraft.fontScale === item.value ? 'default' : 'outline'}
                    className="h-auto min-h-20 flex-col gap-1.5 py-3"
                    onClick={() => updateFontScale(item.value as AccessibilitySettings['fontScale'])}
                  >
                    <Type className={item.iconClassName} />
                    <span className={item.labelClassName}>{item.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Button type="button" variant="secondary" className="w-full" onClick={testSpeech}>
              <Volume2 className="h-6 w-6" />
              음성 안내 테스트
            </Button>
          </section>
        </CardContent>
        <CardFooter className="gap-2">
          <Button className="flex-1" variant="outline" onClick={handleSave}>
            설정 저장
          </Button>
          <Button className="flex-1" onClick={handleGoToCamera}>
            촬영 화면으로 이동
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
