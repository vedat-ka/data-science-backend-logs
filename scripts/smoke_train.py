import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from train import train_models
from app import _load_models, _models, build_text

if __name__ == "__main__":
    result = train_models("data/logs_train.jsonl", "models")
    print(json.dumps(result, indent=2))

    _load_models()
    sample = {
        "message": "DB timeout while fetching time entries",
        "level": "ERROR",
        "service": "main-api",
        "route": "/api/timeflow/time-entries",
        "status_code": 500
    }
    text = build_text(sample)

    if _models["category"]:
        print("category:", _models["category"].predict([text])[0])
    if _models["priority"]:
        print("priority:", _models["priority"].predict([text])[0])
