---
name: lifecycle-testing
description: Complete lifecycle testing workflow for BuildPlus AI panel management. Use when running end-to-end tests of the panel lifecycle from opportunity creation through delivery and claims.
---

# Panel Lifecycle Testing

Complete 13-stage lifecycle test for BuildPlus AI panel management system. This covers the full panel lifecycle from job type setup through opportunity creation, panel production, delivery, and progress claims.

## Prerequisites

- A company with at least one factory configured
- Admin credentials for the target company
- The company must have a job type with activity templates configured

## Test Data Reference (Salvo Property Group)

- Company ID: `b72c8e39-03b5-4181-bc63-d435b291d04b`
- Factory ID: `12e8f794-370f-4601-bc9e-1831c28bd624`
- Admin credentials: `admin@salvo.com.au` / `admin123`
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

Set production parameters on the job:

```sql
UPDATE jobs SET 
  production_start_date = '2026-03-01',
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
SELECT * FROM drafting_program WHERE job_id = '<jobId>';
```

### Stage 7b: Create Drafting Register Entries (Daily Logs)

The Drafting Register (at `/daily-reports`) shows daily time log entries for drafters working on panels. These must be created BEFORE panels are advanced to IFC status. Each entry represents time spent drafting a panel in Revit/AutoCAD.

```bash
# Create manual time entries for each panel (this auto-creates daily_logs)
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

# Submit and approve daily logs
curl -X POST /api/daily-logs/<logId>/submit
curl -X POST /api/daily-logs/<logId>/approve -d '{"approve": true, "comment": "Approved"}'
```

Also update the drafting program entries to COMPLETED:

```bash
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

### Stage 8: Instantiate Job Activities

```bash
curl -X POST /api/jobs/<jobId>/activities/instantiate
```

Creates activities from the job type's workflow templates. Verify:
```sql
SELECT name, status FROM job_activities WHERE job_id = '<jobId>' ORDER BY sort_order;
```

### Stage 9: Advance Panel Lifecycle

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

```sql
-- Advance all panels through lifecycle
UPDATE panel_register SET lifecycle_status = 11 WHERE job_id = '<jobId>';
```

### Stage 10: Create Production Entries

```sql
INSERT INTO production_entries (id, company_id, job_id, panel_id, factory_id, status, pour_date)
SELECT gen_random_uuid(), company_id, job_id, id, '<factoryId>', 'COMPLETED', '2026-03-15'
FROM panel_register WHERE job_id = '<jobId>';
```

### Stage 11: Create Reo Schedules

```sql
INSERT INTO reo_schedules (id, company_id, job_id, panel_id, status)
SELECT gen_random_uuid(), company_id, job_id, id, 'COMPLETED'
FROM panel_register WHERE job_id = '<jobId>';
```

### Stage 12: Create Load List & Delivery

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

### Stage 13: Create Progress Claim

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

After completing all stages, verify:

```sql
-- Should return counts for each entity
SELECT 'panel_register' as entity, COUNT(*) FROM panel_register WHERE job_id = '<jobId>'
UNION ALL SELECT 'production_entries', COUNT(*) FROM production_entries WHERE job_id = '<jobId>'
UNION ALL SELECT 'production_slots', COUNT(*) FROM production_slots WHERE job_id = '<jobId>'
UNION ALL SELECT 'drafting_program', COUNT(*) FROM drafting_program WHERE job_id = '<jobId>'
UNION ALL SELECT 'daily_logs', COUNT(*) FROM daily_logs WHERE user_id = '<userId>'
UNION ALL SELECT 'log_rows', COUNT(*) FROM log_rows WHERE daily_log_id IN (SELECT id FROM daily_logs WHERE user_id = '<userId>')
UNION ALL SELECT 'reo_schedules', COUNT(*) FROM reo_schedules WHERE job_id = '<jobId>'
UNION ALL SELECT 'job_activities', COUNT(*) FROM job_activities WHERE job_id = '<jobId>'
UNION ALL SELECT 'load_lists', COUNT(*) FROM load_lists WHERE job_id = '<jobId>'
UNION ALL SELECT 'progress_claims', COUNT(*) FROM progress_claims WHERE job_id = '<jobId>';
```

## Critical Notes

- **Level matching is EXACT**: panel.level must equal slot.level exactly (e.g., "1" not "L1")
- **Factory filter cross-company bug**: User's default factory from one company can filter out data when viewing another company. The fix validates factory exists in current company's factories list before applying default filter.
- **Production slots require**: productionStartDate (Date), factoryId (UUID), expectedCycleTimePerFloor (number), levels (comma-separated string matching panel levels)
- **Multi-company context**: Users can switch companies. Company isolation is enforced server-side via req.companyId.
- **API caching disabled**: Express ETag caching caused 304 responses with stale data. Cache-Control headers prevent this.

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
