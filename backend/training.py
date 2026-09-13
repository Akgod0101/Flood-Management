"""
FloodGraph Assam — Synthetic Historical Training & ML Model Pipeline
====================================================================
IMPORTANT PROTOTYPE NOTICE:
This ML model is a prototype trained on synthetic hydrological data derived from
the Assam Brahmaputra basin simulation parameters. It is designed for system
integration and engineering validation, NOT for operational or lifesaving flood
prediction.
"""

import os
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
import joblib

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, brier_score_loss

# Check for XGBoost availability
try:
    from xgboost import XGBClassifier
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False
    from sklearn.ensemble import HistGradientBoostingClassifier

FEATURE_NAMES = [
    "rainfall_1h",
    "rainfall_3h",
    "rainfall_6h",
    "rainfall_24h",
    "forecast_rain_3h",
    "forecast_rain_6h",
    "soil_moisture",
    "soil_saturation",
    "water_level",
    "water_level_rise_rate",
    "incoming_flow",
    "elevation",
    "slope",
    "flow_accumulation",
    "storage_remaining",
    "historical_flood_frequency",
]

TARGET_NAMES = [
    "flood_probability_1h",
    "flood_probability_3h",
    "flood_probability_6h",
]

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def generate_synthetic_dataset(num_samples: int = 6000, random_seed: int = 42) -> pd.DataFrame:
    """
    Generates a realistic, physically grounded synthetic historical dataset
    covering 16 hydrological features and 3 flood horizon targets.
    """
    np.random.seed(random_seed)
    
    # 1. Physical catchment characteristics
    elevation = np.random.uniform(35.0, 180.0, num_samples) # Sadiya (~145m) to Dhubri (~38m)
    # Flatter terrain at lower elevations
    slope = np.clip(np.random.normal(3.5, 1.8, num_samples) * (elevation / 100.0), 0.5, 9.5)
    # Downstream accumulation increases as elevation drops
    flow_accumulation = np.clip(
        280000.0 - (elevation * 1200.0) + np.random.normal(0, 15000, num_samples),
        25000.0, 305000.0
    )
    historical_flood_frequency = np.clip(
        0.3 + (180.0 - elevation) / 70.0 + np.random.normal(0, 0.3, num_samples),
        0.1, 4.0
    )

    # 2. Meteorological storm regimes:
    # 0 = baseflow/dry (35%), 1 = moderate monsoon (35%), 2 = heavy rain (20%), 3 = extreme cloudburst (10%)
    regime = np.random.choice([0, 1, 2, 3], size=num_samples, p=[0.35, 0.35, 0.20, 0.10])

    rainfall_1h = np.zeros(num_samples)
    rainfall_3h = np.zeros(num_samples)
    rainfall_6h = np.zeros(num_samples)
    rainfall_24h = np.zeros(num_samples)
    forecast_rain_3h = np.zeros(num_samples)
    forecast_rain_6h = np.zeros(num_samples)

    for i in range(num_samples):
        r = regime[i]
        if r == 0:
            rainfall_1h[i] = np.random.exponential(1.2)
            rainfall_3h[i] = rainfall_1h[i] + np.random.exponential(2.5)
            rainfall_6h[i] = rainfall_3h[i] + np.random.exponential(4.0)
            rainfall_24h[i] = rainfall_6h[i] + np.random.exponential(12.0)
            forecast_rain_3h[i] = np.random.exponential(2.0)
            forecast_rain_6h[i] = forecast_rain_3h[i] + np.random.exponential(3.5)
        elif r == 1:
            rainfall_1h[i] = np.random.uniform(5.0, 18.0)
            rainfall_3h[i] = rainfall_1h[i] + np.random.uniform(8.0, 25.0)
            rainfall_6h[i] = rainfall_3h[i] + np.random.uniform(15.0, 45.0)
            rainfall_24h[i] = rainfall_6h[i] + np.random.uniform(30.0, 80.0)
            forecast_rain_3h[i] = np.random.uniform(10.0, 30.0)
            forecast_rain_6h[i] = forecast_rain_3h[i] + np.random.uniform(15.0, 45.0)
        elif r == 2:
            rainfall_1h[i] = np.random.uniform(20.0, 45.0)
            rainfall_3h[i] = rainfall_1h[i] + np.random.uniform(35.0, 75.0)
            rainfall_6h[i] = rainfall_3h[i] + np.random.uniform(50.0, 110.0)
            rainfall_24h[i] = rainfall_6h[i] + np.random.uniform(80.0, 160.0)
            forecast_rain_3h[i] = np.random.uniform(30.0, 65.0)
            forecast_rain_6h[i] = forecast_rain_3h[i] + np.random.uniform(40.0, 95.0)
        else: # extreme storm pulse
            rainfall_1h[i] = np.random.uniform(45.0, 85.0)
            rainfall_3h[i] = rainfall_1h[i] + np.random.uniform(70.0, 130.0)
            rainfall_6h[i] = rainfall_3h[i] + np.random.uniform(110.0, 200.0)
            rainfall_24h[i] = rainfall_6h[i] + np.random.uniform(140.0, 280.0)
            forecast_rain_3h[i] = np.random.uniform(60.0, 110.0)
            forecast_rain_6h[i] = forecast_rain_3h[i] + np.random.uniform(80.0, 160.0)

    # 3. Soil & moisture dynamics
    # High rainfall leads to high saturation and depleted remaining storage
    soil_saturation = np.clip(
        35.0 + (rainfall_24h / 280.0) * 58.0 + (rainfall_6h / 150.0) * 20.0 + np.random.normal(0, 4.0, num_samples),
        25.0, 99.5
    )
    soil_moisture = np.clip(soil_saturation * 0.85 + np.random.normal(0, 2.5, num_samples), 20.0, 92.0)
    # Porosity ~ 0.46, 400mm root zone -> 184mm max storage
    storage_remaining = np.clip(184.0 * (1.0 - soil_saturation / 100.0), 0.5, 75.0)

    # 4. River channel hydraulic state
    incoming_flow = np.clip(
        3000.0 + (flow_accumulation / 300000.0) * 14000.0 + (rainfall_6h * 65.0) + np.random.normal(0, 1200, num_samples),
        1500.0, 34000.0
    )
    
    danger_threshold = 8.0 # meters reference gauge
    water_level = np.clip(
        3.5 + (incoming_flow / 32000.0) * 4.8 + (soil_saturation / 100.0) * 1.8 + np.random.normal(0, 0.4, num_samples),
        2.0, 11.5
    )
    
    water_level_rise_rate = np.clip(
        ((rainfall_1h - 10.0) / 45.0) * 0.45 + ((soil_saturation - 70.0) / 30.0) * 0.25 + np.random.normal(0, 0.08, num_samples),
        -0.45, 1.25
    )

    # 5. Hydrologically grounded target probabilities
    # 1-hour horizon: heavily driven by stage, rise rate, current cloudburst, low storage
    z_1h = (
        (water_level - 6.8) * 1.6 +
        water_level_rise_rate * 3.8 +
        (rainfall_1h - 22.0) * 0.08 +
        (soil_saturation - 82.0) * 0.06 -
        (storage_remaining - 15.0) * 0.05 +
        np.random.normal(0, 0.4, num_samples)
    )
    p_1h = 1.0 / (1.0 + np.exp(-z_1h))
    y_1h = (p_1h > 0.50).astype(int)

    # 3-hour horizon: driven by 3h forecast rain, upstream inflow wave transit, soil saturation
    z_3h = (
        (water_level - 6.0) * 1.3 +
        (forecast_rain_3h - 24.0) * 0.07 +
        ((incoming_flow - 14000.0) / 4000.0) * 0.8 +
        (soil_saturation - 75.0) * 0.07 +
        water_level_rise_rate * 2.2 +
        np.random.normal(0, 0.4, num_samples)
    )
    p_3h = 1.0 / (1.0 + np.exp(-z_3h))
    y_3h = (p_3h > 0.50).astype(int)

    # 6-hour horizon: driven by 6h forecast rain, antecedent 24h rain, cumulative catchment inflow
    z_6h = (
        (forecast_rain_6h - 40.0) * 0.06 +
        (rainfall_24h - 90.0) * 0.03 +
        ((incoming_flow - 16000.0) / 4500.0) * 0.9 +
        (soil_saturation - 72.0) * 0.06 +
        ((flow_accumulation - 150000.0) / 50000.0) * 0.4 +
        (historical_flood_frequency - 1.5) * 0.3 +
        np.random.normal(0, 0.4, num_samples)
    )
    p_6h = 1.0 / (1.0 + np.exp(-z_6h))
    y_6h = (p_6h > 0.50).astype(int)

    df = pd.DataFrame({
        "rainfall_1h": np.round(rainfall_1h, 2),
        "rainfall_3h": np.round(rainfall_3h, 2),
        "rainfall_6h": np.round(rainfall_6h, 2),
        "rainfall_24h": np.round(rainfall_24h, 2),
        "forecast_rain_3h": np.round(forecast_rain_3h, 2),
        "forecast_rain_6h": np.round(forecast_rain_6h, 2),
        "soil_moisture": np.round(soil_moisture, 2),
        "soil_saturation": np.round(soil_saturation, 2),
        "water_level": np.round(water_level, 2),
        "water_level_rise_rate": np.round(water_level_rise_rate, 3),
        "incoming_flow": np.round(incoming_flow, 1),
        "elevation": np.round(elevation, 1),
        "slope": np.round(slope, 2),
        "flow_accumulation": np.round(flow_accumulation, 0),
        "storage_remaining": np.round(storage_remaining, 2),
        "historical_flood_frequency": np.round(historical_flood_frequency, 2),
        # Ground truth targets
        "target_flood_1h": y_1h,
        "target_flood_3h": y_3h,
        "target_flood_6h": y_6h,
        "prob_groundtruth_1h": np.round(p_1h, 3),
        "prob_groundtruth_3h": np.round(p_3h, 3),
        "prob_groundtruth_6h": np.round(p_6h, 3),
    })

    return df


