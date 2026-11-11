type Page<T> = { data: T[] | null; error: { message: string } | null };

export async function inventoryRows<T>(read: (from: number, to: number) => PromiseLike<Page<T>>, pageSize = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < 200000; from += pageSize) {
    const result = await read(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("Storage inventory unavailable");
    rows.push(...result.data);
    if (result.data.length < pageSize) return rows;
  }
  throw new Error("Storage inventory exceeds read limit");
}

type StorageObject = { id?: string | null; name: string; metadata?: { size?: number } | null };
export async function storageFootprint(read: (prefix: string, from: number, to: number) => PromiseLike<Page<StorageObject>>, prefix = "", depth = 0): Promise<{ files: number; bytes: number }> {
  if (depth > 32) throw new Error("Storage inventory exceeds folder depth");
  const objects = await inventoryRows((from, to) => read(prefix, from, to));
  let files = 0;
  let bytes = 0;
  for (const object of objects) {
    if (object.id) {
      const size = Number(object.metadata?.size);
      if (!Number.isFinite(size) || size < 0) throw new Error("Storage file size unavailable");
      files++;
      bytes += size;
    } else if (object.name) {
      const child = await storageFootprint(read, prefix ? `${prefix}/${object.name}` : object.name, depth + 1);
      files += child.files;
      bytes += child.bytes;
    }
  }
  return { files, bytes };
}