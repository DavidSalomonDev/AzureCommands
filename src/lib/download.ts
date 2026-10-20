/**
 * Hands the browser a file built in memory.
 *
 * Two details matter and were wrong when this lived inline in the cards:
 * Firefox ignores a click on an anchor that is not in the document, and
 * revoking the object URL in the same tick can cancel the download before it
 * starts — so the anchor is attached, clicked, and only then cleaned up.
 */
export function downloadFile(content: string, fileName: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Give the download a tick to start before the URL stops resolving.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
