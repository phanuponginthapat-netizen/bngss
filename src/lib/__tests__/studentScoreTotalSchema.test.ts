// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("authoritative imported totals in the database", () => {
  it("accepts a file total of 83 and preserves existing totals after schema repair", async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE public.student_scores (
        id integer PRIMARY KEY, assignment_score numeric, midterm_score numeric,
        final_score numeric, attendance_score numeric,
        total_score numeric GENERATED ALWAYS AS (
          coalesce(assignment_score,0)+coalesce(midterm_score,0)+coalesce(final_score,0)+coalesce(attendance_score,0)
        ) STORED
      ); INSERT INTO public.student_scores (id,assignment_score) VALUES (1,73);`);
      const file = readdirSync("drizzle/migrations").find(name => name.endsWith("_student_scores_authoritative_total.sql"));
      if (file) await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
      await db.exec("INSERT INTO public.student_scores (id,assignment_score,total_score) VALUES (2,10,83)");
      expect((await db.query("SELECT id,total_score::float8 AS total FROM public.student_scores ORDER BY id")).rows)
        .toEqual([{ id: 1, total: 73 }, { id: 2, total: 83 }]);
      await db.exec("UPDATE public.student_scores SET assignment_score=20 WHERE id=2");
      expect((await db.query("SELECT total_score::float8 AS total FROM public.student_scores WHERE id=2")).rows)
        .toEqual([{ total: 83 }]);
    } finally { await db.close(); }
  }, 30000);
});