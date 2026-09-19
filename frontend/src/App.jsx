import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { LocaleProvider } from "./lib/i18n";
import { AuthProvider, Protected } from "./lib/auth";
import { Shell } from "./components/Shell";
import StaffLogin from "./pages/StaffLogin";
import StudentLogin from "./pages/StudentLogin";
import Circles from "./pages/admin/Circles";
import CircleAdmins from "./pages/admin/CircleAdmins";
import Audit from "./pages/admin/Audit";
import Settings from "./pages/admin/Settings";
import Roster from "./pages/circle/Roster";
import CircleReport from "./pages/circle/CircleReport";
import Leaderboard from "./pages/shared/Leaderboard";
import StudentPerformance from "./pages/shared/StudentPerformance";
import MyStudents from "./pages/teacher/MyStudents";
import LogSession from "./pages/teacher/LogSession";
import Dashboard from "./pages/student/Dashboard";
import Journey from "./pages/student/Journey";
import Badges from "./pages/student/Badges";
import Challenges from "./pages/student/Challenges";

const guard = (roles, el) => <Protected roles={roles}><Shell>{el}</Shell></Protected>;
const ADMIN = ["SYS_ADMIN"], CADMIN = ["CIRCLE_ADMIN", "SYS_ADMIN"], TEACHER = ["TEACHER"], STAFF = ["SYS_ADMIN", "CIRCLE_ADMIN", "TEACHER"], STUDENT = ["STUDENT"];

export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<StaffLogin />} />
            <Route path="/student-login" element={<StudentLogin />} />

            <Route path="/admin" element={guard(ADMIN, <Circles />)} />
            <Route path="/admin/circle-admins" element={guard(ADMIN, <CircleAdmins />)} />
            <Route path="/admin/audit" element={guard(ADMIN, <Audit />)} />
            <Route path="/admin/settings" element={guard(ADMIN, <Settings />)} />

            <Route path="/circle" element={guard(CADMIN, <Roster />)} />
            <Route path="/circle/report" element={guard(CADMIN, <CircleReport />)} />
            <Route path="/circle/leaderboard" element={guard(CADMIN, <Leaderboard />)} />

            <Route path="/teacher" element={guard(TEACHER, <MyStudents />)} />
            <Route path="/teacher/log" element={guard(TEACHER, <LogSession />)} />
            <Route path="/teacher/leaderboard" element={guard(TEACHER, <Leaderboard />)} />

            <Route path="/staff/students/:id" element={guard(STAFF, <StudentPerformance />)} />

            <Route path="/student" element={guard(STUDENT, <Dashboard />)} />
            <Route path="/student/journey" element={guard(STUDENT, <Journey />)} />
            <Route path="/student/leaderboard" element={guard(STUDENT, <Leaderboard />)} />
            <Route path="/student/badges" element={guard(STUDENT, <Badges />)} />
            <Route path="/student/challenges" element={guard(STUDENT, <Challenges />)} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </AuthProvider>
    </LocaleProvider>
  );
}
