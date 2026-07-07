import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppToast } from '@/components/AppToast'
import { AnalyzingScreen } from '@/screens/AnalyzingScreen'
import { CameraScreen } from '@/screens/CameraScreen'
import { HistoryDetailScreen } from '@/screens/HistoryDetailScreen'
import { HistoryScreen } from '@/screens/HistoryScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { MobileTestScreen } from '@/screens/MobileTestScreen'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { ResultScreen } from '@/screens/ResultScreen'
import { useAppStore } from '@/store/useAppStore'

function App() {
  const fontScale = useAppStore((state) => state.accessibility.fontScale)

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale
    return () => {
      delete document.documentElement.dataset.fontScale
    }
  }, [fontScale])

  return (
    <>
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/profile" element={<OnboardingScreen />} />
        <Route path="/camera" element={<CameraScreen />} />
        <Route path="/analyzing" element={<AnalyzingScreen />} />
        <Route path="/result" element={<ResultScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/history/:scanId" element={<HistoryDetailScreen />} />
        <Route path="/mobile-test" element={<MobileTestScreen />} />
        <Route path="/mobile-test/:frameId" element={<MobileTestScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AppToast />
    </>
  )
}

export default App
