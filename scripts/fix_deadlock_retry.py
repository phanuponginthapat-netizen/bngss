#!/usr/bin/env python3
"""เพิ่ม retry เมื่อเจอ deadlock_detected / lock_not_available ใน guard block ของ migration

ปัญหา: ถ้ามี traffic จากแอป (PostgREST) ระหว่างรัน migration ตัว DDL (DROP POLICY /
ALTER TABLE) ต้องการ AccessExclusiveLock แล้วชนกับ AccessShareLock -> deadlock (40P01)

วิธีแก้: ห่อ body ของ guard block ด้วย LOOP + sub-block ที่ดัก deadlock แล้วรอ+ลองใหม่
"""
import re
import pathlib

SKIP_EXC = ("undefined_table OR undefined_column OR undefined_function OR undefined_object "
            "OR undefined_parameter OR invalid_text_representation OR duplicate_object "
            "OR duplicate_table")

# DO $guard$ [DECLARE ...] BEGIN <body> EXCEPTION WHEN <skip> THEN RAISE NOTICE ...; END $guard$;
PATTERN = re.compile(
    r"DO \$guard\$\n(?P<decl>DECLARE\n(?:.*?\n)??)?BEGIN\n(?P<body>.*?)\nEXCEPTION WHEN "
    + re.escape(SKIP_EXC)
    + r" THEN\n(?P<handler>.*?)\nEND\n\$guard\$;",
    re.DOTALL,
)


def build(m: re.Match) -> str:
    decl = (m.group("decl") or "").rstrip("\n")
    body = m.group("body")
    handler = m.group("handler").strip()
    if decl:
        decl_block = decl + "\n  _ddl_try int := 0;\n"
    else:
        decl_block = "DECLARE\n  _ddl_try int := 0;\n"
    body_indented = "\n".join(("    " + ln) if ln.strip() else ln for ln in body.split("\n"))
    return (
        "DO $guard$\n"
        + decl_block
        + "BEGIN\n"
        "  LOOP\n"
        "    BEGIN\n"
        "    SET LOCAL lock_timeout = '5s';\n"
        + body_indented + "\n"
        "    EXIT;\n"
        "    EXCEPTION\n"
        "      WHEN deadlock_detected OR lock_not_available THEN\n"
        "        _ddl_try := _ddl_try + 1;\n"
        "        IF _ddl_try >= 10 THEN\n"
        "          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;\n"
        "          EXIT;\n"
        "        END IF;\n"
        "        PERFORM pg_sleep(0.4 * _ddl_try);\n"
        "      WHEN " + SKIP_EXC + " THEN\n"
        "        " + handler + "\n"
        "        EXIT;\n"
        "    END;\n"
        "  END LOOP;\n"
        "END\n"
        "$guard$;"
    )


def main() -> None:
    files = sorted(pathlib.Path("supabase/migrations").glob("*.sql"))
    changed = total = 0
    for f in files:
        src = f.read_text()
        if "_ddl_try" in src:
            continue
        new, n = PATTERN.subn(build, src)
        if n:
            f.write_text(new)
            changed += 1
            total += n
    print(f"patched {total} guard blocks in {changed} files")


if __name__ == "__main__":
    main()
