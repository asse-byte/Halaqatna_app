"""The learning curve for the ML chapter: forecast error against how many sessions are recorded.

For each cutoff N (2, 5, 10, ...) and each student with enough history, the forecast is made
from that student's first N sessions alone and compared with what the student then actually
did. So the curve answers the committee's question directly: how far off is a forecast made
after N sessions, in days?

The honesty rules of evaluation.py (§9) apply here too:

  * the student being forecast is never in the training data (leave one student out);
  * the error is measured, never assumed. If the curve does not fall, that is the finding;
  * a point standing on fewer than MIN_STUDENTS_PER_POINT students is dropped and listed;
  * the figure is stamped as demo data unless --data-source pilot says it came from a real
    circle. Synthetic seed data may not back any claim in the report.

    ML_DATABASE_URL=... python learning_curve.py --data-source pilot
"""
import argparse
import json
import os
from collections import defaultdict
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

import numpy as np
from sklearn.linear_model import LinearRegression

from training import _as_date, fetch_sessions, student_weeks, training_rows

REPORT_DIR = Path(os.environ.get("ML_REPORT_DIR", Path(__file__).parent / "reports"))
PAGES_PER_JUZ = 20               # provisional [BUILD]
CUTOFFS = (2, 5, 10, 15, 20, 30, 40, 60)
MIN_STUDENTS_PER_POINT = 3
MIN_FUTURE_DAYS = 14             # less than this after the cutoff says little about the real pace
MIN_TRAINING_ROWS = 8            # the same floor as POST /train
MAX_ETA_DAYS = 3650


def eta_days(pages_per_week: float) -> float:
    """§3.9, for one whole Juz so that every cutoff is measured over the same distance."""
    return min(PAGES_PER_JUZ / max(pages_per_week, 0.05) * 7, MAX_ETA_DAYS)


def baseline_pace(momentum: float, density: float, attendance: float) -> float:
    """The formula ml/main.py serves until /train has run."""
    return max(momentum * (0.5 + 0.5 * attendance) * (1 / (1 + 0.15 * density)), 0.0)


def realised_pace(future: list, cutoff_date: date) -> float | None:
    """Pages per week the student actually covered after the cutoff; None if too little time passed."""
    days = (_as_date(future[-1]["session_date"]) - cutoff_date).days if future else 0
    if days < MIN_FUTURE_DAYS:
        return None
    return sum(float(r["pages_memorized"]) for r in future) / (days / 7)


def learning_curve(rows, cutoffs=CUTOFFS) -> dict:
    by_student = defaultdict(list)
    for r in rows:
        by_student[r["student_id"]].append(r)
    for sess in by_student.values():
        sess.sort(key=lambda r: _as_date(r["session_date"]))

    X, y, students, _, _ = training_rows(rows)

    points, dropped = [], []
    for n in cutoffs:
        model_err, base_err, excluded = [], [], 0
        for sid, sess in by_student.items():
            if len(sess) <= n:
                continue
            pace = realised_pace(sess[n:], _as_date(sess[n - 1]["session_date"]))
            if pace is None:
                continue
            if pace <= 0:          # nothing further was memorised, so there is no true date to compare with
                excluded += 1
                continue
            truth = eta_days(pace)
            features = student_weeks(sess[:n])[-1]["features"]
            base_err.append(abs(eta_days(baseline_pace(*features)) - truth))

            mask = students != sid
            if mask.sum() >= MIN_TRAINING_ROWS:
                model = LinearRegression().fit(X[mask], y[mask])
                predicted = float(model.predict(np.array([features]))[0])
                model_err.append(abs(eta_days(max(predicted, 0.0)) - truth))

        if len(base_err) < MIN_STUDENTS_PER_POINT:
            dropped.append({"sessions": n, "students": len(base_err)})
            continue
        points.append({
            "sessions": n,
            "students": len(base_err),
            "excluded_no_further_pages": excluded,
            "baseline_mae_days": round(float(np.mean(base_err)), 1),
            "model_mae_days": round(float(np.mean(model_err)), 1) if len(model_err) == len(base_err) else None,
        })

    if len(points) < 2:
        raise ValueError(
            f"Too little data for a curve: {len(by_student)} students, and only {len(points)} cutoff(s) with at "
            f"least {MIN_STUDENTS_PER_POINT} students who have {MIN_FUTURE_DAYS}+ days of sessions after it. "
            "Report this as a limitation rather than an unreliable figure."
        )
    return {"students_total": len(by_student), "points": points, "dropped_points": dropped}


