"""Halaqtna ML Prediction Service — FR10 only. Internal HTTP; port never published outside the host."""
import os
from datetime import date, timedelta
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.linear_model import LinearRegression

from training import build_training_set

MODEL_PATH = Path(os.environ.get("ML_MODEL_PATH", Path(__file__).parent / "model.joblib"))
PAGES_PER_JUZ = 20  # provisional [BUILD]
BASELINE_VERSION = "baseline-0.1"

app = FastAPI(title="Halaqtna ML Prediction Service", docs_url=None, redoc_url=None)


class ForecastIn(BaseModel):
    student_id: int
    momentum: float = Field(ge=0)
    error_density: float = Field(ge=0)
    attendance_rate: float = Field(ge=0, le=1)
    remaining_pages: float | None = Field(default=None, ge=0)


def load_model():
    if MODEL_PATH.exists():
        return joblib.load(MODEL_PATH)
    return None


def predict_pages_per_week(x: ForecastIn) -> tuple[float, str]:
    bundle = load_model()
    if bundle is None:
        # Baseline until /train has run: momentum damped by attendance and error load
        ppw = x.momentum * (0.5 + 0.5 * x.attendance_rate) * (1 / (1 + 0.15 * x.error_density))
        return max(ppw, 0.0), BASELINE_VERSION
    model: LinearRegression = bundle["model"]
    ppw = float(model.predict(np.array([[x.momentum, x.error_density, x.attendance_rate]]))[0])
    return max(ppw, 0.0), bundle["version"]


@app.get("/health")
def health():
    bundle = load_model()
    return {"status": "ok", "model_version": bundle["version"] if bundle else BASELINE_VERSION, "trained": bundle is not None}


@app.post("/forecast")
def forecast(x: ForecastIn):
    ppw, version = predict_pages_per_week(x)
    remaining = x.remaining_pages if x.remaining_pages is not None else PAGES_PER_JUZ
    if ppw < 0.05:
        eta_days = 3650  # effectively "no progress" — capped so SMALLINT stays valid
    else:
        eta_days = int(round(remaining / ppw * 7))
    eta_days = min(eta_days, 3650)
    return {
        "student_id": x.student_id,
        "predicted_pages_per_week": round(ppw, 3),
        "eta_days": eta_days,
        "predicted_completion_date": (date.today() + timedelta(days=eta_days)).isoformat(),
        "model_version": version,
    }


@app.post("/evaluate")
def evaluate_endpoint(body: dict | None = None):
    from evaluation import evaluate
    try:
        return evaluate(float((body or {}).get("test_share", 0.30)))
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.post("/train")
def train():
    X, y = build_training_set()
    if len(y) < 8:
        raise HTTPException(422, f"Not enough training rows ({len(y)}); need at least 8")
    model = LinearRegression().fit(X, y)
    version = f"linreg-{date.today().strftime('%Y%m%d')}"
    joblib.dump({"model": model, "version": version, "n": int(len(y))}, MODEL_PATH)
    return {"model_version": version, "rows": int(len(y)), "coef": model.coef_.tolist(), "intercept": float(model.intercept_), "r2_train": float(model.score(X, y))}
