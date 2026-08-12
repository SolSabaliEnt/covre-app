export type AuthRole = "worker" | "provider" | "admin"

export type AuthSession = {
  /** Undefined while loading or when Supabase role resolution fails (never default to worker). */
  role?: AuthRole
  name: string
  email?: string
  isAuthenticated: boolean
  /** True while Supabase session + profile role lookup is in flight. */
  isLoading?: boolean
  /** Set when authenticated but app role could not be resolved. */
  authError?: string
  providerId?: string
  workerId?: string
  userId?: string
}

export type AuthAdapter = {
  getSession: () => Promise<AuthSession>
  loginAs: (role: AuthRole) => void | Promise<void>
  logout: () => void | Promise<void>
  switchRole: (role: AuthRole) => void | Promise<void>
}
