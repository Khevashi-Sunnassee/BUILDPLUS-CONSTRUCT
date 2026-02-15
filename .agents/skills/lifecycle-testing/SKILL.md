---
name: lifecycle-testing
description: Complete lifecycle testing workflow for BuildPlus AI panel management. Use when running end-to-end tests of the panel lifecycle from opportunity creation through delivery and claims.
---

# Panel Lifecycle Testing

Complete 15-stage lifecycle test for BuildPlus AI panel management system. This covers the full panel lifecycle from job type setup through opportunity creation, drafting, production scheduling, delivery, and progress claims.

## Prerequisites

- A company with at least one factory configured
- Admin credentials for the target company
- The company must have a job type with activity templates configured

## Test Data Reference (Salvo Property Group)

- Company ID: `b72c8e39-03b5-4181-bc63-d435b291d04b`
- Factory ID: `12e8f794-370f-4601-bc9e-1831c28bd624`
- Admin credentials: `admin@salvo.com.au` / `admin123`
- User ID: `8b4de49b-d70e-44aa-b195-e4d2e09bb738`
- Test Job ID (latest): `48ded35d-df3c-405d-924d-c6742d84af45`

## Complete Lifecycle Workflow

### Stage 1: Setup Job Type & Activity Templates

Before creating jobs, ensure the company has a job type with activity workflow templates:

```sql
-- Create job type
INSERT INTO job_types (id, company_id, name, description, is_active) 
VALUES (gen_random_uuid(), '<companyId>', 'Panel Manufacturing', 'Full panel lifecycle', true);

-- Create activity stages (used for grouping)
INSERT INTO activity_stages (id, company_id, name, sort_order) 
VALUES (gen_random_uuid(), '<companyId>', 'Pre-Construction', 1);

-- Create activity templates for the job type
INSERT INTO activity_templates (id, company_id, job_type_id, name, description, stage_id, duration_days, sort_order) 
VALUES (gen_random_uuid(), '<companyId>', '<jobTypeId>', 'Site Survey', 'Initial site assessment', '<stageId>', 5, 1);
```

### Stage 2: Create Opportunity

```bash
curl -X POST /api/opportunities -d '{
  "companyName": "Test Client",
  "contactName": "Test Contact",
  "email": "test@example.com",
  "phone": "0400000000",
  "estimatedValue": 500000,
  "status": "NEW",
  "source": "REFERRAL"
}'
```

### Stage 3: Win Opportunity & Create Job

```bash
# Update opportunity status to WON
curl -X PATCH /api/opportunities/<id> -d '{"status": "WON"}'

# Create customer
curl -X POST /api/customers -d '{
  "name": "Test Client Pty Ltd",
  "contactName": "Test Contact",
  "email": "test@example.com",
  "phone": "0400000000"
}'

# Create job with jobTypeId
curl -X POST /api/jobs -d '{
  "customerId": "<customerId>",
  "name": "Test Project",
  "projectNumber": "TEST-001",
  "status": "CONTRACTED",
  "jobTypeId": "<jobTypeId>"
}'
```

### Stage 4: Register Panels

Panels must have correct level values (numeric strings like "1", "2") for production slot matching.

```bash
curl -X POST /api/panels/register -d '{
  "jobId": "<jobId>",
  "panelMark": "L1-P01",
  "panelType": "WALL",
  "level": "1",
  "length": 6000,
  "width": 3000,
  "thickness": 200
}'
```

### Stage 5: Configure Job for Production

Set production parameters on the job. **IMPORTANT:** Use a production_start_date within the next 30 days so it appears in the Production Schedule page (which defaults to today + 30 days).

```sql
UPDATE jobs SET 
  production_start_date = CURRENT_DATE + INTERVAL '14 days',
  factory_id = '<factoryId>',
  levels = '1,2',
  expected_cycle_time_per_floor = 5
WHERE id = '<jobId>';
```

### Stage 6: Generate Production Slots

```bash
curl -X POST /api/production-slots/generate -d '{
  "jobId": "<jobId>"
}'
```

