const STORAGE_KEY = "backyard-explorer:history";
const MAX_ENTRIES = 20;

/** Recent searches, newest first */
export function getHistory(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((q): q is string => typeof q === "string")
      : [];
  } catch {
    return [];
  }
}

/** Move a query to the front of the history */
export function addToHistory(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return getHistory();
  const next = [trimmed, ...getHistory().filter((q) => q !== trimmed)].slice(
    0,
    MAX_ENTRIES,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or disabled; history is a convenience
  }
  return next;
}

export function removeFromHistory(query: string): string[] {
  const next = getHistory().filter((q) => q !== query);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
