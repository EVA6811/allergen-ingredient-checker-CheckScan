import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createId } from '@/lib/ids'
import { getLocalUploadUrl } from '@/lib/imageProcessing'
import type { AccessibilitySettings, AllergyType, AnalysisResult, AppToast, LocalAccount, ScanResult, UploadedImage } from '@/types'

const MAX_LOCAL_SCAN_HISTORY = 20
const MAX_LOCAL_UPLOADED_IMAGES = 30
const DEMO_ACCOUNT_ID = 'demo-account-admin'
const DEMO_LEGACY_ACCOUNT_ID = 'demo-account-adim'
const DEMO_ACCOUNT_USERNAME = 'admin'
const DEMO_ACCOUNT_PASSWORD = 'admin123'
const DEMO_ACCOUNT_NAME = 'admin'
const DEMO_ACCOUNT_PHONE = '010-1234-5678'
const DEMO_ALIAS_USERNAME = 'adim'
const DEMO_ALIAS_PASSWORD = 'adim123'
const DEMO_ALIAS_NAME = 'adim'

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  ttsEnabled: false,
  largeText: false,
  fontScale: 'normal',
  highContrast: true,
}

type AuthResult = {
  ok: boolean
  message: string
}

type LookupResult = AuthResult & {
  maskedValue?: string
}

type AppState = {
  accounts: LocalAccount[]
  currentUserId: string | null
  allergies: AllergyType[]
  accessibility: AccessibilitySettings
  scanHistory: ScanResult[]
  uploadedImages: UploadedImage[]
  capturedImage: string | null
  sourceImage: string | null
  analysisResult: AnalysisResult | null
  isAnalyzing: boolean
  toast: AppToast
  register: (username: string, password: string, name: string, phone: string) => AuthResult
  login: (username: string, password: string) => AuthResult
  findUsername: (name: string, phone: string) => LookupResult
  findPassword: (username: string, name: string, phone: string) => LookupResult
  logout: () => void
  setAllergies: (allergies: AllergyType[]) => void
  setAccessibility: (settings: AccessibilitySettings) => void
  setCapturedImage: (capturedImage: string | null) => void
  setSourceImage: (sourceImage: string | null) => void
  setAnalysisResult: (analysisResult: AnalysisResult | null) => void
  setIsAnalyzing: (isAnalyzing: boolean) => void
  addUploadedImages: (images: UploadedImage[]) => void
  removeUploadedImage: (id: string) => void
  clearUploadedImages: () => void
  addScanResult: (result: ScanResult) => void
  deleteScanResult: (id: string) => void
  clearHistory: () => void
  showToast: (message: string, type?: 'error' | 'info') => void
  clearToast: () => void
  resetScan: () => void
}

function createDemoAccount(): LocalAccount {
  return {
    id: DEMO_ACCOUNT_ID,
    username: DEMO_ACCOUNT_USERNAME,
    password: DEMO_ACCOUNT_PASSWORD,
    name: DEMO_ACCOUNT_NAME,
    phone: DEMO_ACCOUNT_PHONE,
    isAdmin: true,
    allergies: [],
    accessibility: DEFAULT_ACCESSIBILITY_SETTINGS,
    scanHistory: [],
    uploadedImages: [],
    createdAt: '2026-07-08T00:00:00.000Z',
  }
}

function normalizePhone(phone: string | null | undefined) {
  return (phone ?? '').replace(/\D/g, '')
}

