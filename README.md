# ML Log Analyzer

Ein Docker‑basiertes Projekt zum **Atomisieren**, **Analysieren** und **Trainieren** von Log‑Daten mit ML.  
**Motivation:** Logs sind oft unstrukturiert und schwer auswertbar. Dieses Projekt macht sie automatisch ML‑tauglich, erkennt Muster/Fehlergründe und liefert verwertbare Reports für Betrieb und Qualität.  
**Zusatznutzen:** Die Auswertung unterstützt auch bessere Software‑Entwürfe und Code‑Qualität, z. B. durch das Erkennen von Hotspots, häufigen Fehlerrouten, wiederkehrenden Ursachen und instabilen Komponenten.

Frontend und Backend laufen getrennt in Containern.
---

## ✨ Features

- Logs aus `data/` analysieren (JSONL / JSON)
- Raw‑Logs atomisieren (z. B. `.log`, `.txt`)
- Dateien splitten (max. 4 MB)
- ML‑Modelle trainieren und speichern
- Reports für Training und Analyse mit UI‑Anzeige

---

## 📁 Projektstruktur (relativ)

```
.
├── app.py
├── train.py
├── docker-compose.yml
├── models/
├── training/
├── analysis/
├── data/
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── scripts/
```

---

## ✅ Voraussetzungen

- Docker + Docker Compose

---

## ▶️ Start (Docker)

```
docker compose up --build
```

**Frontend:** http://127.0.0.1:8090  
**Backend:** http://127.0.0.1:5050

---

## 📦 Daten (relativ)

- Raw‑Logs: `data/*.log` oder `data/*.txt`
- Atomisierte Logs: `data/*.jsonl`
- Analysen: `analysis/*.json`
- Trainings‑Reports: `training/*.json`
- Modelle: `models/*.joblib`

---

## 🧭 Log‑Quellen & Workflow

**Woher kommen die Logs?**

- Datei‑Logs aus deinem Backend/Service (z. B. Rotations‑Logs)
- Export aus einer Datenbank (z. B. mongoexport JSON / JSONL)
- Bereits atomisierte JSONL‑Logs aus bestehenden Pipelines

**Workflow (kurz):**

1. Logs per UI hochladen (roh: `.log`/`.txt` oder atomisiert: `.json`/`.jsonl`).
2. Falls roh → im UI **Atomisieren** starten (erzeugt `.jsonl` in `data/`).
3. Bei großen Dateien → **Splitten** nutzen (≤ 4 MB‑Chunks in `data/`).
4. **Analysieren** → Report in `analysis/`, im UI unter **Analyse‑Reports** öffnen.
5. **Trainieren** → Modelle in `models/`, Report in `training/`.

---

## 🧪 Training

1. JSONL‑Datei per UI hochladen (oder in `data/` ablegen)  
2. Im UI → **Trainieren** starten  
3. Reports erscheinen unter **Training‑Reports**

Beim Training werden drei Modelle erstellt (sofern Labels vorhanden sind):

- `models/model_priority.joblib` (Priorität)
- `models/model_category.joblib` (Kategorie)
- `models/model_reason.joblib` (Grund/Reason)

Zusätzlich wird `models/meta.json` gespeichert. Dort stehen die
Trainings‑Metriken (Classification Report) je Modell sowie die verwendete
Trainingsdatei. Jeder Trainingslauf erzeugt außerdem einen Report in
`training/` (z. B. `training_20260201T114920Z.json`), der im UI unter
**Training‑Reports** geöffnet werden kann.

Hinweis: Neue Trainingsläufe **überschreiben** die Modell‑Dateien in
`models/`, die Reports in `training/` bleiben jedoch erhalten.

---

## 🔎 Analyse

1. JSONL‑Datei per UI hochladen (oder in `data/` ablegen)  
2. Im UI → **Analysieren** (der Ablauf wird vollständig über die UI gesteuert)  
3. Ergebnisse werden in `analysis/` gespeichert  
4. **Analyse‑Reports** im UI öffnen

---

## 🧩 Atomisieren / Splitten

- **Raw‑Logs atomisieren**: `.txt` / `.log` → `.jsonl`
- **Splitten**: große `.json`/`.jsonl` in ≤ 4 MB Stücke

---

## ⚙️ Konfiguration (Environment)

| Variable | Standard |
|---------|----------|
| `ML_LOG_ANALYZER_PORT` | `5050` |
| `ML_LOG_ANALYZER_MODEL_DIR` | `models` |
| `ML_LOG_ANALYZER_DATA_DIR` | `data` |
| `ML_LOG_ANALYZER_TRAINING_DIR` | `training` |
| `ML_LOG_ANALYZER_ANALYSIS_DIR` | `analysis` |

---

## 📄 Lizenz 

MIT