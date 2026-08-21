// SDQ 25 ข้อ ฉบับกรมสุขภาพจิต — สพฐ. (ครู/ผู้ปกครอง/ตนเอง)
// คะแนน 0=ไม่จริง, 1=ค่อนข้างจริง, 2=จริงแน่นอน — บางข้อกลับคะแนน
export const SDQ_QUESTIONS: { id: number; text: string; reverse?: boolean }[] = [
  { id: 1, text: "ใส่ใจความรู้สึกของผู้อื่น" , reverse: true },
  { id: 2, text: "กระสับกระส่าย วุ่นวาย ไม่อยู่กับที่" },
  { id: 3, text: "บ่นปวดหัว ปวดท้อง คลื่นไส้บ่อย" },
  { id: 4, text: "ชอบแบ่งปันกับเด็กอื่น", reverse: true },
  { id: 5, text: "โกรธแรงและมักอาละวาด" },
  { id: 6, text: "อยู่คนเดียว ชอบเล่นคนเดียว" },
  { id: 7, text: "โดยทั่วไปเชื่อฟังผู้ใหญ่", reverse: true },
  { id: 8, text: "ขี้กังวล หลายเรื่อง" },
  { id: 9, text: "ช่วยเหลือผู้อื่นถ้าเขาบาดเจ็บ ป่วย หรือเสียใจ", reverse: true },
  { id: 10, text: "นั่งหรือยืนอยู่ไม่นิ่ง" },
  { id: 11, text: "มีเพื่อนสนิทอย่างน้อยหนึ่งคน", reverse: true },
  { id: 12, text: "ทะเลาะกับเด็กอื่นบ่อย" },
  { id: 13, text: "เศร้า ท้อแท้ ร้องไห้บ่อย" },
  { id: 14, text: "เป็นที่ชื่นชอบของเด็กอื่นทั่วไป", reverse: true },
  { id: 15, text: "วอกแวกง่าย สมาธิสั้น" },
  { id: 16, text: "กังวลใจเวลาอยู่ในสถานการณ์ใหม่ๆ เสียความมั่นใจง่าย" },
  { id: 17, text: "ใจดีกับเด็กที่อายุน้อยกว่า" , reverse: true },
  { id: 18, text: "โกหกหรือขโมยบ่อย" },
  { id: 19, text: "ถูกล้อเลียนหรือถูกแกล้งจากเด็กอื่น" },
  { id: 20, text: "ชอบอาสาช่วยเหลือผู้อื่น", reverse: true },
  { id: 21, text: "คิดก่อนทำ" , reverse: true },
  { id: 22, text: "ขโมยของจากบ้าน โรงเรียน หรือที่อื่น" },
  { id: 23, text: "เข้ากับผู้ใหญ่ได้ดีกว่าเด็กด้วยกัน" },
  { id: 24, text: "หวาดกลัวหลายเรื่อง ตกใจง่าย" },
  { id: 25, text: "ทำงานจนเสร็จ มีสมาธิดี", reverse: true },
];

// map ข้อ -> หมวด
const MAP: Record<string, number[]> = {
  emotional: [3,8,13,16,24],
  conduct: [5,7,12,18,22],
  hyper: [2,10,15,21,25],
  peer: [6,11,14,19,23],
  prosocial: [1,4,9,17,20],
};
const REVERSE = new Set([7,11,14,21,25,1,4,9,17,20]);

export function scoreSDQ(answers: Record<number,0|1|2>){
  const scoreFor = (ids:number[])=> ids.reduce((s,id)=>{ let v=answers[id]??0; if(REVERSE.has(id)) v=2-v; return s+v; },0);
  const emotional=scoreFor(MAP.emotional);
  const conduct=scoreFor(MAP.conduct);
  const hyper=scoreFor(MAP.hyper);
  const peer=scoreFor([11,14,19,23,6]); // correct peer per สพฐ. manual
  const prosocial=scoreFor(MAP.prosocial);
  const total = emotional+conduct+hyper+peer;
  return { emotional, conduct, hyper, peer, prosocial, total };
}

export function sdqLevel(total:number){
  if(total<=13) return {label:"ปกติ", color:"green"};
  if(total<=16) return {label:"เสี่ยง", color:"yellow"};
  return {label:"มีปัญหา", color:"red"};
}
