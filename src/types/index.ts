export type AllergyType = string

export type RiskStatus = 'danger' | 'warning' | 'safe'

export type Box2D = [number, number, number, number]

export type User = {
  id: string
  deviceToken: string
  createdAt: string
}

export type UserAllergy = {
  id: string
  userId: string
  allergyName: AllergyType
}

export type DetectedIngredient = {
  name: string
  reason: string
  box2d: Box2D
}

export type ImageAssessment = {
  isIngredientLabel: boolean
  confidence: 'high' | 'medium' | 'low'
  qualityIssues: string[]
  reason: string
}

export type AnalysisIssue = {
  type: 'not_ingredient_label' | 'low_image_quality' | 'insufficient_text' | 'api_error'
  title: string
  message: string
}

export type AnalysisResult = {
  status: RiskStatus
  detectedIngredients: DetectedIngredient[]
  imageAssessment?: ImageAssessment
  analysisIssue?: AnalysisIssue | null
}

export type ScanResult = AnalysisResult & {
  id: string
  userId: string
  imageData: string
  scannedAt: string
}

export type UploadedImage = {
  id: string
  name: string
  imageData: string
  uploadedAt: string
  localFileName?: string
}

export type AccessibilitySettings = {
  ttsEnabled: boolean
  largeText: boolean
  fontScale: 'normal' | 'large' | 'xlarge'
  highContrast: boolean
}

export type LocalAccount = {
  id: string
  username: string
  password: string
  name: string
  phone: string
  isAdmin: boolean
  allergies: AllergyType[]
  accessibility: AccessibilitySettings
  scanHistory: ScanResult[]
  uploadedImages: UploadedImage[]
  createdAt: string
}

export type AppToast = {
  message: string
  type: 'error' | 'info'
} | null
