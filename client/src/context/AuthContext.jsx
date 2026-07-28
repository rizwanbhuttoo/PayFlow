import { useCallback, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "../lib/api";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    api("/auth/me")
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((data) => {
    tokenStore.set(data.token);
    setUser(data.user);
  }, []);
  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);
  const value = useMemo(
    () => ({ user, loading, login, logout, updateUser: setUser }),
    [user, loading, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
