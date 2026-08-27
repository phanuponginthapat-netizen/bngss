---
name: Canonical department names
description: ชื่อฝ่ายงานมาตรฐานที่ personnel.department / profiles.department ต้องใช้ และการแมปกับ enum school_department
type: feature
---
ชื่อฝ่ายมาตรฐาน (ห้ามใช้ชื่อย่อ เช่น "วิชาการ", "บริหารทั่วไป"):
- สำนักผู้อำนวยการ → `director_office`
- ฝ่ายวิชาการ → `academic`
- ฝ่ายกิจการนักเรียน → `student_affairs`
- ฝ่ายบริหารงานทั่วไป → `general_admin`
- ฝ่ายงบประมาณและบุคคล → `finance_personnel`
- ConnextED (ไม่มี enum)

- trigger `ensure_personnel_required_fields` ใส่ default `ฝ่ายวิชาการ`
- หน้าที่ต้องใช้ค่าเดียวกัน: UserManagement, FirstLoginSetup, ProfilePage, dmcImport, OrgChartPage (hr + public), DepartmentManagementPage
- บัญชีระบบ: `employee_code='kiosk'` (department `ระบบ`) ต้องถูกกรองออกจากทะเบียนบุคลากร/ผังองค์กร; ผู้สังเกตการณ์ = ตำแหน่ง `ศึกษานิเทศก์`, department `หน่วยงานภายนอก`
- SQL cleanup: `scripts/sql/20260827-personnel-department-normalize.sql`
