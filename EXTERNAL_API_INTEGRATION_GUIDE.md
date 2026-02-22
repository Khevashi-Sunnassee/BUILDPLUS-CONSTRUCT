# BuildPlus AI — External API Integration Guide

Hand this document to the developer of the external application so they can connect
to BuildPlus and replicate pages like the Document Register.

---

## 1. Base URL

```
https://<your-replit-app-url>
```

Replace with your published BuildPlus app URL (e.g., `https://buildplus-ai.replit.app`).

---

## 2. Authentication

BuildPlus uses a **two-layer authentication** system:

### Layer 1: API Key (Required for ALL requests)

Every request must include the API key in one of these headers:

```
Authorization: Bearer bp_<your_api_key>
```

or

```
X-API-Key: bp_<your_api_key>
```

The API key is created in BuildPlus under **Admin > External API Keys** (or by a
Super Admin during company setup). Each key is tied to one company — only that
company's data is accessible.

### Layer 2: User Token (Required for user-scoped access)

To enforce **per-user access control** (e.g., only show documents for jobs the user
is a member of), the external app must also authenticate as a specific BuildPlus user.

**Step 1: Login to get a token**

```
POST /api/v1/external/auth/login
Headers:
  X-API-Key: bp_<your_api_key>
  Content-Type: application/json
Body:
{
  "email": "user@company.com",
  "password": "their_buildplus_password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "1h",
  "expiresAt": "2026-02-22T15:00:00.000Z",
  "user": {
    "id": "uuid-here",
    "email": "user@company.com",
    "name": "John Smith",
    "role": "USER"
  }
}
```

**Step 2: Include the token in subsequent requests**

Add the `X-User-Token` header to all API calls:

```
GET /api/v1/external/jobs
Headers:
  X-API-Key: bp_<your_api_key>
  X-User-Token: eyJhbGciOiJIUzI1NiIs...
```

The token expires after **1 hour**. When you get a `401` response with
`"User token has expired"`, call the login endpoint again to get a new token.

### Access Control Rules

When a user token is provided, the API enforces the same access rules as the
BuildPlus web application:

| User Role    | Access Level                                          |
|-------------|-------------------------------------------------------|
| **ADMIN**   | Full access to all company data                       |
| **MANAGER** | Full access to all company data                       |
| **USER**    | Only sees jobs they are a member of, and documents belonging to those jobs |

When **no user token** is provided (API key only), the API returns all company data
with no user-level filtering (backward compatible).

---

## 3. Available Endpoints

### Authentication

```
POST /api/v1/external/auth/login
```
Authenticates a BuildPlus user and returns a JWT token. Requires API key + email/password.

```
GET /api/v1/external/auth/me
```
Returns the authenticated user's info and their access level (which jobs they can see).
Requires API key + user token.

### Health Check
```
GET /api/v1/external/health
```
Returns `{ status: "ok" }`. Use this to verify connectivity.

### Jobs
```
GET /api/v1/external/jobs
GET /api/v1/external/jobs/:id
```
**Permission required:** `read:jobs` or `*`

Query parameters:
- `status` (optional) — Filter by job status (e.g., `ACTIVE`, `COMPLETED`)

**User filtering:** When a user token is provided for a USER role, only jobs the user
is a member of are returned. ADMIN/MANAGER users see all jobs.

Response fields: id, companyId, jobNumber, name, code, client, customerId, address,
city, state, siteContact, siteContactPhone, description, status, jobPhase, jobTypeId,
factoryId, projectManagerId, estimatedValue, defectLiabilityEndDate, createdAt, updatedAt,
and more. See `API_SCHEMA_REFERENCE.md` for full field list.

### Job Types
```
GET /api/v1/external/job-types
```
**Permission required:** `read:job-types` or `*`

Response fields: id, companyId, name, description, isActive, sortOrder, createdAt, updatedAt.

### Cost Codes
```
GET /api/v1/external/cost-codes
```
**Permission required:** `read:cost-codes` or `*`

Returns two arrays:
- `costCodes` — Parent cost code categories
- `childCostCodes` — Detailed sub-codes under each parent

