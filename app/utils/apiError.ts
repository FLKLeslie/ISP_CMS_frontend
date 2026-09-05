// Extracts a human-readable message from an API error, whatever shape the
// backend sent - a plain {"detail": "..."}, DRF field-level validation
// errors ({"email": ["already exists"]}), or this project's wrapped shape
// ({"success": false, "errors": {...}, "status_code": ...} - see
// common.exceptions.custom_exception_handler on the backend). Falls back
// to `fallback` when nothing usable is found, so callers never show a
// blank message.
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: unknown })?.data
  if (!data || typeof data !== 'object') return fallback

  // Unwrap this project's {"success": false, "errors": {...}} envelope.
  const body = 'errors' in (data as Record<string, unknown>)
    ? (data as Record<string, unknown>).errors
    : data
  if (!body || typeof body !== 'object') return fallback

  const record = body as Record<string, unknown>
  if (typeof record.detail === 'string') return record.detail

  // Field-level validation errors: {"email": ["already exists"], ...} -
  // surface the first one, prefixed with the field name when it isn't a
  // generic non_field_errors/detail bucket.
  for (const [field, value] of Object.entries(record)) {
    const message = Array.isArray(value) ? value[0] : value
    if (typeof message !== 'string') continue
    return field === 'non_field_errors' || field === 'detail' ? message : `${field}: ${message}`
  }

  return fallback
}