// AI ตรวจข้อสอบ — สแกนกระดาษฝนวงกลมด้วยกล้อง → ให้คะแนนอัตโนมัติ
export interface AnswerKey { [q: number]: "A"|"B"|"C"|"D" }
export function gradeFromBubbles(detected: Record<number,string>, key: AnswerKey){
  let correct=0; const detail: any[]={} as any;
  for(const q in key){ const ans=detected[Number(q)]; const ok=ans===key[Number(q)]; if(ok) correct++; }
  return { score: correct, total: Object.keys(key).length, percent: Math.round(correct/Object.keys(key).length*100) };
}
// TODO: ต่อยอดด้วย OpenCV.js / Tesseract สำหรับอ่านลายมือ
