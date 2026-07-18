import { useState, useMemo } from "react";

/**
 * Client-side pagination helper.
 * ใช้กับตารางที่ data load มาเต็มแล้ว — แค่แบ่งหน้า
 *
 * usage:
 *   const { paged, page, setPage, totalPages, pageSize } = usePagination(items, 50);
 */
export function usePagination<T>(items: T[] | undefined | null, pageSize = 50) {
  const [page, setPage] = useState(1);
  const safeItems = items || [];
  const total = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(
    () => safeItems.slice((safePage - 1) * pageSize, safePage * pageSize),
    [safeItems, safePage, pageSize]
  );

  return {
    paged,
    page: safePage,
    setPage,
    totalPages,
    pageSize,
    total,
    next: () => setPage((p) => Math.min(p + 1, totalPages)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
    reset: () => setPage(1),
  };
}
