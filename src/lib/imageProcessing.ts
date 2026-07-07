const TARGET_LONG_EDGE = 1600
const JPEG_QUALITY = 0.92

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지 파일을 읽을 수 없습니다. JPG, PNG, WebP 파일을 사용해 주세요.'))
    }
    image.src = url
  })
}

export async function normalizeImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.')
  }

  const image = await loadImageFromFile(file)
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height

  if (!sourceWidth || !sourceHeight) {
    throw new Error('이미지 크기를 확인할 수 없습니다.')
  }

  const longEdge = Math.max(sourceWidth, sourceHeight)
  const scale = Math.min(1, TARGET_LONG_EDGE / longEdge)
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale))
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('이미지를 변환할 수 없습니다.')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, targetWidth, targetHeight)
  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export async function saveImageToLocalUploads(imageData: string, sourceName: string) {
  const response = await fetch('/api/save-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, sourceName }),
  })

  if (!response.ok) {
    throw new Error('로컬 폴더에 이미지를 저장하지 못했습니다.')
  }

  return (await response.json()) as { ok: true; fileName: string; path: string }
}

export function getLocalUploadUrl(fileName: string) {
  return `/api/local-upload/${encodeURIComponent(fileName)}`
}

export async function loadImageDataUrl(source: string) {
  if (source.startsWith('data:image/')) return source

  const response = await fetch(source)
  if (!response.ok) {
    throw new Error('업로드한 이미지 파일을 다시 읽을 수 없습니다.')
  }

  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('이미지를 분석 형식으로 변환하지 못했습니다.'))
    }
    reader.onerror = () => reject(new Error('이미지를 분석 형식으로 변환하지 못했습니다.'))
    reader.readAsDataURL(blob)
  })
}
