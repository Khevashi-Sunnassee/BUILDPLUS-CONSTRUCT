import http from "http";
import https from "https";

const BASE_URL = "http://localhost:5000";
let cookies: string[] = [];

function getCookieHeader(): string {
  return cookies.join("; ");
}

function getCsrfToken(): string {
  const csrfCookie = cookies.find(c => c.startsWith("csrf_token="));
  return csrfCookie ? csrfCookie.split("=")[1] : "";
}

async function request(
  method: string,
  path: string,
  body?: any,
  isStream = false
): Promise<{ status: number; body: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const hdrs: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cookies.length) hdrs["Cookie"] = getCookieHeader();
    const csrf = getCsrfToken();
    if (csrf && method !== "GET") hdrs["x-csrf-token"] = csrf;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: hdrs,
    };

    const req = http.request(options, (res) => {
      const setCookie = res.headers["set-cookie"];
      if (setCookie) {
        for (const raw of setCookie) {
          const cookiePair = raw.split(";")[0];
          const cookieName = cookiePair.split("=")[0];
          cookies = cookies.filter(c => !c.startsWith(cookieName + "="));
          cookies.push(cookiePair);
        }
      }

      if (isStream) {
        let fullData = "";
        const chunks: any[] = [];
        res.on("data", (chunk) => {
          fullData += chunk.toString();
          const lines = fullData.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                chunks.push(JSON.parse(line.slice(6)));
              } catch {}
            }
          }
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            body: chunks,
            headers: res.headers,
          });
        });
      } else {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode || 0,
              body: JSON.parse(data),
              headers: res.headers,
            });
          } catch {
            resolve({
              status: res.statusCode || 0,
              body: data,
              headers: res.headers,
            });
          }
        });
      }
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function log(icon: string, msg: string) {
  console.log(`${icon} ${msg}`);
}

function pass(msg: string) { log("[PASS]", msg); }
function fail(msg: string) { log("[FAIL]", msg); }
function info(msg: string) { log("[INFO]", msg); }

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const COMPANY_POLICY_DOC = `# BuildPlus Company Safety Policy

## 1. Purpose
This policy establishes the safety requirements for all BuildPlus construction sites, manufacturing facilities, and office locations. All employees, contractors, and visitors must comply with these requirements.

## 2. Personal Protective Equipment (PPE)
All personnel on construction sites must wear the following at all times:
- Hard hat (AS/NZS 1801 compliant)
- High-visibility vest (Class D/N or D compliant)
- Steel-capped safety boots (AS/NZS 2210.3 compliant)
- Safety glasses when operating machinery or power tools
- Hearing protection in designated noise areas (above 85dB)

### 2.1 PPE Inspection
PPE must be inspected at the start of each shift. Damaged or expired PPE must be replaced immediately. Supervisors must maintain a PPE register and conduct monthly audits.

## 3. Working at Heights
Any work performed at a height of 2 metres or above requires:
- An approved Fall Prevention Plan
- Completion of Working at Heights training (refreshed every 2 years)
- Use of appropriate fall arrest or fall restraint systems
- A buddy system - no lone working at heights

### 3.1 Scaffold Requirements
All scaffolding must be erected by a licensed scaffolder and tagged with a green "SAFE TO USE" tag before access is permitted. Daily visual inspections are required.

## 4. Incident Reporting
All incidents, near misses, and hazards must be reported within 24 hours using the BuildPlus Incident Report Form (IRF-001). Serious incidents must be reported immediately to the Site Safety Manager and escalated to the State Safety Director within 2 hours.

### 4.1 Investigation Process
All reported incidents are investigated using the ICAM (Incident Cause Analysis Method) framework. Root cause findings must be documented and corrective actions tracked to completion within 30 days.

## 5. Emergency Procedures
Each site must have:
- An Emergency Response Plan reviewed quarterly
- Designated Emergency Assembly Points clearly marked
- First aid kits checked monthly (minimum 1 per 25 workers)
- At least 2 trained First Aid Officers per shift
- Fire extinguishers serviced every 6 months

## 6. Toolbox Talks
Weekly toolbox talks are mandatory for all site personnel. Topics must be relevant to current work activities and documented in the site safety register. Attendance records must be maintained.

## 7. Drug and Alcohol Policy
BuildPlus maintains a zero-tolerance policy for drugs and alcohol on all work sites. Random testing may be conducted at any time. Positive results lead to immediate stand-down and disciplinary proceedings as per HR Policy HR-007.

## 8. Compliance
Failure to comply with this safety policy may result in:
- First offence: Verbal warning and re-training
- Second offence: Written warning
- Third offence: Suspension or termination
- Serious breach: Immediate termination and potential legal action
`;

