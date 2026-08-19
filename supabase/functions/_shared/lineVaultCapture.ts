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

const mimeFromFilename = (name: string): string | null => {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
    mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain", csv: "text/csv", zip: "application/zip",
  };
  return ext ? map[ext] ?? null : null;
};

function resolvedMime(messageType: string, filename: string, responseMime: string) {
  const clean = responseMime.split(";")[0].trim().toLowerCase();
  if (clean && clean !== "application/octet-stream") return clean;
  if (messageType === "image") return "image/jpeg";
  if (messageType === "video") return "video/mp4";
  if (messageType === "audio") return "audio/mpeg";
  return mimeFromFilename(filename) ?? "application/octet-stream";
}

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
    let { data: grp } = await sb
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
      grp = fresh;
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


    // Text -> caption for the sender's most recent media in this group.
    // If the most-recent media belongs to an image album (line_image_set_id),
    // attach the caption to ALL photos in that album so it shows regardless of
    // which one becomes the album cover.
    if (msg.type === "text") {
      const text: string = msg.text || "";
      if (!text.trim()) return { captured: false, reason: "empty_text" };

      const since = new Date(Date.now() - 10 * 60_000).toISOString();
      const { data: recent } = await sb
        .from("line_vault_items")
        .select("id, description, kind, line_image_set_id")
        .eq("line_group_id", groupId)
        .eq("line_sender_user_id", senderUid || "")
        .in("kind", ["photo", "file"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      const target = (recent || []).find((r: any) => !r.description) || (recent || [])[0];
      if (target) {
        const title = text.split("\n")[0].slice(0, 120) || undefined;
        // If part of an album, update every sibling in the album
        if (target.line_image_set_id) {
          await sb.from("line_vault_items")
            .update({ description: text, note_text: text, title })
            .eq("line_group_id", groupId)
            .eq("line_image_set_id", target.line_image_set_id);
        } else {
          await sb.from("line_vault_items")
            .update({ description: text, note_text: text, title })
            .eq("id", target.id);
        }
        return { captured: true, reason: "attached_as_caption" } as any;
      }

      // ไม่บันทึกข้อความแชทเดี่ยว — เก็บเฉพาะไฟล์/สื่อ (หรือใช้เป็นคำอธิบายไฟล์เท่านั้น)
      return { captured: false, reason: "text_chat_ignored" } as any;
    }


    // Image / video / file / audio -> upload to Google Drive (fallback to Supabase storage)
    if (["image", "video", "file", "audio"].includes(msg.type)) {
      if (!msg.id) return { captured: false, reason: "no_message_id" };

      // LOCK FIRST: insert a placeholder row keyed on the unique line_message_id
      // BEFORE touching Drive. Concurrent webhook retries lose the race here and
      // exit without uploading, so Drive can never accumulate duplicates.
      // upsert+ignoreDuplicates ทำให้ duplicate key error ไม่โผล่ใน log แม้ LINE ส่ง webhook ซ้ำ
      const kind: "photo" | "file" = msg.type === "image" ? "photo" : "file";
      const placeholderTitle = msg.fileName || (kind === "photo"
        ? `รูปภาพจาก ${grp.group_name}`
        : `ไฟล์จาก ${grp.group_name}`);
      const { data: placeholder, error: lockErr } = await sb
        .from("line_vault_items")
        .upsert({ ...baseRow, kind, title: placeholderTitle }, { onConflict: "line_message_id", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();
      if (lockErr) {
        const em = `${lockErr.message}`.toLowerCase();
        if (em.includes("duplicate") || em.includes("unique")) {
          return { captured: false, reason: "duplicate_message" };
        }
        console.error("[vault placeholder insert]", lockErr);
        return { captured: false, reason: "placeholder_failed" };
      }
      if (!placeholder?.id) return { captured: false, reason: "duplicate_message" };
      const rowId = placeholder!.id as string;

      const content = await deps.downloadLineContent(token, msg.id);
      if (!content) {
        await sb.from("line_vault_items").delete().eq("id", rowId);
        return { captured: false, reason: "download_failed" };
      }
      const origName: string = msg.fileName || (msg.type === "image"
        ? `photo-${msg.id}.jpg`
        : `${msg.type}-${msg.id}.${extFromMime(content.mime)}`);
      const contentMime = resolvedMime(msg.type, origName, content.mime);
      const ext = origName.includes(".") ? origName.split(".").pop() : extFromMime(contentMime);
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");

      let driveFileId: string | null = null;
      let driveWebViewLink: string | null = null;
      let storagePath: string | null = null;

      // ใช้ Google Drive เฉพาะเมื่อมีคีย์ระบบจริง ๆ ไม่งั้นเก็บลง Supabase Storage ทันที
      let driveReady = false;
      try {
        const { hasNativeSystemDrive } = await import("./googleOauth.ts");
        driveReady = await hasNativeSystemDrive();
      } catch (_) { driveReady = false; }

      const saveToBucket = async () => {
        const path = `${y}/${m}/${groupId}/${msg.id}.${ext}`;
        const { error: upErr } = await sb.storage.from("line-vault").upload(path, content.data, {
          contentType: contentMime, upsert: true,
        });
        if (upErr && !`${upErr.message}`.toLowerCase().includes("exists")) {
          console.error("[vault upload]", upErr);
          return null;
        }
        return path;
      };

      // Keep a storage copy for reliable authenticated previews even when Drive
      // is connected. Drive links/tokens can expire and must not blank thumbnails.
      storagePath = await saveToBucket();
      if (!storagePath) {
        await sb.from("line_vault_items").delete().eq("id", rowId);
        return { captured: false, reason: "upload_failed" };
      }

      if (driveReady) {
        try {
          const { ensureFolderPath, ensureFolder, uploadFile } = await import("./googleDrive.ts");
          const folderName = (grp.group_name || `group-${groupId.slice(0, 8)}`).replace(/[\\/]/g, "-");
          let parent: string;
          if (grp.drive_root_folder_id) {
            const yearFolder = await ensureFolder(String(y), grp.drive_root_folder_id);
            parent = await ensureFolder(m, yearFolder);
          } else {
            parent = await ensureFolderPath(["LineVault", String(y), folderName, m]);
          }
          const uploaded = await uploadFile(`${msg.id}.${ext}`, contentMime, content.data, parent);
          driveFileId = uploaded.id;
          driveWebViewLink = uploaded.webViewLink || null;
          if (!grp.drive_folder_id) {
            await sb.from("line_vault_groups").update({ drive_folder_id: parent }).eq("id", grp.id);
          }
        } catch (driveErr) {
          console.error("[vault drive upload failed, fallback to bucket]", (driveErr as any)?.message || driveErr);
        }
      }

      const { error: updErr } = await sb.from("line_vault_items").update({
        storage_path: storagePath,
        drive_file_id: driveFileId,
        drive_web_view_link: driveWebViewLink,
        mime_type: contentMime,
        size_bytes: content.data.byteLength,
        original_filename: origName,
      }).eq("id", rowId);
      if (updErr) {
        if (driveFileId) {
          try {
            const { deleteFile } = await import("./googleDrive.ts");
            await deleteFile(driveFileId);
          } catch (e) { console.error("[vault rollback drive]", e); }
        }
        await sb.from("line_vault_items").delete().eq("id", rowId);
        throw updErr;
      }
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
