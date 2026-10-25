import type { AuthUser, LoginRequest, LoginResponse } from "@fastmeals/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/services/api-client";
import { onSessionExpired, refreshSession, setAccessToken } from "@/services/session";

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous"; expired: boolean };

type AuthContextValue = {
  state: AuthState;
  user: AuthUser | null;
  login: (credentials: LoginRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
  // Chamado ao sair ou quando a sessão expira: o app limpa o cache de dados do servidor,
  // para o próximo usuário não ver o que o anterior carregou.
  onSignOut?: () => void;
};

export function AuthProvider({ children, onSignOut }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  // Na carga da página não há access token (ele só vive em memória): o cookie httpOnly
  // de refresh, se ainda for válido, devolve a sessão sem pedir a senha de novo.
  useEffect(() => {
    let active = true;
    void refreshSession().then((session) => {
      if (!active) return;
      setState(
        session
          ? { status: "authenticated", user: session.user }
          : { status: "anonymous", expired: false },
      );
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        setState({ status: "anonymous", expired: true });
        onSignOut?.();
      }),
    [onSignOut],
  );

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: credentials,
    });
    // O refreshToken do corpo é ignorado de propósito: o cookie httpOnly já o guardou,
    // fora do alcance do JavaScript.
    setAccessToken(response.accessToken);
    setState({ status: "authenticated", user: response.user });
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST", body: {} });
    } finally {
      setAccessToken(null);
      setState({ status: "anonymous", expired: false });
      onSignOut?.();
    }
  }, [onSignOut]);

  const value = useMemo(
    () => ({
      state,
      user: state.status === "authenticated" ? state.user : null,
      login,
      logout,
    }),
    [state, login, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return context;
}
