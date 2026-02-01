import os
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib

from train import train_models, MODEL_FILES, META_FILE, build_text
from scripts.parse_logs import parse_lines, enrich_record

APP_PORT = int(os.getenv("ML_LOG_ANALYZER_PORT", "5050"))
MODEL_DIR = os.getenv("ML_LOG_ANALYZER_MODEL_DIR", "models")
CORS_ORIGINS = os.getenv("ML_LOG_ANALYZER_CORS_ORIGINS", "*")
DATA_DIR = os.getenv("ML_LOG_ANALYZER_DATA_DIR", "data")
TRAINING_DIR = os.getenv("ML_LOG_ANALYZER_TRAINING_DIR", "training")
ANALYSIS_DIR = os.getenv("ML_LOG_ANALYZER_ANALYSIS_DIR", "analysis")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

_models = {
    "priority": None,
    "category": None,
    "reason": None,
    "meta": None
}


def _safe_join_data(path_value: str) -> Optional[str]:
    if not path_value:
        return None
    base_dir = os.path.abspath(DATA_DIR)
    candidate = path_value
    if not os.path.isabs(candidate):
        candidate = os.path.join(base_dir, candidate)
    candidate = os.path.abspath(candidate)
    if not candidate.startswith(base_dir + os.sep) and candidate != base_dir:
        return None
    return candidate


def _safe_join_training(path_value: str) -> Optional[str]:
    if not path_value:
        return None
    base_dir = os.path.abspath(TRAINING_DIR)
    candidate = path_value
    if not os.path.isabs(candidate):
        candidate = os.path.join(base_dir, candidate)
    candidate = os.path.abspath(candidate)
    if not candidate.startswith(base_dir + os.sep) and candidate != base_dir:
        return None
    return candidate


def _safe_join_analysis(path_value: str) -> Optional[str]:
    if not path_value:
        return None
    base_dir = os.path.abspath(ANALYSIS_DIR)
    candidate = path_value
    if not os.path.isabs(candidate):
        candidate = os.path.join(base_dir, candidate)
    candidate = os.path.abspath(candidate)
    if not candidate.startswith(base_dir + os.sep) and candidate != base_dir:
        return None
    return candidate


def _read_logs_file(file_path: str) -> tuple[List[Dict[str, Any]], List[str]]:
    if file_path.endswith(".jsonl"):
        logs: List[Dict[str, Any]] = []
        warnings: List[str] = []
        with open(file_path, "r", encoding="utf-8") as fh:
            for idx, line in enumerate(fh, start=1):
                raw = line.strip()
                if not raw:
                    continue
                try:
                    logs.append(json.loads(raw))
                except json.JSONDecodeError as exc:
                    warnings.append(f"Invalid JSON at line {idx}: {exc}")
        return logs, warnings

    if file_path.endswith(".json"):
        warnings: List[str] = []
        with open(file_path, "r", encoding="utf-8") as fh:
            try:
                data = json.load(fh)
            except json.JSONDecodeError:
                fh.seek(0)
                logs: List[Dict[str, Any]] = []
                for idx, line in enumerate(fh, start=1):
                    raw = line.strip()
                    if not raw:
                        continue
                    try:
                        logs.append(json.loads(raw))
                    except json.JSONDecodeError as exc:
                        warnings.append(f"Invalid JSON at line {idx}: {exc}")
                return logs, warnings

        if isinstance(data, dict) and "logs" in data:
            data = data.get("logs")
        if isinstance(data, dict):
            return [data], warnings
        if isinstance(data, list):
            return data, warnings
        return [], warnings

    raise ValueError("unsupported file format")


def _write_jsonl(file_path: str, rows: List[Dict[str, Any]]) -> None:
    with open(file_path, "w", encoding="utf-8") as out:
        for row in rows:
            out.write(json.dumps(row, ensure_ascii=True) + "\n")


def _estimate_jsonl_bytes(rows: List[Dict[str, Any]]) -> int:
    return sum(len(json.dumps(r, ensure_ascii=True).encode("utf-8")) + 1 for r in rows)


