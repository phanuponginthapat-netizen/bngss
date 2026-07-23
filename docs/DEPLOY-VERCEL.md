# 🚀 Deploy ระบบไปยัง Vercel (ฉบับละเอียด)

คู่มือทีละขั้น สำหรับคนที่ไม่ใช่ dev ก็ทำตามได้

> 💡 **ทางลัด**: หลัง deploy เสร็จ เปิด `/setup` เพื่อรัน Setup Wizard ตรวจสอบทุกอย่างอัตโนมัติ

---

## 📋 ต้องมีก่อน

- บัญชี [GitHub](https://github.com) (ฟรี)
- บัญชี [Vercel](https://vercel.com) (ฟรี) — sign in ด้วย GitHub ได้เลย
- Supabase project (จะใช้ Lovable Cloud หรือสร้าง Supabase ตรงๆ ก็ได้)

## 🎯 ภาพรวม 3 ขั้น

```text
[1] Push โค้ดขึ้น GitHub  →  [2] Import ใน Vercel  →  [3] ตั้ง env + Deploy
```

---

## ขั้นที่ 1 · Push โค้ดขึ้น GitHub

ถ้าใช้ Lovable — กดปุ่ม **GitHub → Connect** มุมขวาบน ระบบจะสร้าง repo ให้อัตโนมัติ

ถ้าทำเอง:
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## ขั้นที่ 2 · Import ที่ Vercel

1. เข้า [vercel.com/new](https://vercel.com/new)
2. เลือก GitHub repo ที่เพิ่ง push
3. Framework Preset จะขึ้น **Vite** อัตโนมัติ (ตาม `vercel.json` ที่มีให้แล้ว)
4. ปล่อย Build settings ตามค่าเริ่มต้น:
   - Build Command: `vite build`
   - Output Directory: `dist`
   - Install Command: `npm install --legacy-peer-deps`
5. **อย่ากด Deploy** — ไปตั้ง env ก่อน

## ขั้นที่ 3 · ตั้ง Environment Variables

Vercel → **Settings → Environment Variables** → เพิ่ม 3 ตัว:

| Key | หาค่าได้จาก |
| --- | --- |
| `VITE_SUPABASE_URL` | Lovable Cloud → Overview / หรือ Supabase → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon / Publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Project ref (ส่วนที่อยู่ใน URL: `<ref>.supabase.co`) |

Scope: ติ๊กทั้ง **Production / Preview / Development**

จากนั้นกด **Deploy** — Vercel จะ build แล้วได้ URL `https://<project>.vercel.app`

---

## ขั้นตอนเสริม (สำคัญ)

### 🔐 ตั้งค่า Supabase Auth URL

Supabase Dashboard → **Authentication → URL Configuration**:
- Site URL: `https://<project>.vercel.app`
- Redirect URLs: เพิ่ม `https://<project>.vercel.app/**`

**ถ้าไม่ทำ** → login ผ่าน Google จะเด้งไป localhost หรือ error

### 🌐 Custom Domain

Vercel → **Settings → Domains** → เพิ่มโดเมน → ทำตาม DNS records ที่ Vercel แสดง

จากนั้นกลับไปแก้ Supabase Auth URL ให้ตรงกับ custom domain

### 🔄 Redeploy อัตโนมัติ

- Push โค้ดใหม่ไป `main` → Vercel redeploy อัตโนมัติ
- แก้ env → ต้อง trigger redeploy 1 ครั้ง (Deployments → ⋯ → Redeploy)

---

## 🐛 ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
| --- | --- | --- |
| หน้าขาว / blank | env ไม่ครบ | ตรวจ 3 ตัวด้านบน แล้ว redeploy |
| Login แล้วเด้งกลับ localhost | Supabase Site URL ยังชี้ localhost | แก้ที่ Supabase Auth URL |
| 404 เมื่อ refresh หน้าลึก | ไม่มี SPA rewrite | ตรวจว่า `vercel.json` ยังอยู่ |
| Build failed: peer deps | Install command ผิด | ต้องเป็น `npm install --legacy-peer-deps` |
| Edge functions ไม่ทำงาน | Vercel ไม่ได้ host ส่วนนี้ | Edge functions รันบน Supabase อยู่แล้ว |

---

## ✅ ตรวจสอบหลัง deploy

เปิด `https://<project>.vercel.app/setup` — Setup Wizard จะเช็คให้อัตโนมัติว่า:
1. ✅ Env ครบ
2. ✅ เชื่อมต่อ DB ได้
3. ✅ มี admin
4. ✅ ตั้ง CMS แล้ว
5. ✅ พร้อม deploy

---

_กลับไปคู่มือหลัก: [docs/README.md](./README.md)_
