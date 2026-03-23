/** Build user-visible text from API JSON error payloads (e.g. milestone 409 FK). */
export function formatApiErrorBody(
  body: { error?: string; details?: string } | null | undefined,
  fallback: string
): string {
  if (!body?.error?.trim()) return fallback;
  const err = body.error.trim();
  const det = body.details?.trim();
  if (det && det !== err) {
    return `${err}\n\nTechnical details:\n${det}`;
  }
  return err;
}
