/* Nén ảnh ngay trên máy người tải lên, trước khi gửi đi.
   Mục đích: ảnh điện thoại thường nặng 5–12MB, nén về tối đa 1920px, JPEG ~82%
   (thường còn 200–500KB) thì tải nhanh hơn và đỡ tốn dung lượng gói miễn phí.
   Nén lỗi (định dạng lạ) thì giữ nguyên file gốc, không chặn việc tải lên. */

export async function compressImage(
  file: File,
  maxDim = 1920,
  quality = 0.82,
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, '') || 'anh';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
