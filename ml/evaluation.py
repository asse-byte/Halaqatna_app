"""P10 deliverable — the NFR10 forecast evaluation report (§9).

NFR10 ("≥ 80% of forecasts within ±2 weeks") is a TARGET TO MEASURE, never a result
claimed in advance. The honesty rules of §9 apply literally:

  * the split is by STUDENT, never by row — splitting by row leaks a student's own
    history into their own test prediction and inflates the result;
  * a naïve baseline (remaining pages ÷ average pages per week to date, no model) is
    always included, and if no model beats it that is the finding and it is reported;
  * if the target is not met, the measured number is reported and the target is NOT
    adjusted afterwards;
  * if the dataset is too small for a meaningful held-out evaluation, that is reported
    as a limitation instead of an unreliable percentage.
"""
import json
import os
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge

from training import build_training_set

REPORT_DIR = Path(os.environ.get("ML_REPORT_DIR", Path(__file__).parent / "reports"))
PAGES_PER_JUZ = 20          # provisional [BUILD]
WINDOW_DAYS = 14            # NFR10: ±2 weeks
MAX_ETA_DAYS = 3650
MIN_STUDENTS = 4            # below this a held-out split by student is meaningless
MIN_ROWS = 12
SMALL_SAMPLE_ROWS = 200     # §9: Ridge if the sample is small, RandomForest if there is enough data


def eta_days(pages_per_week: np.ndarray, remaining: float = PAGES_PER_JUZ) -> np.ndarray:
    """§3.9 — ETA_days = (remaining pages / predicted pages per week) × 7."""
    return np.minimum(remaining / np.clip(pages_per_week, 0.05, None) * 7, MAX_ETA_DAYS)


def _metrics(pred_ppw: np.ndarray, true_ppw: np.ndarray) -> dict:
    """The four metrics §9 requires, all expressed on the ETA the forecast actually produces."""
    pred_eta = eta_days(np.clip(pred_ppw, 0, None))
    true_eta = eta_days(true_ppw)
    err = pred_eta - true_eta                      # signed, in days
    return {
        "within_2_weeks_pct": round(float((np.abs(err) <= WINDOW_DAYS).mean() * 100), 1),
        "mae_days": round(float(np.abs(err).mean()), 2),
        "rmse_days": round(float(np.sqrt((err ** 2).mean())), 2),
        "bias_days": round(float(err.mean()), 2),  # + = forecasts are pessimistic (too slow)
        "meets_nfr10_target": bool((np.abs(err) <= WINDOW_DAYS).mean() >= 0.80),
    }


def _split_by_student(students: np.ndarray, test_share: float, seed: int):
    """All of one student's rows go entirely into train or entirely into test."""
    unique = np.unique(students)
    rng = np.random.default_rng(seed)
    shuffled = rng.permutation(unique)
    n_test = max(1, int(round(len(unique) * test_share)))
    n_test = min(n_test, len(unique) - 1)          # never leave the training set empty
    test_students = set(shuffled[:n_test].tolist())
    test_mask = np.array([s in test_students for s in students])
    return ~test_mask, test_mask, shuffled[:n_test], shuffled[n_test:]


def _sessions_in(students: np.ndarray, sessions_to_date: np.ndarray, subset: np.ndarray) -> int:
    """sessions_to_date is cumulative, so a split's session count is the last value per student."""
    return int(sum(int(sessions_to_date[students == s].max()) for s in subset if (students == s).any()))


def evaluate(test_share: float = 0.30, seed: int = 499) -> dict:
    X, y, students, avg_ppw, sessions_to_date = build_training_set(with_meta=True)
    n, n_students = len(y), len(np.unique(students)) if len(y) else 0
    if n < MIN_ROWS or n_students < MIN_STUDENTS:
        raise ValueError(
            f"Dataset too small for a meaningful held-out evaluation: {n} student-week rows "
            f"across {n_students} students (need at least {MIN_ROWS} rows and {MIN_STUDENTS} students). "
            "Report this as a limitation rather than an unreliable percentage."
        )

    train_mask, test_mask, test_students, train_students = _split_by_student(students, test_share, seed)
    Xtr, ytr = X[train_mask], y[train_mask]
    Xte, yte = X[test_mask], y[test_mask]

    # §9 item 3 — one alternative, chosen by sample size, and the reason is recorded.
    if len(ytr) < SMALL_SAMPLE_ROWS:
        alt_name, alt_model = "ridge_alpha_1", Ridge(alpha=1.0)
        alt_reason = f"Ridge: the training split has only {len(ytr)} rows, too few for a forest to generalise."
    else:
        alt_name, alt_model = "random_forest_50", RandomForestRegressor(n_estimators=50, random_state=seed, min_samples_leaf=2)
        alt_reason = f"RandomForestRegressor: the training split has {len(ytr)} rows, enough for a non-linear model."

    results = {
        # No model at all: remaining pages ÷ average pages per week to date.
        "baseline_avg_pages_per_week": _metrics(avg_ppw[test_mask], yte),
        "linear_regression": _metrics(LinearRegression().fit(Xtr, ytr).predict(Xte), yte),
        alt_name: _metrics(alt_model.fit(Xtr, ytr).predict(Xte), yte),
    }

    baseline = results["baseline_avg_pages_per_week"]
    best = min(results, key=lambda k: results[k]["mae_days"])
    beats_baseline = [k for k in results if k != "baseline_avg_pages_per_week" and results[k]["mae_days"] < baseline["mae_days"]]
    target_met = [k for k, v in results.items() if v["meets_nfr10_target"]]

    if not beats_baseline:
        discussion = ("Neither model beat the naïve baseline on MAE. That is the honest finding: on this "
                      "dataset the three features carry no more information than the student's own average "
                      "pages per week to date.")
    else:
        discussion = (f"{best} has the lowest MAE ({results[best]['mae_days']} days) and beats the naïve "
                      f"baseline ({baseline['mae_days']} days).")
    discussion += (" NFR10 was met by: " + ", ".join(target_met) + ".") if target_met else \
                  (" NFR10 (≥ 80% within ±2 weeks) was NOT met by any model. The measured values are reported "
                   "as they are; the target is not adjusted after the fact.")

    report = {
        "generated_at": date.today().isoformat(),
        "nfr10_target": "≥ 80% of forecasts within ±14 days on a held-out set",
        "features": ["momentum", "error_density", "attendance_rate"],
        "target_variable": "pages memorised next week",
        "seed": seed,
        "split": {
            "method": "grouped by student — every row of a student is entirely in train or entirely in test",
            "rationale": "a random split by row would leak a student's own history into their test prediction",
            "test_share_of_students": test_share,
            "students_total": int(n_students),
            "students_train": int(len(train_students)),
            "students_test": int(len(test_students)),
            "rows_total": int(n),
            "rows_train": int(len(ytr)),
            "rows_test": int(len(yte)),
            "sessions_train": _sessions_in(students, sessions_to_date, train_students),
            "sessions_test": _sessions_in(students, sessions_to_date, test_students),
        },
        "alternative_model": {"name": alt_name, "why": alt_reason},
        "results": results,
        "best_by_mae_days": best,
        "models_beating_baseline": beats_baseline,
        "nfr10_met_by": target_met,
        "discussion": discussion,
        "note": "All constants are provisional and are calibrated in CPIT-499. Re-run once pilot data is collected.",
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    # encoding is explicit: the report contains ≥ and ±, which a cp1252 default would refuse.
    (REPORT_DIR / f"evaluation_{date.today().strftime('%Y%m%d')}.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(evaluate(), indent=2, ensure_ascii=False))
