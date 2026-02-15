---
name: lifecycle-testing
description: Complete lifecycle testing workflow for BuildPlus AI panel management. Use when running end-to-end tests of the panel lifecycle from job setup through production, delivery, and claims.
---

# Panel Lifecycle Testing

Complete 15-stage lifecycle test for BuildPlus AI panel management system. This covers the full panel lifecycle from job setup through drafting, production, delivery confirmation, and progress claims.

## Prerequisites

- A company with at least one factory configured
- Admin credentials for the target company
- The company must have a job type with activity templates configured

## Test Data Reference (Salvo Property Group)

- Company ID: `b72c8e39-03b5-4181-bc63-d435b291d04b`
- Factory ID: `12e8f794-370f-4601-bc9e-1831c28bd624`
- Factory State: `VIC` (C2 Sydney Factory)
- Admin credentials: `admin@salvo.com.au` / `admin123`
- User ID: `8b4de49b-d70e-44aa-b195-e4d2e09bb738`
- Test Job ID (latest): `48ded35d-df3c-405d-924d-c6742d84af45`
- Customer ID: `5762255d-144a-4cbb-82f7-6b07025af487`

## Key Schema Notes

These column/enum references are commonly needed and error-prone:

| Table | Important Columns | Notes |
|-------|-------------------|-------|
| `panel_register` | `lifecycle_status` (int), `document_status` (enum), `approved_for_production` (bool) | document_status is an enum, cast with `::text` in SQL |
| `production_entries` | `production_date` (not `pour_date`), `factory_id`, `status`, `user_id` | No `company_id` column |
| `daily_logs` | `user_id`, `log_day`, `factory`, `factory_id`, `status` | No `company_id` column; filtered by `user_id` |
| `log_rows` | `daily_log_id`, `start_at`, `end_at`, `panel_mark`, `job_id`, `panel_register_id` | Linked to daily_logs |
| `job_activities` | `status` enum: `NOT_STARTED`, `IN_PROGRESS`, `STUCK`, `DONE`, `ON_HOLD`, `SKIPPED` | NOT "COMPLETED" |
| `delivery_records` | `load_list_id`, `docket_number`, `delivery_date`, many time fields | Linked to load_lists |
| `load_lists` | `job_id`, `load_number`, `status`, `load_date`, `factory_id` | Status values: DRAFT, LOADING, LOADED, IN_TRANSIT, COMPLETE |
| `progress_claims` | `subtotal`, `tax_rate`, `tax_amount`, `total` (all numeric) | Financial values in dollars |

## Complete Lifecycle Workflow

### Stage 1: Setup Job Type & Activity Templates

Before creating jobs, ensure the company has a job type with activity workflow templates:

```sql
-- Check if job type exists
SELECT id, name FROM job_types WHERE company_id = '<companyId>';

-- Create job type if needed
INSERT INTO job_types (id, company_id, name, description, is_active) 
VALUES (gen_random_uuid(), '<companyId>', 'Panel Manufacturing', 'Full panel lifecycle', true);

-- Create activity stages (used for grouping)
INSERT INTO activity_stages (id, company_id, name, sort_order) 
VALUES (gen_random_uuid(), '<companyId>', 'Pre-Construction', 1);

-- Create activity templates for the job type
INSERT INTO activity_templates (id, company_id, job_type_id, name, description, stage_id, duration_days, sort_order) 
VALUES (gen_random_uuid(), '<companyId>', '<jobTypeId>', 'Site Survey', 'Initial site assessment', '<stageId>', 5, 1);
```

### Stage 2: Create Customer & Job

```bash
# Create customer (if needed)
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

### Stage 3: Register Panels

Panels must have correct level values (numeric strings like "1", "2") for production slot matching.

```bash
# Register 5 panels per level (10 total for a 2-level job)
curl -X POST /api/panels/register -d '{
  "jobId": "<jobId>",
  "panelMark": "L1-P01",
  "panelType": "WALL",
  "level": "1",
  "length": 6000,
  "width": 3000,
  "thickness": 200
}'
# Repeat for L1-P02..L1-P05 (level "1") and L2-P01..L2-P05 (level "2")
```

### Stage 4: Configure Job for Production

**IMPORTANT:** Use a `production_start_date` within the next 30 days so it appears in the Production Schedule page (which defaults to today + 30 days).

```sql
UPDATE jobs SET 
  production_start_date = CURRENT_DATE + INTERVAL '14 days',
  factory_id = '<factoryId>',
  levels = '1,2',
  expected_cycle_time_per_floor = 5
