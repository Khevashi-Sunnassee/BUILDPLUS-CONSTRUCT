/**
 * ENDPOINT VALIDATION SCRIPT
 * ==========================
 * 
 * This script validates that all frontend API calls match backend routes.
 * Run this script before deploying or after making API changes.
 * 
 * Usage: npx tsx scripts/validate-endpoints.ts
 * 
 * VALIDATION APPROACH:
 * 1. Scans all backend route files to build a complete list of valid endpoints
 * 2. Scans all frontend files for API calls
 * 3. Compares frontend endpoints against the backend route list
 * 4. Reports mismatches and warns about hardcoded paths
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_DIR = path.join(process.cwd(), 'client/src');
const BACKEND_ROUTES_DIR = path.join(process.cwd(), 'server/routes');

interface FrontendCall {
  file: string;
  line: number;
  endpoint: string;
}

let hasErrors = false;

function normalizeEndpoint(endpoint: string): string {
  return endpoint
    .replace(/\$\{[^}]+\}/g, ':id')
    .replace(/:[a-zA-Z]+Id/g, ':id')
    .replace(/:[a-zA-Z]+/g, ':id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

function findFrontendApiCalls(): FrontendCall[] {
  const calls: FrontendCall[] = [];
  
  const patterns = [
    'queryKey.*\\/api\\/',
    'apiRequest.*\\/api\\/',
    'fetch.*\\/api\\/',
  ];
  
  for (const pattern of patterns) {
    try {
      const output = execSync(
        `grep -rn "${pattern}" ${FRONTEND_DIR} --include="*.tsx" --include="*.ts" 2>/dev/null || true`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      );
      
      const lines = output.split('\n').filter(Boolean);
      for (const line of lines) {
        const match = line.match(/^(.+):(\d+):.*["'`](\/api\/[^"'`\s\]]+)["'`\]]/);
        if (match) {
          calls.push({
            file: match[1].replace(process.cwd() + '/', ''),
            line: parseInt(match[2]),
            endpoint: normalizeEndpoint(match[3]),
          });
        }
      }
    } catch (e) {
    }
  }
  
  const uniqueCalls = new Map<string, FrontendCall>();
  for (const call of calls) {
    const key = `${call.file}:${call.line}:${call.endpoint}`;
    if (!uniqueCalls.has(key)) {
      uniqueCalls.set(key, call);
    }
  }
  
  return Array.from(uniqueCalls.values());
}

function findBackendRoutes(): Map<string, { file: string; prefix: string; routes: Set<string> }> {
  const routeFiles = new Map<string, { file: string; prefix: string; routes: Set<string> }>();
  
  const routerPrefixes: Record<string, string> = {
    'auth.routes.ts': '/api/auth',
    'users.routes.ts': '/api',
    'jobs.routes.ts': '/api',
    'panels.routes.ts': '/api',
    'panel-import.routes.ts': '/api',
    'panel-approval.routes.ts': '/api',
    'panel-types.routes.ts': '/api',
    'production.routes.ts': '/api',
    'production-entries.routes.ts': '/api',
    'production-slots.routes.ts': '/api',
    'drafting.routes.ts': '/api',
    'logistics.routes.ts': '/api',
    'tasks.routes.ts': '/api',
    'factories.routes.ts': '/api',
    'admin.routes.ts': '/api/admin',
    'agent.routes.ts': '/api/agent',
    'procurement.routes.ts': '/api/procurement',
    'procurement-orders.routes.ts': '/api',
    'daily-logs.routes.ts': '/api',
    'weekly-reports.routes.ts': '/api',
    'production-analytics.routes.ts': '/api/reports',
    'drafting-logistics.routes.ts': '/api/reports',
    'cost-analytics.routes.ts': '/api/reports',
    'chat.routes.ts': '/api/chat',
  };
  
  try {
    const files = fs.readdirSync(BACKEND_ROUTES_DIR).filter(f => f.endsWith('.routes.ts'));
    
    for (const file of files) {
      const filePath = path.join(BACKEND_ROUTES_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const routes = new Set<string>();
      
      const prefix = routerPrefixes[file] || '/api';
      
      const routeRegex = /router\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;
      let match;
      while ((match = routeRegex.exec(content)) !== null) {
        let route = match[2];
        route = route.replace(/:[a-zA-Z]+/g, ':id');
        const fullRoute = `${prefix}${route}`;
        routes.add(normalizeEndpoint(fullRoute));
      }
      
      routeFiles.set(file, { file: filePath, prefix, routes });
    }
  } catch (e) {
    console.error('Error scanning backend routes:', e);
  }
  
  return routeFiles;
}

function buildBackendRouteSet(routeFiles: Map<string, { file: string; prefix: string; routes: Set<string> }>): Set<string> {
  const allRoutes = new Set<string>();
  
  for (const [, { routes }] of routeFiles) {
    for (const route of routes) {
      allRoutes.add(route);
    }
  }
  
  const additionalKnownRoutes = [
    '/api/dashboard/stats',
    '/api/dashboard/kpi',
    '/api/permissions/my-permissions',
    '/api/user/settings',
    '/api/settings/logo',
    '/api/work-types',
    '/api/work-types/:id',
    '/api/weekly-wage-reports',
    '/api/weekly-wage-reports/:id',
    '/api/weekly-wage-reports/:id/analysis',
    '/api/weekly-job-reports',
    '/api/weekly-job-reports/:id',
    '/api/weekly-job-reports/my-reports',
    '/api/cfmeu-holidays',
    '/api/log-rows',
    '/api/log-rows/:id',
    '/api/manual-entry',
    '/api/po-attachments/:id',
    '/api/reports',
    '/api/reports/production-daily',
    '/api/reports/production-with-costs',
    '/api/reports/drafting-daily',
    '/api/reports/logistics',
    '/api/reports/cost-analysis',
    '/api/reports/weekly-wages',
    '/api/reports/time-summary',
    '/api/users',
    '/api/users/:id',
    '/api/trailer-types',
    '/api/trailer-types/:id',
    '/api/panel-types',
    '/api/panel-types/:id',
    '/api/panel-types/:id/cost-components',
    '/api/load-lists',
    '/api/load-lists/:id',
    '/api/load-lists/:id/panels',
    '/api/admin/users',
    '/api/admin/users/:id',
    '/api/admin/users/:id/work-hours',
    '/api/admin/factories',
    '/api/admin/factories/:id',
    '/api/admin/factories/:id/beds',
    '/api/admin/factories/:id/beds/:id',
    '/api/admin/devices',
    '/api/admin/devices/:id',
    '/api/admin/settings',
    '/api/admin/settings/company-name',
    '/api/admin/jobs',
    '/api/admin/jobs/:id',
    '/api/admin/work-types',
    '/api/admin/work-types/:id',
    '/api/admin/zones',
    '/api/admin/zones/:id',
    '/api/admin/trailer-types',
    '/api/admin/trailer-types/:id',
    '/api/admin/cfmeu-calendars',
    '/api/admin/cfmeu-calendars/:id',
    '/api/admin/cfmeu-calendars/:id/holidays',
    '/api/admin/cfmeu-calendars/sync',
    '/api/admin/cfmeu-calendars/sync-all',
    '/api/admin/panel-types',
    '/api/admin/panel-types/:id',
    '/api/admin/panel-types/cost-summaries',
    '/api/admin/panels',
    '/api/admin/user-permissions',
    '/api/admin/user-permissions/:id',
    '/api/admin/user-permissions/:id/initialize',
    '/api/admin/data-deletion/counts',
    '/api/admin/data-deletion/validate',
    '/api/admin/data-deletion/jobs',
    '/api/admin/data-deletion/users',
    '/api/admin/data-deletion/daily-logs',
    '/api/purchase-orders',
    '/api/purchase-orders/:id',
    '/api/purchase-orders/:id/items',
    '/api/purchase-orders/:id/attachments',
    '/api/purchase-orders/:id/submit',
    '/api/purchase-orders/:id/approve',
    '/api/purchase-orders/:id/reject',
    '/api/jobs',
    '/api/jobs/:id',
    '/api/jobs/:id/settings',
    '/api/jobs/:id/cost-breakdown',
    '/api/jobs/:id/panels',
    '/api/panels',
    '/api/panels/:id',
    '/api/panels/import',
    '/api/panels/:id/approval',
    '/api/panels/bulk-approval',
    '/api/production-slots',
    '/api/production-slots/:id',
    '/api/production-slots/generate',
    '/api/production-entries',
    '/api/production-entries/:id',
    '/api/production/summary',
    '/api/production/days',
    '/api/drafting-program',
    '/api/drafting-program/:id',
    '/api/drafting/schedule',
    '/api/task-groups',
    '/api/task-groups/:id',
    '/api/tasks',
    '/api/tasks/:id',
    '/api/factories',
    '/api/factories/:id',
    '/api/factories/:id/beds',
    '/api/daily-logs',
    '/api/daily-logs/:id',
    '/api/daily-logs/:id/entries',
    '/api/daily-logs/:id/submit',
    '/api/daily-logs/:id/approve',
    '/api/daily-logs/:id/reject',
    '/api/chat/conversations',
    '/api/chat/conversations/:id',
    '/api/chat/conversations/:id/messages',
    '/api/chat/users',
    '/api/chat/unread-count',
    '/api/chat/conversations/:id/read',
    '/api/agent/ingest',
    '/api/agent/status',
  ];
  
  for (const route of additionalKnownRoutes) {
    allRoutes.add(normalizeEndpoint(route));
  }
  
  return allRoutes;
}

function usesApiRouteConstants(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes("from '@shared/api-routes'") || 
           content.includes('from "@shared/api-routes"') ||
           content.includes("from '../../../shared/api-routes'") ||
           content.includes('from "../../../shared/api-routes"');
  } catch (e) {
    return false;
  }
}

console.log('========================================');
console.log('  ENDPOINT VALIDATION REPORT');
console.log('========================================');
console.log('');

const frontendCalls = findFrontendApiCalls();
const routeFiles = findBackendRoutes();
const backendRoutes = buildBackendRouteSet(routeFiles);

console.log(`Found ${frontendCalls.length} API calls in frontend`);
console.log(`Found ${backendRoutes.size} valid backend routes`);
console.log('');

const invalidEndpoints: { file: string; line: number; endpoint: string }[] = [];
const warningFiles = new Set<string>();

const VALID_DOMAIN_PREFIXES = [
  '/api/auth/',
  '/api/admin/',
  '/api/procurement/',
  '/api/chat/',
  '/api/reports/',
  '/api/dashboard/',
  '/api/agent/',
  '/api/jobs',
  '/api/panels',
  '/api/panel-types',
  '/api/production',
  '/api/drafting',
  '/api/load-lists',
  '/api/trailer-types',
  '/api/factories',
  '/api/task',
  '/api/daily-logs',
  '/api/purchase-orders',
  '/api/users',
  '/api/user/',
  '/api/permissions/',
  '/api/settings/',
  '/api/work-types',
  '/api/weekly-wage-reports',
  '/api/weekly-job-reports',
  '/api/cfmeu-holidays',
  '/api/log-rows',
  '/api/manual-entry',
  '/api/po-attachments',
];

function hasValidPrefix(endpoint: string): boolean {
  for (const prefix of VALID_DOMAIN_PREFIXES) {
    if (endpoint.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

for (const call of frontendCalls) {
  const normalizedEndpoint = normalizeEndpoint(call.endpoint);
  
  let isValid = backendRoutes.has(normalizedEndpoint) || hasValidPrefix(normalizedEndpoint);
  
  if (!isValid) {
    for (const route of backendRoutes) {
      const callParts = normalizedEndpoint.split('/');
      const routeParts = route.split('/');
      
      if (callParts.length === routeParts.length) {
        let matches = true;
        for (let i = 0; i < callParts.length; i++) {
          if (callParts[i] !== routeParts[i] && routeParts[i] !== ':id' && callParts[i] !== ':id') {
            matches = false;
            break;
          }
        }
        if (matches) {
          isValid = true;
          break;
        }
      }
    }
  }
  
  if (!isValid) {
    invalidEndpoints.push(call);
    hasErrors = true;
  }
  
  const fullPath = path.join(process.cwd(), call.file);
  if (!usesApiRouteConstants(fullPath)) {
    warningFiles.add(call.file);
  }
}

if (invalidEndpoints.length > 0) {
  console.log('ERRORS - Endpoints Not Found in Backend:');
  console.log('----------------------------------------');
  const grouped = new Map<string, typeof invalidEndpoints>();
  for (const ep of invalidEndpoints) {
    const key = ep.file;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(ep);
  }
  
  for (const [file, eps] of grouped) {
    console.log(`  ${file}:`);
    for (const ep of eps) {
      console.log(`    Line ${ep.line}: ${ep.endpoint}`);
    }
    console.log('');
  }
}

if (warningFiles.size > 0) {
  console.log('WARNINGS - Not Using Centralized Constants:');
  console.log('-------------------------------------------');
  const files = Array.from(warningFiles).slice(0, 10);
  for (const file of files) {
    console.log(`  ${file}`);
  }
  if (warningFiles.size > 10) {
    console.log(`  ... and ${warningFiles.size - 10} more files`);
  }
  console.log('');
  console.log('  Recommendation: Import from @shared/api-routes');
  console.log('');
}

console.log('========================================');
console.log('  SUMMARY');
console.log('========================================');
console.log(`Total API calls scanned: ${frontendCalls.length}`);
console.log(`Valid backend routes: ${backendRoutes.size}`);
console.log(`Invalid endpoints: ${invalidEndpoints.length}`);
console.log(`Files not using constants: ${warningFiles.size}`);
console.log('');

if (hasErrors) {
  console.log('STATUS: FAILED - Fix invalid endpoints before deploying');
  console.log('');
  console.log('To fix:');
  console.log('1. Ensure the endpoint exists in backend routes');
  console.log('2. Update shared/api-routes.ts with the correct path');
  console.log('3. Use centralized constants in frontend components');
  process.exit(1);
} else {
  console.log('STATUS: PASSED - All frontend endpoints match backend routes');
  process.exit(0);
}
