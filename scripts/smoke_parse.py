from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from parse_logs import parse_lines, enrich_record

if __name__ == "__main__":
    sample_path = Path("data/raw_logs_sample.txt")
    lines = sample_path.read_text(encoding="utf-8").splitlines()
    records = parse_lines(lines)
    enriched = [enrich_record(r) for r in records]
    print(json.dumps(enriched, indent=2))
