"""python -m unittest test_learning_curve (from /ml). No database: the rows are built here."""
import unittest
from datetime import date, timedelta

from learning_curve import eta_days, learning_curve, render_svg


def student(sid, sessions, pages=1.0, start=date(2026, 1, 5), every=2):
    """A student with a perfectly steady record: present, no mistakes, the same pages every time."""
    return [{"student_id": sid, "session_date": start + timedelta(days=i * every), "pages_memorized": pages,
             "attendance_status": "P", "load_w": 0.0} for i in range(sessions)]


class LearningCurve(unittest.TestCase):
    def test_a_steady_student_is_forecast_almost_exactly_by_the_baseline(self):
        rows = [r for sid in range(4) for r in student(sid, 42, every=7 / 3)]
        point = learning_curve(rows, cutoffs=(10, 20))["points"][1]
        # Steady pace, full attendance, no mistakes: the forecast pace is the real pace, up to the
        # few days the week boundaries shift it by. Nowhere near the cap.
        self.assertLess(point["baseline_mae_days"], 0.2 * eta_days(3))

    def test_the_error_is_measured_not_assumed_a_student_who_slows_shows_up(self):
        rows = []
        for sid in range(4):
            early = student(sid, 10, pages=2.0)
            late = student(sid, 15, pages=0.2, start=early[-1]["session_date"] + timedelta(days=2))
            rows += early + late
        # The forecast from the fast start is far more optimistic than the slow pace that followed.
        self.assertGreater(learning_curve(rows, cutoffs=(5, 10))["points"][1]["baseline_mae_days"], 30)

    def test_a_cutoff_resting_on_too_few_students_is_dropped_and_listed(self):
        rows = [r for sid in range(4) for r in student(sid, 25)]
        rows += student(9, 50)      # only one student has any history past session 30
        report = learning_curve(rows, cutoffs=(5, 10, 30))
        self.assertEqual([p["sessions"] for p in report["points"]], [5, 10])
        self.assertEqual(report["dropped_points"], [{"sessions": 30, "students": 1}])

    def test_too_little_data_is_refused_rather_than_drawn(self):
        with self.assertRaisesRegex(ValueError, "limitation"):
            learning_curve(student(1, 3) + student(2, 3))

    def test_the_forecast_student_is_never_in_their_own_training_data(self):
        # With the fast student left out the model has only ever seen slow students, so it misses
        # the fast one badly. Were they in the training data, a line through both groups would
        # forecast everyone almost exactly and this error would be close to zero.
        rows = [r for sid in range(4) for r in student(sid, 30, pages=0.5)]
        rows += student(99, 30, pages=5.0)
        point = learning_curve(rows, cutoffs=(10, 20))["points"][0]
        self.assertEqual(point["students"], 5)
        self.assertGreater(point["model_mae_days"], 10)

    def test_demo_data_is_stamped_and_pilot_data_is_not(self):
        report = learning_curve([r for sid in range(4) for r in student(sid, 25)], cutoffs=(5, 10))
        self.assertIn("NOT A RESULT", render_svg({**report, "data_source": "demo"}))
        self.assertNotIn("NOT A RESULT", render_svg({**report, "data_source": "pilot"}))


if __name__ == "__main__":
    unittest.main()
