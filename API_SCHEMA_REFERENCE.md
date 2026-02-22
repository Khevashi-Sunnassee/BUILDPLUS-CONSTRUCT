# BuildPlus AI - External API Schema Reference

This document lists all database table schemas relevant to the External API system.
Use this to unify field names with external applications.

All tables use **snake_case** column names in the database. The Drizzle ORM maps them
to **camelCase** in the TypeScript/JSON API responses.

---

## Enum Types

### role
Values: `USER`, `MANAGER`, `ADMIN`

### user_type
Values: `EMPLOYEE`, `EXTERNAL`

### job_status
Values: `ACTIVE`, `ON_HOLD`, `COMPLETED`, `ARCHIVED`, `OPPORTUNITY`, `QUOTING`, `WON`, `LOST`, `CANCELLED`, `CONTRACTED`, `IN_PROGRESS`, `PENDING_START`, `STARTED`, `DEFECT_LIABILITY_PERIOD`

### opportunity_status
Values: `NEW`, `CONTACTED`, `PROPOSAL_SENT`, `NEGOTIATING`, `WON`, `LOST`, `ON_HOLD`

### sales_stage
Values: `OPPORTUNITY`, `PRE_QUALIFICATION`, `ESTIMATING`, `SUBMITTED`, `AWARDED`, `LOST`

### opportunity_type
Values: `BUILDER_SELECTED`, `OPEN_TENDER`, `NEGOTIATED_CONTRACT`, `GENERAL_PRICING`

