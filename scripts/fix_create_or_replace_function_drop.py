#!/usr/bin/env python3
"""
Add DROP FUNCTION IF EXISTS ... CASCADE before every CREATE OR REPLACE FUNCTION
in supabase/migrations/*.sql to prevent the PostgreSQL error 42P13
(cannot change name of input parameter) when function parameter names change.

Drops by type signature (parameter names and defaults are stripped).
"""
import re, glob, os
from pathlib import Path

MIGRATIONS_DIR = Path("supabase/migrations")


def find_function_signatures(content: str):
    """Yield (start_idx, end_idx, name, full_arg_string) for each
    CREATE OR REPLACE FUNCTION public.name(args) occurrence."""
    pattern = re.compile(r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+", re.IGNORECASE)
    for m in pattern.finditer(content):
        start = m.start()
        after = m.end()
        # Parse schema.name
        name_match = re.match(r"(public\.\w+)", content[after:])
        if not name_match:
            continue
        name = name_match.group(1)
        after += name_match.end()
        # Skip whitespace until opening paren
        ws = re.match(r"\s*", content[after:])
        after += ws.end() if ws else 0
        if content[after:after+1] != "(":
            continue
        # Find balanced closing paren
        depth = 1
        arg_start = after + 1
        i = arg_start
        while i < len(content) and depth > 0:
            if content[i] == "(":
                depth += 1
            elif content[i] == ")":
                depth -= 1
            i += 1
        if depth != 0:
            continue
        arg_str = content[arg_start:i-1]
        yield start, i, name, arg_str


def strip_arg_types(arg_str: str) -> str:
    """Return comma-separated types with parameter names and defaults removed."""
    arg_str = arg_str.strip()
    if not arg_str:
        return ""
    # Split on commas, but commas can appear inside nested parentheses
    # e.g. numeric(10,2). We split only on top-level commas.
    parts = []
    depth = 0
    current = ""
    for ch in arg_str:
        if ch == "(":
            depth += 1
            current += ch
        elif ch == ")":
            depth -= 1
            current += ch
        elif ch == "," and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += ch
    if current.strip():
        parts.append(current.strip())

    types = []
    for part in parts:
        # Remove DEFAULT ...
        up = part.upper()
        if " DEFAULT " in up:
            part = part[:up.find(" DEFAULT ")].strip()
        # Also handle "VARIADIC" and "IN/OUT/INOUT" modes
        tokens = part.split()
        # Type is usually the last token, possibly with schema prefix
        # If mode is present, it appears before the type
        # If parameter name is present, it appears between mode and type
        # We want the last token that is the type (e.g., uuid, text, int, public.app_role)
        # Special cases: DEFAULT may appear at the start? No, after type.
        if not tokens:
            continue
        # Strip IN/OUT/INOUT/VARIADIC from consideration if they are the first token
        if tokens[0].upper() in {"IN", "OUT", "INOUT", "VARIADIC"}:
            tokens = tokens[1:]
        # The last token is the type (could be public.app_role, uuid, etc.)
        # If it has a parenthesis like varchar(255), it's still the last token
        type_token = tokens[-1] if tokens else ""
        types.append(type_token)
    return ", ".join(types)


def already_has_drop_before(content: str, start: int, name: str, arg_types: str) -> bool:
    """Check if the 20 lines immediately preceding start already contain a matching drop."""
    preceding = content[max(0, start-3000):start]
    drop_pattern = re.compile(
        rf"DROP\s+FUNCTION\s+IF\s+EXISTS\s+{re.escape(name)}\s*\(\s*{re.escape(arg_types)}\s*\)\s*CASCADE?",
        re.IGNORECASE,
    )
    return drop_pattern.search(preceding) is not None


def process_file(path: Path) -> bool:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    edits = []
    for start, end, name, arg_str in find_function_signatures(content):
        arg_types = strip_arg_types(arg_str)
        if already_has_drop_before(content, start, name, arg_types):
            continue
        drop_sql = f"DROP FUNCTION IF EXISTS {name}({arg_types}) CASCADE;\n"
        edits.append((start, drop_sql))

    if not edits:
        return False

    # Apply edits in reverse order so indices remain valid
    edits.sort(reverse=True)
    for start, drop_sql in edits:
        content = content[:start] + drop_sql + content[start:]

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def main():
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    changed = 0
    for path in files:
        if process_file(path):
            changed += 1
    print(f"Modified {changed} migration files")


if __name__ == "__main__":
    main()
