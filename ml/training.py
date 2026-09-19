"""Builds (momentum, error_density, attendance_rate) → next-week pages from the DB over a READ-ONLY connection.

One row per student-week: the features as they stood at the end of that week, and the
pages the student actually memorised in the following week. `with_meta=True` also returns
the student each row belongs to — the P10 evaluation must split by STUDENT, not by row.
"""
import os
from collections import defaultdict
from datetime import timedelta

import numpy as np
from sqlalchemy import create_engine, text

ALPHA = 0.4  # provisional, mirrors §3.4


def engine():
    url = os.environ.get("ML_DATABASE_URL")
    if not url:
        raise RuntimeError("ML_DATABASE_URL not set")
    return create_engine(url, pool_pre_ping=True)


def fetch_sessions():
    sql = text(
        """
        SELECT s.student_id, s.session_date, s.pages_memorized, s.attendance_status,
               COALESCE(SUM(et.weight), 0) AS load_w
        FROM session s
        LEFT JOIN session_error se ON se.session_id = s.session_id
        LEFT JOIN error_type et ON et.error_type_id = se.error_type_id
        GROUP BY s.session_id
        ORDER BY s.student_id, s.session_date
        """
    )
    with engine().connect() as conn:
        return conn.execute(sql).mappings().all()


def build_training_set(with_meta: bool = False):
    """Returns (X, y) or, with_meta, (X, y, student_ids, avg_pages_per_week_to_date, sessions_to_date)."""
    by_student = defaultdict(list)
    for r in fetch_sessions():
        by_student[r["student_id"]].append(r)

    X, y, students, avg_ppw, sessions_to_date = [], [], [], [], []
    for sid, sess in by_student.items():
        weeks = defaultdict(lambda: {"pages": 0.0, "load": 0.0, "n": 0, "att": 0})
        for r in sess:
            wk = r["session_date"] - timedelta(days=r["session_date"].weekday())
            w = weeks[wk]
            w["pages"] += float(r["pages_memorized"])
            w["load"] += float(r["load_w"])
            w["n"] += 1
            w["att"] += 1 if r["attendance_status"] in ("P", "L") else 0

        keys = sorted(weeks)
        ewma, n_tot, att_tot, pages_tot, load_tot = None, 0, 0, 0.0, 0.0
        for i, k in enumerate(keys):
            w = weeks[k]
            ewma = w["pages"] if ewma is None else ALPHA * w["pages"] + (1 - ALPHA) * ewma
            n_tot += w["n"]; att_tot += w["att"]; pages_tot += w["pages"]; load_tot += w["load"]
            if i + 1 < len(keys):
                density = load_tot / pages_tot if pages_tot > 0 else 0.0
                X.append([ewma, density, att_tot / n_tot if n_tot else 0.0])
                y.append(weeks[keys[i + 1]]["pages"])
                students.append(sid)
                # The P10 naïve baseline: average pages per week to date, no model at all.
                avg_ppw.append(pages_tot / (i + 1))
                sessions_to_date.append(n_tot)

    X = np.array(X, dtype=float)
    y = np.array(y, dtype=float)
    if not with_meta:
        return X, y
    return X, y, np.array(students), np.array(avg_ppw, dtype=float), np.array(sessions_to_date, dtype=int)
