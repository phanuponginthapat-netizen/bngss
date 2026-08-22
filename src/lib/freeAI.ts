// AI ฟรี ไม่ต้องใช้ API — รันในเบราว์เซอร์ด้วย Transformers.js (WASM)
// โมเดล Xenova/LaMini-Flan-T5-783M (~300MB ครั้งแรก, cache ไว้) รองรับไทย + อังกฤษ
let pipe: any = null;
let loading: Promise<any> | null = null;

export async function loadFreeAI(onProgress?: (p:string)=>void){
  if(pipe) return pipe;
  if(loading) return loading;
  loading = (async()=>{
    onProgress?.("กำลังโหลด AI ฟรีครั้งแรก (~300MB)...");
    const { pipeline, env } = await import("@huggingface/transformers");
    // @ts-ignore
    env.allowRemoteModels = true;
    // @ts-ignore
    env.allowLocalModels = false;
    pipe = await pipeline("text2text-generation", "Xenova/LaMini-Flan-T5-783M", {
      // @ts-ignore
      progress_callback: (x:any)=> onProgress?.(`${x.status} ${Math.round((x.progress||0)*100)}%`),
    });
    onProgress?.("พร้อมใช้งาน (ออฟไลน์ได้)");
    return pipe;
  })();
  return loading;
}

export async function askFreeAI(prompt: string, onProgress?: (p:string)=>void): Promise<string>{
  const p = await loadFreeAI(onProgress);
  const out: any = await p(prompt, { max_new_tokens: 256, temperature: 0.7 });
  const text = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text;
  return String(text||"").trim() || "ขออภัย ลองใหม่ครับ";
}

// สำหรับใบงาน/เฉลย — ใช้ prompt สำเร็จรูป
export async function generateFreeWorksheet(topic: string){
  return askFreeAI(`สร้างใบงานเรื่อง ${topic} พร้อมเฉลย แบบ สพฐ. ป.1-ม.6`);
}
