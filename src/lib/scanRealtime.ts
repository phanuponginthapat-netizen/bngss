export const SCAN_RECEIPT_EVENT = "facegate:receipt";
export const scanQueryAffected = (key: readonly unknown[]) => {
  const name = String(key[0] ?? "");
  return /attendance|face-logs|face-chart|face-report|homeroom_dashboard|student.*scan|scan.*student/i.test(name);
};