### Documents
```
GET /api/v1/external/documents
```
**Permission required:** `read:documents` or `*`

Query parameters:
- `jobId` (optional) — Filter documents by job
- `limit` (optional, default 100, max 500) — Number of results
- `offset` (optional, default 0) — Pagination offset

**User filtering:** When a user token is provided for a USER role, only documents
belonging to the user's assigned jobs are returned. If a `jobId` filter is specified
for a job the user doesn't have access to, a `403` error is returned.

Response fields: id, documentNumber, title, description, fileName, originalName,
mimeType, fileSize, status, version, revision, jobId, typeId, disciplineId,
categoryId, tags, isLatestVersion, isConfidential, uploadedBy, approvedBy,
approvedAt, createdAt, updatedAt.

### Company Info
```
GET /api/v1/external/company
```
**Permission required:** `read:company` or `*`

Response fields: id, name, code, address, phone, email, website, abn, acn.

### Submit Markups (Write)
```
PUT /api/v1/external/jobs/:id/markups
```
**Permission required:** `write:markups` or `*`

**User filtering:** When a user token is provided, the user must have access to the job.

### Submit Estimates (Write)
```
PUT /api/v1/external/estimates
```
**Permission required:** `write:estimates` or `*`

---

## 4. Response Format

All endpoints return JSON in this structure:

```json
{
  "data": [ ... ],      // Array of records (or single object for :id endpoints)
  "total": 42,          // Total count of returned records
  "limit": 100,         // (paginated endpoints only)
  "offset": 0,          // (paginated endpoints only)
  "userFiltered": true  // true when user-level filtering was applied
}
```

Error responses:
```json
{
  "error": "Description of the error"
}
```

HTTP status codes:
- `200` — Success
- `400` — Bad request (missing/invalid parameters)
- `401` — Unauthorized (missing or invalid API key / expired user token)
- `403` — Forbidden (key doesn't have required permission / user doesn't have job access)
- `404` — Resource not found
- `429` — Rate limited (too many requests)
- `500` — Server error

---

## 5. Field Naming Convention

- **API responses use camelCase** (e.g., `jobNumber`, `documentNumber`, `fileSize`)
- **Database columns use snake_case** (e.g., `job_number`, `document_number`, `file_size`)

When sending data TO BuildPlus (PUT/POST), use **camelCase**.

Common field patterns:
| Pattern              | Example                    |
|----------------------|----------------------------|
| Primary key          | `id` (UUID string)         |
| Foreign key          | `jobId`, `companyId`       |
| Active flag          | `isActive` (boolean)       |
| Timestamps           | `createdAt`, `updatedAt`   |

See `API_SCHEMA_REFERENCE.md` for the complete field-by-field mapping of every table.

---

## 6. To Replicate the Document Register Page

The Document Register page (shown in screenshot) displays documents grouped by Job
and filtered by discipline. Here's what the other app needs to do:

### Step 1: Login as the user
```
POST /api/v1/external/auth/login
Body: { "email": "user@company.com", "password": "password123" }
```
Store the returned `token` for subsequent requests.

### Step 2: Fetch Jobs (filtered to user's access)
```
GET /api/v1/external/jobs
Headers: X-API-Key: bp_xxx, X-User-Token: <token>
```
This gives you only the jobs this user is allowed to see.

### Step 3: Fetch Job Types (optional)
```
GET /api/v1/external/job-types
```
Provides job type names if you want to display them.

### Step 4: Fetch Documents (filtered to user's access)
```
GET /api/v1/external/documents
```
Or filter by job:
```
GET /api/v1/external/documents?jobId=<job-id>&limit=500
```
Only documents for the user's assigned jobs are returned.

### Step 5: Build the UI

Map these API fields to the Document Register columns:

