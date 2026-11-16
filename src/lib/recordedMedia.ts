export type RecordingKind = "audio" | "video";

export function recordingMime(kind: RecordingKind, supported: (mime: string) => boolean): string | undefined {
  const candidates = kind === "audio"
    ? ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"]
    : ["video/webm;codecs=vp8,opus", "video/mp4", "video/webm"];
  return candidates.find(supported);
}

export function recordedFile(chunks: Blob[], mime: string, kind: RecordingKind): File {
  const extension = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
  const blob = new Blob(chunks, { type: mime });
  if (!blob.size) throw new Error("ยังไม่มีข้อมูลที่บันทึก กรุณาอัดใหม่");
  return new File([blob], `${kind}_${Date.now()}.${extension}`, { type: mime });
}