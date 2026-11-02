/**
 * Make S3 user metadata safe to send. Metadata travels as HTTP headers, which only
 * accept ASCII, so a subject or filename with an en dash, accent or emoji makes the
 * request throw. Values with non-ASCII characters are percent-encoded; ASCII values
 * (including Content-IDs, which are read back) are left unchanged.
 * @param metadata - Metadata key/value pairs
 * @returns Metadata with every value header-safe
 */
export function safeS3Metadata(metadata: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      /^[\x20-\x7e]*$/.test(value) ? value : encodeURIComponent(value),
    ])
  )
}
