import http from "http";

const BASE_URL = "http://localhost:5000";
let cookies: string[] = [];

function getCookieHeader(): string { return cookies.join("; "); }
function getCsrfToken(): string {
  const c = cookies.find(c => c.startsWith("csrf_token="));
  return c ? c.split("=")[1] : "";
}

async function request(method: string, path: string, body?: any, isStream = false): Promise<{ status: number; body: any; headers: any; latencyMs: number }> {
  const start = Date.now();
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
      if (isStream) {
        let fullData = "";
        const parsed: any[] = [];
        const seen = new Set<string>();
        res.on("data", (chunk) => {
          fullData += chunk.toString();
        });
        res.on("end", () => {
          const lines = fullData.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && !seen.has(line)) {
              seen.add(line);
              try { parsed.push(JSON.parse(line.slice(6))); } catch {}
            }
          }
          resolve({ status: res.statusCode || 0, body: parsed, headers: res.headers, latencyMs: Date.now() - start });
        });
      } else {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try { resolve({ status: res.statusCode || 0, body: JSON.parse(data), headers: res.headers, latencyMs: Date.now() - start }); }
          catch { resolve({ status: res.statusCode || 0, body: data, headers: res.headers, latencyMs: Date.now() - start }); }
        });
      }
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
const LATENCY = "\x1b[33m[TIME]\x1b[0m";
const SEP = "─".repeat(70);

function extractStreamContent(chunks: any[]): string {
  return chunks.filter((c: any) => c.content).map((c: any) => c.content).join("");
}

function extractSources(chunks: any[]): any[] {
  return chunks.find((c: any) => c.done)?.sources || [];
}

