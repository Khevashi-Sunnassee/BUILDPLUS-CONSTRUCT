# BuildPlus Markup Integration Contract

This document defines the integration protocol between **BuildPlus AI** (the main construction management application) and **BuildPlus Markup** (the document markup/annotation application). Both apps must implement their respective sides of this contract for the integration to work.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites & Setup](#prerequisites--setup)
3. [Authentication Flow](#authentication-flow)
4. [API Endpoints (Provided by BuildPlus AI)](#api-endpoints-provided-by-buildplus-ai)
5. [Handoff Flow (Main App → Markup App)](#handoff-flow-main-app--markup-app)
6. [Markup Return Flow (Markup App → Main App)](#markup-return-flow-markup-app--main-app)
7. [Data Schemas](#data-schemas)
8. [Error Handling](#error-handling)
9. [Security Considerations](#security-considerations)
10. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

```
┌─────────────────────────┐         ┌─────────────────────────┐
│    BuildPlus AI         │         │   BuildPlus Markup      │
│    (Main App)           │         │   (Markup App)          │
│                         │         │                         │
│  Document Register      │         │  Markup Editor          │
│  ├─ "Open in Markup" ──────────►  │  ├─ Receives handoff    │
│  │   button             │  (1)    │  │   token via URL       │
│  │                      │         │  │                       │
│  │  External API        │  (2)    │  ├─ Downloads document   │
│  │  ├─ Document Download ◄────────│  │   via External API    │
│  │  │                   │         │  │                       │
│  │  ├─ Markup Upload   ◄─────────│  ├─ Uploads marked-up    │
│  │  │                   │  (3)    │  │   version via API     │
│  │                      │         │  │                       │
│  └──────────────────────┘         └─────────────────────────┘
```

**Flow Summary:**
1. User clicks "Open in Markup" in BuildPlus AI → redirected to Markup app with a handoff token
2. Markup app decodes the token, authenticates via External API, downloads the document
3. After markup is complete, Markup app uploads the annotated file back → creates a new document version in BuildPlus AI

---

## Prerequisites & Setup

### For BuildPlus AI (Main App)

1. **External API Key**: A Super Admin must create an External API key at `/super-admin` → External API section. This key is shared with the Markup app.
   - The key is generated in format `bp_<64-hex-chars>`
   - The key is shown only once at creation; store it securely
   - Permissions should include `*` (all) or at minimum: `read:documents`, `write:documents`

2. **User Markup Credentials**: Each user configures their Markup app connection via the Document Register toolbar → "Markup Connection" button. They provide:
   - `markupAppUrl`: The Markup app's base URL (e.g., `https://buildplus-markup.replit.app`)
   - `markupEmail`: Their email address in the Markup app
   - `markupApiKey`: (Optional) An API key from the Markup app for enhanced security

### For BuildPlus Markup (Markup App)

1. **Store the API Key**: The BuildPlus AI External API key must be stored as an environment variable/secret (e.g., `BUILDPLUS_API_KEY`).

2. **Store the Source App URL**: The BuildPlus AI base URL must be configured (e.g., `BUILDPLUS_SOURCE_URL`).

3. **Implement the Handoff Receiver**: A route at `/markup/open` that accepts and decodes the handoff token from the URL query parameters.

4. **Implement API Client**: HTTP client to call BuildPlus AI External API endpoints for document download and markup upload.

---

## Authentication Flow

BuildPlus AI's External API uses **two-layer authentication**:

### Layer 1: API Key (Company-Level Access)
- Sent via `X-API-Key` header or `Authorization: Bearer <key>` header
- Identifies which company the request belongs to
- Required for ALL External API endpoints

### Layer 2: User Token (User-Level Access)
- Obtained by calling `POST /api/v1/external/auth/login` with user credentials
- Returns a JWT token valid for 1 hour
- Sent via `X-User-Token` header
- Required for endpoints that need user-level access (e.g., markup upload)
- Enforces per-user job membership filtering

### Authentication Sequence for Markup App

```
Step 1: Markup app receives handoff token with userEmail
Step 2: POST /api/v1/external/auth/login
        Headers: { "X-API-Key": "<api-key>" }
        Body: { "email": "<userEmail>", "password": "<user-password>" }
        Response: { "token": "<jwt-token>", "expiresIn": "1h", ... }
Step 3: Use both headers for subsequent requests:
        X-API-Key: <api-key>
        X-User-Token: <jwt-token>
```

---

## API Endpoints (Provided by BuildPlus AI)

Base URL: `https://<buildplus-ai-app-url>`

### Health Check
```
GET /api/v1/external/health
No authentication required.

Response:
{
  "status": "ok",
  "service": "BuildPlus API",
  "version": "1.0.0",
  "timestamp": "2026-02-22T12:00:00.000Z",
  "endpoints": { ... }
}
```

### Ping (Validate API Key)
```
GET /api/v1/external/ping
Headers: X-API-Key: <api-key>

Response:
{
  "status": "ok",
  "message": "API key is valid",
  "company": "<company-id>",
  "keyName": "<key-name>",
  "permissions": ["*"],
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

### User Login
```
POST /api/v1/external/auth/login
Headers: X-API-Key: <api-key>
Body: { "email": "user@company.com", "password": "userpassword" }

Response:
{
  "token": "<jwt-token>",
  "expiresIn": "1h",
  "expiresAt": "2026-02-22T13:00:00.000Z",
  "user": {
    "id": "<user-uuid>",
    "email": "user@company.com",
    "name": "John Smith",
    "role": "ADMIN"
  }
}
```

### Document Download
```
GET /api/v1/external/documents/:documentId/download
Headers:
  X-API-Key: <api-key>
  X-User-Token: <jwt-token>  (optional but recommended)

Response: Binary file stream
Response Headers:
  Content-Type: <mime-type>
  Content-Disposition: attachment; filename="<encoded-filename>"
  Access-Control-Expose-Headers: Content-Disposition

Error Responses:
  404: { "error": "Document not found" }
  404: { "error": "File not found in storage" }
  403: { "error": "You do not have access to this document" }
```

### Markup Version Upload
```
POST /api/v1/external/documents/:documentId/markup-version
Headers:
  X-API-Key: <api-key>
  X-User-Token: <jwt-token>  (REQUIRED)
Content-Type: multipart/form-data

Form Fields:
  file: <binary-file>  (REQUIRED, max 100MB)
  notes: <string>      (optional, description of markup changes)

Accepted File Types:
  - application/pdf
  - image/png
  - image/jpeg
  - image/tiff
  - image/svg+xml

Response:
{
  "success": true,
  "document": {
    "id": "<new-document-uuid>",
    "documentNumber": "DOC-001",
    "title": "Floor Plan (Marked Up)",
    "version": "1.1",
    "revision": "M1",
    "parentDocumentId": "<original-document-uuid>"
  }
}

Error Responses:
  400: { "error": "No file provided" }
  400: { "error": "File type not supported for markup. Accepted: PDF, PNG, JPEG, TIFF, SVG." }
  401: { "error": "User authentication required", "message": "..." }
  404: { "error": "Document not found" }
```

**Version Behavior:**
- Creates a new document record linked to the original via `parentDocumentId`
- Version increments the minor number: `1.0` → `1.1` → `1.2`
- Revision uses format `M<minor>`: `M1`, `M2`, `M3`
- New document is marked as `isLatestVersion: true`
- Previous document is marked as `isLatestVersion: false`
- Status is set to `REVIEW` for the new markup version

---

## Handoff Flow (Main App → Markup App)

When a user clicks "Open in Markup" in BuildPlus AI:

### Step 1: BuildPlus AI generates a handoff URL

The main app calls its internal endpoint `POST /api/markup/handoff` which:
1. Fetches the document details
2. Reads the user's stored markup credentials
3. Creates a base64url-encoded JSON payload
4. Constructs a URL pointing to the Markup app

### Step 2: User is redirected to the Markup app

The generated URL format:
```
https://<markup-app-url>/markup/open?token=<base64url-payload>&source=buildplus-construct
```

### Step 3: Markup app decodes the handoff token

The `token` query parameter is a base64url-encoded JSON string. Decode it to get:

```json
{
  "documentId": "uuid-of-the-document",
  "documentNumber": "DOC-001",
  "title": "Structural Drawing Rev A",
  "fileName": "structural-drawing-revA.pdf",
  "mimeType": "application/pdf",
  "sourceApp": "buildplus-construct",
  "timestamp": 1740000000000,
  "userEmail": "user@company.com"
}
```

**Handoff Token Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `documentId` | string (UUID) | The document's unique ID in BuildPlus AI. Use this for download and upload. |
| `documentNumber` | string \| null | Human-readable document number (e.g., "DOC-001") |
| `title` | string | Document title for display purposes |
| `fileName` | string | Original file name with extension |
| `mimeType` | string | MIME type of the file |
| `sourceApp` | string | Always `"buildplus-construct"` - identifies the source application |
| `timestamp` | number | Unix timestamp (milliseconds) when the handoff was created |
| `userEmail` | string | The user's email in the Markup app (for auto-login or matching) |

### Decoding Example (JavaScript/Node.js)

```javascript
const tokenParam = req.query.token;
const jsonString = Buffer.from(tokenParam, 'base64url').toString('utf-8');
const handoff = JSON.parse(jsonString);

console.log(handoff.documentId);  // "uuid-..."
console.log(handoff.userEmail);   // "user@company.com"
console.log(handoff.fileName);    // "drawing.pdf"
```

---

## Markup Return Flow (Markup App → Main App)

After the user completes their markup in the Markup app:

### Step 1: Authenticate with BuildPlus AI External API

```javascript
// Login to get a user token
const loginRes = await fetch(`${BUILDPLUS_URL}/api/v1/external/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': BUILDPLUS_API_KEY,
  },
  body: JSON.stringify({
    email: handoff.userEmail,
    password: userPassword,  // User must provide their BuildPlus AI password
  }),
});
const { token } = await loginRes.json();
```

### Step 2: Upload the marked-up file

```javascript
const formData = new FormData();
formData.append('file', markedUpFileBuffer, {
  filename: `markup-${handoff.fileName}`,
  contentType: handoff.mimeType,
});
formData.append('notes', 'Added structural annotations and revision marks');

const uploadRes = await fetch(
  `${BUILDPLUS_URL}/api/v1/external/documents/${handoff.documentId}/markup-version`,
  {
    method: 'POST',
    headers: {
      'X-API-Key': BUILDPLUS_API_KEY,
      'X-User-Token': token,
    },
    body: formData,
  }
);
const result = await uploadRes.json();
// result.document.id → new document version UUID
// result.document.version → "1.1"
```

### Step 3: Download the original document (for markup editing)

```javascript
const downloadRes = await fetch(
  `${BUILDPLUS_URL}/api/v1/external/documents/${handoff.documentId}/download`,
  {
    headers: {
      'X-API-Key': BUILDPLUS_API_KEY,
      'X-User-Token': token,
    },
  }
);
const fileBuffer = await downloadRes.arrayBuffer();
// Use fileBuffer to load into the markup editor
```

---

## Data Schemas

### Markup Credentials (stored in BuildPlus AI)

Per-user connection settings linking them to their Markup app account:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `userId` | UUID | BuildPlus AI user ID |
| `companyId` | UUID | Company ID |
| `markupAppUrl` | text | Base URL of the Markup app |
| `markupEmail` | text | User's email in the Markup app |
| `markupApiKey` | text (optional) | API key for the Markup app |
| `lastUsedAt` | timestamp | Last time the user opened a document in Markup |
| `createdAt` | timestamp | Record creation time |
| `updatedAt` | timestamp | Last update time |

### Document Version (created on markup upload)

When a markup version is uploaded, a new document record is created:

| Field | Value |
|-------|-------|
| `companyId` | Same as original document |
| `jobId` | Same as original document |
| `documentNumber` | Same as original document |
| `title` | `"<original title> (Marked Up)"` or `"<original title> - Markup: <notes>"` |
| `status` | `"REVIEW"` |
| `version` | Minor increment: `"1.0"` → `"1.1"` |
| `revision` | `"M<minor>"` format: `"M1"`, `"M2"` |
| `isLatestVersion` | `true` (old version set to `false`) |
| `parentDocumentId` | Points to the root document (original's parent or the original itself) |
| `typeId`, `disciplineId`, `categoryId`, `tags` | Inherited from original document |

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 204 | Success (OPTIONS preflight) |
| 400 | Bad request (missing fields, invalid file type) |
| 401 | Authentication failed (invalid/expired API key or user token) |
| 403 | Forbidden (insufficient permissions or wrong company) |
| 404 | Resource not found |
| 500 | Internal server error |

### Common Error Responses

```json
// Missing API key
{ "error": "API key required", "message": "Provide an API key via Authorization: Bearer <key> or X-API-Key header" }

// Invalid API key
{ "error": "Invalid or inactive API key" }

// Expired user token
{ "error": "User token has expired. Please login again." }

// Missing user token on protected endpoint
{ "error": "User authentication required", "message": "This endpoint requires a user token..." }

// Wrong company
{ "error": "User token company does not match API key company" }
```

### Retry Strategy

- **401 (Token Expired)**: Re-authenticate via `/auth/login` and retry
- **429 (Rate Limited)**: Back off and retry with exponential delay
- **500 (Server Error)**: Retry up to 3 times with exponential backoff
- **404 (Not Found)**: Do not retry; document may have been deleted

---

## Security Considerations

1. **API Key Storage**: Store the External API key as a server-side secret/environment variable. Never expose it to the browser/client.

2. **CORS**: The External API allows cross-origin requests (`Access-Control-Allow-Origin: *`) but the API key provides the access control layer.

3. **Token Expiry**: User tokens (JWT) expire after 1 hour. The Markup app should handle token refresh by re-authenticating.

4. **Handoff Token**: The handoff token is NOT encrypted (just base64url-encoded). It contains no secrets - only document metadata and a user email. The actual authentication happens via the External API.

5. **File Size Limit**: Maximum upload size is 100MB per file.

6. **File Type Validation**: Only PDF, PNG, JPEG, TIFF, and SVG files are accepted for markup upload.

7. **Company Isolation**: The API key is bound to a single company. All documents accessed through it must belong to that company.

8. **User Scoping**: When a user token is provided, document access is further scoped to the user's job memberships (for non-ADMIN/MANAGER roles).

---

## Implementation Checklist

### BuildPlus AI (Main App) - DONE
- [x] External API key management (Super Admin)
- [x] `GET /api/v1/external/documents/:id/download` endpoint
- [x] `POST /api/v1/external/documents/:id/markup-version` endpoint
- [x] `POST /api/v1/external/auth/login` endpoint
- [x] Markup credentials storage (per-user)
- [x] Handoff token generation (`POST /api/markup/handoff`)
- [x] "Open in Markup" button in Document Register
- [x] Markup Setup Dialog for credential configuration
- [x] CORS headers for cross-origin requests

### BuildPlus Markup (Markup App) - TO IMPLEMENT
- [ ] Store BuildPlus AI API key as environment variable (`BUILDPLUS_API_KEY`)
- [ ] Store BuildPlus AI URL as environment variable (`BUILDPLUS_SOURCE_URL`)
- [ ] Route handler: `GET /markup/open` - receive and decode handoff token
- [ ] API client: Authenticate via `/api/v1/external/auth/login`
- [ ] API client: Download document via `/api/v1/external/documents/:id/download`
- [ ] API client: Upload markup via `/api/v1/external/documents/:id/markup-version`
- [ ] Handle token expiry (re-authenticate on 401)
- [ ] Display handoff document metadata (title, number) in the editor
- [ ] "Save to BuildPlus" button that uploads the markup and shows confirmation

---

## Quick Reference: Markup App Minimal Implementation

```javascript
// 1. Route to receive handoff
app.get('/markup/open', (req, res) => {
  const token = req.query.token;
  const handoff = JSON.parse(
    Buffer.from(token, 'base64url').toString('utf-8')
  );
  // Store handoff data in session, then redirect to editor
  req.session.handoff = handoff;
  res.redirect('/editor');
});

// 2. Download the document for editing
async function downloadDocument(documentId, apiKey, userToken) {
  const res = await fetch(
    `${BUILDPLUS_URL}/api/v1/external/documents/${documentId}/download`,
    { headers: { 'X-API-Key': apiKey, 'X-User-Token': userToken } }
  );
  return res.arrayBuffer();
}

// 3. Upload markup back
async function uploadMarkup(documentId, fileBuffer, fileName, mimeType, notes, apiKey, userToken) {
  const form = new FormData();
  form.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);
  form.append('notes', notes || '');
  
  const res = await fetch(
    `${BUILDPLUS_URL}/api/v1/external/documents/${documentId}/markup-version`,
    {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'X-User-Token': userToken },
      body: form,
    }
  );
  return res.json();
}
```