This creates one slot per level. Verify:
```sql
SELECT * FROM production_slots WHERE job_id = '<jobId>';
```

### Stage 7: Generate Drafting Program

```bash
curl -X POST /api/drafting-program/generate -d '{
  "jobId": "<jobId>"
}'
```

Creates one entry per panel. Verify:
```sql
SELECT id, panel_id, status FROM drafting_program WHERE job_id = '<jobId>';
```

### Stage 8: Create Drafting Register Entries (Daily Logs)

The Drafting Register (at `/daily-reports`) shows daily time log entries for drafters working on panels. These must be created BEFORE panels are advanced to IFC status. Each entry represents time spent drafting a panel in Revit/AutoCAD.

The `/api/manual-entry` endpoint auto-creates or reuses `daily_logs` records grouped by date. Each call creates one `log_rows` entry linked to a daily log.

```bash
# Create manual time entries for each panel (this auto-creates daily_logs)
# Repeat for each panel, distributing across multiple days
curl -X POST /api/manual-entry -d '{
  "logDay": "2026-02-09",
  "jobId": "<jobId>",
  "panelRegisterId": "<panelId>",
  "app": "Revit",
  "startTime": "08:00",
  "endTime": "09:30",
  "panelMark": "L1-P01",
  "drawingCode": "DWG-L1-P01",
  "notes": "Drafting work on panel L1-P01"
}'
```

After creating all entries, retrieve the daily log IDs and submit/approve them:

```bash
# Get daily log IDs
curl -s /api/daily-logs?dateRange=all

# Submit each daily log
curl -X POST /api/daily-logs/<logId>/submit

# Approve each daily log (requires approval permission)
curl -X POST /api/daily-logs/<logId>/approve -d '{"approve": true, "comment": "Approved"}'
```

Then update the drafting program entries to COMPLETED status:

```bash
# For each drafting program entry
curl -X PATCH /api/drafting-program/<draftingProgramId> -d '{
  "status": "COMPLETED",
  "completedAt": "2026-02-10T16:00:00.000Z",
  "estimatedHours": "1.5",
  "actualHours": "1.5"
}'
```

Verify:
```sql
SELECT COUNT(*) FROM daily_logs WHERE user_id = '<userId>';
SELECT COUNT(*) FROM log_rows WHERE daily_log_id IN (SELECT id FROM daily_logs WHERE user_id = '<userId>');
SELECT status, COUNT(*) FROM drafting_program WHERE job_id = '<jobId>' GROUP BY status;
```

### Stage 9: Instantiate Job Activities

```bash
curl -X POST /api/jobs/<jobId>/activities/instantiate
```

Creates activities from the job type's workflow templates. Verify:
```sql
SELECT name, status FROM job_activities WHERE job_id = '<jobId>' ORDER BY sort_order;
```

### Stage 10: Advance Panel Lifecycle & Document Status

Panel lifecycle stages (lifecycle_status values):
- 1: REGISTERED
- 2: ESTIMATE_APPROVED
- 3: APPROVED_FOR_DRAFTING
- 4: DRAFTING_IN_PROGRESS
- 5: DRAFTED
- 6: IFC (Issued for Construction)
- 7: REO_SCHEDULED
- 8: APPROVED_FOR_PRODUCTION
- 9: IN_PRODUCTION
- 10: PRODUCED
- 11: SHIPPED

**IMPORTANT:** Also set `document_status` and `approved_for_production` fields. These are used by the Production Schedule page to determine which panels are "Ready for Production".

```sql
-- Advance all panels through lifecycle and set document/production status
UPDATE panel_register SET 
  lifecycle_status = 11,
  document_status = 'IFC',
  approved_for_production = true
WHERE job_id = '<jobId>';
```

### Stage 11: Create Production Entries (Production Schedule)

Production entries populate the **Production Schedule** page (`/production-schedule`). **IMPORTANT:** The `production_date` must be within the page's default date range (today to today+30 days) for entries to be visible.

The `production_entries` table columns: `id, panel_id, job_id, user_id, production_date, volume_m3, area_m2, notes, factory, status, bay_number, factory_id`.

