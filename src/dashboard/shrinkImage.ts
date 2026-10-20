// Camera photos are several MB; a logo needs a few hundred pixels. Images over
// the limit, or in a type the logo bucket doesn't take (HEIC from an iPhone
// camera, where the browser can decode it), are redrawn as a JPEG.

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export async function logoFile(file: File, maxSide = 800, maxBytes = 2 * 1024 * 1024): Promise<File> {
  if (LOGO_TYPES.includes(file.type) && file.size <= maxBytes) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('Couldn’t read that image. Try a PNG or JPEG.');
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Couldn’t read that image. Try a PNG or JPEG.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Couldn’t read that image. Try a PNG or JPEG.');
  return new File([blob], 'logo.jpg', { type: 'image/jpeg' });
}