const PANEL_PRODUCTION_PROCESS_DOC = `# BuildPlus Panel Production Process

## Overview
BuildPlus manufactures precast concrete panels through a controlled factory process. This document outlines the 14-stage panel lifecycle from design to delivery.

## Stage 1: Design and Engineering
Panels are designed using Revit/CAD software. The engineering team reviews structural requirements, connection details, and reinforcement specifications. Design approval requires sign-off from the Lead Structural Engineer.

## Stage 2: Panel Registration
Once approved, panels are registered in the BuildPlus AI system with unique identifiers. Each panel receives a QR code for tracking throughout its lifecycle. Panel details include dimensions, weight, concrete grade, reinforcement schedule, and connection types.

## Stage 3: Shop Drawing Production
Detailed shop drawings are produced showing exact dimensions, reinforcement placement, lifting points, and embed locations. Shop drawings must be reviewed and stamped by a certified engineer before production.

## Stage 4: Mould Preparation
Factory moulds are prepared according to the panel specifications. Mould dimensions are verified using laser measurement. Edge forms are set and locked. Release agent is applied evenly across the mould surface.

## Stage 5: Reinforcement Placement
Steel reinforcement is placed according to the shop drawings. Cover blocks ensure minimum concrete cover requirements. Reinforcement is tied and secured. An inspection checklist is completed before pouring.

## Stage 6: Concrete Pour
Concrete is poured into the prepared mould. Vibration ensures full compaction. Test cylinders are taken for quality control. Pour time, temperature, slump test results, and batch numbers are recorded in the production log.

## Stage 7: Curing
Panels are cured for a minimum of 7 days under controlled conditions. Temperature monitoring ensures optimal curing conditions. Steam curing may be used to accelerate the process when required by the production schedule.

## Stage 8: Quality Inspection
Cured panels undergo a comprehensive quality inspection:
- Dimensional accuracy (tolerance: +/- 5mm)
- Surface finish quality grading (A, B, or C)
- Concrete strength verification (minimum 40 MPa at 28 days)
- Reinforcement cover scanning
- Visual defect assessment

## Stage 9: Remediation (if required)
Any defects identified during inspection are remediated. Surface repairs, patching, or grinding are performed as needed. Re-inspection is required after any remediation work.

## Stage 10: Finishing
Panel surfaces receive their specified finish treatment:
- Acid wash for exposed aggregate
- Paint preparation and coating
- Sealer application
- Polishing for architectural panels

## Stage 11: Storage
Completed panels are moved to the storage yard. Panels are stored vertically on A-frames with appropriate dunnage. Storage location is recorded in the inventory management system.

## Stage 12: Load Planning
Delivery loads are planned considering:
- Panel weight and dimensions
- Delivery truck capacity
- Site crane capacity at destination
- Installation sequence requirements
- Route restrictions (height, weight limits)

## Stage 13: Delivery
Panels are loaded onto transport vehicles using factory cranes. Tie-down and protection procedures are followed. Delivery documentation includes panel IDs, weights, and handling instructions.

## Stage 14: Installation Record
Post-installation, the site team records:
- Date and time of installation
- Crane used and operator details
- Weather conditions
- Any installation issues or adjustments
- Connection completion status
- Final position survey data
`;

