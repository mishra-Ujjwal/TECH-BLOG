import { Marked } from "marked";

/**
 * Markdown for section bodies.
 *
 * Content is first-party (you author the JSON), so raw HTML in a body is passed
 * through. If you ever accept content you did not write, add a sanitiser here.
 */
const marked = new Marked({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(src: string): string {
  return marked.parse(src, { async: false }) as string;
}

/** Strip markdown to plain text, for meta tags and JSON-LD. */
export function toPlainText(src: string): string {
  return src
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
