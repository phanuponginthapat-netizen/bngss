// ตัวช่วยจัดสายการแข่งขัน — แพ้คัดออก / พบกันหมด / แบ่งสาย+น็อกเอาต์

export type BracketEntry = { id: string; name: string; seed?: number | null };

export type GeneratedMatch = {
  round: number;
  match_no: number;
  bracket_slot: string | null;
  participant_a_id: string | null;
  participant_b_id: string | null;
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** จำนวนรอบทั้งหมดของสายแพ้คัดออก */
export const roundsFor = (n: number) => Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));

export const roundLabel = (round: number, totalRounds: number) => {
  const left = totalRounds - round;
  if (left === 0) return "รอบชิงชนะเลิศ";
  if (left === 1) return "รอบรองชนะเลิศ";
  if (left === 2) return "รอบก่อนรองชนะเลิศ";
  return `รอบที่ ${round}`;
};

/** สายแพ้คัดออก — เติม BYE อัตโนมัติให้ครบกำลัง 2 */
export function singleElimination(entries: BracketEntry[], randomize = true): GeneratedMatch[] {
  const list = randomize ? shuffle(entries) : [...entries];
  list.sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
  const n = list.length;
  if (n < 2) return [];
  const size = 2 ** roundsFor(n);
  const slots: (BracketEntry | null)[] = [...list, ...Array(size - n).fill(null)];
  const matches: GeneratedMatch[] = [];
  let matchNo = 1;
  for (let i = 0; i < size; i += 2) {
    matches.push({
      round: 1,
      match_no: matchNo++,
      bracket_slot: null,
      participant_a_id: slots[i]?.id ?? null,
      participant_b_id: slots[i + 1]?.id ?? null,
    });
  }
  const totalRounds = roundsFor(n);
  let prev = size / 2;
  for (let round = 2; round <= totalRounds; round++) {
    prev = prev / 2;
    for (let i = 0; i < prev; i++) {
      matches.push({
        round,
        match_no: matchNo++,
        bracket_slot: null,
        participant_a_id: null,
        participant_b_id: null,
      });
    }
  }
  return matches;
}

/** พบกันหมด (round robin) */
export function roundRobin(entries: BracketEntry[], slot?: string): GeneratedMatch[] {
  const matches: GeneratedMatch[] = [];
  let matchNo = 1;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      matches.push({
        round: 1,
        match_no: matchNo++,
        bracket_slot: slot ?? null,
        participant_a_id: entries[i].id,
        participant_b_id: entries[j].id,
      });
    }
  }
  return matches;
}

/** แบ่งสาย A,B,C... แล้วพบกันหมดในสาย */
export function groupStage(entries: BracketEntry[], groupCount: number) {
  const g = Math.max(2, Math.min(8, groupCount || 2));
  const shuffled = shuffle(entries);
  const groups: Record<string, BracketEntry[]> = {};
  shuffled.forEach((e, i) => {
    const name = String.fromCharCode(65 + (i % g));
    (groups[name] ||= []).push(e);
  });
  const matches: GeneratedMatch[] = [];
  let matchNo = 1;
  Object.entries(groups).forEach(([name, list]) => {
    roundRobin(list, `สาย ${name}`).forEach((m) => {
      matches.push({ ...m, match_no: matchNo++ });
    });
  });
  return { groups, matches };
}

export const BRACKET_TYPES = [
  { value: "single_elim", label: "แพ้คัดออก (Single Elimination)" },
  { value: "round_robin", label: "พบกันหมด (Round Robin)" },
  { value: "group_knockout", label: "แบ่งสาย + น็อกเอาต์" },
  { value: "score", label: "ตัดสินด้วยคะแนน (ไม่มีสาย)" },
];
