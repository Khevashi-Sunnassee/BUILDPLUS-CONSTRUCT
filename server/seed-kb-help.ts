import { db } from "./db";
import { helpEntries } from "@shared/schema";
import { sql, ilike, or } from "drizzle-orm";
import logger from "./lib/logger";

export interface HelpSearchResult {
  title: string;
  shortText: string;
  bodyMd: string;
  category: string;
}

export async function searchHelpEntries(query: string): Promise<HelpSearchResult[]> {
  try {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 5);
    if (words.length === 0) return [];

    const conditions = words.map(word =>
      or(
        ilike(helpEntries.title, `%${word}%`),
        ilike(helpEntries.shortText, `%${word}%`),
        sql`${helpEntries.keywords}::text ILIKE ${'%' + word + '%'}`
      )
    );

    const results = await db
      .select({
        title: helpEntries.title,
        shortText: helpEntries.shortText,
        bodyMd: helpEntries.bodyMd,
        category: helpEntries.category,
      })
      .from(helpEntries)
      .where(or(...conditions))
      .limit(5);

    return results.map(r => ({
      title: r.title,
      shortText: r.shortText || "",
      bodyMd: r.bodyMd || "",
      category: r.category || "General",
    }));
  } catch (error) {
    logger.error({ err: error }, "[KB Help] Failed to search help entries");
    return [];
  }
}

export function buildHelpContext(helpResults: HelpSearchResult[]): string {
  if (helpResults.length === 0) return "";

  return helpResults.map((h, i) => {
    let text = `[System Help ${i + 1}: ${h.title} (${h.category})]\n`;
    if (h.shortText) text += `${h.shortText}\n`;
    if (h.bodyMd) text += `${h.bodyMd}`;
    return text;
  }).join("\n\n---\n\n");
}
