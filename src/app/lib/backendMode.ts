import { isSupabaseConfigured } from "./supabaseClient"

export type BackendMode = "mock" | "supabase"

function readRawBackendMode(): string | undefined {
  const v = import.meta.env.VITE_BACKEND_MODE
  if (typeof v !== "string") return undefined
  const t = v.trim()
  return t.length > 0 ? t : undefined
}

export function getBackendMode(): BackendMode {
  const raw = readRawBackendMode()
  if (raw === "supabase" && isSupabaseConfigured) return "supabase"
  return "mock"
}

export function isSupabaseBackendEnabled(): boolean {
  return getBackendMode() === "supabase"
}