def train_models(df: pd.DataFrame) -> Tuple[Dict[str, Any], Dict[str, float]]:
    """
    Trains calibrated classifiers for 1h, 3h, and 6h flood prediction.
    """
    X = df[FEATURE_NAMES]
    models = {}
    metrics = {}

    for horizon in ["1h", "3h", "6h"]:
        target_col = f"target_flood_{horizon}"
        y = df[target_col]

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.20, random_state=42, stratify=y
        )

        if XGB_AVAILABLE:
            clf = XGBClassifier(
                n_estimators=120,
                max_depth=4,
                learning_rate=0.08,
                subsample=0.85,
                colsample_bytree=0.85,
                random_state=42,
                eval_metric="logloss",
            )
        else:
            clf = HistGradientBoostingClassifier(
                max_iter=120,
                max_depth=4,
                learning_rate=0.08,
                random_state=42,
            )

        clf.fit(X_train, y_train)

        y_pred = clf.predict(X_test)
        y_proba = clf.predict_proba(X_test)[:, 1]

        acc = float(accuracy_score(y_test, y_pred))
        auc = float(roc_auc_score(y_test, y_proba))
        brier = float(brier_score_loss(y_test, y_proba))

        models[horizon] = clf
        metrics[f"acc_{horizon}"] = round(acc, 4)
        metrics[f"auc_{horizon}"] = round(auc, 4)
        metrics[f"brier_{horizon}"] = round(brier, 4)

        print(f"[{horizon} Model] Test Accuracy: {acc*100:.2f}% | ROC-AUC: {auc:.4f} | Brier: {brier:.4f}")

    return models, metrics


