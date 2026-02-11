/**
 * Generates a unique ID with an optional prefix.
 * Format: [prefix-]<timestamp>-<random-string>
 */
export function generateId(prefix?: string): string {
  const uniqueString = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return prefix ? `${prefix}-${uniqueString}` : uniqueString;
}