WHERE id = '<jobId>';
```

### Stage 5: Generate Production Slots

```bash
curl -X POST /api/production-slots/generate -d '{"jobId": "<jobId>"}'
```

Creates one slot per level. Verify:
```sql
SELECT id, level, status::text FROM production_slots WHERE job_id = '<jobId>';
```

### Stage 6: Generate Drafting Program

```bash
curl -X POST /api/drafting-program/generate -d '{"jobId": "<jobId>"}'
```

Creates one entry per panel. Verify:
```sql
SELECT id, panel_id, status::text FROM drafting_program WHERE job_id = '<jobId>';
```

### Stage 7: Create Drafting Register Entries (Daily Logs)

The Drafting Register page (`/daily-reports`) shows daily time log entries. The page defaults to "This Week" date range, so **daily log dates MUST be within the current week** (today or recent days).

The `/api/manual-entry` endpoint auto-creates or reuses `daily_logs` records grouped by date. Each call creates one `log_rows` entry linked to a daily log.

```bash
# Create manual time entries for each panel
# Use CURRENT dates (today and yesterday) so they appear in "This Week" filter
curl -X POST /api/manual-entry -d '{
  "logDay": "<today YYYY-MM-DD>",
  "jobId": "<jobId>",
  "panelRegisterId": "<panelId>",
  "app": "Revit",
  "startTime": "08:00",
  "endTime": "09:30",
  "panelMark": "L1-P01",
  "drawingCode": "DWG-L1-P01",
  "notes": "Drafting work on panel L1-P01"
}'
# Repeat for each panel, distributing 5 per day across 2 days
```

After creating all entries, submit and approve the daily logs:

```bash
# Get daily log IDs
curl -s /api/daily-logs?dateRange=all
# Returns array with id, logDay, status

# Submit each daily log
curl -X POST /api/daily-logs/<logId>/submit

# Approve each daily log
curl -X POST /api/daily-logs/<logId>/approve -d '{"approve": true, "comment": "Approved"}'
```

Update drafting program entries to COMPLETED:

```bash
# For each drafting program entry
curl -X PATCH /api/drafting-program/<draftingProgramId> -d '{
  "status": "COMPLETED",
  "completedAt": "<ISO datetime>",
  "estimatedHours": "1.5",
  "actualHours": "1.5"
}'
```

Verify:
```sql
SELECT log_day, status FROM daily_logs WHERE user_id = '<userId>' ORDER BY log_day DESC;
SELECT COUNT(*) FROM log_rows WHERE daily_log_id IN (SELECT id FROM daily_logs WHERE user_id = '<userId>');
SELECT status::text, COUNT(*) FROM drafting_program WHERE job_id = '<jobId>' GROUP BY status;
```

### Stage 8: Instantiate Job Activities

```bash
curl -X POST /api/jobs/<jobId>/activities/instantiate
```

Verify:
```sql
SELECT name, status::text FROM job_activities WHERE job_id = '<jobId>' ORDER BY sort_order;
```

### Stage 9: Advance Panel Lifecycle & Document Status

**IMPORTANT:** Set `document_status` and `approved_for_production` fields. These are used by the Production Schedule page to determine "Ready for Production" panels.

```sql
UPDATE panel_register SET 
  lifecycle_status = 11,
  document_status = 'IFC',
  approved_for_production = true
WHERE job_id = '<jobId>';
```

### Stage 10: Create Production Entries (Production Schedule)

**IMPORTANT:** The `production_date` must be within the page's default 30-day date range (today to today+30) for entries to be visible on the Production Schedule page.

```sql
INSERT INTO production_entries (id, panel_id, job_id, user_id, production_date, factory_id, status)
SELECT gen_random_uuid(), id, job_id, '<userId>', CURRENT_DATE + INTERVAL '14 days', '<factoryId>', 'COMPLETED'
FROM panel_register WHERE job_id = '<jobId>';
```

Verify:
```bash
curl "/api/production-schedule/stats"
# Should show completed: 10
curl "/api/production-schedule/days?startDate=<today>&endDate=<today+30>&factoryId=<factoryId>"
# Should show 1 day with 10 panels
```

### Stage 11: Create Reo Schedules

```sql
INSERT INTO reo_schedules (id, company_id, job_id, panel_id, status)
SELECT gen_random_uuid(), company_id, job_id, id, 'COMPLETED'
FROM panel_register WHERE job_id = '<jobId>';
```

### Stage 12: Complete Job Activities

```sql
UPDATE job_activities SET status = 'DONE' WHERE job_id = '<jobId>';
```

### Stage 13: Create Load List with Panels

```bash
# Create load list with complete data
curl -X POST /api/load-lists -d '{
  "jobId": "<jobId>",
  "loadNumber": "LOAD-001",
  "status": "COMPLETE"
}'
```

Then update with factory and date:
```sql
UPDATE load_lists SET 
  load_date = CURRENT_DATE + INTERVAL '14 days',
  load_time = '06:00',
  factory_id = '<factoryId>'
