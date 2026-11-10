/** Do not export a card while a saved photo or template image is unreadable. */
export async function waitForIdCardImages(root: HTMLElement, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const photos = Array.from(root.querySelectorAll<HTMLElement>("[data-card-photo-state]"));
    const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    if (photos.some(photo => photo.dataset.cardPhotoState === "error") || images.some(img => img.complete && img.naturalWidth === 0)) {
      throw new Error("โหลดรูปบนบัตรไม่สำเร็จ กรุณาลองโหลดรูปใหม่ก่อนพิมพ์");
    }
    if (photos.every(photo => photo.dataset.cardPhotoState === "ready") && images.every(img => img.complete && img.naturalWidth > 0)) return;
    if (Date.now() >= deadline) throw new Error("รูปบนบัตรยังโหลดไม่ครบ กรุณาลองใหม่");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}