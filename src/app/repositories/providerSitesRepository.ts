import type { ApiResult } from "../api/types"
import type { CareSite, SiteOperationalDetail, SiteOperationalStatus } from "../data/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderSiteCreatePayload,
  ProviderSiteCreateResult,
  ProviderSitePage,
} from "../services/types"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Care site access is blocked by database permissions (RLS)."
  }
  return raw
}

function splitLines(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
}

function appendLine(lines: string[], label: string, value: string | null | undefined) {
  const trimmed = value?.trim()
  if (trimmed) lines.push(`${label}: ${trimmed}`)
}

type ProviderMembership = {
  providerId: string
}

type CareSiteRow = {
  id: string
  provider_id: string
  name: string
  site_type: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  resident_count: number | null
  status: string
}

type SiteContactRow = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
  is_primary: boolean | null
}

type SiteOrientationRow = {
  overview: string | null
  parking_notes: string | null
  door_access: string | null
  house_rules: string | null
  emergency_protocol: string | null
  med_pass_notes: string | null
}

function mapOperationalStatus(dbStatus: string): SiteOperationalStatus {
  return dbStatus === "active" ? "active" : "needs_review"
}

function formatAddress(row: CareSiteRow): string {
  const parts = [
    row.address_line1,
    row.address_line2,
    [row.city, row.state].filter(Boolean).join(", "),
    row.postal_code,
  ].filter((part): part is string => Boolean(part?.trim()))
  return parts.join(", ").trim() || "—"
}

function mapCareSiteRow(row: CareSiteRow): CareSite {
  return {
    id: row.id,
    name: row.name,
    facilityType: row.site_type?.trim() || "Care site",
    providerOrgId: row.provider_id,
    address: formatAddress(row),
    residents: row.resident_count ?? 0,
    preferredWorkerSlots: 0,
    operationalStatus: mapOperationalStatus(row.status),
  }
}

function mapOperationalDetail(
  orientation: SiteOrientationRow | null,
  contacts: SiteContactRow[],
): SiteOperationalDetail {
  const overview =
    orientation?.overview?.trim() ||
    "Orientation details have not been added for this site yet."

  const orientationLines = splitLines(orientation?.overview)
  appendLine(orientationLines, "Parking", orientation?.parking_notes)
  appendLine(orientationLines, "Door access", orientation?.door_access)
  if (orientationLines.length === 0) {
    orientationLines.push("Add parking, access, and shift notes in site orientation.")
  }

  const mappedContacts = contacts
    .filter(c => c.name?.trim() || c.phone?.trim() || c.email?.trim())
    .map(c => ({
      role: c.title?.trim() || (c.is_primary ? "Primary contact" : "Contact"),
      name: c.name?.trim() || "—",
      phone: c.phone?.trim() || c.email?.trim() || "—",
    }))

  const houseRules = splitLines(orientation?.house_rules)
  const emergency = splitLines(orientation?.emergency_protocol)
  const credentialRequirements = splitLines(orientation?.med_pass_notes)

  return {
    overview,
    contacts:
      mappedContacts.length > 0
        ? mappedContacts
        : [{ role: "Contact", name: "Not listed", phone: "—" }],
    orientation: orientationLines,
    credentialRequirements:
      credentialRequirements.length > 0
        ? credentialRequirements
        : ["Credential requirements not configured for this site yet."],
    houseRules:
      houseRules.length > 0 ? houseRules : ["House rules not documented for this site yet."],
    emergency:
      emergency.length > 0
        ? emergency
        : ["Emergency protocol not documented for this site yet."],
    preferredBenchWorkerIds: [],
  }
}

async function loadProviderMembership(): Promise<
  ApiResult<ProviderMembership | null>
> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return fail("not_authenticated", "Sign in with Supabase before loading care sites.")
  }

  const { data: rows, error } = await supabase
    .from("provider_members")
    .select("provider_id")
    .eq("user_id", session.user.id)
    .limit(1)

  if (error) {
    return fail("provider_membership_load", friendlyDbMessage(error, "Unable to load provider membership."))
  }

  const row = rows?.[0] as { provider_id: string } | undefined
  if (!row?.provider_id) {
    return ok(null)
  }

  return ok({ providerId: row.provider_id })
}