```sql
-- Create production entries with dates within the visible range
INSERT INTO production_entries (id, panel_id, job_id, user_id, production_date, factory_id, status)
SELECT gen_random_uuid(), id, job_id, '<userId>', CURRENT_DATE + INTERVAL '14 days', '<factoryId>', 'COMPLETED'
FROM panel_register WHERE job_id = '<jobId>';
```

Verify production schedule is visible:
```bash
curl "/api/production-schedule/stats"
curl "/api/production-schedule/days?startDate=<today>&endDate=<today+30>&factoryId=<factoryId>"
```

### Stage 12: Create Reo Schedules

```sql
-- Create reo schedules with COMPLETED status
INSERT INTO reo_schedules (id, company_id, job_id, panel_id, status)
SELECT gen_random_uuid(), company_id, job_id, id, 'COMPLETED'
FROM panel_register WHERE job_id = '<jobId>';
```

### Stage 13: Complete Job Activities

Job activities use the `activity_status` enum: `NOT_STARTED`, `IN_PROGRESS`, `STUCK`, `DONE`, `ON_HOLD`, `SKIPPED`.

```sql
-- Mark all activities as DONE
UPDATE job_activities SET status = 'DONE' WHERE job_id = '<jobId>';
```

### Stage 14: Create Load List & Delivery

```bash
# Create load list
curl -X POST /api/load-lists -d '{
  "jobId": "<jobId>",
  "loadNumber": "LOAD-001",
  "status": "DELIVERED"
}'

# Add panels to load list
curl -X POST /api/load-lists/<loadListId>/panels -d '{
  "panelIds": ["<panelId1>", "<panelId2>"]
}'

# Create delivery record
curl -X POST /api/delivery-records -d '{
  "loadListId": "<loadListId>",
  "deliveryDate": "2026-04-15"
}'
```

### Stage 15: Create Progress Claim

```bash
curl -X POST /api/progress-claims -d '{
  "jobId": "<jobId>",
  "claimNumber": "PC-001",
  "claimType": "PROGRESS",
  "status": "DRAFT",
  "subtotal": 450000,
  "taxRate": 10,
  "taxAmount": 45000,
  "total": 495000
}'
```

## Verification Checklist

After completing all stages, verify data exists across all entities:

```sql
-- Should return counts for each entity
SELECT 'panel_register' as entity, COUNT(*) FROM panel_register WHERE job_id = '<jobId>'
UNION ALL SELECT 'production_slots', COUNT(*) FROM production_slots WHERE job_id = '<jobId>'
UNION ALL SELECT 'drafting_program', COUNT(*) FROM drafting_program WHERE job_id = '<jobId>'
UNION ALL SELECT 'daily_logs', COUNT(*) FROM daily_logs WHERE user_id = '<userId>'
UNION ALL SELECT 'log_rows', COUNT(*) FROM log_rows WHERE daily_log_id IN (SELECT id FROM daily_logs WHERE user_id = '<userId>')
UNION ALL SELECT 'job_activities', COUNT(*) FROM job_activities WHERE job_id = '<jobId>'
UNION ALL SELECT 'production_entries', COUNT(*) FROM production_entries WHERE job_id = '<jobId>'
UNION ALL SELECT 'reo_schedules', COUNT(*) FROM reo_schedules WHERE job_id = '<jobId>'
UNION ALL SELECT 'load_lists', COUNT(*) FROM load_lists WHERE job_id = '<jobId>'
UNION ALL SELECT 'progress_claims', COUNT(*) FROM progress_claims WHERE job_id = '<jobId>';
```

Also verify statuses are correct:
```sql
SELECT 'drafting_program' as entity, status::text, COUNT(*) FROM drafting_program WHERE job_id = '<jobId>' GROUP BY status
UNION ALL SELECT 'daily_logs', status::text, COUNT(*) FROM daily_logs WHERE user_id = '<userId>' GROUP BY status
UNION ALL SELECT 'production_entries', status::text, COUNT(*) FROM production_entries WHERE job_id = '<jobId>' GROUP BY status
UNION ALL SELECT 'reo_schedules', status::text, COUNT(*) FROM reo_schedules WHERE job_id = '<jobId>' GROUP BY status
UNION ALL SELECT 'job_activities', status::text, COUNT(*) FROM job_activities WHERE job_id = '<jobId>' GROUP BY status;
```

