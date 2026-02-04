export function extractMentionUserIds(body: string): string[] {
  const regex = /@\[[^\]]+\]\(user:([^)]+)\)/g;
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) ids.add(match[1]);
  return Array.from(ids);
}
