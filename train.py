import json
import os
from typing import Dict, Any, List

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report


MODEL_FILES = {
    "priority": "model_priority.joblib",
    "category": "model_category.joblib",
    "reason": "model_reason.joblib"
}
META_FILE = "meta.json"


def build_text(row: Dict[str, Any]) -> str:
    parts = [
        str(row.get("level", "")),
        str(row.get("service", "")),
        str(row.get("route", "")),
        str(row.get("status_code", "")),
        str(row.get("message", ""))
    ]
    return " ".join(p for p in parts if p and p != "None").strip()


def _load_jsonl(path: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def _train_category(texts, labels) -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(min_df=1, max_df=0.95, ngram_range=(1, 2))),
        ("clf", LinearSVC())
    ])


def _train_priority(texts, labels) -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(min_df=1, max_df=0.95, ngram_range=(1, 2))),
        ("clf", LogisticRegression(max_iter=1000))
    ])


def _train_reason(texts, labels) -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(min_df=1, max_df=0.95, ngram_range=(1, 2))),
        ("clf", LinearSVC())
    ])


def _safe_split(texts, labels, test_size=0.2):
    try:
        return train_test_split(
            texts,
            labels,
            test_size=test_size,
            random_state=42,
            stratify=labels
        )
    except Exception:
        return train_test_split(
            texts,
            labels,
            test_size=test_size,
            random_state=42
        )


def _normalize_labels(values):
    out = []
    for v in values:
        if v is None:
            out.append("unknown")
        else:
            s = str(v).strip()
            out.append(s if s else "unknown")
    return out


def _has_enough_classes(values) -> bool:
    return len(set(values)) >= 2


def train_models(data_path: str, out_dir: str) -> Dict[str, Any]:
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Data file not found: {data_path}")

    rows = _load_jsonl(data_path)
    if not rows:
        raise ValueError("No training rows found")

    texts = [build_text(r) for r in rows]

    os.makedirs(out_dir, exist_ok=True)

    meta: Dict[str, Any] = {"data_path": data_path}

    # Category model
    if any("label" in r for r in rows):
        y_cat = _normalize_labels([r.get("label") for r in rows])
        if _has_enough_classes(y_cat):
            X_train, X_test, y_train, y_test = _safe_split(texts, y_cat)
            cat_model = _train_category(X_train, y_train)
            cat_model.fit(X_train, y_train)
            y_pred = cat_model.predict(X_test)
            meta["category_report"] = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
            joblib.dump(cat_model, os.path.join(out_dir, MODEL_FILES["category"]))
        else:
            meta["category_report"] = None
    else:
        meta["category_report"] = None

    # Priority model
    if any("priority" in r for r in rows):
        y_prio = _normalize_labels([r.get("priority") for r in rows])
        if _has_enough_classes(y_prio):
            X_train, X_test, y_train, y_test = _safe_split(texts, y_prio)
            prio_model = _train_priority(X_train, y_train)
            prio_model.fit(X_train, y_train)
            y_pred = prio_model.predict(X_test)
            meta["priority_report"] = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
            joblib.dump(prio_model, os.path.join(out_dir, MODEL_FILES["priority"]))
        else:
            meta["priority_report"] = None
    else:
        meta["priority_report"] = None

    # Reason model (optional)
    if any("reason" in r for r in rows):
        y_reason_all = _normalize_labels([r.get("reason") for r in rows])
        filtered = [(t, y) for t, y in zip(texts, y_reason_all) if y != "unknown"]
        if filtered:
            X_reason, y_reason = zip(*filtered)
            y_reason = list(y_reason)
            if _has_enough_classes(y_reason):
                X_train, X_test, y_train, y_test = _safe_split(list(X_reason), y_reason)
                reason_model = _train_reason(X_train, y_train)
                reason_model.fit(X_train, y_train)
                y_pred = reason_model.predict(X_test)
                meta["reason_report"] = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
                joblib.dump(reason_model, os.path.join(out_dir, MODEL_FILES["reason"]))
            else:
                meta["reason_report"] = None
        else:
            meta["reason_report"] = None
    else:
        meta["reason_report"] = None

    with open(os.path.join(out_dir, META_FILE), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    return meta


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/logs_train.jsonl")
    parser.add_argument("--out", default="models")
    args = parser.parse_args()

    result = train_models(args.data, args.out)
    print(json.dumps(result, indent=2))
