export function safeJsonParse<T>(
  s: string,
): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: JSON.parse(s) as T };
  } catch (error) {
    return { ok: false, error };
  }
}

export function jsonLine(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}