### panel_status
Values: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`, `PENDING`

### document_status (panel-level)
Values: `DRAFT`, `IFA`, `IFC`, `APPROVED`

### doc_mgmt_status (document register)
Values: `PRELIM`, `IFA`, `IFC`, `DRAFT`, `REVIEW`, `APPROVED`, `SUPERSEDED`, `ARCHIVED`

### australian_state
Values: `VIC`, `NSW`, `QLD`, `SA`, `WA`, `TAS`, `NT`, `ACT`

---

## Core Tables

### companies

| DB Column            | API Field (camelCase) | Type              | Nullable | Default        | Notes                     |
|----------------------|-----------------------|-------------------|----------|----------------|---------------------------|
| id                   | id                    | varchar(36)       | NO       | gen_random_uuid() | Primary key            |
| name                 | name                  | text              | NO       |                |                           |
| code                 | code                  | text              | NO       |                | Unique                    |
| logo_base64          | logoBase64            | text              | YES      |                |                           |
| address              | address               | text              | YES      |                |                           |
| phone                | phone                 | text              | YES      |                |                           |
| email                | email                 | text              | YES      |                |                           |
| website              | website               | text              | YES      |                |                           |
| abn                  | abn                   | text              | YES      |                | Australian Business Number|
| acn                  | acn                   | text              | YES      |                | Australian Company Number |
| ap_inbox_email       | apInboxEmail          | varchar(255)      | YES      |                |                           |
| tender_inbox_email   | tenderInboxEmail      | varchar(255)      | YES      |                |                           |
| drafting_inbox_email | draftingInboxEmail    | varchar(255)      | YES      |                |                           |
| is_active            | isActive              | boolean           | NO       | true           |                           |
| created_at           | createdAt             | timestamp         | NO       | now()          |                           |
| updated_at           | updatedAt             | timestamp         | NO       | now()          |                           |

---

### departments

| DB Column   | API Field  | Type        | Nullable | Default | Notes                              |
|-------------|------------|-------------|----------|---------|------------------------------------|
| id          | id         | varchar(36) | NO       | gen_random_uuid() | Primary key           |
| company_id  | companyId  | varchar(36) | NO       |         | FK → companies.id (cascade)        |
| name        | name       | text        | NO       |         |                                    |
| code        | code       | text        | NO       |         | Unique per company                 |
| description | description| text        | YES      |         |                                    |
| is_active   | isActive   | boolean     | NO       | true    |                                    |
| created_at  | createdAt  | timestamp   | NO       | now()   |                                    |
| updated_at  | updatedAt  | timestamp   | NO       | now()   |                                    |

---

### users

| DB Column              | API Field            | Type           | Nullable | Default    | Notes                              |
|------------------------|----------------------|----------------|----------|------------|------------------------------------|
| id                     | id                   | varchar(36)    | NO       | gen_random_uuid() | Primary key           |
| company_id             | companyId            | varchar(36)    | NO       |            | FK → companies.id (cascade)        |
| email                  | email                | text           | NO       |            | Unique per company                 |
| name                   | name                 | text           | YES      |            |                                    |
| phone                  | phone                | text           | YES      |            |                                    |
| address                | address              | text           | YES      |            |                                    |
| password_hash          | passwordHash         | text           | YES      |            | NOT exposed via API                |
| role                   | role                 | enum: role     | NO       | USER       | USER / MANAGER / ADMIN             |
| user_type              | userType             | enum: user_type| NO       | EMPLOYEE   | EMPLOYEE / EXTERNAL                |
| department_id          | departmentId         | varchar(36)    | YES      |            | FK → departments.id (set null)     |
| is_super_admin         | isSuperAdmin         | boolean        | NO       | false      |                                    |
| is_active              | isActive             | boolean        | NO       | true       |                                    |
| po_approver            | poApprover           | boolean        | YES      | false      |                                    |
| po_approval_limit      | poApprovalLimit      | decimal(12,2)  | YES      |            | >= 0                               |
| capex_approver         | capexApprover        | boolean        | YES      | false      |                                    |
| capex_approval_limit   | capexApprovalLimit   | decimal(12,2)  | YES      |            | >= 0                               |
| monday_start_time      | mondayStartTime      | text           | YES      | 08:00      |                                    |
| monday_hours           | mondayHours          | decimal(4,2)   | YES      | 8          | >= 0                               |
| tuesday_start_time     | tuesdayStartTime     | text           | YES      | 08:00      |                                    |
| tuesday_hours          | tuesdayHours         | decimal(4,2)   | YES      | 8          | >= 0                               |
| wednesday_start_time   | wednesdayStartTime   | text           | YES      | 08:00      |                                    |
| wednesday_hours        | wednesdayHours       | decimal(4,2)   | YES      | 8          | >= 0                               |
| thursday_start_time    | thursdayStartTime    | text           | YES      | 08:00      |                                    |
| thursday_hours         | thursdayHours        | decimal(4,2)   | YES      | 8          | >= 0                               |
| friday_start_time      | fridayStartTime      | text           | YES      | 08:00      |                                    |
| friday_hours           | fridayHours          | decimal(4,2)   | YES      | 8          | >= 0                               |
| saturday_start_time    | saturdayStartTime    | text           | YES      | 08:00      |                                    |
| saturday_hours         | saturdayHours        | decimal(4,2)   | YES      | 0          | >= 0                               |
| sunday_start_time      | sundayStartTime      | text           | YES      | 08:00      |                                    |
| sunday_hours           | sundayHours          | decimal(4,2)   | YES      | 0          | >= 0                               |
| selected_factory_ids   | selectedFactoryIds   | text[]         | YES      |            | Array of factory IDs               |
| default_factory_id     | defaultFactoryId     | varchar(36)    | YES      |            |                                    |
| created_at             | createdAt            | timestamp      | NO       | now()      |                                    |
| updated_at             | updatedAt            | timestamp      | NO       | now()      |                                    |

---

### factories

| DB Column        | API Field       | Type                    | Nullable | Default | Notes                       |
|------------------|-----------------|-------------------------|----------|---------|-----------------------------|
| id               | id              | varchar(36)             | NO       | gen_random_uuid() | Primary key      |
| company_id       | companyId       | varchar(36)             | NO       |         | FK → companies.id (cascade) |
| name             | name            | text                    | NO       |         |                             |
| code             | code            | text                    | NO       |         | Unique per company          |
| address          | address         | text                    | YES      |         |                             |
| street_address   | streetAddress   | text                    | YES      |         |                             |
| city             | city            | text                    | YES      |         |                             |
| postcode         | postcode        | text                    | YES      |         |                             |
| state            | state           | enum: australian_state  | NO       | VIC     |                             |
| latitude         | latitude        | decimal(10,7)           | YES      |         |                             |
| longitude        | longitude       | decimal(10,7)           | YES      |         |                             |
| inherit_work_days| inheritWorkDays | boolean                 | NO       | true    |                             |
| work_days        | workDays        | json (boolean[])        | YES      | [false,true,true,true,true,true,false] | Sun-Sat |
| color            | color           | text                    | YES      | #3B82F6 |                             |
| is_active        | isActive        | boolean                 | NO       | true    |                             |
| created_at       | createdAt       | timestamp               | NO       | now()   |                             |
| updated_at       | updatedAt       | timestamp               | NO       | now()   |                             |

---

### jobs

| DB Column                    | API Field                  | Type                       | Nullable | Default | Notes                              |
|------------------------------|----------------------------|----------------------------|----------|---------|------------------------------------|
| id                           | id                         | varchar(36)                | NO       | gen_random_uuid() | Primary key           |
| company_id                   | companyId                  | varchar(36)                | NO       |         | FK → companies.id (cascade)        |
| job_number                   | jobNumber                  | text                       | NO       |         | Unique per company                 |
| name                         | name                       | text                       | NO       |         |                                    |
| code                         | code                       | text                       | YES      |         |                                    |
| client                       | client                     | text                       | YES      |         |                                    |
| customer_id                  | customerId                 | varchar(36)                | YES      |         | FK → customers.id (set null)       |
| address                      | address                    | text                       | YES      |         |                                    |
| city                         | city                       | text                       | YES      |         |                                    |
| state                        | state                      | enum: australian_state     | YES      |         |                                    |
| site_contact                 | siteContact                | text                       | YES      |         |                                    |
| site_contact_phone           | siteContactPhone           | text                       | YES      |         |                                    |
| description                  | description                | text                       | YES      |         |                                    |
| crane_capacity               | craneCapacity              | text                       | YES      |         |                                    |
| number_of_buildings          | numberOfBuildings          | integer                    | YES      |         |                                    |
| levels                       | levels                     | text                       | YES      |         |                                    |
| lowest_level                 | lowestLevel                | text                       | YES      |         |                                    |
| highest_level                | highestLevel               | text                       | YES      |         |                                    |
| production_start_date        | productionStartDate        | timestamp                  | YES      |         |                                    |
| expected_cycle_time_per_floor| expectedCycleTimePerFloor  | integer                    | YES      |         |                                    |
| days_in_advance              | daysInAdvance              | integer                    | YES      | 7       |                                    |
| days_to_achieve_ifc          | daysToAchieveIfc           | integer                    | YES      |         |                                    |
| production_window_days       | productionWindowDays       | integer                    | YES      |         |                                    |
| production_days_in_advance   | productionDaysInAdvance    | integer                    | YES      |         |                                    |
| procurement_days_in_advance  | procurementDaysInAdvance   | integer                    | YES      |         |                                    |
| procurement_time_days        | procurementTimeDays        | integer                    | YES      |         |                                    |
| project_manager_id           | projectManagerId           | varchar(36)                | YES      |         | FK → users.id (set null)           |
| factory_id                   | factoryId                  | varchar(36)                | YES      |         | FK → factories.id (cascade)        |
| production_slot_color        | productionSlotColor        | text                       | YES      |         |                                    |
| job_phase                    | jobPhase                   | integer                    | NO       | 0       | 0-4 (lifecycle phase)              |
| status                       | status                     | enum: job_status           | NO       | ACTIVE  |                                    |
| referrer                     | referrer                   | text                       | YES      |         |                                    |
| engineer_on_job              | engineerOnJob              | text                       | YES      |         |                                    |
| estimated_value              | estimatedValue             | decimal(12,2)              | YES      |         | >= 0                               |
| number_of_levels             | numberOfLevels             | integer                    | YES      |         |                                    |
| opportunity_status           | opportunityStatus          | enum: opportunity_status   | YES      |         |                                    |
| sales_stage                  | salesStage                 | enum: sales_stage          | YES      |         |                                    |
| sales_status                 | salesStatus                | text                       | YES      |         |                                    |
| opportunity_type             | opportunityType            | enum: opportunity_type     | YES      |         |                                    |
| primary_contact              | primaryContact             | text                       | YES      |         |                                    |
| probability                  | probability                | integer                    | YES      |         |                                    |
| estimated_start_date         | estimatedStartDate         | timestamp                  | YES      |         |                                    |
| submission_date              | submissionDate             | timestamp                  | YES      |         |                                    |
| comments                     | comments                   | text                       | YES      |         |                                    |
| job_type_id                  | jobTypeId                  | varchar(36)                | YES      |         | FK → job_types.id                  |
| defect_liability_end_date    | defectLiabilityEndDate     | timestamp                  | YES      |         |                                    |
| created_at                   | createdAt                  | timestamp                  | NO       | now()   |                                    |
| updated_at                   | updatedAt                  | timestamp                  | NO       | now()   |                                    |

---

### job_types

| DB Column         | API Field        | Type        | Nullable | Default | Notes                       |
|-------------------|------------------|-------------|----------|---------|-----------------------------|
| id                | id               | varchar(36) | NO       | gen_random_uuid() | Primary key      |
| company_id        | companyId        | varchar(36) | NO       |         | FK → companies.id (cascade) |
| name              | name             | text        | NO       |         | Unique per company          |
| description       | description      | text        | YES      |         |                             |
| is_active         | isActive         | boolean     | NO       | true    |                             |
| is_system_default | isSystemDefault  | boolean     | NO       | false   |                             |
| sort_order        | sortOrder        | integer     | NO       | 0       |                             |
| created_at        | createdAt        | timestamp   | NO       | now()   |                             |
| updated_at        | updatedAt        | timestamp   | NO       | now()   |                             |

---

### cost_codes

| DB Column         | API Field        | Type        | Nullable | Default | Notes                              |
|-------------------|------------------|-------------|----------|---------|------------------------------------|
| id                | id               | varchar(36) | NO       | gen_random_uuid() | Primary key           |
| company_id        | companyId        | varchar(36) | NO       |         | FK → companies.id (cascade)        |
| code              | code             | text        | NO       |         | Unique per company                 |
| name              | name             | text        | NO       |         |                                    |
| description       | description      | text        | YES      |         |                                    |
| parent_id         | parentId         | varchar(36) | YES      |         | Self-referencing parent code       |
| is_active         | isActive         | boolean     | NO       | true    |                                    |
| is_system_default | isSystemDefault  | boolean     | NO       | false   |                                    |
| sort_order        | sortOrder        | integer     | NO       | 0       |                                    |
| created_at        | createdAt        | timestamp   | NO       | now()   |                                    |
| updated_at        | updatedAt        | timestamp   | NO       | now()   |                                    |

---

### child_cost_codes

| DB Column           | API Field          | Type        | Nullable | Default | Notes                              |
|---------------------|--------------------|-------------|----------|---------|------------------------------------|
| id                  | id                 | varchar(36) | NO       | gen_random_uuid() | Primary key           |
| company_id          | companyId          | varchar(36) | NO       |         | FK → companies.id (cascade)        |
| parent_cost_code_id | parentCostCodeId   | varchar(36) | NO       |         | FK → cost_codes.id (cascade)       |
| code                | code               | text        | NO       |         | Unique per company                 |
| name                | name               | text        | NO       |         |                                    |
| description         | description        | text        | YES      |         |                                    |
| is_active           | isActive           | boolean     | NO       | true    |                                    |
| is_system_default   | isSystemDefault    | boolean     | NO       | false   |                                    |
| sort_order          | sortOrder          | integer     | NO       | 0       |                                    |
| created_at          | createdAt          | timestamp   | NO       | now()   |                                    |
| updated_at          | updatedAt          | timestamp   | NO       | now()   |                                    |

---

### customers

| DB Column      | API Field     | Type        | Nullable | Default   | Notes                       |
|----------------|---------------|-------------|----------|-----------|-----------------------------|
| id             | id            | varchar(36) | NO       | gen_random_uuid() | Primary key      |
| company_id     | companyId     | varchar(36) | NO       |           | FK → companies.id (cascade) |
| name           | name          | text        | NO       |           |                             |
| key_contact    | keyContact    | text        | YES      |           |                             |
| email          | email         | text        | YES      |           |                             |
| phone          | phone         | text        | YES      |           |                             |
| abn            | abn           | text        | YES      |           |                             |
| acn            | acn           | text        | YES      |           |                             |
| address_line1  | addressLine1  | text        | YES      |           |                             |
| address_line2  | addressLine2  | text        | YES      |           |                             |
| city           | city          | text        | YES      |           |                             |
| state          | state         | text        | YES      |           |                             |
| postcode       | postcode      | text        | YES      |           |                             |
| country        | country       | text        | YES      | Australia |                             |
| payment_terms  | paymentTerms  | text        | YES      |           |                             |
| notes          | notes         | text        | YES      |           |                             |
| is_active      | isActive      | boolean     | NO       | true      |                             |
| website        | website       | text        | YES      |           |                             |
| created_at     | createdAt     | timestamp   | NO       | now()     |                             |
| updated_at     | updatedAt     | timestamp   | NO       | now()     |                             |

---

### suppliers

| DB Column            | API Field           | Type        | Nullable | Default   | Notes                       |
|----------------------|---------------------|-------------|----------|-----------|-----------------------------|
| id                   | id                  | varchar(36) | NO       | gen_random_uuid() | Primary key      |
| company_id           | companyId           | varchar(36) | NO       |           | FK → companies.id (cascade) |
| name                 | name                | text        | NO       |           |                             |
| key_contact          | keyContact          | text        | YES      |           |                             |
| email                | email               | text        | YES      |           |                             |
| phone                | phone               | text        | YES      |           |                             |
| abn                  | abn                 | text        | YES      |           |                             |
| acn                  | acn                 | text        | YES      |           |                             |
| address_line1        | addressLine1        | text        | YES      |           |                             |
| address_line2        | addressLine2        | text        | YES      |           |                             |
| city                 | city                | text        | YES      |           |                             |
| state                | state               | text        | YES      |           |                             |
| postcode             | postcode            | text        | YES      |           |                             |
| country              | country             | text        | YES      | Australia |                             |
| payment_terms        | paymentTerms        | text        | YES      |           |                             |
| notes                | notes               | text        | YES      |           |                             |
| default_cost_code_id | defaultCostCodeId   | varchar(36) | YES      |           |                             |
| is_active            | isActive            | boolean     | NO       | true      |                             |
| is_equipment_hire    | isEquipmentHire     | boolean     | NO       | false     |                             |
| available_for_tender | availableForTender  | boolean     | NO       | false     |                             |
| created_at           | createdAt           | timestamp   | NO       | now()     |                             |
| updated_at           | updatedAt           | timestamp   | NO       | now()     |                             |

---

## Document Management Tables

### documents

| DB Column                | API Field             | Type                    | Nullable | Default | Notes                              |
|--------------------------|-----------------------|-------------------------|----------|---------|------------------------------------|
| id                       | id                    | varchar(36)             | NO       | gen_random_uuid() | Primary key           |
| company_id               | companyId             | varchar(36)             | NO       |         | FK → companies.id (cascade)        |
| document_number          | documentNumber        | varchar(50)             | YES      |         |                                    |
| title                    | title                 | text                    | NO       |         |                                    |
| description              | description           | text                    | YES      |         |                                    |
| file_name                | fileName              | text                    | NO       |         |                                    |
| original_name            | originalName          | text                    | NO       |         |                                    |
| mime_type                | mimeType              | varchar(100)            | NO       |         |                                    |
| file_size                | fileSize              | integer                 | NO       |         | Bytes                              |
| storage_key              | storageKey            | text                    | NO       |         |                                    |
| file_sha256              | fileSha256            | varchar(64)             | YES      |         | SHA-256 hash of file content       |
| type_id                  | typeId                | varchar(36)             | YES      |         | FK → document_types_config.id      |
| discipline_id            | disciplineId          | varchar(36)             | YES      |         | FK → document_disciplines.id       |
| category_id              | categoryId            | varchar(36)             | YES      |         | FK → document_categories.id        |
| tags                     | tags                  | text                    | YES      |         |                                    |
| status                   | status                | enum: doc_mgmt_status   | NO       | DRAFT   |                                    |
| document_type_status_id  | documentTypeStatusId  | varchar(36)             | YES      |         | FK → document_type_statuses.id     |
| version                  | version               | varchar(10)             | NO       | 1.0     |                                    |
| revision                 | revision              | varchar(5)              | NO       | A       |                                    |
| is_latest_version        | isLatestVersion       | boolean                 | NO       | true    |                                    |
| parent_document_id       | parentDocumentId      | varchar(36)             | YES      |         | Previous version document ID       |
| change_summary           | changeSummary         | text                    | YES      |         |                                    |
| job_id                   | jobId                 | varchar(36)             | YES      |         | FK → jobs.id (cascade)             |
| panel_id                 | panelId               | varchar(36)             | YES      |         | FK → panel_register.id (cascade)   |
| supplier_id              | supplierId            | varchar(36)             | YES      |         | FK → suppliers.id (set null)       |
| purchase_order_id        | purchaseOrderId       | varchar(36)             | YES      |         | FK → purchase_orders.id (set null) |
| task_id                  | taskId                | varchar(36)             | YES      |         | FK → tasks.id (cascade)            |
| conversation_id          | conversationId        | varchar(36)             | YES      |         | FK → conversations.id (cascade)    |
| message_id               | messageId             | varchar(36)             | YES      |         | FK → chat_messages.id (cascade)    |
| uploaded_by              | uploadedBy            | varchar(36)             | NO       |         | FK → users.id (cascade)            |
| approved_by              | approvedBy            | varchar(36)             | YES      |         | FK → users.id (set null)           |
| approved_at              | approvedAt            | timestamp               | YES      |         |                                    |
| is_confidential          | isConfidential        | boolean                 | YES      | false   |                                    |
| kb_document_id           | kbDocumentId          | varchar(36)             | YES      |         | Knowledge Base document link       |
| created_at               | createdAt             | timestamp               | NO       | now()   |                                    |
| updated_at               | updatedAt             | timestamp               | NO       | now()   |                                    |

---

## Panel Management Tables

### panel_register

| DB Column                  | API Field                | Type                    | Nullable | Default     | Notes                              |
|----------------------------|--------------------------|-------------------------|----------|-------------|------------------------------------|
| id                         | id                       | varchar(36)             | NO       | gen_random_uuid() | Primary key           |
| job_id                     | jobId                    | varchar(36)             | NO       |             | FK → jobs.id (cascade)             |
| panel_mark                 | panelMark                | text                    | NO       |             | Unique per job                     |
| panel_type                 | panelType                | text                    | NO       | WALL        |                                    |
| description                | description              | text                    | YES      |             |                                    |
| drawing_code               | drawingCode              | text                    | YES      |             |                                    |
| sheet_number               | sheetNumber              | text                    | YES      |             |                                    |
| building                   | building                 | text                    | YES      |             |                                    |
| zone                       | zone                     | text                    | YES      |             |                                    |
| level                      | level                    | text                    | YES      |             |                                    |
| structural_elevation       | structuralElevation      | text                    | YES      |             |                                    |
| reckli_detail              | reckliDetail             | text                    | YES      |             |                                    |
| qty                        | qty                      | integer                 | NO       | 1           |                                    |
| work_type_id               | workTypeId               | integer                 | YES      | 1           | FK → work_types.id                 |
| takeoff_category           | takeoffCategory          | text                    | YES      |             |                                    |
| concrete_strength_mpa      | concreteStrengthMpa      | text                    | YES      |             |                                    |
| source_file_name           | sourceFileName           | text                    | YES      |             |                                    |
| source_sheet               | sourceSheet              | text                    | YES      |             |                                    |
| source_row                 | sourceRow                | integer                 | YES      |             |                                    |
| panel_source_id            | panelSourceId            | text                    | YES      |             |                                    |
| source                     | source                   | integer                 | NO       | 1           | 1=Manual, 2=Excel, 3=Estimate      |
| status                     | status                   | enum: panel_status      | NO       | NOT_STARTED |                                    |
| document_status            | documentStatus           | enum: document_status   | NO       | DRAFT       |                                    |
| estimated_hours            | estimatedHours           | integer                 | YES      |             | >= 0                               |
| actual_hours               | actualHours              | integer                 | YES      | 0           | >= 0                               |
| notes                      | notes                    | text                    | YES      |             |                                    |
| fire_rate                  | fireRate                 | decimal(14,2)           | YES      |             |                                    |
| caulking_fire              | caulkingFire             | text                    | YES      |             |                                    |
| num_rebates                | numRebates               | integer                 | YES      |             |                                    |
| openings                   | openings                 | text                    | YES      |             |                                    |
| net_weight                 | netWeight                | decimal(14,2)           | YES      |             | >= 0                               |
| gross_area                 | grossArea                | decimal(14,2)           | YES      |             | >= 0                               |
| crane_capacity_weight      | craneCapacityWeight      | decimal(14,2)           | YES      |             | >= 0                               |
| crane_check                | craneCheck               | text                    | YES      |             |                                    |
| grout_table_manual         | groutTableManual         | text                    | YES      |             |                                    |
| grout_to_use               | groutToUse               | text                    | YES      |             |                                    |
| grout_strength             | groutStrength            | text                    | YES      |             |                                    |
| vertical_reo_qty           | verticalReoQty           | text                    | YES      |             |                                    |
| vertical_reo_type          | verticalReoType          | text                    | YES      |             |                                    |
| horizontal_reo_qty         | horizontalReoQty         | text                    | YES      |             |                                    |
| horizontal_reo_type        | horizontalReoType        | text                    | YES      |             |                                    |
| mesh_qty                   | meshQty                  | text                    | YES      |             |                                    |
| mesh_type                  | meshType                 | text                    | YES      |             |                                    |
| fitments_reo_qty           | fitmentsReoQty           | text                    | YES      |             |                                    |
| fitments_reo_type          | fitmentsReoType          | text                    | YES      |             |                                    |
| u_bars_qty                 | uBarsQty                 | text                    | YES      |             |                                    |
| u_bars_type                | uBarsType                | text                    | YES      |             |                                    |
| ligs_qty                   | ligsQty                  | text                    | YES      |             |                                    |
| ligs_type                  | ligsType                 | text                    | YES      |             |                                    |
| blockout_bars_qty          | blockoutBarsQty          | text                    | YES      |             |                                    |
| blockout_bars_type         | blockoutBarsType         | text                    | YES      |             |                                    |
| additional_reo_qty_1       | additionalReoQty1        | text                    | YES      |             |                                    |
| additional_reo_type_1      | additionalReoType1       | text                    | YES      |             |                                    |
| additional_reo_qty_2       | additionalReoQty2        | text                    | YES      |             |                                    |
| additional_reo_type_2      | additionalReoType2       | text                    | YES      |             |                                    |
| additional_reo_qty_3       | additionalReoQty3        | text                    | YES      |             |                                    |
| additional_reo_type_3      | additionalReoType3       | text                    | YES      |             |                                    |
| additional_reo_qty_4       | additionalReoQty4        | text                    | YES      |             |                                    |
| additional_reo_type_4      | additionalReoType4       | text                    | YES      |             |                                    |
| top_fixing_qty             | topFixingQty             | text                    | YES      |             |                                    |
| top_fixing_type            | topFixingType            | text                    | YES      |             |                                    |
| trimmer_bars_qty           | trimmerBarsQty           | text                    | YES      |             |                                    |
| trimmer_bars_type          | trimmerBarsType          | text                    | YES      |             |                                    |
| ligs_reo_qty               | ligsReoQty               | text                    | YES      |             |                                    |
| ligs_reo_type              | ligsReoType              | text                    | YES      |             |                                    |
| additional_reo_type        | additionalReoType        | text                    | YES      |             |                                    |
| tie_reinforcement          | tieReinforcement         | text                    | YES      |             |                                    |
| additional_reo_qty         | additionalReoQty         | text                    | YES      |             |                                    |
| additional_reo_frl_type    | additionalReoFrlType     | text                    | YES      |             |                                    |
| grout_tubes_bottom_qty     | groutTubesBottomQty      | text                    | YES      |             |                                    |
| grout_tubes_bottom_type    | groutTubesBottomType     | text                    | YES      |             |                                    |
| grout_tubes_top_qty        | groutTubesTopQty         | text                    | YES      |             |                                    |
| grout_tubes_top_type       | groutTubesTopType        | text                    | YES      |             |                                    |
| ferrules_qty               | ferrulesQty              | text                    | YES      |             |                                    |
| ferrules_type              | ferrulesType             | text                    | YES      |             |                                    |
| fitments_qty_2             | fitmentsQty2             | text                    | YES      |             |                                    |
| fitments_type_2            | fitmentsType2            | text                    | YES      |             |                                    |
| fitments_qty_3             | fitmentsQty3             | text                    | YES      |             |                                    |
| fitments_type_3            | fitmentsType3            | text                    | YES      |             |                                    |
| fitments_qty_4             | fitmentsQty4             | text                    | YES      |             |                                    |
| fitments_type_4            | fitmentsType4            | text                    | YES      |             |                                    |
| plates_qty                 | platesQty                | text                    | YES      |             |                                    |
| plates_type                | platesType               | text                    | YES      |             |                                    |
| plates_qty_2               | platesQty2               | text                    | YES      |             |                                    |
| plates_type_2              | platesType2              | text                    | YES      |             |                                    |
| plates_qty_3               | platesQty3               | text                    | YES      |             |                                    |
| plates_type_3              | platesType3              | text                    | YES      |             |                                    |
| plates_qty_4               | platesQty4               | text                    | YES      |             |                                    |
| plates_type_4              | platesType4              | text                    | YES      |             |                                    |
| dowel_bars_length          | dowelBarsLength          | text                    | YES      |             | Typical dowel bars                 |
| dowel_bars_qty             | dowelBarsQty             | text                    | YES      |             |                                    |
| dowel_bars_type            | dowelBarsType            | text                    | YES      |             |                                    |
| dowel_bars_length_2        | dowelBarsLength2         | text                    | YES      |             | End dowel bars                     |
| dowel_bars_qty_2           | dowelBarsQty2            | text                    | YES      |             |                                    |
| dowel_bars_type_2          | dowelBarsType2           | text                    | YES      |             |                                    |
| lifter_qty_a               | lifterQtyA               | text                    | YES      |             |                                    |
| lifters_type               | liftersType              | text                    | YES      |             |                                    |
| lifter_qty_b               | lifterQtyB               | text                    | YES      |             |                                    |
| safety_lifters_type        | safetyLiftersType        | text                    | YES      |             |                                    |
| lifter_qty_c               | lifterQtyC               | text                    | YES      |             |                                    |
| face_lifters_type          | faceLiftersType          | text                    | YES      |             |                                    |
| inserts_qty_d              | insertsQtyD              | text                    | YES      |             |                                    |
| insert_type_d              | insertTypeD              | text                    | YES      |             |                                    |
| unit_check                 | unitCheck                | text                    | YES      |             |                                    |
| order                      | order                    | text                    | YES      |             |                                    |
| horizontal_reo_text        | horizontalReoText        | text                    | YES      |             |                                    |
| horizontal_reo_at          | horizontalReoAt          | text                    | YES      |             |                                    |
| reo_r6                     | reoR6                    | text                    | YES      |             | Reo bar count                      |
| reo_n10                    | reoN10                   | text                    | YES      |             |                                    |
| reo_n12                    | reoN12                   | text                    | YES      |             |                                    |
| reo_n16                    | reoN16                   | text                    | YES      |             |                                    |
| reo_n20                    | reoN20                   | text                    | YES      |             |                                    |
| reo_n24                    | reoN24                   | text                    | YES      |             |                                    |
| reo_n28                    | reoN28                   | text                    | YES      |             |                                    |
| reo_n32                    | reoN32                   | text                    | YES      |             |                                    |
| mesh_sl82                  | meshSl82                 | text                    | YES      |             | Mesh count                         |
| mesh_sl92                  | meshSl92                 | text                    | YES      |             |                                    |
| mesh_sl102                 | meshSl102                | text                    | YES      |             |                                    |
| dowel_n20                  | dowelN20                 | text                    | YES      |             | Dowel bar count                    |
| dowel_n24                  | dowelN24                 | text                    | YES      |             |                                    |
| dowel_n28                  | dowelN28                 | text                    | YES      |             |                                    |
| dowel_n32                  | dowelN32                 | text                    | YES      |             |                                    |
| dowel_n36                  | dowelN36                 | text                    | YES      |             |                                    |
| reo_tons                   | reoTons                  | text                    | YES      |             |                                    |
| dowels_tons                | dowelsTons               | text                    | YES      |             |                                    |
| total_reo                  | totalReo                 | text                    | YES      |             |                                    |
| total_kg_m3                | totalKgM3                | text                    | YES      |             |                                    |
| contract                   | contract                 | text                    | YES      |             |                                    |
| reo_contract               | reoContract              | text                    | YES      |             |                                    |
| load_width                 | loadWidth                | text                    | YES      |             |                                    |
| load_height                | loadHeight               | text                    | YES      |             |                                    |
| panel_thickness            | panelThickness           | text                    | YES      |             |                                    |
| panel_volume               | panelVolume              | text                    | YES      |             |                                    |
| panel_mass                 | panelMass                | text                    | YES      |             |                                    |
| panel_area                 | panelArea                | decimal(14,2)           | YES      |             | >= 0                               |
| day_28_fc                  | day28Fc                  | text                    | YES      |             |                                    |
| lift_fcm                   | liftFcm                  | text                    | YES      |             |                                    |
| rotational_lifters         | rotationalLifters        | text                    | YES      |             |                                    |
| primary_lifters            | primaryLifters           | text                    | YES      |             |                                    |
| production_pdf_url         | productionPdfUrl         | text                    | YES      |             |                                    |
| approved_for_production    | approvedForProduction    | boolean                 | NO       | false       |                                    |
| approved_at                | approvedAt               | timestamp               | YES      |             |                                    |
| approved_by_id             | approvedById             | varchar(36)             | YES      |             | FK → users.id (set null)           |
| lifecycle_status           | lifecycleStatus          | integer                 | NO       | 0           | 0-13 lifecycle stage               |
| consolidated_into_panel_id | consolidatedIntoPanelId  | varchar(36)             | YES      |             |                                    |
| created_at                 | createdAt                | timestamp               | NO       | now()       |                                    |
| updated_at                 | updatedAt                | timestamp               | NO       | now()       |                                    |

---

## External API Tables

### external_api_keys

| DB Column     | API Field    | Type        | Nullable | Default | Notes                              |
|---------------|--------------|-------------|----------|---------|------------------------------------|
| id            | id           | varchar(36) | NO       | gen_random_uuid() | Primary key           |
| company_id    | companyId    | varchar(36) | NO       |         | FK → companies.id (cascade)        |
| name          | name         | text        | NO       |         | Descriptive name for the key       |
| key_hash      | keyHash      | text        | NO       |         | SHA-256 hash (raw key never stored)|
| key_prefix    | keyPrefix    | varchar(12) | NO       |         | First chars for identification     |
| permissions   | permissions  | jsonb       | NO       | []      | Array of permission strings        |
| is_active     | isActive     | boolean     | NO       | true    |                                    |
| last_used_at  | lastUsedAt   | timestamp   | YES      |         |                                    |
| created_by_id | createdById  | varchar(36) | NO       |         | FK → users.id (cascade)            |
| expires_at    | expiresAt    | timestamp   | YES      |         |                                    |
| created_at    | createdAt    | timestamp   | NO       | now()   |                                    |
| updated_at    | updatedAt    | timestamp   | NO       | now()   |                                    |

**Available Permission Values:**
- `*` — Full access to all endpoints
- `read:jobs` — Read job data
- `read:cost-codes` — Read cost code data
- `read:documents` — Read document data
- `read:job-types` — Read job type data
- `read:company` — Read company info
- `write:markups` — Write markup data
- `write:estimates` — Write estimate data

---

### external_api_logs

| DB Column        | API Field       | Type        | Nullable | Default | Notes                              |
|------------------|-----------------|-------------|----------|---------|------------------------------------|
| id               | id              | varchar(36) | NO       | gen_random_uuid() | Primary key           |
| company_id       | companyId       | varchar(36) | NO       |         | FK → companies.id (cascade)        |
| api_key_id       | apiKeyId        | varchar(36) | NO       |         | FK → external_api_keys.id (cascade)|
| method           | method          | varchar(10) | NO       |         | HTTP method (GET, POST, etc.)      |
| path             | path            | text        | NO       |         | API endpoint path                  |
| status_code      | statusCode      | integer     | NO       |         | HTTP response status code          |
| response_time_ms | responseTimeMs  | integer     | YES      |         | Response time in milliseconds      |
| ip_address       | ipAddress       | varchar(45) | YES      |         | Client IP address                  |
| user_agent       | userAgent       | text        | YES      |         | Client user agent string           |
| created_at       | createdAt       | timestamp   | NO       | now()   |                                    |

---

## Authentication

External API requests authenticate via one of these headers:
- `Authorization: Bearer bp_<key>`
- `X-API-Key: bp_<key>`

All API keys are prefixed with `bp_` and contain 64 hex characters after the prefix.

---

## Field Name Mapping Summary

The API uses **camelCase** in JSON responses. The database uses **snake_case**.
Common patterns:

| Pattern           | DB (snake_case)       | API (camelCase)      |
|-------------------|-----------------------|----------------------|
| Primary key       | id                    | id                   |
| Company ref       | company_id            | companyId            |
| Foreign key       | *_id                  | *Id                  |
| Active flag       | is_active             | isActive             |
| Created timestamp | created_at            | createdAt            |
| Updated timestamp | updated_at            | updatedAt            |
| Boolean flag      | is_*                  | is*                  |

---

## Notes for External Integration

1. All IDs are UUID v4 strings (36 characters including hyphens).
2. Timestamps are ISO 8601 format in API responses.
3. Decimal fields are returned as strings in JSON to preserve precision.
4. Array fields (like `selectedFactoryIds`) are returned as JSON arrays.
5. All data is scoped to a company via `companyId` — the API key determines which company's data is accessible.
6. The `passwordHash` field on users is never exposed through the API.
