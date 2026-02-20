function renderInlineMarkdown(text: string, keyPrefix: string = "md"): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    type MatchInfo = { index: number; length: number; node: React.ReactNode };
    const candidates: MatchInfo[] = [];

    if (codeMatch && codeMatch.index !== undefined) {
      candidates.push({
        index: codeMatch.index,
        length: codeMatch[0].length,
        node: <code key={`${keyPrefix}-c${key++}`} className="px-1 py-0.5 rounded bg-muted text-sm font-mono">{codeMatch[1]}</code>,
      });
    }
    if (boldMatch && boldMatch.index !== undefined) {
      candidates.push({
        index: boldMatch.index,
        length: boldMatch[0].length,
        node: <strong key={`${keyPrefix}-b${key++}`}>{boldMatch[1]}</strong>,
      });
    }
    if (italicMatch && italicMatch.index !== undefined) {
      candidates.push({
        index: italicMatch.index,
        length: italicMatch[0].length,
        node: <em key={`${keyPrefix}-i${key++}`}>{italicMatch[1]}</em>,
      });
    }
    if (linkMatch && linkMatch.index !== undefined) {
      const href = linkMatch[2];
      const isSafeUrl = /^https?:\/\//i.test(href) || href.startsWith("/") || href.startsWith("#");
      candidates.push({
        index: linkMatch.index,
        length: linkMatch[0].length,
        node: isSafeUrl
          ? <a key={`${keyPrefix}-a${key++}`} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">{linkMatch[1]}</a>
          : <span key={`${keyPrefix}-a${key++}`} className="text-blue-600 dark:text-blue-400">{linkMatch[1]}</span>,
      });
    }

    candidates.sort((a, b) => a.index - b.index);
    const firstMatch = candidates[0] || null;

    if (firstMatch) {
      if (firstMatch.index > 0) {
        parts.push(remaining.slice(0, firstMatch.index));
      }
      parts.push(firstMatch.node);
      remaining = remaining.slice(firstMatch.index + firstMatch.length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return parts;
}

export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const codeBlockMatch = line.match(/^```(\w*)/);
    if (codeBlockMatch) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre key={`cb-${key++}`} className="my-2 p-3 rounded-md bg-muted overflow-x-auto text-sm">
          <code className="font-mono">{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (line.match(/^#{1,6}\s/)) {
      const level = line.match(/^(#+)/)?.[1].length || 1;
      const content = line.replace(/^#+\s*/, "");
      const Tag = (`h${Math.min(level, 6)}`) as keyof JSX.IntrinsicElements;
      const sizeClass = level === 1 ? "text-xl font-bold" : level === 2 ? "text-lg font-semibold" : "text-base font-semibold";
      elements.push(<Tag key={`h-${key++}`} className={`${sizeClass} mt-3 mb-1`}>{renderInlineMarkdown(content, `h${key}`)}</Tag>);
      i++;
      continue;
    }

    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    if (ulMatch) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)[-*]\s+(.*)/);
        if (!m) break;
        items.push(<li key={`li-${key++}`}>{renderInlineMarkdown(m[2], `ul${key}`)}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${key++}`} className="list-disc pl-5 my-1 space-y-0.5">{items}</ul>);
      continue;
    }

    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
    if (olMatch) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)\d+\.\s+(.*)/);
        if (!m) break;
        items.push(<li key={`oli-${key++}`}>{renderInlineMarkdown(m[2], `ol${key}`)}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${key++}`} className="list-decimal pl-5 my-1 space-y-0.5">{items}</ol>);
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={`br-${key++}`} className="h-2" />);
      i++;
      continue;
    }

    elements.push(<p key={`p-${key++}`} className="my-0.5">{renderInlineMarkdown(line, `p${key}`)}</p>);
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}
