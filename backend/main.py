"""
FloodGraph Assam — ML Prediction FastAPI Backend Service
=========================================================
Independent ML microservice providing multi-horizon flood probability forecasts.

IMPORTANT NOTICE:
This ML model is a prototype trained on synthetic hydrological data. It is intended
for technical development and system integration, NOT for real-world lifesaving or
operational flood forecasting.
"""

import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.model import FloodPredictor, FEATURE_NAMES

app = FastAPI(
    title="FloodGraph Assam — ML Prediction API",
    description="Multi-horizon flood risk prediction engine for the Assam Brahmaputra river basin.",
    version="1.0.0",
)

# Enable CORS for local Next.js frontend or any external caller
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize predictor singleton
predictor = FloodPredictor()


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class PredictProbabilities(BaseModel):
    flood_probability_1h: float = Field(..., ge=0.0, le=1.0, description="Predicted 1h flood probability")
    flood_probability_3h: float = Field(..., ge=0.0, le=1.0, description="Predicted 3h flood probability")
    flood_probability_6h: float = Field(..., ge=0.0, le=1.0, description="Predicted 6h flood probability")


class ModelMetadata(BaseModel):
    algorithm: str
    is_prototype: bool
    notice: str


class PredictResponse(BaseModel):
    zone_id: str
    probabilities: PredictProbabilities
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence rating between 0 and 1")
    risk_tier: str = Field(..., description="Risk tier: safe, watch, warning, or critical")
    extracted_features: Dict[str, float]
    model_metadata: ModelMetadata


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    algorithm: str
    metrics: Dict[str, float]
    features_count: int
    timestamp: str
    notice: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/", tags=["Info"])
def get_service_info():
    return {
        "service": "FloodGraph Assam ML Prediction Backend",
        "status": "operational",
        "health_endpoint": "/health",
        "predict_endpoint": "/predict",
        "docs_url": "/docs",
        "disclaimer": "PROTOTYPE ML SERVICE — SYNTHETIC DATA — NOT FOR OPERATIONAL SAFETY USE",
    }


@app.get("/health", response_model=HealthResponse, tags=["Monitoring"])
def get_health():
    """
    Returns the health and operational status of the ML prediction service.
    """
    return HealthResponse(
        status="healthy" if predictor.is_loaded else "degraded",
        model_loaded=predictor.is_loaded,
        algorithm=predictor.algorithm,
        metrics=predictor.metrics,
        features_count=len(FEATURE_NAMES),
        timestamp=datetime.now(timezone.utc).isoformat(),
        notice="PROTOTYPE ML MODEL — NOT TO BE USED AS A SCIENTIFIC OR OPERATIONAL WARNING TOOL",
    )


@app.post("/predict", response_model=PredictResponse, tags=["Inference"])
def predict_flood(payload: Dict[str, Any]):
    """
    Predicts multi-horizon flood probabilities (1h, 3h, 6h) given current zone state
    and meteorological forecast data.
    
    Accepts flat or nested inputs containing:
    - rainfall_1h, rainfall_3h, rainfall_6h, rainfall_24h
    - forecast_rain_3h, forecast_rain_6h
    - soil_moisture, soil_saturation, storage_remaining
    - water_level, water_level_rise_rate, incoming_flow
    - elevation, slope, flow_accumulation, historical_flood_frequency
    """
    try:
        result = predictor.predict(payload)
        return PredictResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Prediction failed: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