export async function listProviderSitesFromSupabase(): Promise<ApiResult<CareSite[]>> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) {
      return membershipResult
    }
    if (!membershipResult.data) {
      return ok([])
    }

    const supabase = getSupabaseClient()
    const { data: rows, error } = await supabase
      .from("care_sites")
      .select(
        "id, provider_id, name, site_type, address_line1, address_line2, city, state, postal_code, resident_count, status",
      )
      .eq("provider_id", membershipResult.data.providerId)
      .order("created_at", { ascending: false })

    if (error) {
      return fail("care_sites_list", friendlyDbMessage(error, "Unable to load care sites."))
    }

    const sites = ((rows ?? []) as CareSiteRow[]).map(mapCareSiteRow)
    return ok(sites)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function getProviderSiteFromSupabase(
  siteId: string,
): Promise<ApiResult<ProviderSitePage | null>> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) {
      return membershipResult
    }
    if (!membershipResult.data) {
      return ok(null)
    }

    const supabase = getSupabaseClient()
    const { data: siteRow, error: siteError } = await supabase
      .from("care_sites")
      .select(
        "id, provider_id, name, site_type, address_line1, address_line2, city, state, postal_code, resident_count, status",
      )
      .eq("id", siteId)
      .eq("provider_id", membershipResult.data.providerId)
      .maybeSingle()

    if (siteError) {
      return fail("care_site_load", friendlyDbMessage(siteError, "Unable to load care site."))
    }
    if (!siteRow) {
      return ok(null)
    }

    const site = mapCareSiteRow(siteRow as CareSiteRow)

    const { data: contactRows, error: contactError } = await supabase
      .from("site_contacts")
      .select("name, title, phone, email, is_primary")
      .eq("site_id", siteId)

    if (contactError) {
      return fail("site_contacts_load", friendlyDbMessage(contactError, "Unable to load site contacts."))
    }

    const { data: orientationRow, error: orientationError } = await supabase
      .from("site_orientation")
      .select(
        "overview, parking_notes, door_access, house_rules, emergency_protocol, med_pass_notes",
      )
      .eq("site_id", siteId)
      .maybeSingle()

    if (orientationError) {
      return fail(
        "site_orientation_load",
        friendlyDbMessage(orientationError, "Unable to load site orientation."),
      )
    }

    const operational = mapOperationalDetail(
      (orientationRow as SiteOrientationRow | null) ?? null,
      (contactRows ?? []) as SiteContactRow[],
    )

    return ok({
      site,
      operational,
      benchNames: [],
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function createProviderSiteInSupabase(
  payload: ProviderSiteCreatePayload,
): Promise<ApiResult<ProviderSiteCreateResult>> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) {
      return membershipResult
    }
    if (!membershipResult.data) {
      return fail(
        "no_provider_membership",
        "Complete provider setup before adding care sites.",
      )
    }

    const name = payload.siteName?.trim()
    if (!name) {
      return fail("validation", "Please add a site name before continuing.")
    }
    if (!payload.siteType?.trim()) {
      return fail("validation", "Please select a site type.")
    }

    const residentParsed = Number.parseInt(String(payload.residentCount ?? "").trim(), 10)
    const residentCount = Number.isFinite(residentParsed) ? residentParsed : null

    const supabase = getSupabaseClient()
    const providerId = membershipResult.data.providerId

    const { data: siteRow, error: siteErr } = await supabase
      .from("care_sites")
      .insert({
        provider_id: providerId,
        name,
        site_type: payload.siteType?.trim() || null,
        address_line1: payload.address?.trim() || null,
        address_line2: null,
        city: payload.city?.trim() || null,
        state: payload.state?.trim() || null,
        postal_code: null,
        resident_count: residentCount,
        status: "needs_review",
      })
      .select(
        "id, provider_id, name, site_type, address_line1, address_line2, city, state, postal_code, resident_count, status",
      )
      .single()

    if (siteErr || !siteRow) {
      return fail(
        "care_site_insert",
        friendlyDbMessage(siteErr ?? { message: "Unknown error" }, "Unable to save care site."),
      )
    }

    const siteId = (siteRow as CareSiteRow).id
    const hasContact =
      Boolean(payload.primaryContact?.trim()) || Boolean(payload.contactPhone?.trim())

    if (hasContact) {
      const { error: contactErr } = await supabase.from("site_contacts").insert({
        site_id: siteId,
        name: payload.primaryContact?.trim() || null,
        title: "Primary contact",
        phone: payload.contactPhone?.trim() || null,
        email: null,
        is_primary: true,
      })
      if (contactErr) {
        return fail(
          "site_contact_insert",
          friendlyDbMessage(contactErr, "Care site saved but contact could not be added."),
        )
      }
    }

    const overview = payload.orientationNotes?.trim() || "Orientation to be completed."

    const { error: orientErr } = await supabase.from("site_orientation").insert({
      site_id: siteId,
      overview,
      parking_notes: "",
      door_access: "",
      house_rules: "",
      emergency_protocol: "",
      med_pass_notes: "",
    })
    if (orientErr) {
      return fail(
        "site_orientation_insert",
        friendlyDbMessage(orientErr, "Care site saved but orientation could not be added."),
      )
    }

    const site = mapCareSiteRow(siteRow as CareSiteRow)
    return ok({ siteId, site })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