const LEAVE_POLICY_DOC = `# BuildPlus Leave and Attendance Policy

## Annual Leave
All full-time employees are entitled to 4 weeks (20 days) of annual leave per year, accrued at 1.667 days per month. Part-time employees accrue leave on a pro-rata basis.

### Annual Leave Application
- Leave requests must be submitted at least 2 weeks in advance through the BuildPlus HR portal
- Requests exceeding 2 consecutive weeks require General Manager approval
- December/January shutdown period: minimum 2 weeks mandatory leave
- Leave requests during peak production periods may be declined based on operational needs

## Personal/Sick Leave
Full-time employees receive 10 days of personal/sick leave per year. Unused sick leave accumulates year-on-year.

### Medical Certificate Requirements
A medical certificate is required for:
- Absences of 2 or more consecutive days
- Absences immediately before or after a public holiday
- Absences on a Monday or Friday when a pattern is identified

## Long Service Leave
After 10 years of continuous service, employees are entitled to 8.667 weeks of long service leave. Pro-rata access is available after 7 years in certain circumstances.

## Parental Leave
- Primary carer: 16 weeks paid leave + up to 52 weeks unpaid
- Secondary carer: 4 weeks paid leave
- Both parents may access flexible return-to-work arrangements

## Compassionate Leave
3 days of paid compassionate leave per occasion for:
- Death of an immediate family member
- Life-threatening illness of an immediate family member

## Time in Lieu
Overtime worked may be banked as time in lieu at the employee's election, subject to manager approval. Banked hours must be taken within 3 months or paid out at overtime rates.

## Public Holidays
BuildPlus observes all state and territory public holidays. Employees required to work on public holidays are paid at double time rates.
`;

