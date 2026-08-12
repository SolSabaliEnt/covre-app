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
import { signInWorkerWithEmail, signUpWorkerWithEmail } from "../auth/supabaseWorkerAuth"

type Mode = "signup" | "signin"

export function WorkerAuthForm() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>("signin")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const validate = (): boolean => {
    if (!email.trim()) {
      toast.error("Email is required.")
      return false
    }
    if (password.length < 6) {
      toast.error("Password should be at least 6 characters.")
      return false
    }
    if (mode === "signup" && !fullName.trim()) {
      toast.error("Full name is required to create an account.")
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
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
      }

      const result =
        mode === "signup"
          ? await signUpWorkerWithEmail(payload)
          : await signInWorkerWithEmail(payload)

      if (!result.ok) {
        toast.error(result.error.message)
        return
      }

      if (result.data.sessionEstablished) {
        toast.success(result.data.message)
        navigate("/worker/onboarding", { replace: true })
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
            Apply for care shifts
          </CardTitle>
          <CardDescription className="mx-auto max-w-xs text-sm leading-relaxed text-[#607583]">
            Create or sign in to your Covre worker account.
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
            <div className="space-y-2">
              <Label htmlFor="worker-auth-name" className="text-[#13334F]">
                Full name
              </Label>
              <Input
                id="worker-auth-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                disabled={loading}
                className="border-[#DDE7E8] bg-white"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="worker-auth-email" className="text-[#13334F]">
              Email
            </Label>
            <Input
              id="worker-auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className="border-[#DDE7E8] bg-white"
            />
          </div>

          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="worker-auth-phone" className="text-[#13334F]">
                Phone <span className="font-normal text-[#9AAAB3]">(optional)</span>
              </Label>
              <Input
                id="worker-auth-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={loading}
                className="border-[#DDE7E8] bg-white"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="worker-auth-password" className="text-[#13334F]">
              Password
            </Label>
            <Input
              id="worker-auth-password"
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
            <p className="text-xs leading-relaxed text-[#9AAAB3]">
              After creating an account, check your inbox if email confirmation is required.
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-[#607583]">
              Sign in to continue your worker profile and shift applications.
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full bg-[#53B59F] text-white hover:bg-[#449a86]"
          >
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? "Create worker account"
                : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