function normalizeLookup(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function isDemoUsername(username: string) {
  const normalized = normalizeLookup(username)
  return normalized === DEMO_ACCOUNT_USERNAME || normalized === DEMO_ALIAS_USERNAME
}

function isDemoName(name: string) {
  const normalized = normalizeLookup(name)
  return normalized === DEMO_ACCOUNT_NAME || normalized === DEMO_ALIAS_NAME
}

function isDemoPhone(phone: string) {
  return normalizePhone(phone) === normalizePhone(DEMO_ACCOUNT_PHONE)
}

function isDemoAccount(account: LocalAccount) {
  return (
    account.id === DEMO_ACCOUNT_ID ||
    account.id === DEMO_LEGACY_ACCOUNT_ID ||
    isDemoUsername(account.username) ||
    (isDemoName(account.name) && isDemoPhone(account.phone))
  )
}

function isDemoPassword(password: string) {
  return password === DEMO_ACCOUNT_PASSWORD || password === DEMO_ALIAS_PASSWORD
}

function maskMiddle(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length === 1) return '*'
  if (trimmed.length <= 4) {
    return `${trimmed.slice(0, 1)}${'*'.repeat(Math.max(2, trimmed.length - 2))}${trimmed.slice(-1)}`
  }

  const edgeLength = trimmed.length >= 6 ? 2 : 1
  const hiddenLength = Math.max(2, trimmed.length - edgeLength * 2)
  return `${trimmed.slice(0, edgeLength)}${'*'.repeat(hiddenLength)}${trimmed.slice(-edgeLength)}`
}

function normalizeStoredUploadedImages(images: UploadedImage[] = []) {
  return images
    .map((image) => {
      if (image.localFileName) {
        return {
          ...image,
          imageData: getLocalUploadUrl(image.localFileName),
        }
      }
      return image.imageData.startsWith('data:image/') ? null : image
    })
    .filter(Boolean) as UploadedImage[]
}

function withAccountDefaults(account: LocalAccount): LocalAccount {
  return {
    ...account,
    name: account.name ?? '',
    phone: account.phone ?? '',
    isAdmin: account.isAdmin ?? isDemoAccount(account),
    allergies: account.allergies ?? [],
    accessibility: {
      ...DEFAULT_ACCESSIBILITY_SETTINGS,
      ...(account.accessibility ?? {}),
    },
    scanHistory: account.scanHistory ?? [],
    uploadedImages: normalizeStoredUploadedImages(account.uploadedImages ?? []),
    createdAt: account.createdAt ?? new Date().toISOString(),
  }
}

function ensureDemoAccount(accounts: LocalAccount[] = []) {
  const demoAccount = createDemoAccount()
  const normalizedAccounts = accounts.map(withAccountDefaults)
  const existingDemo = normalizedAccounts.find(isDemoAccount)

  const mergedDemo = existingDemo
    ? {
        ...existingDemo,
        username: demoAccount.username,
        password: demoAccount.password,
        name: demoAccount.name,
        phone: demoAccount.phone,
        isAdmin: true,
      }
    : demoAccount

  return [mergedDemo, ...normalizedAccounts.filter((account) => !isDemoAccount(account))]
}

