// ── Request flow control ────────────────────────────────────────────────
// จุดประสงค์: ให้การดึงข้อมูลจาก backend "ไหลลื่น" และไม่เกิดคอขวด
// เมื่อมีผู้ใช้จำนวนมากเข้าพร้อมกัน (Supabase free tier / transaction pooler)
//
// 1) Concurrency gate — จำกัดจำนวน request ที่วิ่งพร้อมกันต่อแท็บ
//    เบราว์เซอร์ยิงได้ไม่จำกัดผ่าน HTTP/2 แต่ฝั่ง DB จะแย่ง connection กัน
//    ทำให้ทุกคำขอช้าลงทั้งหมด → คุมไว้ ~6 พร้อมกัน แล้วต่อคิวที่เหลือ
// 2) In-flight dedup — คำขออ่าน (GET) ที่ URL เหมือนกันเป๊ะและยังไม่เสร็จ
//    จะแชร์ผลลัพธ์เดียวกัน (หลายคอมโพเนนต์เปิดหน้าเดียวกัน = 1 query)
// 3) Backoff — เจอ 429/503 (pooler เต็ม) ให้รอแล้วลองใหม่แบบมีขอบเขต

const MAX_CONCURRENT = 6;
const MAX_RETRIES = 2;

let active = 0;
const queue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => queue.push(resolve));
}

function release() {
  const next = queue.shift();
  if (next) next();
  else active = Math.max(0, active - 1);
}

const inflight = new Map<string, Promise<Response>>();

function requestKey(input: RequestInfo | URL, init?: RequestInit): string | null {
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET") return null;
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  // อ่านอย่างเดียวและไม่มี body → ปลอดภัยที่จะแชร์ผล
  return `${url}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ครอบ fetch ด้วยคิว + dedup + backoff */
export function createFlowFetch(baseFetch: typeof fetch): typeof fetch {
  const run = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    await acquire();
    try {
      let attempt = 0;
      for (;;) {
        const res = await baseFetch(input as any, init);
        // pooler/rate limit เต็ม → รอแล้วลองใหม่ (มีขอบเขต)
        if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
          const retryAfter = Number(res.headers.get("Retry-After"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 300 * Math.pow(2, attempt) + Math.random() * 200;
          attempt++;
          await sleep(waitMs);
          continue;
        }
        return res;
      }
    } finally {
      release();
    }
  };

  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const key = requestKey(input, init);
    if (!key) return run(input, init);

    const existing = inflight.get(key);
    // clone() เพื่อให้ผู้เรียกแต่ละรายอ่าน body ได้เอง
    if (existing) return existing.then((r) => r.clone());

    const p = run(input, init).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p.then((r) => r.clone());
  }) as typeof fetch;
}
