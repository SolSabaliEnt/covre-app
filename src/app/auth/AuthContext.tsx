import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import type { AuthStateChangeEvent } from "@supabase/supabase-js"
import { getBackendMode } from "../lib/backendMode"
import { getSupabaseClient } from "../lib/supabaseClient"
import { mockAuthStore } from "./mockAuthAdapter"
import { supabaseAuthAdapter } from "./supabaseAuthAdapter"
import type { AuthRole, AuthSession } from "./types"

export type Role = AuthRole
export type { AuthSession } from "./types"

type AuthContextValue = AuthSession & {
  isLoading: boolean
  loginAs: (role: Role) => void
  logout: () => void
  switchRole: (role: Role) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Supabase auth events that should re-resolve app session (skip TOKEN_REFRESHED). */
function shouldReloadOnAuthEvent(event: AuthStateChangeEvent): boolean {
  return (
    event === "INITIAL_SESSION" ||
    event === "SIGNED_IN" ||
    event === "SIGNED_OUT" ||
    event === "USER_UPDATED" ||
    event === "PASSWORD_RECOVERY"
  )
}

/** Keep last known good role when refresh/profile lookup temporarily fails. */
export function mergeSupabaseAuthSession(prev: AuthSession, next: AuthSession): AuthSession {
  if (!next.isAuthenticated) {
    return { ...next, isLoading: false, authError: undefined, role: undefined }
  }

  if (next.role) {
    return { ...next, isLoading: false, authError: undefined }
  }

  if (prev.isAuthenticated && prev.role) {
    return {
      isAuthenticated: true,
      role: prev.role,
      name: next.name || prev.name,
      email: next.email ?? prev.email,
      userId: next.userId ?? prev.userId,
      providerId: next.providerId ?? prev.providerId,
      workerId: next.workerId ?? prev.workerId,
      isLoading: false,
      authError:
        next.authError ??
        "Unable to verify your workspace role. Your last known access is preserved.",
    }
  }

  return { ...next, isLoading: false }
}

function MockAuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(
    mockAuthStore.subscribe,
    mockAuthStore.getSnapshot,
    mockAuthStore.getServerSnapshot,
  )

  const loginAs = useCallback((role: Role) => {
    mockAuthStore.loginAs(role)
  }, [])

  const logout = useCallback(() => {
    mockAuthStore.logout()
  }, [])

  const switchRole = useCallback((role: Role) => {
    mockAuthStore.switchRole(role)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      isLoading: false,
      loginAs,
      logout,
      switchRole,
    }),
    [session, loginAs, logout, switchRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    isAuthenticated: false,
    name: "",
    isLoading: true,
  })

  useEffect(() => {
    let cancelled = false

    const loadSupabaseSession = async () => {
      setSession(prev => ({ ...prev, isLoading: true }))
      try {
        const next = await supabaseAuthAdapter.getSession()
        if (!cancelled) {
          setSession(prev => mergeSupabaseAuthSession(prev, next))
        }
      } catch {
        if (!cancelled) {
          setSession(prev =>
            prev.isAuthenticated && prev.role
              ? {
                  ...prev,
                  isLoading: false,
                  authError:
                    "We couldn't refresh your session. Your last known access is preserved.",
                }
              : {
                  isAuthenticated: false,
                  name: "",
                  isLoading: false,
                  authError: "We couldn't refresh your session. Please sign in again.",
                },
          )
        }
      }
    }

    void loadSupabaseSession()

    const supabase = getSupabaseClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!shouldReloadOnAuthEvent(event)) {
        return
      }
      void loadSupabaseSession()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const loginAs = useCallback((role: Role) => {
    supabaseAuthAdapter.loginAs(role)
  }, [])

  const logout = useCallback(() => {
    void (async () => {
      await supabaseAuthAdapter.logout()
      const next = await supabaseAuthAdapter.getSession()
      setSession({ ...next, isLoading: false })
    })()
  }, [])

  const switchRole = useCallback((role: Role) => {
    supabaseAuthAdapter.switchRole(role)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      isLoading: session.isLoading ?? false,
      loginAs,
      logout,
      switchRole,
    }),
    [session, loginAs, logout, switchRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = useMemo(() => getBackendMode(), [])
  if (mode === "mock") {
    return <MockAuthProvider>{children}</MockAuthProvider>
  }
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
