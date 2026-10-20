/**
 * Notes authored as Markdown in `content/` and turned into HTML by the loaders
 * at build time. The HTML is the repository's own, never user input — see the
 * loaders in `src/lib/content/`.
 *
 * The styling lives in the `.command-notes` rule of `globals.css` so both the
 * command and the script card get exactly the same one.
 */
export function MarkdownNotes({ html }: { html: string }) {
  return (
    <div
      className="command-notes text-xs text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
