import sanitizeHtml from "sanitize-html";

const SAFE_TAGS = [
  "p", "br", "strong", "em", "b", "i", "u", "s",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  "a",
  "span", "div", "blockquote",
];

const SAFE_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "target", "rel"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  span: ["style"],
  div: ["style"],
  p: ["style"],
  table: ["style"],
};

const SAFE_STYLES: Record<string, RegExp[]> = {
  "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
  "text-decoration": [/^underline$/, /^line-through$/],
  "font-weight": [/^bold$/, /^normal$/, /^\d+$/],
  "font-style": [/^italic$/, /^normal$/],
  "color": [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/],
  "background-color": [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/],
  "border": [/^.+$/],
  "padding": [/^\d+(\.\d+)?(px|em|rem|%)$/],
  "margin": [/^\d+(\.\d+)?(px|em|rem|%)$/],
  "width": [/^\d+(\.\d+)?(px|em|rem|%)$/],
};

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: SAFE_TAGS,
    allowedAttributes: SAFE_ATTRIBUTES,
    allowedStyles: { "*": SAFE_STYLES },
    disallowedTagsMode: "discard",
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}