function syncCurrentUser(accounts: LocalAccount[], currentUserId: string | null) {
  const account = ensureDemoAccount(accounts).find((item) => item.id === currentUserId)
  return {
    allergies: account?.allergies ?? [],
    accessibility: account?.accessibility ?? DEFAULT_ACCESSIBILITY_SETTINGS,
    scanHistory: account?.scanHistory ?? [],
    uploadedImages: account?.uploadedImages ?? [],
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      accounts: ensureDemoAccount([]),
      currentUserId: null,
      allergies: [],
      accessibility: DEFAULT_ACCESSIBILITY_SETTINGS,
      scanHistory: [],
      uploadedImages: [],
      capturedImage: null,
      sourceImage: null,
      analysisResult: null,
      isAnalyzing: false,
      toast: null,
      register: (rawUsername, rawPassword, rawName, rawPhone) => {
        const username = rawUsername.trim()
        const password = rawPassword.trim()
        const name = rawName.trim()
        const phone = rawPhone.trim()

        if (!name) return { ok: false, message: '이름을 입력해 주세요.' }
        if (normalizePhone(phone).length < 10) return { ok: false, message: '전화번호를 정확히 입력해 주세요.' }
        if (username.length < 3) return { ok: false, message: '아이디는 3자 이상 입력해 주세요.' }
        if (password.length < 4) return { ok: false, message: '비밀번호는 4자 이상 입력해 주세요.' }
        if (username.toLowerCase().includes('admin')) {
          return { ok: false, message: '아이디에 admin을 포함할 수 없습니다.' }
        }
        if (isDemoUsername(username) || ensureDemoAccount(get().accounts).some((account) => account.username.toLowerCase() === username.toLowerCase())) {
          return { ok: false, message: '이미 존재하는 아이디입니다.' }
        }

        const account: LocalAccount = {
          id: createId(),
          username,
          password,
          name,
          phone,
          isAdmin: false,
          allergies: [],
          accessibility: DEFAULT_ACCESSIBILITY_SETTINGS,
          scanHistory: [],
          uploadedImages: [],
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          accounts: [...ensureDemoAccount(state.accounts), account],
          currentUserId: account.id,
          allergies: [],
          accessibility: account.accessibility,
          scanHistory: [],
          uploadedImages: [],
          capturedImage: null,
          sourceImage: null,
          analysisResult: null,
        }))
        return { ok: true, message: '계정을 만들었습니다.' }
      },
      login: (rawUsername, rawPassword) => {
        const username = rawUsername.trim()
        const password = rawPassword.trim()
        const accounts = ensureDemoAccount(get().accounts)
        const account =
          accounts.find((item) => item.username.toLowerCase() === username.toLowerCase()) ??
          (isDemoUsername(username) ? accounts.find(isDemoAccount) : undefined)
        const passwordMatches = account && (account.password === password || (isDemoAccount(account) && isDemoPassword(password)))
        if (!account || !passwordMatches) {
          return { ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' }
        }

        set({
          accounts: accounts.map((item) => (item.id === account.id ? account : item)),
          currentUserId: account.id,
          allergies: account.allergies,
          accessibility: account.accessibility,
          scanHistory: account.scanHistory,
          uploadedImages: account.uploadedImages,
          capturedImage: null,
          sourceImage: null,
          analysisResult: null,
        })
        return { ok: true, message: '로그인했습니다.' }
      },
      findUsername: (rawName, rawPhone) => {
        const name = rawName.trim()
        const phoneDigits = normalizePhone(rawPhone)
        if (!name || phoneDigits.length < 10) {
          return { ok: false, message: '이름과 전화번호를 입력해 주세요.' }
        }

        const accounts = ensureDemoAccount(get().accounts)
        const account =
          accounts.find((item) => item.name.trim().toLowerCase() === name.toLowerCase() && normalizePhone(item.phone) === phoneDigits) ??
          (isDemoName(name) && isDemoPhone(rawPhone) ? accounts.find(isDemoAccount) : undefined)
        if (!account) return { ok: false, message: '일치하는 계정을 찾을 수 없습니다.' }

        const maskedValue = maskMiddle(account.username)
        return { ok: true, message: `아이디는 ${maskedValue} 입니다.`, maskedValue }
      },
      findPassword: (rawUsername, rawName, rawPhone) => {
        const username = rawUsername.trim()
        const name = rawName.trim()
        const phoneDigits = normalizePhone(rawPhone)
        if (!username || !name || phoneDigits.length < 10) {
          return { ok: false, message: '아이디, 이름, 전화번호를 모두 입력해 주세요.' }
        }

        const accounts = ensureDemoAccount(get().accounts)
        const account =
          accounts.find(
            (item) =>
              item.username.toLowerCase() === username.toLowerCase() &&
              item.name.trim().toLowerCase() === name.toLowerCase() &&
              normalizePhone(item.phone) === phoneDigits,
          ) ?? (isDemoUsername(username) && isDemoName(name) && isDemoPhone(rawPhone) ? accounts.find(isDemoAccount) : undefined)
        if (!account) return { ok: false, message: '일치하는 계정을 찾을 수 없습니다.' }

        const maskedValue = maskMiddle(account.password)
        return { ok: true, message: `비밀번호는 ${maskedValue} 입니다.`, maskedValue }
      },
      logout: () =>
        set({
          currentUserId: null,
          allergies: [],
          accessibility: DEFAULT_ACCESSIBILITY_SETTINGS,
          scanHistory: [],
          uploadedImages: [],
          capturedImage: null,
          sourceImage: null,
          analysisResult: null,
          isAnalyzing: false,
        }),
      setAllergies: (allergies) =>
        set((state) => ({
          allergies,
          accounts: ensureDemoAccount(state.accounts).map((account) => (account.id === state.currentUserId ? { ...account, allergies } : account)),
        })),
      setAccessibility: (accessibility) =>
        set((state) => ({
          accessibility,
          accounts: ensureDemoAccount(state.accounts).map((account) =>
            account.id === state.currentUserId ? { ...account, accessibility } : account,
          ),
        })),
      setCapturedImage: (capturedImage) => set({ capturedImage }),
      setSourceImage: (sourceImage) => set({ sourceImage }),
      setAnalysisResult: (analysisResult) => set({ analysisResult }),
      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
      addUploadedImages: (images) =>
        set((state) => {
          const uploadedImages = [...images, ...state.uploadedImages].slice(0, MAX_LOCAL_UPLOADED_IMAGES)
          return {
            uploadedImages,
            accounts: ensureDemoAccount(state.accounts).map((account) =>
              account.id === state.currentUserId ? { ...account, uploadedImages } : account,
            ),
          }
        }),
      removeUploadedImage: (id) =>
        set((state) => {
          const uploadedImages = state.uploadedImages.filter((image) => image.id !== id)
          return {
            uploadedImages,
            accounts: ensureDemoAccount(state.accounts).map((account) =>
              account.id === state.currentUserId ? { ...account, uploadedImages } : account,
            ),
          }
        }),
      clearUploadedImages: () =>
        set((state) => ({
          uploadedImages: [],
          accounts: ensureDemoAccount(state.accounts).map((account) =>
            account.id === state.currentUserId ? { ...account, uploadedImages: [] } : account,
          ),
        })),
      addScanResult: (result) =>
        set((state) => {
          const scanHistory = [result, ...state.scanHistory].slice(0, MAX_LOCAL_SCAN_HISTORY)
          return {
            scanHistory,
            accounts: ensureDemoAccount(state.accounts).map((account) =>
              account.id === state.currentUserId ? { ...account, scanHistory } : account,
            ),
          }
        }),
      deleteScanResult: (id) =>
        set((state) => {
          const scanHistory = state.scanHistory.filter((scan) => scan.id !== id)
          return {
            scanHistory,
            accounts: ensureDemoAccount(state.accounts).map((account) =>
              account.id === state.currentUserId ? { ...account, scanHistory } : account,
            ),
          }
        }),
      clearHistory: () =>
        set((state) => ({
          scanHistory: [],
          accounts: ensureDemoAccount(state.accounts).map((account) =>
            account.id === state.currentUserId ? { ...account, scanHistory: [] } : account,
          ),
        })),
      showToast: (message, type = 'info') => set({ toast: { message, type } }),
      clearToast: () => set({ toast: null }),
      resetScan: () => set({ capturedImage: null, sourceImage: null, analysisResult: null, isAnalyzing: false }),
    }),
    {
      name: 'allergy-lens-store',
      partialize: (state) => ({
        accounts: ensureDemoAccount(state.accounts),
        currentUserId: state.currentUserId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.accounts = ensureDemoAccount(state.accounts)
        const synced = syncCurrentUser(state.accounts, state.currentUserId)
        state.allergies = synced.allergies
        state.accessibility = synced.accessibility
        state.scanHistory = synced.scanHistory
        state.uploadedImages = synced.uploadedImages
      },
    },
  ),
)
