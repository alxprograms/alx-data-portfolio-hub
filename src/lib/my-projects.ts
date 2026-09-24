const storageKey = "alx-data-portfolio-hub:my-projects:v1";

function uniqueSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.filter((slug): slug is string => typeof slug === "string" && slug.length > 0)),
  );
}

export function readMyProjectSlugs(): string[] {
  try {
    return uniqueSlugs(JSON.parse(window.localStorage.getItem(storageKey) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveMyProjectSlugs(slugs: string[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(uniqueSlugs(slugs)));
  } catch {
    // The commitment still succeeds if storage is unavailable.
  }
}
