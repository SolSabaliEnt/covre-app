import type { AuthAdapter, AuthRole, AuthSession } from "./types"

export const MOCK_AUTH_STORAGE_KEY = "covre-auth-session"
const LEGACY_MOCK_AUTH_STORAGE_KEY = "coverd-auth-session"

const MOCK_BY_ROLE: Record<AuthRole, Omit<AuthSession, "isAuthenticated">> = {
  worker: { role: "worker", name: "Maya Johnson" },
  provider: { role: "provider", name: "Evergreen Residential Care" },
  admin: { role: "admin", name: "Covre Ops" },
}

const emptySession: AuthSession = {
  isAuthenticated: false,
  role: "worker",
  name: "",
}

function readStoredSession(): AuthSession {
  if (typeof window === "undefined") {
    return { ...emptySession }
  }
  try {
    const raw = localStorage.getItem(MOCK_AUTH_STORAGE_KEY) ?? localStorage.getItem(LEGACY_MOCK_AUTH_STORAGE_KEY)
    if (!raw) {
      return { ...emptySession }
    }
    const parsed = JSON.parse(raw) as AuthSession
    if (
      parsed &&
      typeof parsed.isAuthenticated === "boolean" &&
      parsed.role &&
      ["worker", "provider", "admin"].includes(parsed.role)
    ) {
      const role = parsed.role as AuthRole
      return {
        role,
        name: typeof parsed.name === "string" ? parsed.name : MOCK_BY_ROLE[role].name,
        email: typeof parsed.email === "string" ? parsed.email : undefined,
        isAuthenticated: parsed.isAuthenticated,
        providerId: typeof parsed.providerId === "string" ? parsed.providerId : undefined,
        workerId: typeof parsed.workerId === "string" ? parsed.workerId : undefined,
        userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
      }
    }
  } catch {
    /* ignore */
  }
  return { ...emptySession }
}

function writeStoredSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return
  }
  localStorage.removeItem(LEGACY_MOCK_AUTH_STORAGE_KEY)
  if (!session.isAuthenticated) {
    localStorage.removeItem(MOCK_AUTH_STORAGE_KEY)
    return
  }
  const payload: Record<string, unknown> = {
    role: session.role,
    name: session.name,
    email: session.email,
    isAuthenticated: true,
  }
  if (session.providerId) payload.providerId = session.providerId
  if (session.workerId) payload.workerId = session.workerId
  if (session.userId) payload.userId = session.userId
  localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(payload))
}

let snapshot: AuthSession =
  typeof window !== "undefined" ? readStoredSession() : { ...emptySession }

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

function setSession(next: AuthSession) {
  snapshot = next
  writeStoredSession(next)
  emit()
}

export const mockAuthStore = {
  subscribe(onChange: () => void) {
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  },
  getSnapshot(): AuthSession {
    return snapshot
  },
  getServerSnapshot(): AuthSession {
    return { ...emptySession }
  },
  loginAs(role: AuthRole) {
    const base = MOCK_BY_ROLE[role]
    setSession({
      ...base,
      isAuthenticated: true,
    })
  },
  logout() {
    setSession({ ...emptySession })
  },
  switchRole(role: AuthRole) {
    mockAuthStore.loginAs(role)
  },
}

export const mockAuthAdapter: AuthAdapter = {
  getSession: () => Promise.resolve(mockAuthStore.getSnapshot()),
  loginAs: role => {
    mockAuthStore.loginAs(role)
  },
  logout: () => {
    mockAuthStore.logout()
  },
  switchRole: role => {
    mockAuthStore.switchRole(role)
  },
}
