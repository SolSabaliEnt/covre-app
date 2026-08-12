/** Dev-only auth tracing; set VITE_AUTH_DEBUG=true locally. Never logs tokens. */
export const AUTH_DEBUG =
  import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG === "true"

export function authDebug(...args: unknown[]): void {
  if (AUTH_DEBUG) {
    console.log(...args)
  }
}
