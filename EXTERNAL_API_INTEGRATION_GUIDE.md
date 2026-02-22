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

---

## 3. Available Endpoints

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
  "offset": 0           // (paginated endpoints only)
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
- `401` — Unauthorized (missing or invalid API key)
- `403` — Forbidden (key doesn't have required permission)
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

### Step 1: Fetch Jobs
```
GET /api/v1/external/jobs
```
This gives you the job list for the dropdown filter and for grouping documents.

### Step 2: Fetch Job Types (optional)
```
GET /api/v1/external/job-types
```
Provides job type names if you want to display them.

### Step 3: Fetch Documents
```
GET /api/v1/external/documents
```
Or filter by job:
```
GET /api/v1/external/documents?jobId=<job-id>&limit=500
```

### Step 4: Build the UI

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

### Step 5: Filtering

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

const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

// Fetch all jobs
const jobsRes = await fetch(`${API_BASE}/api/v1/external/jobs`, { headers });
const { data: jobs } = await jobsRes.json();

// Fetch documents for a specific job
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

---

## 8. Rate Limits

API requests are rate-limited. If you receive a `429` response, back off and retry
after a short delay. Recommended: max 60 requests per minute.

---

## 9. Data Isolation

Each API key is locked to one company. The external app will only ever see data
belonging to that company. No cross-company access is possible.

---

## 10. Checklist for the External Developer

- [ ] Receive the API key from the BuildPlus Super Admin
- [ ] Receive the base URL of the BuildPlus app
- [ ] Receive the `API_SCHEMA_REFERENCE.md` file for field name mapping
- [ ] Test connectivity with `GET /api/v1/external/health`
- [ ] Fetch jobs, documents, cost codes as needed
- [ ] Map camelCase field names to their application's field names
- [ ] Handle pagination (limit/offset) for large datasets
- [ ] Handle error responses (401, 403, 404, 429, 500)
- [ ] Store the API key securely (never expose in frontend code)
