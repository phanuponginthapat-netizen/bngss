/** Identity separation uses the closest ORIGINAL sample of every person.
 * Averaging a rival's worse photos must never hide a plausible lookalike.
 */
export const FACE_IDENTITY_MARGIN = 0.12;

export function faceIdentityClear(candidate: string, scores: ReadonlyMap<string, number>): boolean {
  const own = scores.get(candidate);
  if (own === undefined || !Number.isFinite(own)) return false;
  for (const [id, score] of scores) {
    if (!Number.isFinite(score)) return false;
    if (id !== candidate && own - score < FACE_IDENTITY_MARGIN) return false;
  }
  return true;
}