async function main() {
  console.log("\n========================================");
  console.log("  BUILDPLUS KB SYSTEM - FULL TEST SUITE");
  console.log("========================================\n");

  // Step 0: Get CSRF token
  info("Fetching CSRF token...");
  await request("GET", "/api/auth/me");
  info(`Got CSRF token: ${getCsrfToken() ? "YES" : "NO"}`);

  // Step 1: Login
  info("Logging in as admin@lte.com.au...");
  const loginRes = await request("POST", "/api/auth/login", {
    email: "admin@lte.com.au",
    password: "admin123",
  });
  if (loginRes.status !== 200) {
    fail(`Login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
    process.exit(1);
  }
  pass(`Logged in successfully as admin`);

  // Step 2: Create KB Project
  info("Creating KB project: 'Company Policies & Procedures'...");
  const projRes = await request("POST", "/api/kb/projects", {
    name: "Company Policies & Procedures",
    description: "Official BuildPlus company policies, procedures, and process documentation",
  });
  if (projRes.status !== 201) {
    fail(`Failed to create project: ${projRes.status} ${JSON.stringify(projRes.body)}`);
    process.exit(1);
  }
  const projectId = projRes.body.id;
  pass(`Created project: ${projRes.body.name} (ID: ${projectId})`);

  // Step 3: Add documents
  info("Adding Document 1: Safety Policy...");
  const doc1Res = await request("POST", `/api/kb/projects/${projectId}/documents`, {
    title: "Company Safety Policy",
    content: COMPANY_POLICY_DOC,
    sourceType: "TEXT",
  });
  if (doc1Res.status !== 201) {
    fail(`Failed to add safety doc: ${doc1Res.status} ${JSON.stringify(doc1Res.body)}`);
  } else {
    pass(`Added safety policy doc (ID: ${doc1Res.body.id})`);
  }

  info("Adding Document 2: Panel Production Process...");
  const doc2Res = await request("POST", `/api/kb/projects/${projectId}/documents`, {
    title: "Panel Production Process",
    content: PANEL_PRODUCTION_PROCESS_DOC,
    sourceType: "TEXT",
  });
  if (doc2Res.status !== 201) {
    fail(`Failed to add production doc: ${doc2Res.status} ${JSON.stringify(doc2Res.body)}`);
  } else {
    pass(`Added production process doc (ID: ${doc2Res.body.id})`);
  }

  info("Adding Document 3: Leave and Attendance Policy...");
  const doc3Res = await request("POST", `/api/kb/projects/${projectId}/documents`, {
    title: "Leave and Attendance Policy",
    content: LEAVE_POLICY_DOC,
    sourceType: "TEXT",
  });
  if (doc3Res.status !== 201) {
    fail(`Failed to add leave doc: ${doc3Res.status} ${JSON.stringify(doc3Res.body)}`);
  } else {
    pass(`Added leave policy doc (ID: ${doc3Res.body.id})`);
  }

  // Step 4: Process documents (chunking + embeddings)
  const docIds = [doc1Res.body?.id, doc2Res.body?.id, doc3Res.body?.id].filter(Boolean);

  for (const docId of docIds) {
    info(`Processing document ${docId}...`);
    const processRes = await request("POST", `/api/kb/documents/${docId}/process`);
    if (processRes.status !== 200) {
      fail(`Failed to start processing: ${processRes.status} ${JSON.stringify(processRes.body)}`);
    } else {
      pass(`Processing started for doc ${docId}`);
    }
  }

  // Wait for async processing to complete
  info("Waiting for document processing (chunking + embeddings)...");
  let allReady = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(2000);
    const docsRes = await request("GET", `/api/kb/projects/${projectId}/documents`);
    if (docsRes.status === 200 && Array.isArray(docsRes.body)) {
      const statuses = docsRes.body.map((d: any) => ({
        title: d.title,
        status: d.status,
        chunks: d.chunkCount,
        error: d.errorMessage,
      }));
      info(`Processing status (attempt ${attempt + 1}): ${JSON.stringify(statuses)}`);
      allReady = docsRes.body.every((d: any) => d.status === "READY" || d.status === "FAILED");
      if (allReady) break;
    }
  }

  if (!allReady) {
    fail("Document processing timed out after 60 seconds");
    process.exit(1);
  }

  // Verify chunks were created
  const finalDocsRes = await request("GET", `/api/kb/projects/${projectId}/documents`);
  const docs = finalDocsRes.body;
  let totalChunks = 0;
  for (const doc of docs) {
    if (doc.status === "READY") {
      pass(`Document "${doc.title}": ${doc.chunkCount} chunks created`);
      totalChunks += doc.chunkCount;
    } else {
      fail(`Document "${doc.title}": ${doc.status} - ${doc.errorMessage}`);
    }
  }
  info(`Total chunks across all documents: ${totalChunks}`);

  // Step 5: Test KB Search directly
  console.log("\n--- TESTING KB SEMANTIC SEARCH ---\n");

  info("Search test 1: 'PPE requirements on construction sites'");
  const search1 = await request("POST", "/api/kb/search", {
    query: "PPE requirements on construction sites",
    projectId,
  });
  if (search1.status === 200 && search1.body.length > 0) {
    pass(`Found ${search1.body.length} relevant chunks`);
    for (const chunk of search1.body.slice(0, 3)) {
      info(`  - [${Math.round(chunk.similarity * 100)}%] ${chunk.documentTitle}: ${chunk.content.slice(0, 100)}...`);
    }
  } else {
    fail(`Search returned no results: ${JSON.stringify(search1.body)}`);
  }

  info("Search test 2: 'how many days annual leave'");
  const search2 = await request("POST", "/api/kb/search", {
    query: "how many days annual leave",
    projectId,
  });
  if (search2.status === 200 && search2.body.length > 0) {
    pass(`Found ${search2.body.length} relevant chunks`);
    for (const chunk of search2.body.slice(0, 3)) {
      info(`  - [${Math.round(chunk.similarity * 100)}%] ${chunk.documentTitle}: ${chunk.content.slice(0, 100)}...`);
    }
  } else {
    fail(`Search returned no results`);
  }

  info("Search test 3: 'panel curing temperature'");
  const search3 = await request("POST", "/api/kb/search", {
    query: "panel curing temperature and duration",
    projectId,
  });
  if (search3.status === 200 && search3.body.length > 0) {
    pass(`Found ${search3.body.length} relevant chunks`);
    for (const chunk of search3.body.slice(0, 3)) {
      info(`  - [${Math.round(chunk.similarity * 100)}%] ${chunk.documentTitle}: ${chunk.content.slice(0, 100)}...`);
    }
  } else {
    fail(`Search returned no results`);
  }

  // Step 6: Test KB_ONLY Chat Mode
  console.log("\n--- TESTING KB_ONLY CHAT MODE (Constrained Responses) ---\n");

  info("Creating conversation linked to project...");
  const convoRes = await request("POST", "/api/kb/conversations", {
    title: "Policy Questions",
    projectId,
  });
  if (convoRes.status !== 201) {
    fail(`Failed to create conversation: ${JSON.stringify(convoRes.body)}`);
    process.exit(1);
  }
  const convoId = convoRes.body.id;
  pass(`Created conversation: ${convoId}`);

  // KB_ONLY Test 1: Safety Policy question
  info("KB_ONLY Test 1: 'What PPE is required on BuildPlus construction sites?'");
  const chat1 = await request(
    "POST",
    `/api/kb/conversations/${convoId}/messages`,
    { content: "What PPE is required on BuildPlus construction sites?", mode: "KB_ONLY" },
    true
  );
  if (chat1.status === 200) {
    const content = chat1.body
      .filter((c: any) => c.content)
      .map((c: any) => c.content)
      .join("");
    const sources = chat1.body.find((c: any) => c.done)?.sources;
    pass(`KB_ONLY Response (${content.length} chars):`);
    console.log(`   "${content.slice(0, 500)}..."`);
    if (sources?.length) {
      info(`   Sources: ${sources.map((s: any) => `${s.documentTitle} (${s.similarity}%)`).join(", ")}`);
    }
    if (content.toLowerCase().includes("hard hat") || content.toLowerCase().includes("ppe") || content.toLowerCase().includes("safety")) {
      pass("Response correctly references safety policy content");
    } else {
      fail("Response does not appear to reference safety policy documents");
    }
  } else {
    fail(`Chat failed: ${chat1.status}`);
  }

  // KB_ONLY Test 2: Leave policy question
  info("KB_ONLY Test 2: 'How many days of annual leave do employees get?'");
  const chat2 = await request(
    "POST",
    `/api/kb/conversations/${convoId}/messages`,
    { content: "How many days of annual leave do full-time employees get?", mode: "KB_ONLY" },
    true
  );
  if (chat2.status === 200) {
    const content = chat2.body
      .filter((c: any) => c.content)
      .map((c: any) => c.content)
      .join("");
    pass(`KB_ONLY Response (${content.length} chars):`);
    console.log(`   "${content.slice(0, 500)}..."`);
    if (content.includes("20") || content.includes("4 weeks") || content.includes("four weeks")) {
      pass("Response correctly states 20 days / 4 weeks annual leave");
    } else {
      fail("Response does not contain correct leave entitlement");
    }
  } else {
    fail(`Chat failed: ${chat2.status}`);
  }

  // KB_ONLY Test 3: Production process question
  info("KB_ONLY Test 3: 'What is the minimum curing time for precast panels?'");
  const chat3 = await request(
    "POST",
    `/api/kb/conversations/${convoId}/messages`,
    { content: "What is the minimum curing time for precast concrete panels?", mode: "KB_ONLY" },
    true
  );
  if (chat3.status === 200) {
    const content = chat3.body
      .filter((c: any) => c.content)
      .map((c: any) => c.content)
      .join("");
    pass(`KB_ONLY Response (${content.length} chars):`);
    console.log(`   "${content.slice(0, 500)}..."`);
    if (content.includes("7 days") || content.includes("seven days") || content.includes("7-day")) {
      pass("Response correctly states 7-day minimum curing time");
    } else {
      fail("Response does not contain correct curing time");
    }
  } else {
    fail(`Chat failed: ${chat3.status}`);
  }

  // KB_ONLY Test 4: Question NOT in the KB (should say info not available)
  info("KB_ONLY Test 4: 'What is the company dress code for the office?'");
  const chat4 = await request(
    "POST",
    `/api/kb/conversations/${convoId}/messages`,
    { content: "What is the company dress code policy for the head office?", mode: "KB_ONLY" },
    true
  );
  if (chat4.status === 200) {
    const content = chat4.body
      .filter((c: any) => c.content)
      .map((c: any) => c.content)
      .join("");
    pass(`KB_ONLY Response for unanswerable question (${content.length} chars):`);
    console.log(`   "${content.slice(0, 500)}..."`);
    if (
      content.toLowerCase().includes("not available") ||
      content.toLowerCase().includes("not found") ||
      content.toLowerCase().includes("no information") ||
      content.toLowerCase().includes("doesn't contain") ||
      content.toLowerCase().includes("does not contain") ||
      content.toLowerCase().includes("not specifically") ||
      content.toLowerCase().includes("knowledge base")
    ) {
      pass("KB_ONLY correctly indicates info is not in the knowledge base");
    } else {
      fail("KB_ONLY may have hallucinated an answer not in the documents");
    }
  } else {
    fail(`Chat failed: ${chat4.status}`);
  }

  // Step 7: Test HYBRID Chat Mode
  console.log("\n--- TESTING HYBRID CHAT MODE (Open Responses) ---\n");

  info("Creating separate HYBRID conversation...");
  const hybridConvoRes = await request("POST", "/api/kb/conversations", {
    title: "Open Questions",
    projectId,
  });
  const hybridConvoId = hybridConvoRes.body.id;
  pass(`Created HYBRID conversation: ${hybridConvoId}`);

  // HYBRID Test 1: Question that combines KB + general knowledge
  info("HYBRID Test 1: 'What are best practices for precast concrete panel quality inspection?'");
  const hybrid1 = await request(
    "POST",
    `/api/kb/conversations/${hybridConvoId}/messages`,
    {
      content: "What are best practices for precast concrete panel quality inspection? Include both our company standards and industry best practices.",
      mode: "HYBRID",
    },
    true
  );
  if (hybrid1.status === 200) {
    const content = hybrid1.body
      .filter((c: any) => c.content)
      .map((c: any) => c.content)
      .join("");
    pass(`HYBRID Response (${content.length} chars):`);
    console.log(`   "${content.slice(0, 600)}..."`);
    if (content.length > 200) {
      pass("HYBRID mode returned a substantive response combining KB and general knowledge");
    }
  } else {
    fail(`HYBRID chat failed: ${hybrid1.status}`);
  }

  // HYBRID Test 2: Software help question
  info("HYBRID Test 2: 'How do I register a new panel in the BuildPlus system?'");
  const hybrid2 = await request(
    "POST",
    `/api/kb/conversations/${hybridConvoId}/messages`,
    {
      content: "How do I register a new panel in the BuildPlus AI system?",
      mode: "HYBRID",
    },
    true
  );
  if (hybrid2.status === 200) {
    const content = hybrid2.body
      .filter((c: any) => c.content)
      .map((c: any) => c.content)
      .join("");
    const sources = hybrid2.body.find((c: any) => c.done)?.sources;
    pass(`HYBRID Response for software question (${content.length} chars):`);
    console.log(`   "${content.slice(0, 600)}..."`);
    if (sources?.length) {
      info(`   Sources: ${sources.map((s: any) => `${s.documentTitle} (${s.similarity}%)`).join(", ")}`);
    }
  } else {
    fail(`HYBRID chat failed: ${hybrid2.status}`);
  }

  // HYBRID Test 3: Fully open question (no KB context expected)
  info("HYBRID Test 3: Open question - 'What are the main benefits of using precast concrete in construction?'");
  const hybrid3 = await request(
    "POST",
    `/api/kb/conversations/${hybridConvoId}/messages`,
    {
      content: "What are the main benefits of using precast concrete in construction compared to in-situ concrete?",
      mode: "HYBRID",
    },
    true
  );
  if (hybrid3.status === 200) {
    const content = hybrid3.body
      .filter((c: any) => c.content)
      .map((c: any) => c.content)
      .join("");
    pass(`HYBRID Open Response (${content.length} chars):`);
    console.log(`   "${content.slice(0, 600)}..."`);
    if (content.length > 200) {
      pass("HYBRID mode answered an open question with general AI knowledge");
    }
  } else {
    fail(`HYBRID chat failed: ${hybrid3.status}`);
  }

  // Step 8: Get stats
  console.log("\n--- KB SYSTEM STATS ---\n");
  const statsRes = await request("GET", "/api/kb/stats");
  if (statsRes.status === 200) {
    info(`Projects: ${statsRes.body.projects}`);
    info(`Documents: ${statsRes.body.documents}`);
    info(`Chunks: ${statsRes.body.chunks}`);
    info(`Conversations: ${statsRes.body.conversations}`);
  }

  // Step 9: Verify conversation history
  console.log("\n--- VERIFYING CONVERSATION HISTORY ---\n");
  const messagesRes = await request("GET", `/api/kb/conversations/${convoId}/messages`);
  if (messagesRes.status === 200 && Array.isArray(messagesRes.body)) {
    pass(`KB_ONLY conversation has ${messagesRes.body.length} messages stored`);
    for (const msg of messagesRes.body) {
      info(`  [${msg.role}] (${msg.mode}) ${msg.content.slice(0, 80)}...`);
    }
  }

  console.log("\n========================================");
  console.log("  KB SYSTEM TEST COMPLETE");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
