import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Button } from "./ui/button"
import { cn } from "./ui/utils"
import { CovreBrandLogo } from "./CovreBrandLogo"
import { APP_NAME } from "../lib/brand"
import {
  signInProviderWithEmail,
  signUpProviderWithEmail,
} from "../auth/supabaseProviderAuth"
import { getProviderOnboardingStatus } from "../services"

type Mode = "signup" | "signin"

export function ProviderAuthForm() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [contactName, setContactName] = useState("")
  const [loading, setLoading] = useState(false)

  const validate = (): boolean => {
    if (!email.trim()) {
      toast.error("Email is required.")
      return false
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return false
    }
    if (mode === "signup" && !organizationName.trim()) {
      toast.error("Organization name is required to create an account.")
      return false
    }
    return true
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const payload = {
        email: email.trim(),
        password,
        organizationName: organizationName.trim() || undefined,
        contactName: contactName.trim() || undefined,
      }

      const result =
        mode === "signup"
          ? await signUpProviderWithEmail(payload)
          : await signInProviderWithEmail(payload)

      if (!result.ok) {
        toast.error(result.error.message)
        return
      }

      if (result.data.sessionEstablished) {
        toast.success(result.data.message)
        const status = await getProviderOnboardingStatus()
        if (status.ok && status.data.onboardingComplete) {
          navigate("/provider", { replace: true })
        } else {
          navigate("/provider/onboarding", { replace: true })
        }
        return
      }

      toast.success(result.data.message, { duration: 8000 })
      if (mode === "signup") {
        setMode("signin")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full border-[#DDE7E8] bg-white shadow-sm">
      <CardHeader className="items-center space-y-3 pb-5 text-center">
        <CovreBrandLogo
          surface="light"
          layout="mark"
          width={64}
          className="mx-auto"
          imgClassName="h-16 w-16 object-contain"
          alt={APP_NAME}
        />
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold text-[#13334F]">
            Facility access
          </CardTitle>
          <CardDescription className="mx-auto max-w-xs text-sm leading-relaxed text-[#607583]">
            Create or sign in to your Covre facility account.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <div
          className="flex rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-1"
          role="tablist"
          aria-label="Account mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={cn(
              "min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]",
              mode === "signin"
                ? "bg-white text-[#13334F] shadow-sm"
                : "text-[#607583] hover:text-[#13334F]",
            )}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={cn(
              "min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]",
              mode === "signup"
                ? "bg-white text-[#13334F] shadow-sm"
                : "text-[#607583] hover:text-[#13334F]",
            )}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {mode === "signup" ? (
            <p className="text-xs leading-relaxed text-[#607583]">
              Create a facility account to set up your organization, add care sites, and post
              shifts. Worker and admin sign-in are not available on this screen.
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-[#607583]">
              Sign in to return to workspace setup or your facility dashboard. Worker and admin
              sign-in are not available on this screen.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="provider-auth-email" className="text-[#13334F]">
              Email
            </Label>
            <Input
              id="provider-auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className="border-[#DDE7E8] bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="provider-auth-password" className="text-[#13334F]">
              Password
            </Label>
            <Input
              id="provider-auth-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              minLength={6}
              className="border-[#DDE7E8] bg-white"
            />
            <p className="text-xs text-[#607583]">At least 6 characters.</p>
          </div>

          {mode === "signup" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="provider-auth-org" className="text-[#13334F]">
                  Organization name
                </Label>
                <Input
                  id="provider-auth-org"
                  type="text"
                  autoComplete="organization"
                  value={organizationName}
                  onChange={e => setOrganizationName(e.target.value)}
                  disabled={loading}
                  className="border-[#DDE7E8] bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-auth-contact" className="text-[#13334F]">
                  Primary contact name
                </Label>
                <Input
                  id="provider-auth-contact"
                  type="text"
                  autoComplete="name"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  disabled={loading}
                  className="border-[#DDE7E8] bg-white"
                />
              </div>
              <p className="text-xs leading-relaxed text-[#9AAAB3]">
                After creating an account, check your inbox if email confirmation is required.
              </p>
            </>
          ) : null}

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full bg-[#53B59F] text-white hover:bg-[#449a86]"
          >
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? "Create facility account"
                : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