WHERE job_id = '<jobId>';
```

Add all panels:
```bash
curl -X POST /api/load-lists/<loadListId>/panels -d '{
  "panelIds": ["<panelId1>", "<panelId2>", ... ]
}'
```

Verify:
```sql
SELECT load_number, status, load_date, factory_id FROM load_lists WHERE job_id = '<jobId>';
SELECT COUNT(*) FROM load_list_panels WHERE load_list_id = '<loadListId>';
```

### Stage 14: Create Delivery Record (Delivery Confirmation)

Create a complete delivery record with truck details, times, and location data.

**IMPORTANT:** The delivery creation endpoint is on the load list, NOT a standalone route:

```bash
# Create delivery record via load list endpoint
curl -X POST /api/load-lists/<loadListId>/delivery -d '{
  "deliveryDate": "<delivery date>",
  "docketNumber": "DEL-2026-0001"
}'
```

Then populate all delivery fields via update:

```bash
# Update delivery record with full details
curl -X PUT /api/delivery-records/<deliveryRecordId> -d '{...}'
```

Or populate via SQL:
```sql
UPDATE delivery_records SET 
  docket_number = 'DEL-2026-0001',
  load_document_number = 'LD-001',
  truck_rego = 'ABC-123',
  trailer_rego = 'TRL-456',
  preload = 'Standard flatbed',
  load_number = 'LOAD-001',
  number_panels = 10,
  comment = 'Full delivery of all panels',
  start_time = '06:00',
  leave_depot_time = '06:30',
  arrive_lte_time = '07:00',
  pickup_location = '<Factory Name>',
  pickup_arrive_time = '07:15',
  pickup_leave_time = '08:00',
  delivery_location = '<Site Address>',
  arrive_holding_time = '09:00',
  leave_holding_time = '09:15',
  site_first_lift_time = '09:30',
  site_last_lift_time = '12:30',
  return_depot_arrive_time = '13:30',
  total_hours = '7.5'
WHERE load_list_id = '<loadListId>';
```

### Stage 15: Create Progress Claim

```bash
curl -X POST /api/progress-claims -d '{
  "jobId": "<jobId>",
  "claimNumber": "PC-001",
  "claimType": "PROGRESS",
  "status": "DRAFT"
}'
```

Then set financial values:
```sql
UPDATE progress_claims SET 
  subtotal = 450000,
  tax_rate = 10,
  tax_amount = 45000,
  total = 495000
