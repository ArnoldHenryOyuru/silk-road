/**
 * Browser-only helper (use it from a 'use client' component, never on the
 * server). Shrinks a photo before upload so the request stays far below
 * Vercel's ~4.5 MB limit on request bodies sent to functions.
 *
 * A typical phone photo (2 to 5 MB) becomes about 150 to 350 KB: longest side
 * at most 1280 px, re-encoded as JPEG. If anything goes wrong, or the result
 * wouldn't be smaller, the original file is returned unchanged.
 */
export async function compressImage(
  file: File,
  { maxSize = 1280, quality = 0.78 }: { maxSize?: number; quality?: number } = {}
): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  let bitmap: ImageBitmap
  try {
    // 'from-image' applies the photo's rotation, so portrait shots stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob || blob.size >= file.size) return file

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}
