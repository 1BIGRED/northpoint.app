// Page-path helpers for multi-page sites. Pure string logic, no I/O — the
// editor route, the create-page action, and the public render route all agree
// on the same canonical form through these functions.
//
// Canonical form: the home page is "/", every other page is "/<slug>" where
// slug is lowercase, hyphen-separated, [a-z0-9-]. The public route exposes the
// slug without its leading slash (/sites/<id>/<slug>).

export const HOME_PATH = "/";

// Turn arbitrary user input ("About Us", "/contact/", "Our Work!") into a
// canonical page path ("/about-us", "/contact", "/our-work"). Returns null when
// the input has no usable characters. "/" (home) is returned for empty-ish
// input that still reads as root, so callers must reject HOME_PATH explicitly
// when creating a *new* page.
export function normalizePagePath(input: string): string | null {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "") // strip leading/trailing slashes
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "") // trim stray hyphens
    .replace(/-{2,}/g, "-"); // collapse repeats

  if (!slug) return null;
  return `/${slug}`;
}

// The slug a public URL segment maps to: "about" → "/about". A missing/empty
// segment is the home page.
export function pathFromSlug(slug: string | undefined): string {
  if (!slug) return HOME_PATH;
  const normalized = normalizePagePath(slug);
  return normalized ?? HOME_PATH;
}

// The URL segment for a stored path: "/about" → "about", "/" → "".
export function slugFromPath(path: string): string {
  return path === HOME_PATH ? "" : path.replace(/^\//, "");
}

// A friendly label for a page tab: "/" → "Home", "/about-us" → "About us".
export function pageLabel(path: string): string {
  if (path === HOME_PATH) return "Home";
  const slug = slugFromPath(path).replace(/-/g, " ");
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

// Order pages for display: home first, then alphabetical by path.
export function sortPagePaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    if (a === HOME_PATH) return -1;
    if (b === HOME_PATH) return 1;
    return a.localeCompare(b);
  });
}