def _load_models() -> None:
    priority_path = os.path.join(MODEL_DIR, MODEL_FILES["priority"])
    category_path = os.path.join(MODEL_DIR, MODEL_FILES["category"])
    reason_path = os.path.join(MODEL_DIR, MODEL_FILES["reason"])
    meta_path = os.path.join(MODEL_DIR, META_FILE)

    if os.path.exists(priority_path):
        _models["priority"] = joblib.load(priority_path)
    if os.path.exists(category_path):
        _models["category"] = joblib.load(category_path)
    if os.path.exists(reason_path):
        _models["reason"] = joblib.load(reason_path)
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as fh:
            _models["meta"] = json.load(fh)


def _ensure_models() -> None:
    if _models["priority"] is None or _models["category"] is None or _models["reason"] is None:
        _load_models()


@app.get("/health")
def health():
    _ensure_models()
    return jsonify({
        "ok": True,
        "time": datetime.utcnow().isoformat() + "Z",
        "models": {
            "priority": _models["priority"] is not None,
            "category": _models["category"] is not None,
            "reason": _models["reason"] is not None
        }
    })


@app.post("/train")
def train_endpoint():
    payload = request.get_json(silent=True) or {}
    data_path = payload.get("data_path") or os.getenv("ML_LOG_ANALYZER_DATA", "data/logs_train.jsonl")
    out_dir = payload.get("out_dir") or MODEL_DIR

    result = train_models(data_path=data_path, out_dir=out_dir)
    os.makedirs(TRAINING_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_name = f"training_{stamp}.json"
    report_path = os.path.join(TRAINING_DIR, report_name)
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    _load_models()
    return jsonify({"ok": True, "result": result, "report_file": report_name})


@app.get("/data-files")
def list_data_files():
    base_dir = os.path.abspath(DATA_DIR)
    if not os.path.isdir(base_dir):
        return jsonify({"files": []})

    files = []
    for name in os.listdir(base_dir):
        if not (name.endswith(".jsonl") or name.endswith(".json")):
            continue
        full = os.path.join(base_dir, name)
        if os.path.isfile(full):
            files.append({
                "name": name,
                "path": name,
                "size": os.path.getsize(full)
            })
    files.sort(key=lambda x: x["name"])
    return jsonify({"files": files})


@app.get("/training-files")
def list_training_files():
    base_dir = os.path.abspath(TRAINING_DIR)
    if not os.path.isdir(base_dir):
        return jsonify({"files": []})

    files = []
    for name in os.listdir(base_dir):
        if not name.endswith(".json"):
            continue
        full = os.path.join(base_dir, name)
        if os.path.isfile(full):
            files.append({
                "name": name,
                "path": name,
                "size": os.path.getsize(full)
            })
    files.sort(key=lambda x: x["name"], reverse=True)
    return jsonify({"files": files})


@app.get("/training-report")
def get_training_report():
    name = request.args.get("name")
    safe_path = _safe_join_training(name)
    if not safe_path or not os.path.exists(safe_path):
        return jsonify({"error": "file not found or not allowed"}), 400
    with open(safe_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return jsonify({"name": name, "report": data})


@app.get("/analysis-files")
def list_analysis_files():
    base_dir = os.path.abspath(ANALYSIS_DIR)
    if not os.path.isdir(base_dir):
        return jsonify({"files": []})

    files = []
    for name in os.listdir(base_dir):
        if not name.endswith(".json"):
            continue
        full = os.path.join(base_dir, name)
        if os.path.isfile(full):
            files.append({
                "name": name,
                "path": name,
                "size": os.path.getsize(full)
            })
    files.sort(key=lambda x: x["name"], reverse=True)
    return jsonify({"files": files})


@app.get("/analysis-report")
def get_analysis_report():
    name = request.args.get("name")
    safe_path = _safe_join_analysis(name)
    if not safe_path or not os.path.exists(safe_path):
        return jsonify({"error": "file not found or not allowed"}), 400
    with open(safe_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return jsonify({"name": name, "report": data})


@app.get("/raw-files")
def list_raw_files():
    base_dir = os.path.abspath(DATA_DIR)
    if not os.path.isdir(base_dir):
        return jsonify({"files": []})

    files = []
    for name in os.listdir(base_dir):
        if not (name.endswith(".txt") or name.endswith(".log") or name.endswith(".html")):
            continue
        full = os.path.join(base_dir, name)
        if os.path.isfile(full):
            files.append({
                "name": name,
                "path": name,
                "size": os.path.getsize(full)
            })
    files.sort(key=lambda x: x["name"])
    return jsonify({"files": files})


@app.post("/predict-file")
def predict_file():
    _ensure_models()
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("file_path") or payload.get("path")
    safe_path = _safe_join_data(raw_path)
    if not safe_path or not os.path.exists(safe_path):
        return jsonify({"error": "file not found or not allowed"}), 400
    try:
        logs, warnings = _read_logs_file(safe_path)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    if not isinstance(logs, list):
        return jsonify({"error": "logs must be a list"}), 400
    if not logs:
        return jsonify({"error": "no valid logs parsed", "warnings": warnings}), 400

    results = _predict_logs(logs)
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_name = f"analysis_{stamp}.json"
    report_path = os.path.join(ANALYSIS_DIR, report_name)
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump({
            "created_at": stamp,
            "source": os.path.basename(safe_path),
            "count": len(logs),
            "results": results,
            "logs": logs
        }, fh, indent=2)
    response = {"logs": logs, "results": results, "report_file": report_name}
    if warnings:
        response["warnings"] = warnings
    return jsonify(response)


@app.post("/atomize-file")
def atomize_file():
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("file_path") or payload.get("path")
    out_path = payload.get("out_path")

    safe_path = _safe_join_data(raw_path)
    if not safe_path or not os.path.exists(safe_path):
        return jsonify({"error": "file not found or not allowed"}), 400
    if not (safe_path.endswith(".txt") or safe_path.endswith(".log") or safe_path.endswith(".html")):
        return jsonify({"error": "only .txt, .log or .html files supported"}), 400

    with open(safe_path, "r", encoding="utf-8") as fh:
        content = fh.read()
    if safe_path.endswith(".html"):
        import re
        # Try to extract embedded JSON array (e.g., const rawData = [...])
        first_bracket = content.find("[")
        last_bracket = content.rfind("]")
        array_text = None
        if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
            array_text = content[first_bracket:last_bracket + 1]

        array_match = re.search(r"\[[\s\S]*?\]", content)
        if array_text or array_match:
            try:
                raw_json = json.loads(array_text or array_match.group(0))
                if isinstance(raw_json, list):
                    lines = []
                    for item in raw_json:
                        if isinstance(item, dict):
                            msg = item.get("msg") or item.get("message") or ""
                            if msg:
                                lines.append(str(msg))
                    if lines:
                        records = parse_lines(lines)
                        enriched = [enrich_record(r) for r in records]
                        if out_path:
                            safe_out = _safe_join_data(out_path)
                            if not safe_out:
                                return jsonify({"error": "out_path not allowed"}), 400
                            if not safe_out.endswith(".jsonl"):
                                return jsonify({"error": "out_path must end with .jsonl"}), 400
                            _write_jsonl(safe_out, enriched)
                        return jsonify({
                            "count": len(enriched),
                            "logs": enriched,
                            "out_path": out_path
                        })
            except Exception:
                pass

        msg_matches = re.findall(r"msg\s*[:=]\s*\"([^\"]*?)\"", content, flags=re.DOTALL)
        if not msg_matches:
            msg_matches = re.findall(r"msg\s*[:=]\s*'([^']*?)'", content, flags=re.DOTALL)
        if not msg_matches:
            msg_matches = re.findall(r"\\\"msg\\\"\s*:\s*\\\"(.*?)\\\"", content, flags=re.DOTALL)
        if msg_matches:
            lines = [m.replace("\\n", "\n").replace("\\r", "\r") for m in msg_matches if m]
            records = parse_lines(lines)
            enriched = [enrich_record(r) for r in records]
            if out_path:
                safe_out = _safe_join_data(out_path)
                if not safe_out:
                    return jsonify({"error": "out_path not allowed"}), 400
                if not safe_out.endswith(".jsonl"):
                    return jsonify({"error": "out_path must end with .jsonl"}), 400
                _write_jsonl(safe_out, enriched)
            return jsonify({
                "count": len(enriched),
                "logs": enriched,
                "out_path": out_path
            })

        content = re.sub(r"<script[\s\S]*?>[\s\S]*?<\/script>", "\n", content, flags=re.IGNORECASE)
        content = re.sub(r"<style[\s\S]*?>[\s\S]*?<\/style>", "\n", content, flags=re.IGNORECASE)
        content = re.sub(r"<[^>]+>", "\n", content)
    lines = content.splitlines()

    records = parse_lines(lines)
    enriched = [enrich_record(r) for r in records]

    if out_path:
        safe_out = _safe_join_data(out_path)
        if not safe_out:
            return jsonify({"error": "out_path not allowed"}), 400
        if not safe_out.endswith(".jsonl"):
            return jsonify({"error": "out_path must end with .jsonl"}), 400
        _write_jsonl(safe_out, enriched)

    return jsonify({
        "count": len(enriched),
        "logs": enriched,
        "out_path": out_path
    })


@app.post("/split-file")
def split_file():
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("file_path") or payload.get("path")
    max_mb = payload.get("max_mb") or 4
    try:
        max_mb = float(max_mb)
    except (TypeError, ValueError):
        return jsonify({"error": "max_mb must be a number"}), 400

    if max_mb <= 0:
        return jsonify({"error": "max_mb must be > 0"}), 400

    safe_path = _safe_join_data(raw_path)
    if not safe_path or not os.path.exists(safe_path):
        return jsonify({"error": "file not found or not allowed"}), 400

    try:
        logs, warnings = _read_logs_file(safe_path)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    if not logs:
        return jsonify({"error": "no valid logs parsed", "warnings": warnings}), 400

    max_bytes = int(max_mb * 1024 * 1024)
    base_name = os.path.splitext(os.path.basename(safe_path))[0]
    out_files = []
    chunk: List[Dict[str, Any]] = []

    def flush_chunk(index: int, rows: List[Dict[str, Any]]):
        file_name = f"{base_name}_part{index:03d}.jsonl"
        out_path = _safe_join_data(file_name)
        if not out_path:
            raise ValueError("output path not allowed")
        _write_jsonl(out_path, rows)
        out_files.append({
            "name": file_name,
            "path": file_name,
            "size": os.path.getsize(out_path)
        })

    part_index = 1
    current_bytes = 0
    for row in logs:
        row_bytes = len(json.dumps(row, ensure_ascii=True).encode("utf-8")) + 1
        if chunk and current_bytes + row_bytes > max_bytes:
            flush_chunk(part_index, chunk)
            part_index += 1
            chunk = []
            current_bytes = 0

        chunk.append(row)
        current_bytes += row_bytes

    if chunk:
        flush_chunk(part_index, chunk)

    response = {
        "count": len(logs),
        "parts": out_files,
        "max_mb": max_mb
    }
    if warnings:
        response["warnings"] = warnings
    return jsonify(response)


def _predict_logs(logs: List[Dict[str, Any]]):
    texts = [build_text(x) for x in logs]
    results: List[Dict[str, Any]] = []

    for idx, raw in enumerate(logs):
        item: Dict[str, Any] = {"index": idx}

        if _models["category"] is not None:
            model = _models["category"]
            pred = model.predict([texts[idx]])[0]
            item["category"] = pred
            if hasattr(model, "decision_function"):
                scores = model.decision_function([texts[idx]])
                try:
                    score_value = float(scores[0])
                except (TypeError, ValueError):
                    flat = scores.ravel().tolist()
                    score_value = float(flat[0]) if flat else 0.0
                item["category_score"] = score_value
        else:
            item["category"] = None

        if _models["priority"] is not None:
            model = _models["priority"]
            pred = model.predict([texts[idx]])[0]
            item["priority"] = pred
            if hasattr(model, "predict_proba"):
                prob = model.predict_proba([texts[idx]])[0]
                item["priority_prob"] = [float(p) for p in prob]
        else:
            item["priority"] = None

        if _models["reason"] is not None:
            model = _models["reason"]
            pred = model.predict([texts[idx]])[0]
            item["reason"] = pred
            if hasattr(model, "decision_function"):
                scores = model.decision_function([texts[idx]])
                try:
                    score_value = float(scores[0])
                except (TypeError, ValueError):
                    flat = scores.ravel().tolist()
                    score_value = float(flat[0]) if flat else 0.0
                item["reason_score"] = score_value
        else:
            item["reason"] = None

        results.append(item)

    return results


@app.post("/predict")
def predict():
    _ensure_models()

    payload = request.get_json(silent=True) or {}
    logs = payload.get("logs")
    if isinstance(payload, dict) and logs is None:
        logs = [payload]

    if not isinstance(logs, list):
        return jsonify({"error": "logs must be a list"}), 400
    results = _predict_logs(logs)
    return jsonify({"results": results})


if __name__ == "__main__":
    os.makedirs(MODEL_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(TRAINING_DIR, exist_ok=True)
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    _load_models()
    app.run(host="0.0.0.0", port=APP_PORT)
