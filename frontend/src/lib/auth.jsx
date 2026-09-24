import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ACTOR_TYPE_KEY, api, TOKEN_KEY } from "./api";

const AuthCtx = createContext(null);

export const homeFor = (actor) => {
  if (!actor) return "/login";
  if (actor.type === "student") return "/student";
  return { SYS_ADMIN: "/admin", CIRCLE_ADMIN: "/circle", TEACHER: "/teacher" }[actor.role] || "/login";
};

const staffActor = (user) => ({ type: "staff", ...user });
const studentActor = (student) => ({ type: "student", role: "STUDENT", ...student });

export function AuthProvider({ children }) {
  const [actor, setActor] = useState(null); // null = checking, false = anonymous

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return setActor(false);
    api.get("/auth/me")
      .then(({ data }) => setActor(data.type === "staff" ? staffActor(data.user) : studentActor(data.student)))
      .catch(() => setActor(false));
  }, []);

  const signIn = (token, a) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ACTOR_TYPE_KEY, a.type);
    setActor(a);
    return a;
  };
  const loginStaff = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    return signIn(data.token, staffActor(data.user));
  };
  const loginStudent = async (access_code) => {
    const { data } = await api.post("/auth/student-login", { access_code });
    return signIn(data.token, studentActor(data.student));
  };
  const logout = () => { localStorage.removeItem(TOKEN_KEY); setActor(false); };

  /** A password change signs out every other device; this one continues on the token it returned. */
  const replaceToken = (token) => localStorage.setItem(TOKEN_KEY, token);
  /** Keeps the name in the header in step with an edit made on the account page. */
  const updateActor = (fields) => setActor((a) => (a ? { ...a, ...fields } : a));

  return (
    <AuthCtx.Provider value={{ actor, loginStaff, loginStudent, logout, replaceToken, updateActor }}>
      {children}
    </AuthCtx.Provider>
  );
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
