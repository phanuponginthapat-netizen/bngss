// Capture LINE group messages into the line_vault_items table + storage.
// Called from line-webhook when event.source.type === 'group'.

export interface VaultCaptureDeps {
  downloadLineContent: (token: string, messageId: string) => Promise<{ data: Uint8Array; mime: string } | null>;
  fetchLineProfile?: (token: string, groupId: string, userId: string) => Promise<{ displayName?: string } | null>;
}

const extFromMime = (mime: string, fallback = "bin") => {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/msword": "doc", "application/vnd.ms-excel": "xls", "application/vnd.ms-powerpoint": "ppt",
    "text/plain": "txt", "application/zip": "zip",
    "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
    "video/mp4": "mp4", "video/quicktime": "mov",
  };
  return map[mime.toLowerCase()] || fallback;
};

export async function captureLineGroupEvent(
  sb: any,
  token: string,
  event: any,
  deps: VaultCaptureDeps,
): Promise<{ captured: boolean; reason?: string }> {
  try {
    if (event.type !== "message") return { captured: false, reason: "not_message" };
    const source = event.source || {};
    if (source.type !== "group" && source.type !== "room") return { captured: false, reason: "not_group" };
    const groupId = source.groupId || source.roomId;
    if (!groupId) return { captured: false, reason: "no_group_id" };

    // Look up mapping
    const { data: grp } = await sb
      .from("line_vault_groups")
      .select("*")
      .eq("line_group_id", groupId)
      .maybeSingle();

    // Auto-register unknown groups (auto_capture=false so admin must enable)
    if (!grp) {
      await sb.from("line_vault_groups").insert({
        line_group_id: groupId,
        group_name: `กลุ่มใหม่ (${groupId.slice(0, 8)}...)`,
        auto_capture: false,
        default_visibility: "everyone",
        notes: "ตรวจพบอัตโนมัติ - กรุณาตั้งชื่อและเปิด auto_capture",
      });
      return { captured: false, reason: "group_registered_pending" };
    }
    if (!grp.auto_capture) return { captured: false, reason: "auto_capture_disabled" };

    const msg = event.message || {};
    const senderUid = source.userId || null;
    let senderName: string | null = null;
    if (senderUid && deps.fetchLineProfile) {
      try {
        const p = await deps.fetchLineProfile(token, groupId, senderUid);
        senderName = p?.displayName || null;
      } catch (_) { /* ignore */ }
    }

    const baseRow = {
      source: "line" as const,
      line_group_id: groupId,
      line_message_id: msg.id,
      line_sender_user_id: senderUid,
      line_sender_name: senderName,
      line_image_set_id: msg?.imageSet?.id || null,
      department: grp.department || null,
      visibility: grp.default_visibility || "everyone",
      category: grp.default_category || null,
    };


    // Text -> note
    if (msg.type === "text") {
      const text: string = msg.text || "";
      if (!text.trim()) return { captured: false, reason: "empty_text" };
      const title = text.split("\n")[0].slice(0, 80) || "โน้ตจาก LINE";
      const { error } = await sb.from("line_vault_items").insert({
        ...baseRow,
        kind: "note",
        title,
        note_text: text,
      });
      if (error && !`${error.message}`.includes("duplicate")) throw error;
      return { captured: true };
    }

    // Image / video / file / audio -> download to storage
    if (["image", "video", "file", "audio"].includes(msg.type)) {
      const content = await deps.downloadLineContent(token, msg.id);
      if (!content) return { captured: false, reason: "download_failed" };
      const kind: "photo" | "file" = msg.type === "image" ? "photo" : "file";
      const origName: string = msg.fileName || (msg.type === "image" ? `photo-${msg.id}.jpg` : `${msg.type}-${msg.id}.${extFromMime(content.mime)}`);
      const ext = origName.includes(".") ? origName.split(".").pop() : extFromMime(content.mime);
      const now = new Date();
      const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, "0");
      const path = `${y}/${m}/${groupId}/${msg.id}.${ext}`;

      const { error: upErr } = await sb.storage.from("line-vault").upload(path, content.data, {
        contentType: content.mime, upsert: false,
      });
      if (upErr && !`${upErr.message}`.toLowerCase().includes("exists")) {
        console.error("[vault upload]", upErr);
        return { captured: false, reason: "upload_failed" };
      }

      const title = msg.fileName || (kind === "photo" ? `รูปภาพจาก ${grp.group_name}` : `ไฟล์จาก ${grp.group_name}`);
      const { error } = await sb.from("line_vault_items").insert({
        ...baseRow,
        kind,
        title,
        storage_path: path,
        mime_type: content.mime,
        size_bytes: content.data.byteLength,
        original_filename: origName,
      });
      if (error && !`${error.message}`.includes("duplicate")) throw error;
      return { captured: true };
    }

    return { captured: false, reason: `unsupported_type:${msg.type}` };
  } catch (e: any) {
    console.error("[captureLineGroupEvent]", e?.message || e);
    return { captured: false, reason: "error" };
  }
}

export async function fetchLineGroupMemberProfile(token: string, groupId: string, userId: string) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/member/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
