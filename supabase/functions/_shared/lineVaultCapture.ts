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

    // Auto-register unknown groups with auto_capture=true so files start flowing immediately
    if (!grp) {
      let groupName = `กลุ่มใหม่ (${groupId.slice(0, 8)}...)`;
      try {
        const summary = await fetchLineGroupSummary(token, groupId);
        if (summary?.groupName) groupName = summary.groupName;
      } catch (_) { /* ignore */ }
      await sb.from("line_vault_groups").insert({
        line_group_id: groupId,
        group_name: groupName,
        auto_capture: true,
        default_visibility: "everyone",
        notes: "ตรวจพบอัตโนมัติจาก LINE",
      });
      // Re-select the freshly registered row so we can capture this very message
      const { data: fresh } = await sb
        .from("line_vault_groups").select("*").eq("line_group_id", groupId).maybeSingle();
      if (!fresh) return { captured: false, reason: "group_registered_pending" };
      Object.assign(grp || {}, fresh);
      // continue below using `fresh` as grp
      // eslint-disable-next-line no-var
      (grp as any) = fresh;
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

    // Image / video / file / audio -> upload to Google Drive (fallback to Supabase storage)
    if (["image", "video", "file", "audio"].includes(msg.type)) {
      const content = await deps.downloadLineContent(token, msg.id);
      if (!content) return { captured: false, reason: "download_failed" };
      const kind: "photo" | "file" = msg.type === "image" ? "photo" : "file";
      const origName: string = msg.fileName || (msg.type === "image" ? `photo-${msg.id}.jpg` : `${msg.type}-${msg.id}.${extFromMime(content.mime)}`);
      const ext = origName.includes(".") ? origName.split(".").pop() : extFromMime(content.mime);
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");

      let driveFileId: string | null = null;
      let driveWebViewLink: string | null = null;
      let storagePath: string | null = null;

      // Try Google Drive first
      try {
        const { ensureFolderPath, uploadFile } = await import("./googleDrive.ts");
        const folderName = (grp.group_name || `group-${groupId.slice(0, 8)}`).replace(/[\\/]/g, "-");
        const parent = await ensureFolderPath(["LineVault", String(y), folderName, m]);
        const uploaded = await uploadFile(`${msg.id}.${ext}`, content.mime, content.data, parent);
        driveFileId = uploaded.id;
        driveWebViewLink = uploaded.webViewLink || null;
        // Persist folder id on group for reference
        if (!grp.drive_folder_id) {
          await sb.from("line_vault_groups").update({ drive_folder_id: parent }).eq("id", grp.id);
        }
      } catch (driveErr) {
        console.error("[vault drive upload failed, fallback to bucket]", (driveErr as any)?.message || driveErr);
        // Fallback to Supabase storage
        const path = `${y}/${m}/${groupId}/${msg.id}.${ext}`;
        const { error: upErr } = await sb.storage.from("line-vault").upload(path, content.data, {
          contentType: content.mime, upsert: false,
        });
        if (upErr && !`${upErr.message}`.toLowerCase().includes("exists")) {
          console.error("[vault upload]", upErr);
          return { captured: false, reason: "upload_failed" };
        }
        storagePath = path;
      }

      const title = msg.fileName || (kind === "photo" ? `รูปภาพจาก ${grp.group_name}` : `ไฟล์จาก ${grp.group_name}`);
      const { error } = await sb.from("line_vault_items").insert({
        ...baseRow,
        kind,
        title,
        storage_path: storagePath,
        drive_file_id: driveFileId,
        drive_web_view_link: driveWebViewLink,
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

export async function fetchLineGroupSummary(token: string, groupId: string) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json() as { groupId: string; groupName?: string; pictureUrl?: string };
  } catch { return null; }
}

// Register a group from a non-message event (join / memberJoined).
// Returns { created, group } where group is the row.
export async function registerLineGroupFromJoin(sb: any, token: string, groupId: string) {
  const { data: existing } = await sb
    .from("line_vault_groups").select("*").eq("line_group_id", groupId).maybeSingle();
  if (existing) return { created: false, group: existing };
  let groupName = `กลุ่มใหม่ (${groupId.slice(0, 8)}...)`;
  try {
    const summary = await fetchLineGroupSummary(token, groupId);
    if (summary?.groupName) groupName = summary.groupName;
  } catch (_) { /* ignore */ }
  const { data: inserted, error } = await sb.from("line_vault_groups").insert({
    line_group_id: groupId,
    group_name: groupName,
    auto_capture: true,
    default_visibility: "everyone",
    notes: "บอทถูกเชิญเข้ากลุ่ม",
  }).select("*").maybeSingle();
  if (error) console.error("[registerLineGroupFromJoin]", error.message);
  return { created: true, group: inserted };
}
