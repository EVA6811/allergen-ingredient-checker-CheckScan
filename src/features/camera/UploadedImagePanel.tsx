import { Images, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UploadedImage } from '@/types'

type MobileFrameSize = 'small' | 'regular' | 'large'

type UploadedImagePanelProps = {
  images: UploadedImage[]
  onAnalyze: (imageData: string) => void
  onRemove: (id: string) => void
  onClear: () => void
  onUpload: () => void
  frameSize?: MobileFrameSize | null
}

const UPLOAD_UI = {
  default: {
    panel: 'inset-x-4 bottom-10 top-[168px] p-3 sm:top-24 md:left-1/2 md:right-auto md:w-[560px] md:-translate-x-1/2',
    title: 'text-sm',
    detail: 'text-xs',
    uploadIcon: 'h-6 w-6',
    emptyIcon: 'h-12 w-12',
    grid: 'grid-cols-2 gap-2',
    image: 'h-28',
    actionButton: 'h-10',
  },
  small: {
    panel: 'inset-x-3 bottom-4 top-[128px] p-2',
    title: 'text-xs',
    detail: 'text-[0.68rem]',
    uploadIcon: 'h-4 w-4',
    emptyIcon: 'h-8 w-8',
    grid: 'grid-cols-1 gap-2',
    image: 'h-24',
    actionButton: 'h-8 text-xs',
  },
  regular: {
    panel: 'inset-x-4 bottom-6 top-[148px] p-3',
    title: 'text-sm',
    detail: 'text-xs',
    uploadIcon: 'h-5 w-5',
    emptyIcon: 'h-10 w-10',
    grid: 'grid-cols-2 gap-2',
    image: 'h-24',
    actionButton: 'h-9',
  },
  large: {
    panel: 'inset-x-4 bottom-8 top-[164px] p-3',
    title: 'text-base',
    detail: 'text-sm',
    uploadIcon: 'h-6 w-6',
    emptyIcon: 'h-12 w-12',
    grid: 'grid-cols-2 gap-2',
    image: 'h-28',
    actionButton: 'h-10',
  },
} as const

export function UploadedImagePanel({ images, onAnalyze, onRemove, onClear, onUpload, frameSize }: UploadedImagePanelProps) {
  const ui = frameSize ? UPLOAD_UI[frameSize] : UPLOAD_UI.default

  return (
    <section className={cn('absolute z-20 rounded-lg border border-white/15 bg-black/75 text-white shadow-2xl backdrop-blur', ui.panel)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn('font-semibold', ui.title)}>업로드한 사진</h2>
          <p className={cn('text-white/70', ui.detail)}>{images.length}개 저장됨. 분석할 사진을 하나 선택하세요.</p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 text-white hover:bg-white/15 hover:text-white" onClick={onClear} disabled={images.length === 0}>
          모두 비우기
        </Button>
      </div>
      <Button type="button" className="mb-3 w-full" onClick={onUpload}>
        <Upload className={ui.uploadIcon} />
        사진 업로드
      </Button>
      {images.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-white/20 bg-white/10 px-4 py-8 text-center">
          <Images className={cn('mb-3 text-white/70', ui.emptyIcon)} />
          <p className={cn('font-semibold', ui.title)}>업로드한 사진이 없습니다</p>
          <p className={cn('mt-1 leading-5 text-white/65', ui.detail)}>위의 사진 업로드 버튼으로 성분표 사진을 추가하세요.</p>
        </div>
      ) : (
        <div className={cn('grid max-h-full overflow-y-auto md:max-h-[calc(100svh-220px)]', ui.grid)}>
          {images.map((image) => (
            <article key={image.id} className="overflow-hidden rounded-md border border-white/15 bg-white/10">
              <img src={image.imageData} alt={image.name} className={cn('w-full object-cover', ui.image)} />
              <div className="space-y-2 p-2">
                <p className="truncate text-xs font-medium text-white/90" title={image.name}>
                  {image.name}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" className={ui.actionButton} onClick={() => onAnalyze(image.imageData)}>
                    분석
                  </Button>
                  <Button variant="destructive" size="sm" className={ui.actionButton} onClick={() => onRemove(image.id)}>
                    <Trash2 className="h-5 w-5" />
                    삭제
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
