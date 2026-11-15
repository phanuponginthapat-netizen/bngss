"""Cross-device student receipts, separate from local pending scans."""
def confirmed_scan_keys(data, today):
    if data.get("scan_date") != today:
        return set()
    return {
        (row["student_id"], row["direction"])
        for row in data.get("scans", [])
        if row.get("student_id") and row.get("direction") in ("in", "out")
    }