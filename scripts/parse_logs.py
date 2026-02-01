import argparse
import json
import re
from typing import Dict, List, Optional

TIMESTAMP_RE = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) - (?P<service>[^ ]+) - (?P<level>[A-Z]+) - (?P<msg>.*)$"
)
ROUTE_RE = re.compile(r"\bon (?P<route>/[^\s\[]+)")
METHOD_RE = re.compile(r"\[(GET|POST|PUT|PATCH|DELETE)\]")
STATUS_RE = re.compile(r"\b([2345]\d{2})\b")

LABEL_RULES = [
    ("missing authorization header", "auth", "medium"),
    ("jwt", "auth", "medium"),
    ("unauthorized", "auth", "medium"),
    ("nameerror", "api", "high"),
    ("traceback", "api", "high"),
    ("exception on", "api", "high"),
    ("mongo", "db", "high"),
    ("database", "db", "high"),
    ("timeout", "infra", "high"),
    ("bad gateway", "infra", "high")
]

REASON_RULES = [
    ("missing authorization header", "Missing Authorization Header"),
    ("noauthorizationerror", "NoAuthorizationError"),
    ("permissionerror", "PermissionError"),
    ("forbidden", "Forbidden"),
    ("unauthorized", "Unauthorized"),
    ("nameerror", "NameError"),
    ("typeerror", "TypeError"),
    ("valueerror", "ValueError"),
    ("keyerror", "KeyError"),
    ("indexerror", "IndexError"),
    ("attributeerror", "AttributeError"),
    ("validationerror", "ValidationError"),
    ("jsondecodeerror", "JSONDecodeError"),
    ("runtimeerror", "RuntimeError"),
    ("timeout", "Timeout"),
    ("timeouterror", "TimeoutError"),
    ("connection refused", "Connection Refused"),
    ("connectionerror", "ConnectionError"),
    ("bad gateway", "Bad Gateway"),
    ("internal server error", "Internal Server Error"),
    ("traceback", "Unhandled Exception")
]


def _default_priority(level: str) -> str:
    if level == "ERROR":
        return "high"
    if level == "WARN":
        return "medium"
    return "low"


def _apply_rules(message: str, level: str) -> Dict[str, Optional[str]]:
    msg = message.lower()
    for needle, label, priority in LABEL_RULES:
        if needle in msg:
            return {"label": label, "priority": priority}
    return {"label": None, "priority": _default_priority(level)}


def _extract_reason(message: str) -> str | None:
    msg = message.lower()
    for needle, reason in REASON_RULES:
        if needle in msg:
            return reason
    return None


def _append_record(records: List[Dict[str, str]], current: Optional[Dict[str, str]]) -> None:
    if current:
        records.append(current)


def parse_lines(lines: List[str]) -> List[Dict[str, str]]:
    records: List[Dict[str, str]] = []
    current: Optional[Dict[str, str]] = None

    for raw in lines:
        line = raw.rstrip("\n")
        if not line.strip():
            continue

        m = TIMESTAMP_RE.match(line)
        if m:
            _append_record(records, current)
            current = {
                "timestamp": m.group("ts"),
                "service": m.group("service"),
                "level": m.group("level"),
                "message": m.group("msg")
            }
            continue

        if current is None:
            current = {
                "timestamp": None,
                "service": None,
                "level": "INFO",
                "message": line.strip()
            }
        else:
            current["message"] = f"{current['message']} | {line.strip()}"

    _append_record(records, current)
    return records


def enrich_record(rec: Dict[str, str]) -> Dict[str, str]:
    message = rec.get("message") or ""
    route_match = ROUTE_RE.search(message)
    method_match = METHOD_RE.search(message)
    status_match = STATUS_RE.search(message)

    route = route_match.group("route") if route_match else None
    method = method_match.group(1) if method_match else None
    status_code = int(status_match.group(1)) if status_match else None

    rules = _apply_rules(message, rec.get("level") or "INFO")
    reason = _extract_reason(message)

    return {
        "message": message,
        "level": rec.get("level"),
        "service": rec.get("service"),
        "route": route,
        "method": method,
        "status_code": status_code,
        "timestamp": rec.get("timestamp"),
        "label": rules["label"],
        "priority": rules["priority"],
        "reason": reason
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse raw logs into JSONL for training")
    parser.add_argument("--in", dest="input_path", required=True)
    parser.add_argument("--out", dest="output_path", required=True)
    args = parser.parse_args()

    with open(args.input_path, "r", encoding="utf-8") as fh:
        lines = fh.readlines()

    records = parse_lines(lines)
    enriched = [enrich_record(r) for r in records]

    with open(args.output_path, "w", encoding="utf-8") as out:
        for row in enriched:
            out.write(json.dumps(row, ensure_ascii=True) + "\n")

    print(f"Wrote {len(enriched)} records to {args.output_path}")


if __name__ == "__main__":
    main()
