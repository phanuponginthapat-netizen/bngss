// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("school and lesson database separation", () => {
  it("keeps school arrival, two conflicting lesson statuses and notification scopes separate", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE attendance(student_id uuid,attendance_date date,subject_id uuid,status text);
        CREATE UNIQUE INDEX uniq_attendance_per_day_subject ON attendance(student_id,attendance_date,COALESCE(subject_id,'00000000-0000-0000-0000-000000000000'::uuid));
        ALTER TABLE attendance ADD CONSTRAINT attendance_student_date_subject_key UNIQUE(student_id,attendance_date,subject_id);
        CREATE TABLE notices(kind text);
        CREATE FUNCTION auto_attendance_on_face_scan() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
        CREATE FUNCTION notify_parent_on_absence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO notices VALUES('parent'); RETURN NEW; END $$;
        CREATE FUNCTION gchat_on_absence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO notices VALUES('gchat'); RETURN NEW; END $$;
        CREATE FUNCTION auto_set_late_minutes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO notices VALUES('gate_late'); RETURN NEW; END $$;
      `);
      await db.exec(readFileSync("drizzle/migrations/0047_separate_school_and_lesson_attendance.sql", "utf8"));
      await db.exec(`
        CREATE TRIGGER parent AFTER INSERT ON attendance FOR EACH ROW EXECUTE FUNCTION notify_parent_on_absence();
        CREATE TRIGGER gchat AFTER INSERT ON attendance FOR EACH ROW EXECUTE FUNCTION gchat_on_absence();
        CREATE TRIGGER late BEFORE INSERT ON attendance FOR EACH ROW EXECUTE FUNCTION auto_set_late_minutes();
        INSERT INTO attendance VALUES('11111111-1111-1111-1111-111111111111','2026-11-16',NULL,'present',0);
        INSERT INTO attendance VALUES('11111111-1111-1111-1111-111111111111','2026-11-16','22222222-2222-2222-2222-222222222222','absent',1);
        INSERT INTO attendance VALUES('11111111-1111-1111-1111-111111111111','2026-11-16','22222222-2222-2222-2222-222222222222','present',2);
      `);
      const { rows } = await db.query("SELECT subject_id,status,period FROM attendance ORDER BY period");
      expect(rows).toEqual([
        {subject_id:null,status:"present",period:0},
        {subject_id:"22222222-2222-2222-2222-222222222222",status:"absent",period:1},
        {subject_id:"22222222-2222-2222-2222-222222222222",status:"present",period:2},
      ]);
      const notices = await db.query("SELECT kind FROM notices ORDER BY kind");
      expect(notices.rows).toEqual([{kind:"gate_late"},{kind:"gchat"},{kind:"parent"}]);
      await expect(db.exec("INSERT INTO attendance VALUES('11111111-1111-1111-1111-111111111111','2026-11-16',NULL,'absent',3)")).rejects.toThrow();
    } finally { await db.close(); }
  }, 30000);
});