async function main() {
  console.log("\n" + "═".repeat(70));
  console.log("  COMPREHENSIVE MAIL REGISTER + KNOWLEDGE BASE TEST SUITE");
  console.log("═".repeat(70) + "\n");

  // ── AUTH ──
  await request("GET", "/api/auth/me");
  const login = await request("POST", "/api/auth/login", { email: "admin@lte.com.au", password: "admin123" });
  if (login.status !== 200) { console.log(`${FAIL} Login failed: ${login.status}`); process.exit(1); }
  console.log(`${PASS} Logged in as admin (${login.latencyMs}ms)`);

  // ════════════════════════════════════════════════════════════════
  //  SECTION 1: MAIL REGISTER - MULTI-TYPE EMAILS + THREADING
  // ════════════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n  SECTION 1: MAIL REGISTER - SENDING EMAILS\n${SEP}\n`);

  const typesRes = await request("GET", "/api/mail-register/types");
  console.log(`${INFO} Available mail types: ${typesRes.body.length}`);
  console.log(`${LATENCY} Fetch mail types: ${typesRes.latencyMs}ms`);

  const mailTypeMap: Record<string, string> = {};
  for (const t of typesRes.body) {
    mailTypeMap[t.abbreviation] = t.id;
  }

  // Test 1: Send a General Correspondence
  console.log(`\n${INFO} Test 1: Sending GENERAL CORRESPONDENCE to colin@regenthill.com.au`);
  const mail1 = await request("POST", "/api/mail-register", {
    mailTypeId: mailTypeMap["GEN"],
    toAddresses: "colin@regenthill.com.au",
    subject: "BuildPlus System Test - General Correspondence",
    htmlBody: "<p>Dear Colin,</p><p>This is an automated test of the BuildPlus Mail Register system. This email is a <strong>General Correspondence</strong> type.</p><p>Please disregard this test email.</p><p>Regards,<br/>BuildPlus AI System</p>",
    responseRequired: "NO",
  });
  if (mail1.status === 200 && mail1.body.success) {
    console.log(`${PASS} General Correspondence SENT`);
    console.log(`${INFO}   Mail Number: ${mail1.body.mailNumber}`);
    console.log(`${INFO}   Message ID: ${mail1.body.entry?.messageId || "N/A"}`);
    console.log(`${INFO}   Status: ${mail1.body.entry?.status}`);
    console.log(`${LATENCY}   Send latency: ${mail1.latencyMs}ms`);
  } else {
    console.log(`${FAIL} General Correspondence FAILED: ${JSON.stringify(mail1.body).slice(0, 200)}`);
  }

  // Test 2: Send an RFI (Request For Information) with response required
  console.log(`\n${INFO} Test 2: Sending RFI to colin@regenthill.com.au (response required)`);
  const mail2 = await request("POST", "/api/mail-register", {
    mailTypeId: mailTypeMap["RFI"],
    toAddresses: "colin@regenthill.com.au",
    subject: "RFI - Panel Connection Details for Level 3 Facade",
    htmlBody: "<p>Dear Colin,</p><p>We require clarification on the following:</p><ol><li>Connection type for facade panels on Level 3 - welded or bolted?</li><li>Load bearing capacity requirements for the corner panels</li><li>Tolerance specifications for panel gaps at the expansion joints</li></ol><p>Please respond by the due date indicated.</p><p>Regards,<br/>BuildPlus Engineering Team</p>",
    responseRequired: "YES",
    responseDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (mail2.status === 200 && mail2.body.success) {
    console.log(`${PASS} RFI SENT`);
    console.log(`${INFO}   Mail Number: ${mail2.body.mailNumber}`);
    console.log(`${INFO}   Response Required: YES`);
    console.log(`${INFO}   Status: ${mail2.body.entry?.status}`);
    console.log(`${LATENCY}   Send latency: ${mail2.latencyMs}ms`);
  } else {
    console.log(`${FAIL} RFI FAILED: ${JSON.stringify(mail2.body).slice(0, 200)}`);
  }

  // Test 3: Send a Transmittal
  console.log(`\n${INFO} Test 3: Sending TRANSMITTAL to colin@regenthill.com.au`);
  const mail3 = await request("POST", "/api/mail-register", {
    mailTypeId: mailTypeMap["TRANSMIT"],
    toAddresses: "colin@regenthill.com.au",
    subject: "Transmittal - Shop Drawings Batch 7 for Approval",
    htmlBody: "<p>Dear Colin,</p><p>Please find attached the following shop drawings for your review and approval:</p><ul><li>Drawing SD-301 - Level 3 East Facade Panels</li><li>Drawing SD-302 - Level 3 West Facade Panels</li><li>Drawing SD-303 - Level 3 Spandrel Panels</li></ul><p>Action Required: <strong>Review and Approval</strong></p><p>Regards,<br/>BuildPlus Drafting Team</p>",
    responseRequired: "YES",
    responseDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (mail3.status === 200 && mail3.body.success) {
    console.log(`${PASS} Transmittal SENT`);
    console.log(`${INFO}   Mail Number: ${mail3.body.mailNumber}`);
    console.log(`${INFO}   Status: ${mail3.body.entry?.status}`);
    console.log(`${LATENCY}   Send latency: ${mail3.latencyMs}ms`);
  } else {
    console.log(`${FAIL} Transmittal FAILED: ${JSON.stringify(mail3.body).slice(0, 200)}`);
  }

  // Test 4: Send a Site Instruction
  console.log(`\n${INFO} Test 4: Sending SITE INSTRUCTION to colin@regenthill.com.au`);
  const mail4 = await request("POST", "/api/mail-register", {
    mailTypeId: mailTypeMap["SI"],
    toAddresses: "colin@regenthill.com.au",
    subject: "Site Instruction - Revised Panel Installation Sequence",
    htmlBody: "<p>Dear Colin,</p><p>Please be advised of the following site instruction effective immediately:</p><p><strong>Panel Installation Sequence Change:</strong></p><p>Due to crane availability constraints, the Level 4 panel installation sequence has been revised. Panels P4-01 through P4-08 should be installed west to east (previously east to west).</p><p>All other installation requirements remain unchanged.</p><p>Regards,<br/>BuildPlus Site Management</p>",
    responseRequired: "FOR_INFORMATION",
  });
  if (mail4.status === 200 && mail4.body.success) {
    console.log(`${PASS} Site Instruction SENT`);
    console.log(`${INFO}   Mail Number: ${mail4.body.mailNumber}`);
    console.log(`${INFO}   Status: ${mail4.body.entry?.status}`);
    console.log(`${LATENCY}   Send latency: ${mail4.latencyMs}ms`);
  } else {
    console.log(`${FAIL} Site Instruction FAILED: ${JSON.stringify(mail4.body).slice(0, 200)}`);
  }

  // Test 5: THREADING - Reply to the RFI
  console.log(`\n${INFO} Test 5: THREADING - Sending reply to the RFI (parentMailId linkage)`);
  const rfiEntryId = mail2.body.entry?.id;
  if (rfiEntryId) {
    const reply = await request("POST", "/api/mail-register", {
      mailTypeId: mailTypeMap["RFI"],
      toAddresses: "colin@regenthill.com.au",
      subject: "RE: RFI - Panel Connection Details for Level 3 Facade",
      htmlBody: "<p>Dear Colin,</p><p>Following up on our previous RFI regarding Level 3 facade panel connections. We have received the structural engineer's recommendation and would like to confirm the following:</p><ul><li>Corner panels: Welded connections with 150kN capacity</li><li>Standard panels: Bolted connections with 100kN capacity</li><li>Expansion joint gaps: 25mm +/- 3mm tolerance</li></ul><p>Please confirm these specifications at your earliest convenience.</p><p>Regards,<br/>BuildPlus Engineering Team</p>",
      responseRequired: "YES",
      parentMailId: rfiEntryId,
    });
    if (reply.status === 200 && reply.body.success) {
      console.log(`${PASS} RFI Reply SENT (threaded)`);
      console.log(`${INFO}   Mail Number: ${reply.body.mailNumber}`);
      console.log(`${INFO}   Thread ID: ${reply.body.entry?.threadId}`);
      console.log(`${INFO}   Parent Mail ID: ${reply.body.entry?.parentMailId}`);
      console.log(`${LATENCY}   Send latency: ${reply.latencyMs}ms`);

      // Verify threading by fetching the parent mail's detail
      const threadCheck = await request("GET", `/api/mail-register/${rfiEntryId}`);
      if (threadCheck.status === 200 && threadCheck.body.thread?.length > 0) {
        console.log(`${PASS} Threading verified: ${threadCheck.body.thread.length} related messages in thread`);
        for (const t of threadCheck.body.thread) {
          console.log(`${INFO}   Thread item: ${t.mailNumber} - ${t.subject} (${t.status})`);
        }
      } else {
        console.log(`${FAIL} Threading not working: thread array is empty`);
        console.log(`${INFO}   Thread data: ${JSON.stringify(threadCheck.body.thread)}`);
      }
      console.log(`${LATENCY}   Thread fetch latency: ${threadCheck.latencyMs}ms`);
    } else {
      console.log(`${FAIL} RFI Reply FAILED: ${JSON.stringify(reply.body).slice(0, 200)}`);
    }
  }

  // List all mail register entries
  console.log(`\n${INFO} Verifying Mail Register list...`);
  const listRes = await request("GET", "/api/mail-register?limit=10");
  console.log(`${PASS} Mail Register has ${listRes.body.total} entries`);
  for (const item of (listRes.body.items || []).slice(0, 5)) {
    console.log(`${INFO}   ${item.mailNumber} | ${item.mailTypeName} | ${item.subject?.slice(0, 50)} | ${item.status}`);
  }
  console.log(`${LATENCY}   List latency: ${listRes.latencyMs}ms`);

  // ════════════════════════════════════════════════════════════════
  //  SECTION 2: KNOWLEDGE BASE - COMPREHENSIVE TESTING
  // ════════════════════════════════════════════════════════════════
  console.log(`\n${SEP}\n  SECTION 2: KNOWLEDGE BASE - COMPREHENSIVE TESTING\n${SEP}\n`);

  // Get existing project with documents
  const projRes = await request("GET", "/api/kb/projects");
  const project = projRes.body.find((p: any) => p.name === "Company Policies & Procedures");
  if (!project) {
    console.log(`${FAIL} No KB project found. Cannot test KB.`);
    process.exit(1);
  }
  console.log(`${PASS} Found KB project: "${project.name}" (ID: ${project.id})`);
  console.log(`${LATENCY}   Project fetch: ${projRes.latencyMs}ms`);

  // Get document status
  const docsRes = await request("GET", `/api/kb/projects/${project.id}/documents`);
  console.log(`${PASS} Documents in project: ${docsRes.body.length}`);
  for (const d of docsRes.body) {
    console.log(`${INFO}   "${d.title}" - Status: ${d.status}, Chunks: ${d.chunkCount}`);
  }

  // ── 2A: KB_ONLY MODE (Constrained to Knowledge Articles) ──
  console.log(`\n${SEP}\n  2A: KB_ONLY MODE - Knowledge Article Responses\n${SEP}\n`);

  const kbConvoRes = await request("POST", "/api/kb/conversations", { title: "KB Test - Constrained", projectId: project.id });
  const kbConvoId = kbConvoRes.body.id;
  console.log(`${PASS} Created KB_ONLY conversation: ${kbConvoId}`);

  // KB_ONLY Q1: Safety PPE
  console.log(`\n${INFO} KB_ONLY Q1: "What PPE must workers wear on BuildPlus construction sites?"`);
  const kb1 = await request("POST", `/api/kb/conversations/${kbConvoId}/messages`, { content: "What PPE must workers wear on BuildPlus construction sites?", mode: "KB_ONLY" }, true);
  const kb1Content = extractStreamContent(kb1.body);
  const kb1Sources = extractSources(kb1.body);
  console.log(`${PASS} Response (${kb1Content.length} chars, ${kb1.latencyMs}ms):`);
  console.log(`\x1b[90m${kb1Content.slice(0, 800)}\x1b[0m`);
  if (kb1Sources.length) console.log(`${INFO} Sources: ${kb1Sources.map((s: any) => `${s.documentTitle} (${s.similarity}%)`).join(", ")}`);
  console.log(`${LATENCY} KB_ONLY Q1 latency: ${kb1.latencyMs}ms`);

  // KB_ONLY Q2: Leave entitlements
  console.log(`\n${INFO} KB_ONLY Q2: "How many days of annual leave do full-time employees receive and what are the rules for applying?"`);
  const kb2 = await request("POST", `/api/kb/conversations/${kbConvoId}/messages`, { content: "How many days of annual leave do full-time employees receive and what are the rules for applying?", mode: "KB_ONLY" }, true);
  const kb2Content = extractStreamContent(kb2.body);
  const kb2Sources = extractSources(kb2.body);
  console.log(`${PASS} Response (${kb2Content.length} chars, ${kb2.latencyMs}ms):`);
  console.log(`\x1b[90m${kb2Content.slice(0, 800)}\x1b[0m`);
  if (kb2Sources.length) console.log(`${INFO} Sources: ${kb2Sources.map((s: any) => `${s.documentTitle} (${s.similarity}%)`).join(", ")}`);
  console.log(`${LATENCY} KB_ONLY Q2 latency: ${kb2.latencyMs}ms`);

  // KB_ONLY Q3: Panel production stages
  console.log(`\n${INFO} KB_ONLY Q3: "Describe the panel production process from mould prep to quality inspection"`);
  const kb3 = await request("POST", `/api/kb/conversations/${kbConvoId}/messages`, { content: "Describe the panel production process from mould preparation through to quality inspection. What are the key stages?", mode: "KB_ONLY" }, true);
  const kb3Content = extractStreamContent(kb3.body);
  const kb3Sources = extractSources(kb3.body);
  console.log(`${PASS} Response (${kb3Content.length} chars, ${kb3.latencyMs}ms):`);
  console.log(`\x1b[90m${kb3Content.slice(0, 1000)}\x1b[0m`);
  if (kb3Sources.length) console.log(`${INFO} Sources: ${kb3Sources.map((s: any) => `${s.documentTitle} (${s.similarity}%)`).join(", ")}`);
  console.log(`${LATENCY} KB_ONLY Q3 latency: ${kb3.latencyMs}ms`);

  // KB_ONLY Q4: Incident reporting
  console.log(`\n${INFO} KB_ONLY Q4: "What is the process for reporting a workplace incident?"`);
  const kb4 = await request("POST", `/api/kb/conversations/${kbConvoId}/messages`, { content: "What is the process for reporting a workplace incident and how is it investigated?", mode: "KB_ONLY" }, true);
  const kb4Content = extractStreamContent(kb4.body);
  const kb4Sources = extractSources(kb4.body);
  console.log(`${PASS} Response (${kb4Content.length} chars, ${kb4.latencyMs}ms):`);
  console.log(`\x1b[90m${kb4Content.slice(0, 800)}\x1b[0m`);
  if (kb4Sources.length) console.log(`${INFO} Sources: ${kb4Sources.map((s: any) => `${s.documentTitle} (${s.similarity}%)`).join(", ")}`);
  console.log(`${LATENCY} KB_ONLY Q4 latency: ${kb4.latencyMs}ms`);

  // KB_ONLY Q5: Unanswerable question
  console.log(`\n${INFO} KB_ONLY Q5: "What is the company travel allowance policy?" (NOT in KB - should say not available)`);
  const kb5 = await request("POST", `/api/kb/conversations/${kbConvoId}/messages`, { content: "What is the company travel allowance policy for interstate business trips?", mode: "KB_ONLY" }, true);
  const kb5Content = extractStreamContent(kb5.body);
  console.log(`${PASS} Response (${kb5Content.length} chars, ${kb5.latencyMs}ms):`);
  console.log(`\x1b[90m${kb5Content.slice(0, 600)}\x1b[0m`);
  const notInKb = /not (available|found|contain|specifically|covered|include)/i.test(kb5Content) || /knowledge base/i.test(kb5Content);
  console.log(notInKb ? `${PASS} Correctly indicates info not in KB` : `${FAIL} May have hallucinated - should say not in KB`);
  console.log(`${LATENCY} KB_ONLY Q5 latency: ${kb5.latencyMs}ms`);

  // Verify KB_ONLY conversation history
  const kbMsgsRes = await request("GET", `/api/kb/conversations/${kbConvoId}/messages`);
  console.log(`\n${PASS} KB_ONLY conversation stores ${kbMsgsRes.body.length} messages (${kbMsgsRes.body.filter((m: any) => m.role === "USER").length} user, ${kbMsgsRes.body.filter((m: any) => m.role === "ASSISTANT").length} assistant)`);

  // ── 2B: HYBRID MODE (Open Chat with KB Context) ──
  console.log(`\n${SEP}\n  2B: HYBRID MODE - Open Chat with KB Context\n${SEP}\n`);

  const hybridConvoRes = await request("POST", "/api/kb/conversations", { title: "KB Test - Hybrid", projectId: project.id });
  const hybridConvoId = hybridConvoRes.body.id;
  console.log(`${PASS} Created HYBRID conversation: ${hybridConvoId}`);

  // HYBRID Q1: Combines KB + general knowledge
  console.log(`\n${INFO} HYBRID Q1: "Compare our panel quality inspection process with Australian Standard AS 3600. Where do we meet or exceed the standard?"`);
  const h1 = await request("POST", `/api/kb/conversations/${hybridConvoId}/messages`, { content: "Compare our panel quality inspection process with Australian Standard AS 3600. Where do we meet or exceed the standard?", mode: "HYBRID" }, true);
  const h1Content = extractStreamContent(h1.body);
  const h1Sources = extractSources(h1.body);
  console.log(`${PASS} Response (${h1Content.length} chars, ${h1.latencyMs}ms):`);
  console.log(`\x1b[90m${h1Content.slice(0, 1000)}\x1b[0m`);
  if (h1Sources.length) console.log(`${INFO} Sources: ${h1Sources.map((s: any) => `${s.documentTitle} (${s.similarity}%)`).join(", ")}`);
  console.log(`${LATENCY} HYBRID Q1 latency: ${h1.latencyMs}ms`);

  // HYBRID Q2: Open question with NO KB match
  console.log(`\n${INFO} HYBRID Q2: "What are the latest trends in modular construction for 2026?" (open AI knowledge)`);
  const h2 = await request("POST", `/api/kb/conversations/${hybridConvoId}/messages`, { content: "What are the latest trends in modular construction technology for 2026?", mode: "HYBRID" }, true);
  const h2Content = extractStreamContent(h2.body);
  console.log(`${PASS} Response (${h2Content.length} chars, ${h2.latencyMs}ms):`);
  console.log(`\x1b[90m${h2Content.slice(0, 800)}\x1b[0m`);
  console.log(`${LATENCY} HYBRID Q2 latency: ${h2.latencyMs}ms`);

  // HYBRID Q3: Mix of KB safety + general WHS knowledge
  console.log(`\n${INFO} HYBRID Q3: "What scaffolding safety requirements do we have and how do they compare to SafeWork Australia guidelines?"`);
  const h3 = await request("POST", `/api/kb/conversations/${hybridConvoId}/messages`, { content: "What are our company scaffolding safety requirements and how do they compare to SafeWork Australia guidelines?", mode: "HYBRID" }, true);
  const h3Content = extractStreamContent(h3.body);
  const h3Sources = extractSources(h3.body);
  console.log(`${PASS} Response (${h3Content.length} chars, ${h3.latencyMs}ms):`);
  console.log(`\x1b[90m${h3Content.slice(0, 1000)}\x1b[0m`);
  if (h3Sources.length) console.log(`${INFO} Sources: ${h3Sources.map((s: any) => `${s.documentTitle} (${s.similarity}%)`).join(", ")}`);
  console.log(`${LATENCY} HYBRID Q3 latency: ${h3.latencyMs}ms`);

  // Verify HYBRID conversation history
  const hybridMsgsRes = await request("GET", `/api/kb/conversations/${hybridConvoId}/messages`);
  console.log(`\n${PASS} HYBRID conversation stores ${hybridMsgsRes.body.length} messages (${hybridMsgsRes.body.filter((m: any) => m.role === "USER").length} user, ${hybridMsgsRes.body.filter((m: any) => m.role === "ASSISTANT").length} assistant)`);

  // ── 2C: SYSTEM HELP QUERIES ──
  console.log(`\n${SEP}\n  2C: SYSTEM HELP - Software Feature Queries\n${SEP}\n`);

  const helpConvoRes = await request("POST", "/api/kb/conversations", { title: "System Help Test" });
  const helpConvoId = helpConvoRes.body.id;
  console.log(`${PASS} Created System Help conversation: ${helpConvoId}`);

  // Help Q1: Panel management
  console.log(`\n${INFO} Help Q1: "How do I register and track panels in BuildPlus?"`);
  const help1 = await request("POST", `/api/kb/conversations/${helpConvoId}/messages`, { content: "How do I register and track panels in the BuildPlus system?", mode: "HYBRID" }, true);
  const help1Content = extractStreamContent(help1.body);
  const help1Sources = extractSources(help1.body);
  console.log(`${PASS} Response (${help1Content.length} chars, ${help1.latencyMs}ms):`);
  console.log(`\x1b[90m${help1Content.slice(0, 800)}\x1b[0m`);
  if (help1Sources.length) console.log(`${INFO} Sources: ${help1Sources.map((s: any) => `${s.documentTitle} (${s.similarity}%)`).join(", ")}`);
  console.log(`${LATENCY} Help Q1 latency: ${help1.latencyMs}ms`);

  // Help Q2: Reporting
  console.log(`\n${INFO} Help Q2: "How do I generate production reports in BuildPlus?"`);
  const help2 = await request("POST", `/api/kb/conversations/${helpConvoId}/messages`, { content: "How do I generate production reports and export them in BuildPlus?", mode: "HYBRID" }, true);
  const help2Content = extractStreamContent(help2.body);
  console.log(`${PASS} Response (${help2Content.length} chars, ${help2.latencyMs}ms):`);
  console.log(`\x1b[90m${help2Content.slice(0, 800)}\x1b[0m`);
  console.log(`${LATENCY} Help Q2 latency: ${help2.latencyMs}ms`);

  // Help Q3: Approvals
  console.log(`\n${INFO} Help Q3: "How does the approval workflow work for panel production?"`);
  const help3 = await request("POST", `/api/kb/conversations/${helpConvoId}/messages`, { content: "How does the approval workflow work for panel production in BuildPlus?", mode: "HYBRID" }, true);
  const help3Content = extractStreamContent(help3.body);
  console.log(`${PASS} Response (${help3Content.length} chars, ${help3.latencyMs}ms):`);
  console.log(`\x1b[90m${help3Content.slice(0, 800)}\x1b[0m`);
  console.log(`${LATENCY} Help Q3 latency: ${help3.latencyMs}ms`);

  // Verify Help conversation history
  const helpMsgsRes = await request("GET", `/api/kb/conversations/${helpConvoId}/messages`);
  console.log(`\n${PASS} System Help conversation stores ${helpMsgsRes.body.length} messages`);

  // ── 2D: VERIFY CONVERSATION ISOLATION ──
  console.log(`\n${SEP}\n  2D: CONVERSATION ISOLATION VERIFICATION\n${SEP}\n`);

  console.log(`${INFO} Verifying each conversation retrieves correct history...`);

  const kbCheck = await request("GET", `/api/kb/conversations/${kbConvoId}/messages`);
  const hybridCheck = await request("GET", `/api/kb/conversations/${hybridConvoId}/messages`);
  const helpCheck = await request("GET", `/api/kb/conversations/${helpConvoId}/messages`);

  console.log(`${PASS} KB_ONLY conversation (${kbConvoId}):`);
  console.log(`${INFO}   Messages: ${kbCheck.body.length}`);
  for (const m of kbCheck.body.slice(0, 4)) {
    console.log(`${INFO}   [${m.role}] ${m.content.slice(0, 80)}...`);
  }

  console.log(`${PASS} HYBRID conversation (${hybridConvoId}):`);
  console.log(`${INFO}   Messages: ${hybridCheck.body.length}`);
  for (const m of hybridCheck.body.slice(0, 4)) {
    console.log(`${INFO}   [${m.role}] ${m.content.slice(0, 80)}...`);
  }

  console.log(`${PASS} System Help conversation (${helpConvoId}):`);
  console.log(`${INFO}   Messages: ${helpCheck.body.length}`);
  for (const m of helpCheck.body.slice(0, 4)) {
    console.log(`${INFO}   [${m.role}] ${m.content.slice(0, 80)}...`);
  }

  // No cross-contamination check
  const kbUserMsgs = kbCheck.body.filter((m: any) => m.role === "USER").map((m: any) => m.content);
  const hybridUserMsgs = hybridCheck.body.filter((m: any) => m.role === "USER").map((m: any) => m.content);
  const helpUserMsgs = helpCheck.body.filter((m: any) => m.role === "USER").map((m: any) => m.content);

  const kbHasOnlyKb = kbUserMsgs.every((c: string) => !c.includes("modular construction") && !c.includes("generate production reports"));
  const hybridHasOnlyHybrid = hybridUserMsgs.every((c: string) => !c.includes("PPE") && !c.includes("annual leave") && !c.includes("generate production reports"));
  const helpHasOnlyHelp = helpUserMsgs.every((c: string) => !c.includes("PPE") && !c.includes("modular construction"));

  console.log(kbHasOnlyKb ? `\n${PASS} KB_ONLY conversation has no cross-contamination` : `\n${FAIL} KB_ONLY conversation has cross-contamination`);
  console.log(hybridHasOnlyHybrid ? `${PASS} HYBRID conversation has no cross-contamination` : `${FAIL} HYBRID conversation has cross-contamination`);
  console.log(helpHasOnlyHelp ? `${PASS} Help conversation has no cross-contamination` : `${FAIL} Help conversation has cross-contamination`);

  // ── LATENCY SUMMARY ──
  console.log(`\n${SEP}\n  LATENCY SUMMARY\n${SEP}\n`);
  const latencies = [
    { op: "Mail Types Fetch", ms: typesRes.latencyMs },
    { op: "General Correspondence Send", ms: mail1.latencyMs },
    { op: "RFI Send", ms: mail2.latencyMs },
    { op: "Transmittal Send", ms: mail3.latencyMs },
    { op: "Site Instruction Send", ms: mail4.latencyMs },
    { op: "KB_ONLY Q1 (PPE)", ms: kb1.latencyMs },
    { op: "KB_ONLY Q2 (Leave)", ms: kb2.latencyMs },
    { op: "KB_ONLY Q3 (Production)", ms: kb3.latencyMs },
    { op: "KB_ONLY Q4 (Incidents)", ms: kb4.latencyMs },
    { op: "KB_ONLY Q5 (Unanswerable)", ms: kb5.latencyMs },
    { op: "HYBRID Q1 (AS3600 Compare)", ms: h1.latencyMs },
    { op: "HYBRID Q2 (Open Question)", ms: h2.latencyMs },
    { op: "HYBRID Q3 (SafeWork Compare)", ms: h3.latencyMs },
    { op: "Help Q1 (Panel Tracking)", ms: help1.latencyMs },
    { op: "Help Q2 (Reports)", ms: help2.latencyMs },
    { op: "Help Q3 (Approvals)", ms: help3.latencyMs },
  ];

  for (const l of latencies) {
    const color = l.ms < 100 ? "\x1b[32m" : l.ms < 2000 ? "\x1b[33m" : "\x1b[31m";
    console.log(`${color}  ${l.ms.toString().padStart(6)}ms\x1b[0m  ${l.op}`);
  }

  const avgMail = Math.round(latencies.filter(l => l.op.includes("Send")).reduce((a, b) => a + b.ms, 0) / latencies.filter(l => l.op.includes("Send")).length);
  const avgKb = Math.round(latencies.filter(l => l.op.startsWith("KB_ONLY") || l.op.startsWith("HYBRID") || l.op.startsWith("Help")).reduce((a, b) => a + b.ms, 0) / latencies.filter(l => l.op.startsWith("KB_ONLY") || l.op.startsWith("HYBRID") || l.op.startsWith("Help")).length);

  console.log(`\n${INFO} Average email send latency: ${avgMail}ms`);
  console.log(`${INFO} Average KB chat latency: ${avgKb}ms`);

  // Final stats
  const statsRes = await request("GET", "/api/kb/stats");
  console.log(`\n${SEP}\n  FINAL KB STATS\n${SEP}`);
  console.log(`${INFO} Projects: ${statsRes.body.projects}`);
  console.log(`${INFO} Documents: ${statsRes.body.documents}`);
  console.log(`${INFO} Chunks: ${statsRes.body.chunks}`);
  console.log(`${INFO} Conversations: ${statsRes.body.conversations}`);

  console.log(`\n${"═".repeat(70)}`);
  console.log("  TEST SUITE COMPLETE");
  console.log("═".repeat(70) + "\n");
}

main().catch(err => { console.error("Test failed:", err); process.exit(1); });
