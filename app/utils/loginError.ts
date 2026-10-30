// What to tell someone whose sign-in failed.
//
// The wording for "that didn't work" is deliberately ONE message for every kind of
// refusal - wrong password, unknown e-mail, inactive account, or a real account at the
// wrong door - because the server answers all of them identically on purpose (so the
// answer can't be used to find out which e-mails exist or who is an administrator).
// Never add wording here that distinguishes them.
const REFUSED = "We couldn't sign you in. Check your email and password and try again."

export function loginErrorMessage(error: unknown): string {
  const e = error as { response?: { status?: number }; statusCode?: number; status?: number } | null
  const status = e?.response?.status ?? e?.statusCode ?? e?.status
  if (status === undefined) return "We couldn't reach the server. Check your connection and try again."
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.'
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
  return REFUSED
}
