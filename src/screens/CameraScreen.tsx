import { Camera, History, RotateCcw, Upload, UserCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Webcam from 'react-webcam'

import { Button } from '@/components/ui/button'
import { UploadedImagePanel } from '@/features/camera/UploadedImagePanel'
import { createId } from '@/lib/ids'
import { getLocalUploadUrl, loadImageDataUrl, normalizeImageFile, saveImageToLocalUploads } from '@/lib/imageProcessing'
import { speak } from '@/lib/speech'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { UploadedImage } from '@/types'

const videoConstraints: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
}

type CaptureMode = 'camera' | 'upload'
type CameraPermissionState = 'unknown' | 'prompt' | 'checking' | 'granted' | 'denied' | 'unsupported'
type MobileFrameSize = 'small' | 'regular' | 'large'

const MOBILE_FRAME_SIZES = ['small', 'regular', 'large'] as const

const CAMERA_UI = {
  default: {
    modeTop: 'top-[104px] sm:top-4',
    modeText: 'text-sm',
    modeButton: 'gap-2 px-4 py-2',
    modeIcon: 'h-5 w-5',
    topPadding: 'p-5',
    navButton: 'h-14 w-14',
    navIcon: 'h-7 w-7',
    focusPadding: 'p-4',
    focusBox: 'w-[72vw] max-w-[390px] md:w-[min(78vw,390px)]',
    focusLabel: 'left-3 right-3 top-3 px-3 py-1 text-sm',
    focusCorner: 'h-10 w-10',
    captureWrap: 'px-6 pb-10 pt-16',
    captureButton: 'h-24 w-24',
    captureIcon: 'h-10 w-10',
    permissionIcon: 'h-14 w-14',
    permissionButtonIcon: 'h-6 w-6',
  },
  small: {
    modeTop: 'top-[76px]',
    modeText: 'text-xs',
    modeButton: 'gap-1.5 px-3 py-1.5',
    modeIcon: 'h-4 w-4',
    topPadding: 'p-3',
    navButton: 'h-10 w-10',
    navIcon: 'h-5 w-5',
    focusPadding: 'px-3 py-4',
    focusBox: 'w-[72vw] max-w-[250px]',
    focusLabel: 'left-2 right-2 top-2 px-2 py-1 text-[0.68rem]',
    focusCorner: 'h-7 w-7',
    captureWrap: 'px-4 pb-6 pt-10',
    captureButton: 'h-[4.5rem] w-[4.5rem]',
    captureIcon: 'h-7 w-7',
    permissionIcon: 'h-10 w-10',
    permissionButtonIcon: 'h-5 w-5',
  },
  regular: {
    modeTop: 'top-[88px]',
    modeText: 'text-sm',
    modeButton: 'gap-2 px-4 py-2',
    modeIcon: 'h-5 w-5',
    topPadding: 'p-4',
    navButton: 'h-12 w-12',
    navIcon: 'h-6 w-6',
    focusPadding: 'px-4 py-5',
    focusBox: 'w-[76vw] max-w-[300px]',
    focusLabel: 'left-3 right-3 top-3 px-3 py-1 text-xs',
    focusCorner: 'h-9 w-9',
    captureWrap: 'px-5 pb-8 pt-12',
    captureButton: 'h-[5.5rem] w-[5.5rem]',
    captureIcon: 'h-9 w-9',
    permissionIcon: 'h-12 w-12',
    permissionButtonIcon: 'h-5 w-5',
  },
  large: {
    modeTop: 'top-[96px]',
    modeText: 'text-base',
    modeButton: 'gap-2 px-5 py-2.5',
    modeIcon: 'h-6 w-6',
    topPadding: 'p-5',
    navButton: 'h-14 w-14',
    navIcon: 'h-7 w-7',
    focusPadding: 'px-5 py-6',
    focusBox: 'w-[78vw] max-w-[330px]',
    focusLabel: 'left-3 right-3 top-3 px-3 py-1.5 text-sm',
    focusCorner: 'h-10 w-10',
    captureWrap: 'px-6 pb-10 pt-16',
    captureButton: 'h-24 w-24',
    captureIcon: 'h-10 w-10',
    permissionIcon: 'h-14 w-14',
    permissionButtonIcon: 'h-6 w-6',
  },
} as const

function stopMediaStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

function getMobileFrameSize(value: string | null): MobileFrameSize | null {
  return MOBILE_FRAME_SIZES.includes(value as MobileFrameSize) ? (value as MobileFrameSize) : null
}

