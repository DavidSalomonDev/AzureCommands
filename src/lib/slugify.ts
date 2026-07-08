export function slugify(text: string): string {
  const withoutDiacritics = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const slug = withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "comando";
}
