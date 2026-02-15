import { simpleParser } from "mailparser";

export interface ParsedEmail {
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
}

function sanitize(str: string): string {
  return str.replace(/\0/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

const HEADER_PATTERNS = [
  /^(Message-ID|Content-Type|MIME-Version|X-MS-Exchange[^:]*|X-[A-Za-z-]+|Received|Return-Path|Authentication-Results|DKIM-Signature|ARC-[^:]+|Thread-[^:]+|Accept-Language|Content-Language|Content-Transfer-Encoding|SpamDiagnostic[^:]*|AntiSpam[^:]*|ChunkCount|MessageData[^:]*|In-Reply-To|References|Importance|Priority|X-Priority|X-Mailer|User-Agent|List-[^:]*|Precedence):\s*.*/i,
  /^\s*boundary=.*/i,
  /^\s*charset=.*/i,
  /^\s*multipart\/.*/i,
  /^\s*text\/(plain|html).*/i,
];

function isHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return HEADER_PATTERNS.some(p => p.test(trimmed));
}

function stripHeadersFromBody(rawBody: string): string {
  const lines = rawBody.split(/\r?\n/);
  const cleanLines: string[] = [];
  let foundContent = false;

  for (const line of lines) {
    if (!foundContent) {
      if (isHeaderLine(line)) continue;
      if (line.trim().length === 0 && cleanLines.length === 0) continue;
      foundContent = true;
    }
    if (foundContent && isHeaderLine(line)) continue;
    cleanLines.push(line);
  }

  return cleanLines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

export async function parseEmailFile(buffer: Buffer, fileName: string): Promise<ParsedEmail> {
  const isEml = fileName.toLowerCase().endsWith(".eml");
  const isMsg = fileName.toLowerCase().endsWith(".msg");

  let emailSubject = "";
  let emailFrom = "";
  let emailTo = "";
  let emailDate = "";
  let emailBody = "";

  if (isEml) {
    try {
      const parsed = await simpleParser(buffer);
      emailSubject = parsed.subject || "(No Subject)";
      emailFrom = typeof parsed.from?.text === "string" ? parsed.from.text : (parsed.from?.value?.[0]?.address || "");
      emailTo = typeof parsed.to === "string" ? parsed.to : (Array.isArray(parsed.to) ? parsed.to.map(t => t.text).join(", ") : parsed.to?.text || "");
      emailDate = parsed.date ? parsed.date.toISOString() : "";
      emailBody = parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");
    } catch {
      emailSubject = "(Could not parse email)";
      const raw = sanitize(buffer.toString("utf-8"));
      emailBody = stripHeadersFromBody(raw).substring(0, 5000);
    }
  } else if (isMsg) {
    try {
      const content = sanitize(buffer.toString("utf-8"));

      const subjectMatch = content.match(/Subject:\s*(.+?)[\r\n]/i);
      const fromMatch = content.match(/From:\s*(.+?)[\r\n]/i);
      const toMatch = content.match(/To:\s*(.+?)[\r\n]/i);
      const dateMatch = content.match(/Date:\s*(.+?)[\r\n]/i);
      emailSubject = subjectMatch?.[1]?.trim() || "(Outlook Email)";
      emailFrom = fromMatch?.[1]?.trim() || "";
      emailTo = toMatch?.[1]?.trim() || "";
      emailDate = dateMatch?.[1]?.trim() || "";

      const bodyStart = content.indexOf("\r\n\r\n") !== -1 ? content.indexOf("\r\n\r\n") + 4 : content.indexOf("\n\n") + 2;
      const rawBody = bodyStart > 4 ? content.substring(bodyStart, bodyStart + 10000) : content.substring(0, 5000);
      const cleanedBody = stripHeadersFromBody(rawBody)
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      emailBody = cleanedBody.substring(0, 5000);
    } catch {
      emailSubject = "(Outlook Email)";
      emailBody = "Could not parse .msg file. The email file has been saved as an attachment.";
    }
  } else {
    emailBody = sanitize(buffer.toString("utf-8")).substring(0, 5000);
    emailSubject = sanitize(fileName);
  }

  if (emailBody.length > 5000) {
    emailBody = emailBody.substring(0, 5000) + "\n\n... (content truncated)";
  }

  return {
    subject: sanitize(emailSubject),
    from: sanitize(emailFrom),
    to: sanitize(emailTo),
    date: sanitize(emailDate),
    body: sanitize(emailBody),
  };
}
