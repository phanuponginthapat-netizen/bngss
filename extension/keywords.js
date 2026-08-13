// Safe Browser — ชุดคำต้องห้ามในตัว (ใช้ร่วมกันระหว่าง background และ content script)
// หมวดหมู่: gambling (พนัน), adult (ลามก), drugs (ยาเสพติด), violence (ความรุนแรง/อาวุธ), cheat (ทุจริตการเรียน)
const SB_KEYWORD_CATEGORIES = {
  gambling: {
    label: "การพนัน",
    words: [
      "บาคาร่า", "คาสิโน", "แทงบอล", "พนันออนไลน์", "สล็อตออนไลน์", "สล็อตเว็บตรง",
      "เว็บพนัน", "หวยออนไลน์", "ซื้อหวย", "แทงหวย", "ยิงปลา", "เครดิตฟรี",
      "สมัครสมาชิกรับเครดิต", "ไฮโล", "ป๊อกเด้ง", "บอลสเต็ป", "เว็บตรงไม่ผ่านเอเย่นต์",
      "casino", "baccarat", "sportsbook", "sbobet", "ufabet", "pgslot", "pg slot",
      "slotxo", "joker123", "betting", "online gambling", "poker online", "roulette",
      "lottovip", "huay", "jackpot slot", "free credit",
    ],
  },
  adult: {
    label: "สื่อลามก / 18+",
    words: [
      "หนังโป๊", "คลิปโป๊", "หนังเอ็กซ์", "หนังav", "ดูหนังโป้", "โป๊ไทย", "เย็ดกัน",
      "คลิปหลุด", "หนังผู้ใหญ่", "เว็บโป๊", "นัดเย็ด", "ขายบริการทางเพศ",
      "porn", "pornhub", "xvideos", "xnxx", "xhamster", "hentai", "sex video",
      "nude", "nudes", "camgirl", "escort service", "adult video", "xxx video",
      "onlyfans leak", "jav uncensored",
    ],
  },
  drugs: {
    label: "ยาเสพติด / บุหรี่ / สุรา",
    words: [
      "ยาบ้า", "ยาไอซ์", "กัญชาส่งด่วน", "ขายกัญชา", "น้ำกระท่อม", "ยาเค",
      "บุหรี่ไฟฟ้า", "พอตใช้แล้วทิ้ง", "ขายพอต", "ขายเหล้าเถื่อน",
      "buy weed", "buy cocaine", "meth for sale", "vape shop", "e-cigarette buy",
    ],
  },
  violence: {
    label: "ความรุนแรง / อาวุธ",
    words: [
      "ขายปืนเถื่อน", "ปืนไทยประดิษฐ์", "ระเบิดทำเอง", "วิธีทำระเบิด", "รับจ้างฆ่า",
      "how to make a bomb", "buy gun online", "gore video", "beheading video",
    ],
  },
  selfharm: {
    label: "ทำร้ายตัวเอง",
    words: [
      "วิธีฆ่าตัวตาย", "อยากตายวิธี", "กรีดข้อมือ",
      "how to commit suicide", "suicide method", "self harm method",
    ],
  },
  cheat: {
    label: "ทุจริตการเรียน",
    words: ["รับทำการบ้าน", "รับทำรายงาน", "จ้างทำวิทยานิพนธ์", "ขายข้อสอบ", "เฉลยข้อสอบจริง"],
  },
};

const SB_DEFAULT_CATEGORIES = ["gambling", "adult", "drugs", "violence", "selfharm"];

function sbBuildKeywordList(cfg) {
  const enabled = (() => {
    try {
      const raw = cfg?.browser_keyword_categories;
      if (!raw) return SB_DEFAULT_CATEGORIES;
      const v = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(v) && v.length ? v : SB_DEFAULT_CATEGORIES;
    } catch { return SB_DEFAULT_CATEGORIES; }
  })();

  const words = [];
  for (const cat of enabled) {
    const c = SB_KEYWORD_CATEGORIES[cat];
    if (c) for (const w of c.words) words.push({ w: w.toLowerCase(), cat });
  }
  const custom = String(cfg?.browser_keywords || "")
    .split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  for (const w of custom) words.push({ w, cat: "custom" });

  const allow = String(cfg?.browser_keyword_allowlist || "")
    .split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

  return { words, allow };
}

// ตรวจข้อความ → คืน hit แรกที่เจอ (หรือ null)
function sbMatchKeywords(text, list) {
  const t = String(text || "").toLowerCase();
  if (!t) return null;
  for (const a of list.allow) if (a && t.includes(a)) return null;
  for (const k of list.words) {
    if (!k.w) continue;
    if (t.includes(k.w)) return k;
  }
  return null;
}

// นับจำนวนคำที่เจอในเนื้อหาหน้าเว็บ (ใช้กับ page scan เพื่อลด false positive)
function sbCountKeywords(text, list, limit = 3) {
  const t = String(text || "").toLowerCase();
  if (!t) return { count: 0, hits: [] };
  for (const a of list.allow) if (a && t.includes(a)) return { count: 0, hits: [] };
  const hits = [];
  for (const k of list.words) {
    if (!k.w) continue;
    if (t.includes(k.w)) {
      hits.push(k);
      if (hits.length >= limit) break;
    }
  }
  return { count: hits.length, hits };
}

if (typeof self !== "undefined") {
  self.SB_KEYWORD_CATEGORIES = SB_KEYWORD_CATEGORIES;
  self.SB_DEFAULT_CATEGORIES = SB_DEFAULT_CATEGORIES;
  self.sbBuildKeywordList = sbBuildKeywordList;
  self.sbMatchKeywords = sbMatchKeywords;
  self.sbCountKeywords = sbCountKeywords;
}
