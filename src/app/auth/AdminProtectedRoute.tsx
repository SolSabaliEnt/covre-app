import { useEffect, useState } from "react"
import { Navigate, Outlet } from "react-router"
import { getBackendMode } from "../lib/backendMode"
import { ADMIN_ENTRY_PATH } from "../lib/entryRoutes"
import { getCurrentAdminRoleFromSupabase } from "./supabaseAdminAuth"
import { AccessRestricted, ProtectedRoute } from "./ProtectedRoute"
import { useAuth } from "./AuthContext"

function AdminLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F7FAFA] px-4">
      <p className="text-sm font-medium text-[#13334F]">Verifying admin access…</p>
    </div>
  )
}

function SupabaseAdminGate() {
  const { isLoading: authLoading, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [deniedMessage, setDeniedMessage] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!isAuthenticated) {
        if (!cancelled) {
          setAllowed(false)
          setLoading(false)
        }
        return
      }

      const result = await getCurrentAdminRoleFromSupabase()
      if (cancelled) return

      if (!result.ok) {
        setAllowed(false)
        setDeniedMessage(result.error.message)
        setLoading(false)
        return
      }

      setAllowed(result.data.isAdmin)
      setDeniedMessage(result.data.isAdmin ? undefined : result.data.message)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (authLoading || loading) {
    return <AdminLoading />
  }

  if (!isAuthenticated) {
    return <Navigate to={ADMIN_ENTRY_PATH} replace />
  }

  if (!allowed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F7FAFA] px-4 py-12">
        <AccessRestricted allowedRoles={["admin"]} />
        {deniedMessage && (
          <p className="mt-4 max-w-md text-center text-sm text-[#607583]">{deniedMessage}</p>
        )}
      </div>
    )
  }

  return <Outlet />
}

/** Admin routes: mock uses session role; Supabase verifies `user_roles` on each load. */
export function AdminProtectedRoute() {
  if (getBackendMode() === "mock") {
    return <ProtectedRoute allowedRoles={["admin"]} />
  }
  return <SupabaseAdminGate />
}