export function CameraScreen() {
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const requestedMode = searchParams.get('mode') === 'upload' ? 'upload' : searchParams.get('mode') === 'camera' ? 'camera' : null
  const isMobileTest = searchParams.get('mobileTest') === '1'
  const testFrameSize = isMobileTest ? getMobileFrameSize(searchParams.get('frame')) ?? 'regular' : null
  const cameraUi = testFrameSize ? CAMERA_UI[testFrameSize] : CAMERA_UI.default
  const stateMode = (location.state as { initialMode?: CaptureMode } | null)?.initialMode === 'upload' ? 'upload' : 'camera'
  const initialMode = requestedMode ?? stateMode
  const [mode, setMode] = useState<CaptureMode>(initialMode)
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>('unknown')
  const [cameraReady, setCameraReady] = useState(false)
  const navigate = useNavigate()
  const currentUserId = useAppStore((state) => state.currentUserId)
  const accounts = useAppStore((state) => state.accounts)
  const allergies = useAppStore((state) => state.allergies)
  const accessibility = useAppStore((state) => state.accessibility)
  const uploadedImages = useAppStore((state) => state.uploadedImages)
  const addUploadedImages = useAppStore((state) => state.addUploadedImages)
  const removeUploadedImage = useAppStore((state) => state.removeUploadedImage)
  const clearUploadedImages = useAppStore((state) => state.clearUploadedImages)
  const setCapturedImage = useAppStore((state) => state.setCapturedImage)
  const setSourceImage = useAppStore((state) => state.setSourceImage)
  const resetScan = useAppStore((state) => state.resetScan)
  const showToast = useAppStore((state) => state.showToast)
  const currentAccount = accounts.find((account) => account.id === currentUserId)
  const isAdminMobileTest = Boolean(currentAccount?.isAdmin && isMobileTest)

  useEffect(() => {
    if (!currentUserId) {
      navigate('/', { replace: true })
      return
    }
    if (allergies.length === 0 && !isAdminMobileTest) {
      navigate('/profile', { replace: true })
    }
  }, [allergies.length, currentUserId, isAdminMobileTest, navigate])

  useEffect(() => {
    if (mode !== 'camera') return
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermission('unsupported')
      return
    }

    let ignore = false
    async function checkPermissionState() {
      try {
        const status = await navigator.permissions?.query({ name: 'camera' as PermissionName })
        if (ignore || !status) return
        setCameraPermission(status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'prompt')
        status.onchange = () => {
          setCameraPermission(status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'prompt')
        }
      } catch {
        if (!ignore) setCameraPermission('prompt')
      }
    }

    void checkPermissionState()
    return () => {
      ignore = true
    }
  }, [mode])

  const saveLocalCopy = async (imageData: string, sourceName: string) => {
    try {
      const saved = await saveImageToLocalUploads(imageData, sourceName)
      return saved.fileName
    } catch {
      showToast('분석은 계속 진행하지만, 로컬 폴더 저장은 dev server에서만 지원됩니다.', 'info')
      return undefined
    }
  }

  const analyzeImage = async (imageSource: string, voiceGuide = '사진 분석을 시작합니다.', analysisImageData?: string) => {
    speak(voiceGuide, accessibility.ttsEnabled)
    try {
      const imageDataForAnalysis = analysisImageData ?? (await loadImageDataUrl(imageSource))
      setSourceImage(imageSource)
      setCapturedImage(imageDataForAnalysis)
      navigate('/analyzing', { state: { returnMode: mode } })
    } catch (error) {
      showToast(error instanceof Error ? error.message : '이미지를 분석할 수 없습니다.', 'error')
    }
  }

  const capture = async (imageSrc: string) => {
    const localFileName = await saveLocalCopy(imageSrc, 'camera-capture.jpg')
    const sourceImage = localFileName ? getLocalUploadUrl(localFileName) : imageSrc
    void analyzeImage(sourceImage, '사진을 촬영했습니다. 성분 분석을 시작합니다.', imageSrc)
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    showToast(`${files.length}개 이미지를 업로드 목록에 추가하는 중입니다.`, 'info')

    const processedImages: UploadedImage[] = []
    for (const file of files) {
      try {
        const normalizedImage = await normalizeImageFile(file)
        const localFileName = await saveLocalCopy(normalizedImage, file.name)
        const imageData = localFileName ? getLocalUploadUrl(localFileName) : normalizedImage
        processedImages.push({
          id: createId(),
          name: file.name,
          imageData,
          uploadedAt: new Date().toISOString(),
          localFileName,
        })
      } catch (error) {
        showToast(`${file.name}: ${error instanceof Error ? error.message : '업로드 실패'}`, 'error')
      }
    }

    if (processedImages.length > 0) {
      addUploadedImages(processedImages)
      setMode('upload')
      showToast(`${processedImages.length}개 이미지를 업로드했습니다. 분석할 사진을 선택해 주세요.`, 'info')
      speak('사진을 업로드했습니다. 분석할 사진을 선택해 주세요.', accessibility.ttsEnabled)
    }
  }

  const handleRemoveUploadedImage = (id: string) => {
    removeUploadedImage(id)
    showToast('업로드 목록에서 사진을 삭제했습니다.', 'info')
  }

  const requestCameraPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermission('unsupported')
      showToast('이 브라우저에서는 카메라 권한 요청을 지원하지 않습니다. 사진 업로드를 이용해 주세요.', 'error')
      return false
    }

    if (cameraPermission === 'denied') {
      showToast('카메라 권한이 이미 차단되어 브라우저가 권한 창을 다시 띄우지 않습니다. 주소창 왼쪽의 사이트 설정에서 카메라를 허용해 주세요.', 'error')
      return false
    }

    setCameraPermission('checking')
    showToast('카메라 권한을 확인해 주세요. 브라우저 권한 요청 창에서 허용을 선택해야 촬영할 수 있습니다.', 'info')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })
      stopMediaStream(stream)
      setCameraPermission('granted')
      setCameraReady(false)
      return true
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      const message =
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? '카메라 권한이 거부되었습니다. 브라우저 주소창의 권한 설정에서 카메라를 허용해 주세요.'
          : '카메라를 사용할 수 없습니다. PC 카메라 연결 상태와 브라우저 권한을 확인해 주세요.'
      setCameraPermission(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'denied' : 'unknown')
      showToast(message, 'error')
      return false
    }
  }

  const handleCaptureClick = async () => {
    if (cameraPermission !== 'granted') {
      const permitted = await requestCameraPermission()
      if (!permitted) return
      showToast('카메라 권한이 허용되었습니다. 카메라 화면이 준비되면 다시 촬영해 주세요.', 'info')
      return
    }

    let imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) {
      if (!cameraReady) {
        showToast('카메라 화면을 준비 중입니다. 잠시 후 다시 촬영해 주세요.', 'info')
        return
      }
      await new Promise((resolve) => window.setTimeout(resolve, 300))
      imageSrc = webcamRef.current?.getScreenshot()
    }

    if (!imageSrc) {
      showToast('카메라 권한을 허용한 뒤에도 화면을 캡처하지 못했습니다. 잠시 후 다시 촬영하거나 브라우저를 새로고침해 주세요.', 'error')
      return
    }

    await capture(imageSrc)
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-black text-white">
      {mode === 'camera' ? (
        <>
          {cameraPermission === 'granted' && (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="absolute inset-0 h-full w-full object-cover"
              onUserMedia={() => {
                setCameraReady(true)
                setCameraPermission('granted')
              }}
              onUserMediaError={() => {
                setCameraReady(false)
                setCameraPermission('denied')
                showToast('카메라를 열 수 없습니다. 브라우저 카메라 권한과 PC 카메라 연결 상태를 확인해 주세요.', 'error')
              }}
            />
          )}
          <div className="absolute inset-0 bg-black/20" />
          {cameraPermission !== 'granted' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65 px-5 text-center">
              <div className="w-full max-w-md rounded-lg border border-white/20 bg-white p-5 text-slate-950 shadow-2xl">
                <Camera className={cn('mx-auto mb-3 text-emerald-700', cameraUi.permissionIcon)} />
                <h1 className="text-xl font-semibold tracking-normal">카메라 권한이 필요합니다</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  촬영 버튼을 누르면 브라우저의 카메라 권한 요청 창이 열립니다. 이미 차단한 경우에는 주소창 왼쪽의 사이트 설정에서 카메라를 허용해야 합니다.
                </p>
                <Button type="button" className="mt-4 w-full" onClick={() => void requestCameraPermission()} disabled={cameraPermission === 'checking'}>
                  <Camera className={cameraUi.permissionButtonIcon} />
                  {cameraPermission === 'checking' ? '권한 확인 중' : '카메라 권한 요청'}
                </Button>
              </div>
            </div>
          )}
          <div className={cn('pointer-events-none absolute inset-0 flex items-center justify-center', cameraUi.focusPadding)}>
            <div
              className={cn(
                'relative aspect-[3/4] rounded-[28px] border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]',
                cameraUi.focusBox,
              )}
            >
              <div className={cn('absolute rounded-full bg-black/35 text-center font-medium text-white/90 backdrop-blur', cameraUi.focusLabel)}>
                성분표를 프레임 안에 맞춰주세요
              </div>
              <div className={cn('absolute left-5 top-5 rounded-tl-2xl border-l-4 border-t-4 border-lime-300', cameraUi.focusCorner)} />
              <div className={cn('absolute right-5 top-5 rounded-tr-2xl border-r-4 border-t-4 border-lime-300', cameraUi.focusCorner)} />
              <div className={cn('absolute bottom-5 left-5 rounded-bl-2xl border-b-4 border-l-4 border-lime-300', cameraUi.focusCorner)} />
              <div className={cn('absolute bottom-5 right-5 rounded-br-2xl border-b-4 border-r-4 border-lime-300', cameraUi.focusCorner)} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#064e3b_0,#020617_58%,#000_100%)]" />
          <div className="absolute inset-0 bg-black/20" />
        </>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

      <div
        className={cn(
          'absolute left-1/2 z-30 flex -translate-x-1/2 rounded-full border border-white/50 bg-white/90 p-1 font-bold text-slate-900 shadow-2xl backdrop-blur',
          cameraUi.modeTop,
          cameraUi.modeText,
        )}
      >
        <button
          type="button"
          onClick={() => setMode('camera')}
          className={cn(
            'inline-flex items-center rounded-full transition',
            cameraUi.modeButton,
            mode === 'camera' ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
          )}
        >
          <Camera className={cameraUi.modeIcon} />
          촬영
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={cn(
            'inline-flex items-center rounded-full transition',
            cameraUi.modeButton,
            mode === 'upload' ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
          )}
        >
          <Upload className={cameraUi.modeIcon} />
          업로드
        </button>
      </div>

      <div className={cn('pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between', cameraUi.topPadding)}>
        {mode === 'camera' ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'pointer-events-auto rounded-full border border-white/70 bg-white text-slate-950 shadow-xl hover:bg-emerald-50 hover:text-emerald-800',
              cameraUi.navButton,
            )}
            onClick={resetScan}
          >
            <RotateCcw className={cameraUi.navIcon} />
            <span className="sr-only">카메라 방향 바꾸기</span>
          </Button>
        ) : (
          <div className={cameraUi.navButton} aria-hidden="true" />
        )}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'pointer-events-auto rounded-full border border-white/70 bg-white text-slate-950 shadow-xl hover:bg-emerald-50 hover:text-emerald-800',
              cameraUi.navButton,
            )}
            onClick={() => navigate('/history')}
          >
            <History className={cameraUi.navIcon} />
            <span className="sr-only">스캔 기록</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'pointer-events-auto rounded-full border border-white/70 bg-white text-slate-950 shadow-xl hover:bg-emerald-50 hover:text-emerald-800',
              cameraUi.navButton,
            )}
            onClick={() => navigate(isMobileTest ? '/profile?mobileTest=1' : '/profile')}
          >
            <UserCircle className={cameraUi.navIcon} />
            <span className="sr-only">프로필 설정</span>
          </Button>
        </div>
      </div>

      {mode === 'upload' && (
        <UploadedImagePanel
          images={uploadedImages}
          onAnalyze={(imageData) => void analyzeImage(imageData, '선택한 사진의 성분 분석을 시작합니다.')}
          onRemove={handleRemoveUploadedImage}
          onClear={clearUploadedImages}
          onUpload={() => fileInputRef.current?.click()}
          frameSize={testFrameSize}
        />
      )}

      {mode === 'camera' && (
        <div className={cn('absolute bottom-0 left-0 right-0 z-10 flex justify-center bg-gradient-to-t from-black/70 to-transparent', cameraUi.captureWrap)}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => void handleCaptureClick()}
            className={cn(
              'flex items-center justify-center rounded-full border-4 border-white bg-white text-black shadow-2xl ring-4 ring-white/30',
              cameraUi.captureButton,
            )}
            aria-label="촬영"
          >
            <Camera className={cameraUi.captureIcon} />
          </motion.button>
        </div>
      )}
    </main>
  )
}
