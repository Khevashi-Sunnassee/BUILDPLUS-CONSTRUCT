import logger from "../lib/logger";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const MAX_CHUNK_SIZE = 1500;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function splitByHeadings(text: string): { content: string; heading?: string }[] {
  const headingPattern = /^(#{1,6}\s+.+|[A-Z][A-Z\s]{3,}[A-Z](?:\n|$)|(?:^|\n)(?:\d+\.?\s+)?[A-Z][a-zA-Z\s]+(?::\s*$|\n={3,}|\n-{3,}))/gm;
  const sections: { content: string; heading?: string }[] = [];
  const lines = text.split("\n");
  let currentSection = "";
  let currentHeading: string | undefined;

  for (const line of lines) {
    const isHeading = /^#{1,6}\s+/.test(line) ||
      /^[A-Z][A-Z\s]{3,}[A-Z]$/.test(line.trim()) ||
      /^\d+\.?\s+[A-Z]/.test(line.trim());

    if (isHeading && currentSection.trim()) {
      sections.push({ content: currentSection.trim(), heading: currentHeading });
      currentSection = line + "\n";
      currentHeading = line.trim().replace(/^#+\s+/, "");
    } else {
      currentSection += line + "\n";
      if (isHeading && !currentHeading) {
        currentHeading = line.trim().replace(/^#+\s+/, "");
      }
    }
  }

  if (currentSection.trim()) {
    sections.push({ content: currentSection.trim(), heading: currentHeading });
  }

  return sections.length > 0 ? sections : [{ content: text }];
}

function splitByParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  return paragraphs;
}

function splitBySentences(text: string): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
  return sentences.map(s => s.trim()).filter(s => s);
}

export interface ChunkResult {
  content: string;
  tokenCount: number;
  metadata: { section?: string; headings?: string[]; chunkIndex: number };
}

export function chunkText(text: string, docTitle?: string): ChunkResult[] {
  if (!text || !text.trim()) return [];

  const cleanedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{3,}/g, "  ")
    .trim();

  const sections = splitByHeadings(cleanedText);
  const chunks: ChunkResult[] = [];
  let globalIndex = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);

    if (sectionTokens <= CHUNK_SIZE) {
      chunks.push({
        content: section.content,
        tokenCount: sectionTokens,
        metadata: {
          section: section.heading,
          headings: section.heading ? [section.heading] : undefined,
          chunkIndex: globalIndex++,
        },
      });
      continue;
    }

    const paragraphs = splitByParagraphs(section.content);
    let currentChunk = "";
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paraTokens = estimateTokens(paragraph);

      if (paraTokens > MAX_CHUNK_SIZE) {
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            tokenCount: currentTokens,
            metadata: {
              section: section.heading,
              headings: section.heading ? [section.heading] : undefined,
              chunkIndex: globalIndex++,
            },
          });
          currentChunk = "";
          currentTokens = 0;
        }

        const sentences = splitBySentences(paragraph);
        let sentenceChunk = "";
        let sentenceTokens = 0;

        for (const sentence of sentences) {
          const sTokens = estimateTokens(sentence);
          if (sentenceTokens + sTokens > CHUNK_SIZE && sentenceChunk.trim()) {
            chunks.push({
              content: sentenceChunk.trim(),
              tokenCount: sentenceTokens,
              metadata: {
                section: section.heading,
                headings: section.heading ? [section.heading] : undefined,
                chunkIndex: globalIndex++,
              },
            });
            const overlapText = sentenceChunk.trim().slice(-CHUNK_OVERLAP * 4);
            sentenceChunk = overlapText + " " + sentence;
            sentenceTokens = estimateTokens(sentenceChunk);
          } else {
            sentenceChunk += (sentenceChunk ? " " : "") + sentence;
            sentenceTokens += sTokens;
          }
        }

        if (sentenceChunk.trim()) {
          currentChunk = sentenceChunk;
          currentTokens = sentenceTokens;
        }
        continue;
      }

      if (currentTokens + paraTokens > CHUNK_SIZE && currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          tokenCount: currentTokens,
          metadata: {
            section: section.heading,
            headings: section.heading ? [section.heading] : undefined,
            chunkIndex: globalIndex++,
          },
        });

        const overlapText = currentChunk.trim().slice(-CHUNK_OVERLAP * 4);
        currentChunk = overlapText + "\n\n" + paragraph;
        currentTokens = estimateTokens(currentChunk);
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        currentTokens += paraTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        tokenCount: currentTokens,
        metadata: {
          section: section.heading,
          headings: section.heading ? [section.heading] : undefined,
          chunkIndex: globalIndex++,
        },
      });
    }
  }

  logger.info({ docTitle, totalChunks: chunks.length, totalTokens: chunks.reduce((s, c) => s + c.tokenCount, 0) }, "[KB] Document chunked");

  return chunks;
}

export function extractTextFromPlainText(content: string): string {
  return content;
}