def save_artifacts(models: Dict[str, Any], metrics: Dict[str, float], df: pd.DataFrame) -> str:
    """
    Persists synthetic dataset and trained models to backend/data/
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Save dataset CSV
    csv_path = os.path.join(DATA_DIR, "synthetic_flood_data.csv")
    df.to_csv(csv_path, index=False)
    print(f"Saved synthetic dataset to: {csv_path} ({len(df)} rows)")

    # Save model bundle
    bundle_path = os.path.join(DATA_DIR, "flood_models.joblib")
    artifact = {
        "models": models,
        "feature_names": FEATURE_NAMES,
        "metrics": metrics,
        "algorithm": "XGBoost" if XGB_AVAILABLE else "HistGradientBoosting",
        "notice": "PROTOTYPE ML MODEL — SYNTHETIC DATASET — NOT CALIBRATED FOR OPERATIONAL SAFETY USE",
    }
    joblib.dump(artifact, bundle_path)
    print(f"Saved trained models to: {bundle_path}")

    return bundle_path


def main():
    print("=========================================================")
    print("FloodGraph Assam — Synthetic Training & Model Compilation")
    print("=========================================================")
    print(f"Using ML Framework: {'XGBoost (Active)' if XGB_AVAILABLE else 'Scikit-Learn (Fallback)'}")
    
    print("1. Generating synthetic hydrological records (6,000 samples)...")
    df = generate_synthetic_dataset(num_samples=6000, random_seed=42)

    print("2. Training multi-horizon flood classifiers (1h, 3h, 6h)...")
    models, metrics = train_models(df)

    print("3. Persisting local artifacts...")
    bundle_path = save_artifacts(models, metrics, df)

    print("\nTraining completed successfully!")
    print(f"Artifact location: {bundle_path}")
    print("Metrics summary:", json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
