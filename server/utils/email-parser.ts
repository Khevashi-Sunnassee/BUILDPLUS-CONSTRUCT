import { simpleParser } from "mailparser";

export interface ParsedEmail {
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
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
      emailBody = buffer.toString("utf-8").substring(0, 5000);
    }
  } else if (isMsg) {
    try {
      const content = buffer.toString("utf-8");
      const subjectMatch = content.match(/Subject:\s*(.+?)[\r\n]/i);
      const fromMatch = content.match(/From:\s*(.+?)[\r\n]/i);
      const toMatch = content.match(/To:\s*(.+?)[\r\n]/i);
      const dateMatch = content.match(/Date:\s*(.+?)[\r\n]/i);
      emailSubject = subjectMatch?.[1]?.trim() || "(Outlook Email)";
      emailFrom = fromMatch?.[1]?.trim() || "";
      emailTo = toMatch?.[1]?.trim() || "";
      emailDate = dateMatch?.[1]?.trim() || "";
      const bodyStart = content.indexOf("\r\n\r\n") !== -1 ? content.indexOf("\r\n\r\n") + 4 : content.indexOf("\n\n") + 2;
      emailBody = bodyStart > 4 ? content.substring(bodyStart, bodyStart + 5000).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : content.substring(0, 2000);
    } catch {
      emailSubject = "(Outlook Email)";
      emailBody = "Could not parse .msg file. The email file has been saved as an attachment.";
    }
  } else {
    emailBody = buffer.toString("utf-8").substring(0, 5000);
    emailSubject = fileName;
  }

  if (emailBody.length > 5000) {
    emailBody = emailBody.substring(0, 5000) + "\n\n... (content truncated)";
  }

  return {
    subject: emailSubject,
    from: emailFrom,
    to: emailTo,
    date: emailDate,
    body: emailBody,
  };
}