| Register Column   | API Field        | Notes                                                |
|-------------------|------------------|------------------------------------------------------|
| Document (name)   | `title`          | Document title                                       |
| Doc No.           | `documentNumber` | Alphanumeric document number                         |
| Rev               | `revision`       | Revision letter (A, B, C...)                         |
| Type / Discipline | `typeId`, `disciplineId` | IDs — you'll need a lookup table or fetch these separately |
| Job               | `jobId`          | Join with jobs list to get job name                  |
| Version           | `version`        | Version string like "1.0"                            |
| Status            | `status`         | One of: PRELIM, IFA, IFC, DRAFT, REVIEW, APPROVED, SUPERSEDED, ARCHIVED |
| Size              | `fileSize`       | In bytes — convert to KB/MB for display              |
| Uploaded          | `createdAt`      | ISO 8601 timestamp                                   |
| File name         | `originalName`   | Original uploaded file name                          |

### Step 6: Filtering

To replicate the filter bar:
- **Latest versions only** — Filter where `isLatestVersion === true`
- **All Statuses** — Filter on `status` field
- **All Jobs** — Filter on `jobId` field
- **Search** — Client-side search across `title`, `documentNumber`, `originalName`
- **Group by Job + Discipline** — Group records by `jobId` then by `disciplineId`

---

## 7. Example Code (Node.js / JavaScript)

```javascript
const API_BASE = "https://your-buildplus-app.replit.app";
const API_KEY = "bp_your_api_key_here";

// Step 1: Login as a user to get a token
const loginRes = await fetch(`${API_BASE}/api/v1/external/auth/login`, {
  method: "POST",
  headers: {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "user@company.com",
    password: "their_password",
  }),
});
const { token, user } = await loginRes.json();
console.log(`Logged in as ${user.name} (${user.role})`);

// Step 2: Use the token for all subsequent requests
const headers = {
  "X-API-Key": API_KEY,
  "X-User-Token": token,
  "Content-Type": "application/json",
};

// Step 3: Check what jobs this user can access
const meRes = await fetch(`${API_BASE}/api/v1/external/auth/me`, { headers });
const { access } = await meRes.json();
console.log(`Access level: ${access.level}`);
if (access.level === "restricted") {
  console.log(`Can access ${access.allowedJobCount} jobs`);
}

// Step 4: Fetch jobs (only the ones this user can see)
const jobsRes = await fetch(`${API_BASE}/api/v1/external/jobs`, { headers });
const { data: jobs } = await jobsRes.json();
console.log(`User can see ${jobs.length} jobs`);

// Step 5: Fetch documents for a specific job
const docsRes = await fetch(
  `${API_BASE}/api/v1/external/documents?jobId=${jobs[0].id}&limit=500`,
  { headers }
);
const { data: documents } = await docsRes.json();

// Group documents by job
const grouped = {};
for (const doc of documents) {
  const jobName = jobs.find(j => j.id === doc.jobId)?.name || "Unassigned";
  if (!grouped[jobName]) grouped[jobName] = [];
  grouped[jobName].push(doc);
}
```

### Token Refresh Pattern

```javascript
let currentToken = null;
let tokenExpiresAt = null;

async function getValidToken() {
  if (currentToken && tokenExpiresAt && new Date(tokenExpiresAt) > new Date()) {
    return currentToken;
  }

  const loginRes = await fetch(`${API_BASE}/api/v1/external/auth/login`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
  });

  const data = await loginRes.json();
  currentToken = data.token;
  tokenExpiresAt = data.expiresAt;
  return currentToken;
}

async function apiCall(endpoint) {
  const token = await getValidToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "X-API-Key": API_KEY,
      "X-User-Token": token,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 401) {
    // Token expired, force refresh
    currentToken = null;
    const newToken = await getValidToken();
    return fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "X-API-Key": API_KEY,
        "X-User-Token": newToken,
        "Content-Type": "application/json",
      },
    }).then(r => r.json());
  }

  return res.json();
}
```

---

## 8. Rate Limits

API requests are rate-limited. If you receive a `429` response, back off and retry
after a short delay. Recommended: max 60 requests per minute.

---

## 9. Data Isolation & Access Control

### Company-Level Isolation
Each API key is locked to one company. The external app will only ever see data
belonging to that company. No cross-company access is possible.

