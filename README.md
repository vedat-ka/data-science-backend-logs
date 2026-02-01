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

## 🧪 Training

1. JSONL‑Datei in `data/` ablegen  
2. Im UI → **Trainieren** starten  
3. Reports erscheinen unter **Training‑Reports**

Modelle werden dauerhaft in `models/` gespeichert.

---

## 🔎 Analyse

1. JSONL‑Datei in `data/` ablegen  
2. Im UI → **Analysieren**  
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