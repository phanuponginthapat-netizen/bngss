export async function readAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error('source unavailable');
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
}