/* Chuẩn hóa link ảnh Drive: từ link dán vào suy ra link xem, ảnh thu nhỏ và link tải.
   - Link file Drive dạng /file/d/<ID>/... hoặc ?id=<ID> thì rút ID ra.
   - Link khác (không phải Drive) giữ nguyên. */

/** Rút ID file từ các dạng link Drive phổ biến, không phải thì trả null. */
export function extractDriveFileId(url: string): string | null {
  const m =
    url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) ?? url.match(/[?&]id=([^&#]+)/);
  return m ? m[1] : null;
}

/** Link chuẩn để lưu: file Drive -> dạng xem /file/d/<ID>/view; còn lại giữ nguyên. */
export function normalizeDriveLink(url: string): string {
  const trimmed = url.trim();
  const id = extractDriveFileId(trimmed);
  if (trimmed.includes('drive.google.com') && id) {
    return `https://drive.google.com/file/d/${id}/view`;
  }
  return trimmed;
}

/** Ảnh thu nhỏ để hiển thị trong lưới/lightbox: file Drive -> thumbnail; còn lại giữ nguyên. */
export function driveThumbnailUrl(url: string, size = 1200): string {
  const id = extractDriveFileId(url);
  if (url.includes('drive.google.com') && id) {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
  }
  return url;
}

/** Link tải trực tiếp: file Drive -> uc?export=download; còn lại giữ nguyên. */
export function driveDownloadUrl(url: string): string {
  const id = extractDriveFileId(url);
  if (url.includes('drive.google.com') && id) {
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  return url;
}