def render_svg(report: dict) -> str:
    """A self-contained figure for the report. Plain SVG, so no plotting library is added to the service."""
    W, H, L, R, T, B = 720, 420, 70, 150, 50, 70
    points = report["points"]
    series = [("model_mae_days", "Linear regression", "#0F382C"), ("baseline_mae_days", "Baseline formula", "#D97706")]
    values = [p[k] for k, _, _ in series for p in points if p[k] is not None]
    y_max = max(values) * 1.15 or 1
    x_lo, x_hi = points[0]["sessions"], points[-1]["sessions"]
    sx = lambda v: L + (v - x_lo) / (x_hi - x_lo) * (W - L - R)
    sy = lambda v: H - B - v / y_max * (H - T - B)

    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Arial, sans-serif">',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
         f'<text x="{L}" y="28" font-size="16" font-weight="bold" fill="#111827">Forecast error against recorded sessions</text>']
    for i in range(6):
        v = y_max * i / 5
        o.append(f'<line x1="{L}" x2="{W - R}" y1="{sy(v):.1f}" y2="{sy(v):.1f}" stroke="#e5e7eb"/>')
        o.append(f'<text x="{L - 8}" y="{sy(v) + 4:.1f}" font-size="12" text-anchor="end" fill="#4b5563">{v:.0f}</text>')
    for p in points:
        x = sx(p["sessions"])
        o.append(f'<text x="{x:.1f}" y="{H - B + 18}" font-size="12" text-anchor="middle" fill="#4b5563">{p["sessions"]}</text>')
        o.append(f'<text x="{x:.1f}" y="{H - B + 33}" font-size="10" text-anchor="middle" fill="#9ca3af">n={p["students"]}</text>')
    o.append(f'<text x="{(L + W - R) / 2}" y="{H - 12}" font-size="13" text-anchor="middle" fill="#111827">Sessions recorded when the forecast was made</text>')
    o.append(f'<text transform="translate(18 {(T + H - B) / 2}) rotate(-90)" font-size="13" text-anchor="middle" fill="#111827">Mean absolute error (days)</text>')

    for key, label, color in series:
        drawn = [p for p in points if p[key] is not None]
        if not drawn:
            continue
        line = " ".join(f"{sx(p['sessions']):.1f},{sy(p[key]):.1f}" for p in drawn)
        o.append(f'<polyline points="{line}" fill="none" stroke="{color}" stroke-width="2" stroke-linejoin="round"/>')
        for p in drawn:
            o.append(f'<circle cx="{sx(p["sessions"]):.1f}" cy="{sy(p[key]):.1f}" r="4" fill="{color}" stroke="#fff" stroke-width="2"/>')
        last = drawn[-1]
        o.append(f'<text x="{sx(last["sessions"]) + 10:.1f}" y="{sy(last[key]) + 4:.1f}" font-size="12" fill="#111827">{escape(label)}: ±{last[key]:.0f}</text>')

    if report["data_source"] != "pilot":
        o.append(f'<text x="{(L + W - R) / 2}" y="{(T + H - B) / 2}" font-size="26" font-weight="bold" text-anchor="middle" fill="#DC2626" opacity="0.3">DEMO DATA — NOT A RESULT</text>')
    o.append("</svg>")
    return "\n".join(o)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-source", choices=["demo", "pilot"], default="demo",
                        help="pilot only when the sessions were recorded in a real circle")
    args = parser.parse_args()

    report = learning_curve(fetch_sessions())
    report.update({
        "generated_at": date.today().isoformat(),
        "data_source": args.data_source,
        "error": "mean absolute error, in days, of the forecast time to memorise one Juz, against the realised pace after the cutoff",
        "split": "leave one student out: the student being forecast is never in the training data",
        "note": "Constants are provisional. A demo-data curve shows the method only and backs no claim.",
    })
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    stem = REPORT_DIR / f"learning_curve_{args.data_source}_{date.today().strftime('%Y%m%d')}"
    stem.with_suffix(".json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    stem.with_suffix(".svg").write_text(render_svg(report), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nFigure: {stem.with_suffix('.svg')}")


if __name__ == "__main__":
    try:
        main()
    except ValueError as e:
        raise SystemExit(str(e))
