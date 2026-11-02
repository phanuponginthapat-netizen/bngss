export async function readAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const result = await page(offset, offset + size - 1);
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("Source returned no data payload");
    rows.push(...result.data);
    if (result.data.length < size) return rows;
  }
}