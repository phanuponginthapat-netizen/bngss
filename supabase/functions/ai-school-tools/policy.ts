export const toolNames = { analyze: "วิเคราะห์ไฟล์", worksheet: "ใบงาน", lesson: "แผนการสอน", quiz: "ข้อสอบฝึกทบทวน", grades: "สรุปผลการเรียน" } as const;
export type SchoolTool = keyof typeof toolNames;
export function isSchoolTool(value: unknown): value is SchoolTool {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(toolNames, value);
}
export function canUseSchoolTool(tool: SchoolTool, roles: string[]) {
  if (tool === "grades" || tool === "analyze") return true;
  if (roles.some(role => ["admin", "director", "teacher"].includes(role))) return true;
  return tool === "quiz" && roles.includes("student");
}
export function buildSchoolToolPrompt(tool: SchoolTool, topic: string, grade: string, count: number) {
  if (tool === "analyze") return `วิเคราะห์เอกสารตามคำถาม: ${topic} ตอบภาษาไทย อ้างชื่อไฟล์/หน้า/แผ่นงานเมื่อมี สรุปเฉพาะข้อมูลที่ได้รับ ไม่เดาส่วนที่ขาด ไม่อ้างว่าตรวจฐานข้อมูลโรงเรียน ไม่คำนวณคะแนนรวมใหม่ แยกข้อเท็จจริงกับข้อเสนอแนะ`;
  const shared = `สร้าง${toolNames[tool]}เป็นภาษาไทย เรื่อง/ข้อมูล: ${topic}\nระดับชั้น: ${grade || "ไม่ระบุ ให้ถามระดับชั้นหากจำเป็น"}\nใช้ Markdown ที่อ่านและพิมพ์ได้ ไม่ส่ง HTML หรือโค้ด ระบุว่าเป็นร่าง/แบบฝึกตัวอย่าง ไม่อ้างว่าบันทึกเข้าสู่ระบบแล้ว ห้ามแต่งข้อมูลโรงเรียนหรือรหัสตัวชี้วัดที่ไม่มั่นใจ ใช้ช่องว่างสำหรับชื่อและวันที่ที่ไม่ได้ให้มา`;
  if (tool === "worksheet") return `${shared}\nมีจุดประสงค์ คำชี้แจง ตัวอย่างสั้น และแบบฝึก ${count} ข้อพร้อมพื้นที่ตอบ แยกเฉลยครูท้ายเอกสาร ตรวจคำตอบและระดับความยาก`;
  if (tool === "lesson") return `${shared}\nมีสาระสำคัญ จุดประสงค์ K/P/A กิจกรรมเรียนรู้เป็นขั้น สื่อ การวัดและประเมินผล และบันทึกหลังสอนเว้นว่าง หากไม่ระบุเวลาให้ใส่ [ระยะเวลาสอน] ไม่แต่งผลการสอนที่ยังไม่เกิดขึ้น`;
  if (tool === "quiz") return `${shared}\nสร้างแบบทดสอบฝึกใหม่ ${count} ข้อ ตัวเลือก 4 ตัวเลือก มีคำตอบถูกเพียงข้อเดียว พร้อมเฉลยและคำอธิบายแยกท้ายเอกสาร ไม่เฉลยข้อสอบจริงที่ผู้ใช้นำมาสอบ`;
  return `${shared}\nสรุปเฉพาะคะแนน/เกรดและปี/ภาคเรียนที่ผู้ใช้ให้มา ไม่ดึงหรืออ้างข้อมูลบุคคลอื่น ไม่คำนวณคะแนนรวมใหม่ ไม่สร้าง GPA ไม่เดาคะแนนที่ขาด หากไม่ระบุปี/ภาคเรียนให้ถามก่อน เปรียบเทียบเฉพาะเทอมเดียวกัน แยกข้อเท็จจริงกับข้อเสนอแนะ ไม่อ้างว่าได้ตรวจฐานข้อมูลโรงเรียน`;
}