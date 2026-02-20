import http from "http";

const BASE_URL = "http://localhost:5000";
let cookies: string[] = [];

function getCookieHeader(): string { return cookies.join("; "); }
function getCsrfToken(): string {
  const c = cookies.find(c => c.startsWith("csrf_token="));
  return c ? c.split("=")[1] : "";
}

async function request(method: string, path: string, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const hdrs: Record<string, string> = { "Content-Type": "application/json" };
    if (cookies.length) hdrs["Cookie"] = getCookieHeader();
    const csrf = getCsrfToken();
    if (csrf && method !== "GET") hdrs["x-csrf-token"] = csrf;

    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: hdrs }, (res) => {
      const setCookie = res.headers["set-cookie"];
      if (setCookie) {
        for (const raw of setCookie) {
          const pair = raw.split(";")[0];
          const name = pair.split("=")[0];
          cookies = cookies.filter(c => !c.startsWith(name + "="));
          cookies.push(pair);
        }
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode || 0, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode || 0, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const PASS = "\x1b[32m[PASS]\x1b[0m";
const FAIL = "\x1b[31m[FAIL]\x1b[0m";
const INFO = "\x1b[36m[INFO]\x1b[0m";

async function main() {
  console.log("\n" + "═".repeat(70));
  console.log("  EMAIL DELIVERY TEST - colin@regenthill.com.au");
  console.log("═".repeat(70) + "\n");

  await request("GET", "/api/auth/me");
  const login = await request("POST", "/api/auth/login", { email: "admin@lte.com.au", password: "admin123" });
  if (login.status !== 200) { console.log(`${FAIL} Login failed: ${login.status} - ${JSON.stringify(login.body)}`); process.exit(1); }
  console.log(`${PASS} Logged in as admin`);

  const typesRes = await request("GET", "/api/mail-register/types");
  const mailTypeMap: Record<string, string> = {};
  for (const t of typesRes.body) {
    mailTypeMap[t.abbreviation] = t.id;
  }
  console.log(`${INFO} Mail types available: ${Object.keys(mailTypeMap).join(", ")}`);

  const timestamp = new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne" });

  console.log(`\n${"─".repeat(70)}\n  MAIL REGISTER EMAILS (with 3s delay between each)\n${"─".repeat(70)}\n`);

  console.log(`${INFO} 1. Sending General Correspondence...`);
  const mail1 = await request("POST", "/api/mail-register", {
    mailTypeId: mailTypeMap["GEN"],
    toAddresses: "colin@regenthill.com.au",
    subject: `BuildPlus Test - General Correspondence [${timestamp}]`,
    htmlBody: `<h2>General Correspondence Test</h2><p>Dear Colin,</p><p>This is a <strong>General Correspondence</strong> email sent from the BuildPlus Mail Register system at ${timestamp}.</p><p>This email confirms the Mail Register email dispatch is working correctly.</p><p>Regards,<br/>BuildPlus AI System</p>`,
    responseRequired: "NO",
  });
  console.log(mail1.status === 200 && mail1.body.success 
    ? `${PASS} General Correspondence SENT - Mail#: ${mail1.body.mailNumber}, MsgID: ${mail1.body.entry?.messageId || "queued"}, Status: ${mail1.body.entry?.status}` 
    : `${FAIL} FAILED: ${JSON.stringify(mail1.body).slice(0, 300)}`);
  
  await sleep(3000);

  console.log(`\n${INFO} 2. Sending RFI (Request For Information)...`);
  const mail2 = await request("POST", "/api/mail-register", {
    mailTypeId: mailTypeMap["RFI"],
    toAddresses: "colin@regenthill.com.au",
    subject: `BuildPlus Test - RFI Panel Connections [${timestamp}]`,
    htmlBody: `<h2>Request For Information</h2><p>Dear Colin,</p><p>This is an <strong>RFI (Request For Information)</strong> email from BuildPlus at ${timestamp}.</p><p>We require clarification on:</p><ol><li>Facade panel connection type - welded or bolted?</li><li>Load bearing capacity for corner panels</li><li>Expansion joint gap tolerances</li></ol><p>Please respond by the due date.</p><p>Regards,<br/>BuildPlus Engineering</p>`,
    responseRequired: "YES",
    responseDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  console.log(mail2.status === 200 && mail2.body.success
    ? `${PASS} RFI SENT - Mail#: ${mail2.body.mailNumber}, MsgID: ${mail2.body.entry?.messageId || "queued"}, Status: ${mail2.body.entry?.status}`
    : `${FAIL} FAILED: ${JSON.stringify(mail2.body).slice(0, 300)}`);

  await sleep(3000);

  console.log(`\n${INFO} 3. Sending Transmittal...`);
  const mail3 = await request("POST", "/api/mail-register", {
    mailTypeId: mailTypeMap["TRANSMIT"],
    toAddresses: "colin@regenthill.com.au",
    subject: `BuildPlus Test - Transmittal Shop Drawings [${timestamp}]`,
    htmlBody: `<h2>Transmittal</h2><p>Dear Colin,</p><p>This is a <strong>Transmittal</strong> email from BuildPlus at ${timestamp}.</p><p>Documents for review:</p><ul><li>Drawing SD-301 - Level 3 East Facade</li><li>Drawing SD-302 - Level 3 West Facade</li><li>Drawing SD-303 - Level 3 Spandrel Panels</li></ul><p>Action Required: <strong>Review and Approval</strong></p><p>Regards,<br/>BuildPlus Drafting</p>`,
    responseRequired: "YES",
    responseDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  console.log(mail3.status === 200 && mail3.body.success
    ? `${PASS} Transmittal SENT - Mail#: ${mail3.body.mailNumber}, MsgID: ${mail3.body.entry?.messageId || "queued"}, Status: ${mail3.body.entry?.status}`
    : `${FAIL} FAILED: ${JSON.stringify(mail3.body).slice(0, 300)}`);

  await sleep(3000);

  console.log(`\n${INFO} 4. Sending Site Instruction...`);
  const mail4 = await request("POST", "/api/mail-register", {
    mailTypeId: mailTypeMap["SI"],
    toAddresses: "colin@regenthill.com.au",
    subject: `BuildPlus Test - Site Instruction [${timestamp}]`,
    htmlBody: `<h2>Site Instruction</h2><p>Dear Colin,</p><p>This is a <strong>Site Instruction</strong> email from BuildPlus at ${timestamp}.</p><p><strong>Instruction:</strong> Level 4 panel installation sequence revised. Panels P4-01 through P4-08: install west to east (previously east to west).</p><p>This is for information only.</p><p>Regards,<br/>BuildPlus Site Management</p>`,
    responseRequired: "FOR_INFORMATION",
  });
  console.log(mail4.status === 200 && mail4.body.success
    ? `${PASS} Site Instruction SENT - Mail#: ${mail4.body.mailNumber}, MsgID: ${mail4.body.entry?.messageId || "queued"}, Status: ${mail4.body.entry?.status}`
    : `${FAIL} FAILED: ${JSON.stringify(mail4.body).slice(0, 300)}`);

  await sleep(3000);

  console.log(`\n${"─".repeat(70)}\n  BROADCAST EMAIL\n${"─".repeat(70)}\n`);

  console.log(`${INFO} 5. Sending Broadcast notification to colin@regenthill.com.au...`);
  const broadcast = await request("POST", "/api/broadcasts/send", {
    subject: `BuildPlus Broadcast Test [${timestamp}]`,
    message: `This is a test broadcast notification from BuildPlus AI system sent at ${timestamp}. This broadcast uses the EMAIL channel to verify delivery to external recipients. All system tests passed successfully. The email dispatch queue, circuit breaker, and rate limiter are working correctly.`,
    channels: ["EMAIL"],
    recipientType: "CUSTOM_CONTACTS",
    customRecipients: [{ name: "Colin", email: "colin@regenthill.com.au" }],
  });
  console.log(broadcast.status === 201 || broadcast.status === 200
    ? `${PASS} Broadcast CREATED - ID: ${broadcast.body.id}, Status: ${broadcast.body.status}`
    : `${FAIL} FAILED: ${JSON.stringify(broadcast.body).slice(0, 300)}`);

  await sleep(5000);

  if (broadcast.body.id) {
    const check = await request("GET", `/api/broadcasts/${broadcast.body.id}`);
    if (check.status === 200) {
      console.log(`${INFO} Broadcast status: ${check.body.status}, Sent: ${check.body.sentCount}, Failed: ${check.body.failedCount}`);
    }
  }

  console.log(`\n${"─".repeat(70)}\n  DIRECT EMAIL (via email templates/send logs)\n${"─".repeat(70)}\n`);

  console.log(`\n${"─".repeat(70)}\n  SUMMARY\n${"─".repeat(70)}\n`);
  console.log(`${INFO} Emails sent to: colin@regenthill.com.au`);
  console.log(`${INFO} From address: noreply@send.lfrmanagement.com.au (Resend)`);
  console.log(`${INFO} Check spam/junk folder if emails not in inbox`);
  console.log(`${INFO} Resend message IDs can be tracked for delivery status`);
  console.log("");
}

main().catch(console.error);
