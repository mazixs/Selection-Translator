export function shouldRefreshSelectionForKey(key: unknown): boolean {
  return typeof key === "string" && (key.startsWith("Arrow") || key === "Shift");
}