### User-Level Access Control
When a user token is included:
- **ADMIN/MANAGER users** see all company data (same as API key only)
- **USER role** only sees jobs they are explicitly assigned to (via job membership),
  and documents belonging to those jobs
- This matches the access rules in the BuildPlus web application

---

## 10. Testing Guide

Use these steps to test the API integration from start to finish.

### Step 1: Test connectivity
```bash
curl -H "X-API-Key: bp_your_key" \
  https://your-app.replit.app/api/v1/external/health
```
Expected: `{ "status": "ok", "version": "1.0" }`

### Step 2: Login as a user
```bash
curl -X POST \
  -H "X-API-Key: bp_your_key" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@company.com","password":"password123"}' \
  https://your-app.replit.app/api/v1/external/auth/login
```
Expected: JSON with `token`, `expiresIn`, `expiresAt`, and `user` object.

### Step 3: Check user access level
```bash
curl -H "X-API-Key: bp_your_key" \
  -H "X-User-Token: <token_from_step_2>" \
  https://your-app.replit.app/api/v1/external/auth/me
```
Expected: JSON with `user` info and `access` object showing which jobs the user can see.

### Step 4: Fetch jobs (user-filtered)
```bash
curl -H "X-API-Key: bp_your_key" \
  -H "X-User-Token: <token>" \
  https://your-app.replit.app/api/v1/external/jobs
```
Expected: Only jobs the user is a member of (for USER role).

### Step 5: Fetch documents (user-filtered)
```bash
curl -H "X-API-Key: bp_your_key" \
  -H "X-User-Token: <token>" \
  https://your-app.replit.app/api/v1/external/documents
```
Expected: Only documents for the user's accessible jobs.

### Step 6: Test access denied
Try fetching a job the user is NOT a member of:
```bash
curl -H "X-API-Key: bp_your_key" \
  -H "X-User-Token: <token>" \
  https://your-app.replit.app/api/v1/external/jobs/<job-id-user-cannot-access>
```
Expected: `403 { "error": "You do not have access to this job" }`

### Step 7: Compare with/without user token
Run the same request with and without the `X-User-Token` header to verify that:
- **Without token**: Returns all company data
- **With token (USER role)**: Returns only the user's permitted data

---

## 11. Checklist for the External Developer

- [ ] Receive the API key from the BuildPlus Super Admin
- [ ] Receive the base URL of the BuildPlus app
- [ ] Receive the `API_SCHEMA_REFERENCE.md` file for field name mapping
- [ ] Test connectivity with `GET /api/v1/external/health`
- [ ] Implement user login flow (`POST /api/v1/external/auth/login`)
- [ ] Store the API key securely (never expose in frontend code)
- [ ] Store user credentials securely (never log passwords)
- [ ] Include `X-User-Token` header in all data requests
- [ ] Implement token refresh logic (tokens expire after 1 hour)
- [ ] Fetch jobs, documents, cost codes as needed
- [ ] Map camelCase field names to their application's field names
- [ ] Handle pagination (limit/offset) for large datasets
- [ ] Handle error responses (401, 403, 404, 429, 500)
- [ ] Handle `403` responses when user tries to access restricted jobs/documents

---

## 12. What to Tell the Other Application Developer

Send them this information:

1. **Base URL**: `https://<your-buildplus-app-url>`
2. **API Key**: The `bp_xxxx` key generated in Admin > External API Keys
3. **This document**: `EXTERNAL_API_INTEGRATION_GUIDE.md`
4. **Schema reference**: `API_SCHEMA_REFERENCE.md`
5. **User credentials**: Each user logs in with their BuildPlus email and password
6. **Authentication flow**:
   - Every request needs the API key in `X-API-Key` header
   - To get user-scoped data, first call `POST /api/v1/external/auth/login` with the user's email/password
   - Include the returned token in `X-User-Token` header on all subsequent requests
   - Tokens expire after 1 hour — call login again when expired
7. **Access rules**: Users with USER role only see jobs they're members of. ADMIN/MANAGER see everything.
