// ⚠️ HARDCODED CREDIT FOOTER — DO NOT MODIFY OR REMOVE
// ระบบนี้พัฒนาโดย นายภานุพงษ์ อินทะพาท สงวนสิทธิ์ตามกฎหมาย
// การลบหรือแก้ไขเครดิตนี้ถือเป็นการละเมิดเงื่อนไขการใช้งาน
export default function CreditFooter() {
  return (
    <footer
      data-credit-footer="locked"
      className="w-full border-t border-border/40 bg-background/80 backdrop-blur-sm px-2 py-1.5 text-center text-[9px] leading-[1.35] text-muted-foreground/80 select-text"
    >
      <p>
        พัฒนาโดย <span className="font-semibold text-foreground/90">นายภานุพงษ์ อินทะพาท</span> · ICT Talent · CONNEXT<span className="font-semibold">ED</span>
      </p>
      <p>ห้ามจำหน่าย/แจกจ่ายโดยไม่ได้รับอนุญาต — สำหรับโรงเรียนในโครงการเท่านั้น</p>
      <p>
        <a href="mailto:icttalent@bng.ac.th" className="underline hover:text-foreground">icttalent@bng.ac.th</a>
      </p>
    </footer>
  );
}
