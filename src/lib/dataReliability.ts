/** Never carry a previous user's/term's result across a changed query key. */
export const reliableQueryDefaults = {
  staleTime: 3 * 60_000,
  gcTime: 15 * 60_000,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  refetchOnReconnect: "always" as const,
};

export function requireSuccessfulReads(results: readonly { error?: unknown }[]): void {
  for (const result of results) if (result.error) throw result.error;
}

export function bangkokWeekday(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}