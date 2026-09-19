import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "./api";

const AuthCtx = createContext(null);

export const homeFor = (actor) => {
  if (!actor) return "/login";
  if (actor.type === "student") return "/student";
  return { SYS_ADMIN: "/admin", CIRCLE_ADMIN: "/circle", TEACHER: "/teacher" }[actor.role] || "/login";
};

export function AuthProvider({ children }) {
  const [actor, setActor] = useState(null); // null = checking, false = anonymous

  useEffect(() => {
    if (!localStorage.getItem("halaqtna_token")) return setActor(false);
    api.get("/auth/me")
      .then(({ data }) => setActor(data.type === "staff" ? { type: "staff", ...data.user } : { type: "student", role: "STUDENT", ...data.student }))
      .catch(() => setActor(false));
  }, []);

  const loginStaff = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("halaqtna_token", data.token);
    const a = { type: "staff", ...data.user };
    setActor(a);
    return a;
  };
  const loginStudent = async (access_code) => {
    const { data } = await api.post("/auth/student-login", { access_code });
    localStorage.setItem("halaqtna_token", data.token);
    const a = { type: "student", role: "STUDENT", ...data.student };
    setActor(a);
    return a;
  };
  const logout = () => { localStorage.removeItem("halaqtna_token"); setActor(false); };

  return <AuthCtx.Provider value={{ actor, loginStaff, loginStudent, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function Protected({ roles, children }) {
  const { actor } = useAuth();
  const loc = useLocation();
  if (actor === null) return <div className="grid min-h-screen place-items-center text-muted-foreground" data-testid="auth-loading">…</div>;
  if (!actor) return <Navigate to={roles?.includes("STUDENT") ? "/student-login" : "/login"} state={{ from: loc }} replace />;
  if (roles && !roles.includes(actor.role)) return <Navigate to={homeFor(actor)} replace />;
  return children;
}
