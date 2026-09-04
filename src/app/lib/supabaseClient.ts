import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const ANON_KEY_PLACEHOLDER = "replace_with_supabase_anon_key"

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const supabaseUrl = readTrimmedString(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = readTrimmedString(import.meta.env.VITE_SUPABASE_ANON_KEY)

function computeConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false
  if (supabaseAnonKey === ANON_KEY_PLACEHOLDER) return false
  return true
}

export const isSupabaseConfigured = computeConfigured()

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null

/**
 * Covre does not yet commit generated Supabase Database types. Keep that missing schema contract
 * explicit at this single boundary instead of pretending PostgREST relationship inference is
 * authoritative throughout repositories. Repository DTOs remain the checked application boundary.
 * Replace `any` with `SupabaseClient<Database>` when generated Covre schema types are committed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseClient(): any {
  if (!isSupabaseConfigured || supabase === null) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    )
  }
  return supabase
}