WHERE job_id = '<jobId>';
```

## Verification Checklist

After completing all stages, run this comprehensive check:

```sql
-- Entity counts
SELECT 'panel_register' as entity, COUNT(*) as count FROM panel_register WHERE job_id = '<jobId>'
UNION ALL SELECT 'production_slots', COUNT(*) FROM production_slots WHERE job_id = '<jobId>'
UNION ALL SELECT 'drafting_program', COUNT(*) FROM drafting_program WHERE job_id = '<jobId>'
UNION ALL SELECT 'daily_logs', COUNT(*) FROM daily_logs WHERE user_id = '<userId>'
UNION ALL SELECT 'log_rows', COUNT(*) FROM log_rows WHERE daily_log_id IN (SELECT id FROM daily_logs WHERE user_id = '<userId>')
UNION ALL SELECT 'job_activities', COUNT(*) FROM job_activities WHERE job_id = '<jobId>'
UNION ALL SELECT 'production_entries', COUNT(*) FROM production_entries WHERE job_id = '<jobId>'
UNION ALL SELECT 'reo_schedules', COUNT(*) FROM reo_schedules WHERE job_id = '<jobId>'
UNION ALL SELECT 'load_lists', COUNT(*) FROM load_lists WHERE job_id = '<jobId>'
UNION ALL SELECT 'load_list_panels', COUNT(*) FROM load_list_panels WHERE load_list_id IN (SELECT id FROM load_lists WHERE job_id = '<jobId>')
UNION ALL SELECT 'delivery_records', COUNT(*) FROM delivery_records WHERE load_list_id IN (SELECT id FROM load_lists WHERE job_id = '<jobId>')
UNION ALL SELECT 'progress_claims', COUNT(*) FROM progress_claims WHERE job_id = '<jobId>';
```

Status verification:
```sql
SELECT 'drafting_program' as entity, status::text, COUNT(*) FROM drafting_program WHERE job_id = '<jobId>' GROUP BY status
UNION ALL SELECT 'daily_logs', status::text, COUNT(*) FROM daily_logs WHERE user_id = '<userId>' GROUP BY status
UNION ALL SELECT 'production_entries', status::text, COUNT(*) FROM production_entries WHERE job_id = '<jobId>' GROUP BY status
UNION ALL SELECT 'reo_schedules', status::text, COUNT(*) FROM reo_schedules WHERE job_id = '<jobId>' GROUP BY status
UNION ALL SELECT 'job_activities', status::text, COUNT(*) FROM job_activities WHERE job_id = '<jobId>' GROUP BY status;
```

Delivery record completeness:
```sql
SELECT docket_number, truck_rego, delivery_date, number_panels, total_hours, 
  delivery_location, site_first_lift_time, site_last_lift_time
FROM delivery_records WHERE load_list_id IN (SELECT id FROM load_lists WHERE job_id = '<jobId>');
```

Progress claim values:
```sql
SELECT claim_number, status, subtotal, tax_rate, tax_amount, total 
FROM progress_claims WHERE job_id = '<jobId>';
```

## Page-Level Verification

| Page | Route | Key API Endpoint | Expected Data |
|------|-------|------------------|---------------|
| Drafting Program | `/drafting-program` | `GET /api/drafting-program` | 10 entries, all COMPLETED |
| Drafting Register | `/daily-reports` | `GET /api/daily-logs?dateRange=week` | 2 daily logs (today+yesterday), APPROVED, 5 rows each |
| Production Schedule | `/production-schedule` | `GET /api/production-schedule/days?startDate=...&endDate=...` | 1 day with 10 panels within 30-day window |
| Production Report | `/production-report` | `GET /api/production-report` | Panels with production data |
| Production Slots | `/production-slots` | `GET /api/production-slots?jobId=...` | 2 slots (one per level) |
| Load Lists | `/load-lists` | `GET /api/load-lists?jobId=...` | 1 load list, COMPLETE status, 10 panels |
| Delivery Records | (within load list detail) | Linked from load list | Full delivery record with times and locations |
| Progress Claims | `/progress-claims` | `GET /api/progress-claims?jobId=...` | 1 claim, $495,000 total |

## Critical Notes

- **Daily log dates**: The Drafting Register page defaults to "This Week" date range. Daily log `log_day` values MUST be within the current week or they won't appear. Use `CURRENT_DATE` and `CURRENT_DATE - 1` when creating test data.
- **Production Schedule date range**: The page defaults to today + 30 days. Production entry `production_date` MUST fall within this range.
- **Production Schedule "Ready Panels"**: Only shows panels with `document_status` = IFC/APPROVED, `approved_for_production` = true, AND no existing production_entries. Once entries exist, panels appear in "Production Days Register".
- **Level matching is EXACT**: panel.level must equal slot.level exactly (e.g., "1" not "L1").
- **Factory filter cross-company bug**: User's default factory from one company can filter out data when viewing another company. Validate factory exists in current company before applying.
- **Job activity statuses**: Use enum `NOT_STARTED`, `IN_PROGRESS`, `STUCK`, `DONE`, `ON_HOLD`, `SKIPPED` (NOT "COMPLETED").
- **document_status is an enum**: Cast with `::text` in aggregate SQL queries.
- **daily_logs has no company_id**: Filter by `user_id` and optionally `factory_id`.
- **production_entries has no company_id**: Filter by `job_id`.
- **Delivery records**: The `delivery_records` table has extensive time tracking fields covering the full delivery journey from depot to site and back.
- **Progress claims**: Financial fields (`subtotal`, `tax_amount`, `total`) are numeric/decimal - set explicitly after creation.

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