## Page-Level Verification

Verify each page shows data by hitting its API endpoint:

| Page | Route | Key API Endpoint | What to Check |
|------|-------|------------------|---------------|
| Drafting Program | `/drafting-program` | `GET /api/drafting-program` | All entries show COMPLETED status |
| Drafting Register | `/daily-reports` | `GET /api/daily-logs?dateRange=all` | Daily logs with APPROVED status, row counts |
| Production Schedule | `/production-schedule` | `GET /api/production-schedule/days?startDate=...&endDate=...` | Days with panels within date range |
| Production Report | `/production-report` | `GET /api/production-report` | Panels with production data |
| Production Slots | `/production-slots` | `GET /api/production-slots?jobId=...` | Slots per level |

## Critical Notes

- **Level matching is EXACT**: panel.level must equal slot.level exactly (e.g., "1" not "L1")
- **Production Schedule date range**: The page defaults to today + 30 days. Production entry `production_date` MUST fall within this range or the schedule appears empty.
- **Production Schedule "Ready Panels"**: Only shows panels with `document_status` = IFC/APPROVED, `approved_for_production` = true, AND no existing production_entries. Once entries exist, panels move to the "Production Days Register" section.
- **Factory filter cross-company bug**: User's default factory from one company can filter out data when viewing another company. The fix validates factory exists in current company's factories list before applying default filter.
- **Production slots require**: productionStartDate (Date), factoryId (UUID), expectedCycleTimePerFloor (number), levels (comma-separated string matching panel levels)
- **Job activity statuses**: Use enum values `NOT_STARTED`, `IN_PROGRESS`, `STUCK`, `DONE`, `ON_HOLD`, `SKIPPED` (NOT "COMPLETED")
- **Reo schedule statuses**: Can use `PENDING` or `COMPLETED` text values
- **production_entries columns**: Uses `production_date` (not `pour_date`), `factory_id`, `status`, `panel_id`, `job_id`, `user_id`
- **Multi-company context**: Users can switch companies. Company isolation is enforced server-side via req.companyId.
- **API caching disabled**: Express ETag caching caused 304 responses with stale data. Cache-Control headers prevent this.
- **Daily logs have no company_id column**: They are filtered by `user_id` and `factory_id`, not company_id.

## Cleanup

To clean up test data before re-running:

```sql
-- Delete in reverse dependency order
DELETE FROM delivery_records WHERE load_list_id IN (SELECT id FROM load_lists WHERE job_id = '<jobId>');
DELETE FROM load_list_panels WHERE load_list_id IN (SELECT id FROM load_lists WHERE job_id = '<jobId>');
DELETE FROM load_lists WHERE job_id = '<jobId>';
DELETE FROM progress_claims WHERE job_id = '<jobId>';
DELETE FROM reo_schedules WHERE job_id = '<jobId>';
DELETE FROM production_entries WHERE job_id = '<jobId>';
DELETE FROM log_rows WHERE daily_log_id IN (SELECT id FROM daily_logs WHERE user_id = '<userId>');
DELETE FROM daily_logs WHERE user_id = '<userId>';
DELETE FROM drafting_program WHERE job_id = '<jobId>';
DELETE FROM production_slots WHERE job_id = '<jobId>';
DELETE FROM job_activity_assignees WHERE activity_id IN (SELECT id FROM job_activities WHERE job_id = '<jobId>');
DELETE FROM job_activity_updates WHERE activity_id IN (SELECT id FROM job_activities WHERE job_id = '<jobId>');
DELETE FROM job_activities WHERE job_id = '<jobId>';
DELETE FROM panel_audit_logs WHERE panel_id IN (SELECT id FROM panel_register WHERE job_id = '<jobId>');
DELETE FROM panel_register WHERE job_id = '<jobId>';
```
