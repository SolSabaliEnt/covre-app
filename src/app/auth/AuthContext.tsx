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
import type { AuthChangeEvent } from "@supabase/supabase-js"
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
function shouldReloadOnAuthEvent(event: AuthChangeEvent): boolean {
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
      authError: next.authError,
    }
  }

  return { ...next, isLoading: false }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const backendMode = getBackendMode()
  const mockSession = useSyncExternalStore(
    mockAuthStore.subscribe,
    mockAuthStore.getSnapshot,
    mockAuthStore.getSnapshot,
  )
  const [supabaseSession, setSupabaseSession] = useState<AuthSession>({
    name: "",
    isAuthenticated: false,
    isLoading: backendMode === "supabase",
  })

  const reloadSupabaseSession = useCallback(async () => {
    const next = await supabaseAuthAdapter.getSession()
    setSupabaseSession(prev => mergeSupabaseAuthSession(prev, next))
  }, [])

  useEffect(() => {
    if (backendMode !== "supabase") return

    let active = true
    void supabaseAuthAdapter.getSession().then(next => {
      if (!active) return
      setSupabaseSession(prev => mergeSupabaseAuthSession(prev, next))
    })

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange(event => {
      if (!active || !shouldReloadOnAuthEvent(event)) return
      void reloadSupabaseSession()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [backendMode, reloadSupabaseSession])

  const loginAs = useCallback(
    (role: Role) => {
      if (backendMode === "mock") mockAuthStore.loginAs(role)
    },
    [backendMode],
  )

  const logout = useCallback(() => {
    if (backendMode === "mock") {
      mockAuthStore.logout()
      return
    }
    void supabaseAuthAdapter.logout().then(() => {
      setSupabaseSession({ name: "", isAuthenticated: false, isLoading: false })
    })
  }, [backendMode])

  const switchRole = useCallback(
    (role: Role) => {
      if (backendMode === "mock") mockAuthStore.switchRole(role)
    },
    [backendMode],
  )

  const session = backendMode === "supabase" ? supabaseSession : mockSession
  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      isLoading: session.isLoading ?? false,
      loginAs,
      logout,
      switchRole,
    }),
    [loginAs, logout, session, switchRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
