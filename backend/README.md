# FloodGraph Assam — ML Prediction Backend

A lightweight, decoupled Python FastAPI microservice providing multi-horizon flood probability forecasts (1h, 3h, 6h) for the Assam Brahmaputra river system using XGBoost / Scikit-Learn.

> [!IMPORTANT]
> **PROTOTYPE ML MODEL NOTICE:**
> This machine learning model is an engineering prototype trained on synthetic historical hydrological data. It is intended solely for system integration and development. **It does NOT claim scientific accuracy and must NOT be used for operational lifesaving flood predictions or real evacuation decisions.**

---

## Directory Structure

```
backend/
├── data/
│   ├── synthetic_flood_data.csv   # 6,000 synthetic historical records
│   └── flood_models.joblib        # Serialized multi-horizon XGBoost models
├── main.py                        # FastAPI server & endpoints (/health, /predict)
├── model.py                       # FloodPredictor inference engine & feature extractor
├── training.py                    # Synthetic dataset generator & XGBoost trainer
├── requirements.txt               # Python package dependencies
└── README.md                      # Backend documentation & quickstart
```

---

## 16 Hydrological Features & Targets

### Features
| Category | Feature Name | Unit / Range | Description |
|---|---|---|---|
| **Rainfall Antecedent** | `rainfall_1h` | mm | Precipitation in preceding 1 hour |
| | `rainfall_3h` | mm | Cumulative rainfall in preceding 3 hours |
| | `rainfall_6h` | mm | Cumulative rainfall in preceding 6 hours |
| | `rainfall_24h` | mm | Cumulative rainfall in preceding 24 hours |
| **Forecast** | `forecast_rain_3h` | mm | Quantitative forecast rain in next 3 hours |
| | `forecast_rain_6h` | mm | Quantitative forecast rain in next 6 hours |
| **Soil Conditions** | `soil_moisture` | % | Volumetric root-zone moisture content |
| | `soil_saturation` | % | Pore space saturation fraction |
| | `storage_remaining` | mm | Remaining retention pore storage |
| **River Hydraulics** | `water_level` | m | River stage elevation at zone gauge |
| | `water_level_rise_rate` | m/h | Dynamic rate of stage rise |
| | `incoming_flow` | m³/s | Inflow from upstream contributing reaches |
| **Catchment Geomorphology** | `elevation` | m ASL | Zone mean elevation |
| | `slope` | % | Topographic slope |
| | `flow_accumulation` | km² | Upstream contributing catchment area |
| | `historical_flood_frequency`| events/yr | Historical seasonal flood event rate |

### Prediction Targets
- `flood_probability_1h`: Immediate 1-hour flash flood / threshold breach probability (0.0 to 1.0)
- `flood_probability_3h`: 3-hour horizon flood probability incorporating upstream transit waves (0.0 to 1.0)
- `flood_probability_6h`: 6-hour horizon flood probability incorporating cumulative forecast rain (0.0 to 1.0)

---

## Quickstart

### 1. Prerequisites & Dependencies
Ensure Python 3.10+ is installed. Install the dependencies:
```bash
pip install -r backend/requirements.txt
```

### 2. Generate Synthetic Data & Train Models
Run the training pipeline to regenerate the synthetic historical dataset and train the multi-horizon XGBoost classifiers:
```bash
python3 backend/training.py
```
This generates:
- `backend/data/synthetic_flood_data.csv` (6,000 synthetic rows)
- `backend/data/flood_models.joblib` (Trained model bundle)

### 3. Start the FastAPI Server
Launch the server on port 8000:
```bash
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger UI documentation is available at:
`http://localhost:8000/docs`

---

## API Reference

### `GET /health`
Returns the service health status, model load verification, algorithm, and training metrics.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "algorithm": "XGBoost",
  "metrics": {
    "acc_1h": 0.9992,
    "auc_1h": 1.0,
    "brier_1h": 0.0003,
    "acc_3h": 0.9742,
    "auc_3h": 0.9976,
    "brier_3h": 0.0201,
    "acc_6h": 0.9675,
    "auc_6h": 0.9967,
    "brier_6h": 0.0233
  },
  "features_count": 16,
  "timestamp": "2026-09-13T07:00:08.215682+00:00",
  "notice": "PROTOTYPE ML MODEL — NOT TO BE USED AS A SCIENTIFIC OR OPERATIONAL WARNING TOOL"
}
```

### `POST /predict`
Generates 1h, 3h, and 6h flood probabilities. Accepts both flat feature dictionaries and nested zone state + forecast payloads.

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "zone_id": "zone-as-04",
    "rainfall_1h": 32.0,
    "rainfall_3h": 68.0,
    "rainfall_6h": 110.0,
    "rainfall_24h": 180.0,
    "forecast_rain_3h": 50.0,
    "forecast_rain_6h": 85.0,
    "soil_moisture": 82.0,
    "soil_saturation": 90.0,
    "water_level": 7.4,
    "water_level_rise_rate": 0.35,
    "incoming_flow": 16500.0,
    "elevation": 112.0,
    "slope": 2.8,
    "flow_accumulation": 260000.0,
    "storage_remaining": 12.0,
    "historical_flood_frequency": 2.2
  }'
```

**Example Response:**
```json
{
  "zone_id": "zone-as-04",
  "probabilities": {
    "flood_probability_1h": 0.8924,
    "flood_probability_3h": 0.9941,
    "flood_probability_6h": 0.9982
  },
  "confidence": 0.959,
  "risk_tier": "critical",
  "extracted_features": { ... },
  "model_metadata": {
    "algorithm": "XGBoost",
    "is_prototype": true,
    "notice": "PROTOTYPE ML MODEL — SYNTHETIC DATASET — NOT CALIBRATED FOR OPERATIONAL SAFETY USE"
  }
}
```
