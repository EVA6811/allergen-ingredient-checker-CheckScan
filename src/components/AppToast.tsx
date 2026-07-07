import { AlertCircle, Info, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'

export function AppToast() {
  const toast = useAppStore((state) => state.toast)
  const clearToast = useAppStore((state) => state.clearToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(clearToast, toast.type === 'error' ? 8000 : 4500)
    return () => window.clearTimeout(timer)
  }, [clearToast, toast])

  const Icon = toast?.type === 'error' ? AlertCircle : Info

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed left-4 right-4 top-4 z-[100] mx-auto flex max-w-md items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-slate-950 shadow-xl"
          role="status"
        >
          <Icon className={toast.type === 'error' ? 'mt-0.5 h-5 w-5 shrink-0 text-red-600' : 'mt-0.5 h-5 w-5 shrink-0 text-emerald-700'} />
          <p className="min-w-0 flex-1 text-sm font-medium leading-6">{toast.message}</p>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={clearToast}>
            <X className="h-4 w-4" />
            <span className="sr-only">닫기</span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
