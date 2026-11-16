// Shared parent-account provisioning: finds the parent account linked to a student
// (students.parent_user_id/_2 with role parent) or creates one, never granting other roles.
// Used by every parent sign-in path (card QR, code+DOB, LINE) so parents always get their own account.
function randomPassword() {
  const a = new Uint8Array(24); crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureParentAccount(admin: any, student: any): Promise<{ parentUserId: string } | { error: string; status: number }> {
    // 1) หาบัญชีผู้ปกครองที่ผูกไว้แล้ว (ต้องมี role = parent จริง)
    let parentUserId: string | null = null;
    const candidates = [student.parent_user_id, student.parent_user_id_2].filter(Boolean) as string[];
    for (const cand of candidates) {
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", cand)
        .eq("role", "parent")
        .maybeSingle();
      if (roleRow) { parentUserId = cand; break; }
    }

    // 2) ถ้ายังไม่มี → สร้างบัญชีผู้ปกครองอัตโนมัติ
    if (!parentUserId) {
      const codeSlug = String(student.student_code || student.id).toLowerCase().replace(/[^a-z0-9]/g, "");
      const email = `parent.${codeSlug}@parent.local`;

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          account_type: "parent",
          child_student_code: student.student_code,
          first_name: "ผู้ปกครองของ",
          last_name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
        },
      });

      if (created?.user?.id) {
        parentUserId = created.user.id;
      } else {
        // อาจมีอยู่แล้วจากการสร้างครั้งก่อน — ค้นหาซ้ำ
        if (!createErr) return { error: "provision_failed", status: 500 };
        for (let page = 1; page <= 20 && !parentUserId; page++) {
          const { data: list, error: lerr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          if (lerr || !list?.users?.length) break;
          const u = list.users.find((x: any) => (x.email || "").toLowerCase() === email);
          if (u) parentUserId = u.id;
          if (list.users.length < 200) break;
        }
        if (!parentUserId) return { error: "provision_failed", status: 500 };
      }

      // profile (บาง instance มี trigger handle_new_user สร้างให้แล้ว → ใช้ upsert)
      const { error: profErr } = await admin.from("profiles").upsert(
        {
          id: parentUserId,
          first_name: "ผู้ปกครองของ",
          last_name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
          // ห้ามใส่ student_code: trigger จะผูกบัญชีผู้ปกครองเป็นบัญชีนักเรียนเอง
          school_id: student.school_id ?? null,
          account_linked: true,
        },
        { onConflict: "id" },
      );

      // role = parent (เท่านั้น — ห้ามให้สิทธิ์อื่น)
      const { error: roleErr } = await admin.from("user_roles").upsert(
        { user_id: parentUserId, role: "parent" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

      if (profErr || roleErr) {
        console.error("parent profile/role failed", profErr, roleErr);
        return { error: "provision_failed", status: 500 };
      }
      // ผูกกับนักเรียน
      const patch = student.parent_user_id
        ? { parent_user_id_2: parentUserId }
        : { parent_user_id: parentUserId };
      const { error: linkErr } = await admin.from("students").update(patch).eq("id", student.id);
      if (linkErr) {
        console.error("parent link failed", linkErr);
        return { error: "link_failed", status: 500 };
      }
    }

    // 3) ป้องกันการยกระดับสิทธิ์: บัญชีผู้ปกครองต้องไม่มี role อื่น
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", parentUserId);
    const roleList = (roles ?? []).map((r: any) => r.role);
    if (roleList.some((r: string) => r !== "parent")) {
      return { error: "not_a_parent_account", status: 403 };
    }
    if (!roleList.includes("parent")) {
      await admin.from("user_roles").insert({ user_id: parentUserId, role: "parent" });
    }

    return { parentUserId: parentUserId! };
}
