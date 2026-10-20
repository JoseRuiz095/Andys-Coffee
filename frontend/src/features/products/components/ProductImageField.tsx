import { ProductImage } from '../../../shared/components/ProductImage'
import { PRODUCT_IMAGE_ACCEPT, PRODUCT_IMAGE_MAX_MB } from '../../../shared/constants/images'
import type { ImageDraft } from '../hooks/useImageDraft'

interface ProductImageFieldProps {
  /** Image saved on the server (public URL), if any. */
  currentUrl?: string | null
  draft: ImageDraft | null
  error: string | null
  /** New products have no id yet: the photo is uploaded right after the product is created. */
  uploadsOnSave: boolean
  disabled?: boolean
  isUploading: boolean
  isRemoving: boolean
  onSelect: (file: File | undefined) => void
  onConfirm: () => void
  onCancel: () => void
  onRemove: () => void
}

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`

const secondaryButton = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
}

/** Product photo in the product form: preview, confirm/cancel, replace and remove. */
export function ProductImageField({
  currentUrl,
  draft,
  error,
  uploadsOnSave,
  disabled = false,
  isUploading,
  isRemoving,
  onSelect,
  onConfirm,
  onCancel,
  onRemove,
}: ProductImageFieldProps) {
  const busy = isUploading || isRemoving
  const inputId = 'product-image-input'

  return (
    <div>
      <span className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Imagen
      </span>
      <div className="mt-1 flex items-start gap-4">
        <div
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border"
          style={{ borderColor: draft ? 'var(--color-primary)' : 'var(--color-border)' }}
        >
          {draft ? (
            <img src={draft.previewUrl} alt="Vista previa" className="h-full w-full object-cover" />
          ) : (
            <ProductImage src={currentUrl} alt="Imagen actual del producto" eager />
          )}
          {busy && (
            <div
              className="absolute inset-0 flex items-center justify-center text-xs font-semibold opacity-90"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
            >
              {isUploading ? 'Procesando…' : 'Quitando…'}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {draft ? (
            <>
              <p className="truncate text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {draft.file.name} · {formatSize(draft.file.size)}
              </p>
              <div className="flex flex-wrap gap-2">
                {!uploadsOnSave && (
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={busy || disabled}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
                  >
                    {isUploading ? 'Subiendo…' : currentUrl ? 'Reemplazar imagen' : 'Subir imagen'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-60"
                  style={secondaryButton}
                >
                  Cancelar
                </button>
              </div>
              {uploadsOnSave && (
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Se subirá al guardar el producto.
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <label
                htmlFor={inputId}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${busy || disabled ? 'pointer-events-none opacity-60' : ''}`}
                style={secondaryButton}
              >
                {currentUrl ? 'Cambiar imagen' : 'Elegir imagen'}
              </label>
              {currentUrl && (
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={busy || disabled}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-60"
                  style={{ ...secondaryButton, color: 'var(--color-danger)' }}
                >
                  Quitar imagen
                </button>
              )}
            </div>
          )}
          <input
            id={inputId}
            type="file"
            accept={PRODUCT_IMAGE_ACCEPT}
            className="sr-only"
            disabled={busy || disabled}
            onChange={(event) => {
              onSelect(event.target.files?.[0])
              event.target.value = '' // allows picking the same file again after cancelling
            }}
          />
          {error ? (
            <p className="text-xs" role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              JPEG, PNG, WebP o AVIF de hasta {PRODUCT_IMAGE_MAX_MB} MB. Se optimiza y guarda como WebP.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
