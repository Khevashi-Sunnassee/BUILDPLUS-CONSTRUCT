const http = require('http');

const BASE = 'http://localhost:5000';
const COMPANY1 = { id: '1', name: 'BUILDPLUS AI', email: 'admin@lte.com.au', password: 'admin123' };
const COMPANY2 = { id: 'b72c8e39-03b5-4181-bc63-d435b291d04b', name: 'SALVO PROPERTY GROUP', email: 'admin@salvo.com.au', password: 'admin123' };

let results = { pass: 0, fail: 0, errors: [] };

function request(method, path, cookies, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (cookies) {
      const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      options.headers['Cookie'] = cookieStr;
      if (cookies['csrf_token'] && method !== 'GET') {
        options.headers['x-csrf-token'] = cookies['csrf_token'];
      }
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        const setCookies = {};
        const rawCookies = res.headers['set-cookie'] || [];
        for (const c of rawCookies) {
          const [kv] = c.split(';');
          const [k, v] = kv.split('=');
          setCookies[k.trim()] = v.trim();
        }
        resolve({ status: res.statusCode, body: parsed, setCookies });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(company) {
  const r1 = await request('GET', '/api/auth/me', {});
  const cookies = { ...r1.setCookies };
  const r2 = await request('POST', '/api/auth/login', cookies, { email: company.email, password: company.password });
  Object.assign(cookies, r2.setCookies);
  if (r2.status !== 200 || !r2.body?.user) {
    throw new Error(`Login failed for ${company.email}: ${JSON.stringify(r2.body)}`);
  }
  console.log(`  Logged in as ${company.email} (${company.name})`);
  return cookies;
}

function check(testName, condition, detail) {
  if (condition) {
    results.pass++;
  } else {
    results.fail++;
    results.errors.push(`FAIL: ${testName} - ${detail || ''}`);
    console.log(`  FAIL: ${testName} ${detail || ''}`);
  }
}

function extractArray(body) {
  if (Array.isArray(body)) return body;
  if (body?.data && Array.isArray(body.data)) return body.data;
  if (body?.items && Array.isArray(body.items)) return body.items;
  if (body?.results && Array.isArray(body.results)) return body.results;
  if (body?.templates && Array.isArray(body.templates)) return body.templates;
  if (body?.conversations && Array.isArray(body.conversations)) return body.conversations;
  if (body?.notifications && Array.isArray(body.notifications)) return body.notifications;
  return [];
}

async function createAndVerify(label, createPath, listPath, createBody, c1Cookies, c2Cookies) {
  console.log(`\n--- ${label} ---`);
  
  const c1Create = await request('POST', createPath, c1Cookies, createBody.c1);
  const c2Create = await request('POST', createPath, c2Cookies, createBody.c2);
  
  const c1OK = c1Create.status < 400;
  const c2OK = c2Create.status < 400;
  
  if (!c1OK) console.log(`  WARN: C1 create ${c1Create.status}: ${JSON.stringify(c1Create.body).substring(0, 150)}`);
  if (!c2OK) console.log(`  WARN: C2 create ${c2Create.status}: ${JSON.stringify(c2Create.body).substring(0, 150)}`);
  
  check(`${label} - C1 create works`, c1OK, `Status: ${c1Create.status}`);
  check(`${label} - C2 create works`, c2OK, `Status: ${c2Create.status}`);

  const c1List = await request('GET', listPath, c1Cookies);
  const c2List = await request('GET', listPath, c2Cookies);
  
  const c1Data = extractArray(c1List.body);
  const c2Data = extractArray(c2List.body);
  
  if (c1Data.length > 0 && c1Data[0]?.companyId) {
    const c1HasC2 = c1Data.some(item => item.companyId === COMPANY2.id);
    const c2HasC1 = c2Data.some(item => item.companyId === COMPANY1.id);
    check(`${label} - C1 isolation`, !c1HasC2, `C1 saw ${c1Data.filter(i => i.companyId === COMPANY2.id).length} C2 records`);
    check(`${label} - C2 isolation`, !c2HasC1, `C2 saw ${c2Data.filter(i => i.companyId === COMPANY1.id).length} C1 records`);
  }
  
  console.log(`  C1: ${c1Data.length} records, C2: ${c2Data.length} records`);
  return { c1Create, c2Create, c1Data, c2Data };
}

async function testGetIsolation(label, listPath, c1Cookies, c2Cookies) {
  console.log(`\n--- ${label} ---`);
  
  const c1List = await request('GET', listPath, c1Cookies);
  const c2List = await request('GET', listPath, c2Cookies);
  
  check(`${label} - C1 accessible`, c1List.status < 400, `Status: ${c1List.status}`);
  check(`${label} - C2 accessible`, c2List.status < 400, `Status: ${c2List.status}`);
  
  const c1Data = extractArray(c1List.body);
  const c2Data = extractArray(c2List.body);
  
  if (c1Data.length > 0 && c1Data[0]?.companyId) {
    const c1HasC2 = c1Data.some(item => item.companyId === COMPANY2.id);
    const c2HasC1 = c2Data.some(item => item.companyId === COMPANY1.id);
    check(`${label} - C1 isolation`, !c1HasC2, `C1 saw C2 data`);
    check(`${label} - C2 isolation`, !c2HasC1, `C2 saw C1 data`);
  }
  
  console.log(`  C1: ${c1List.status} (${c1Data.length}), C2: ${c2List.status} (${c2Data.length})`);
  return { c1Data, c2Data };
}

async function main() {
  console.log('=== COMPREHENSIVE COMPANY ISOLATION TEST ===\n');
  
  console.log('Authenticating...');
  const c1Cookies = await login(COMPANY1);
  const c2Cookies = await login(COMPANY2);

  // ======= ADMIN SETTINGS =======
  console.log('\n\n========== ADMIN SETTINGS ==========');
  await testGetIsolation('Global Settings', '/api/admin/settings', c1Cookies, c2Cookies);
  
  const c1S = await request('PUT', '/api/admin/settings', c1Cookies, { weekStartDay: 1, productionWorkDays: [false,true,true,true,true,true,false], draftingWorkDays: [false,true,true,true,true,true,false], cfmeuCalendar: 'CFMEU_VIC', includePOTerms: true });
  const c2S = await request('PUT', '/api/admin/settings', c2Cookies, { weekStartDay: 0, productionWorkDays: [true,true,true,true,true,false,false], draftingWorkDays: [true,true,true,true,true,false,false], cfmeuCalendar: 'NONE', includePOTerms: false });
  check('Settings - C1 all fields save', c1S.status < 400, `Status: ${c1S.status} ${JSON.stringify(c1S.body).substring(0,100)}`);
  check('Settings - C2 all fields save', c2S.status < 400, `Status: ${c2S.status} ${JSON.stringify(c2S.body).substring(0,100)}`);

  const c1G = await request('GET', '/api/admin/settings', c1Cookies);
  const c2G = await request('GET', '/api/admin/settings', c2Cookies);
  check('Settings - C1 companyId correct', c1G.body?.companyId === COMPANY1.id);
  check('Settings - C2 companyId correct', c2G.body?.companyId === COMPANY2.id);
  check('Settings - C1 weekStartDay=1', c1G.body?.weekStartDay === 1);
  check('Settings - C2 weekStartDay=0', c2G.body?.weekStartDay === 0);
  check('Settings - C1 prodDays correct', JSON.stringify(c1G.body?.productionWorkDays) === JSON.stringify([false,true,true,true,true,true,false]));
  check('Settings - C2 prodDays correct', JSON.stringify(c2G.body?.productionWorkDays) === JSON.stringify([true,true,true,true,true,false,false]));
  check('Settings - C1 draftDays correct', JSON.stringify(c1G.body?.draftingWorkDays) === JSON.stringify([false,true,true,true,true,true,false]));
  check('Settings - C2 draftDays correct', JSON.stringify(c2G.body?.draftingWorkDays) === JSON.stringify([true,true,true,true,true,false,false]));
  check('Settings - C1 cfmeu correct', c1G.body?.cfmeuCalendar === 'CFMEU_VIC');
  check('Settings - C2 cfmeu correct', c2G.body?.cfmeuCalendar === 'NONE');
  check('Settings - C1 POTerms correct', c1G.body?.includePOTerms === true);
  check('Settings - C2 POTerms correct', c2G.body?.includePOTerms === false);

  // ======= DEPARTMENTS =======
  console.log('\n\n========== DEPARTMENTS ==========');
  await createAndVerify('Departments', '/api/admin/departments', '/api/admin/departments',
    { c1: { name: 'C1 Engineering', code: 'C1ENG' }, c2: { name: 'C2 Operations', code: 'C2OPS' } },
    c1Cookies, c2Cookies);

  // ======= FACTORIES =======
  console.log('\n\n========== FACTORIES ==========');
  await createAndVerify('Factories', '/api/admin/factories', '/api/admin/factories',
    { c1: { name: 'C1 Melbourne Factory', code: 'C1MEL', location: 'Melbourne' }, c2: { name: 'C2 Sydney Factory', code: 'C2SYD', location: 'Sydney' } },
    c1Cookies, c2Cookies);

  // ======= WORK TYPES =======
  console.log('\n\n========== WORK TYPES ==========');
  await createAndVerify('Work Types', '/api/admin/work-types', '/api/admin/work-types',
    { c1: { name: 'C1 Panel Work', code: 'C1PW' }, c2: { name: 'C2 Steel Work', code: 'C2SW' } },
    c1Cookies, c2Cookies);

  // ======= ZONES =======
  console.log('\n\n========== ZONES ==========');
  await createAndVerify('Zones', '/api/admin/zones', '/api/admin/zones',
    { c1: { name: 'C1 Zone Alpha', code: 'C1ZA' }, c2: { name: 'C2 Zone Beta', code: 'C2ZB' } },
    c1Cookies, c2Cookies);

  // ======= TRAILER TYPES =======
  console.log('\n\n========== TRAILER TYPES ==========');
  await createAndVerify('Trailer Types', '/api/admin/trailer-types', '/api/admin/trailer-types',
    { c1: { name: 'C1 Flatbed', maxPanels: 10 }, c2: { name: 'C2 Semi', maxPanels: 20 } },
    c1Cookies, c2Cookies);

  // ======= MAPPING RULES =======
  console.log('\n\n========== MAPPING RULES ==========');
  await createAndVerify('Mapping Rules', '/api/admin/mapping-rules', '/api/admin/mapping-rules',
    { c1: { pattern: 'C1-*', field: 'mark', workTypeId: null }, c2: { pattern: 'C2-*', field: 'mark', workTypeId: null } },
    c1Cookies, c2Cookies);

  // ======= CUSTOMERS =======
  console.log('\n\n========== CUSTOMERS ==========');
  const custResult = await createAndVerify('Customers', '/api/customers', '/api/customers',
    { c1: { name: 'C1 Builder Corp', contactName: 'John C1', contactEmail: 'john@c1builder.com' },
      c2: { name: 'C2 Developer LLC', contactName: 'Jane C2', contactEmail: 'jane@c2dev.com' } },
    c1Cookies, c2Cookies);

  // ======= JOBS =======
  console.log('\n\n========== JOBS ==========');
  let c1CustId = custResult.c1Create.body?.id;
  let c2CustId = custResult.c2Create.body?.id;
  if (!c1CustId) {
    const c1Cs = await request('GET', '/api/customers', c1Cookies);
    c1CustId = extractArray(c1Cs.body)[0]?.id;
  }
  if (!c2CustId) {
    const c2Cs = await request('GET', '/api/customers', c2Cookies);
    c2CustId = extractArray(c2Cs.body)[0]?.id;
  }
  
  const jobResult = await createAndVerify('Jobs', '/api/admin/jobs', '/api/jobs',
    { c1: { name: 'C1 Test Project', jobNumber: 'C1-JOB-ISO-001', customerId: c1CustId, status: 'ACTIVE' },
      c2: { name: 'C2 Test Project', jobNumber: 'C2-JOB-ISO-001', customerId: c2CustId, status: 'ACTIVE' } },
    c1Cookies, c2Cookies);

  // ======= EMPLOYEES =======
  console.log('\n\n========== EMPLOYEES ==========');
  await createAndVerify('Employees', '/api/employees', '/api/employees',
    { c1: { firstName: 'John', lastName: 'C1Worker', email: 'worker-iso@c1.com', employeeNumber: 'C1EMP-ISO-001', position: 'Labourer' },
      c2: { firstName: 'Jane', lastName: 'C2Worker', email: 'worker-iso@c2.com', employeeNumber: 'C2EMP-ISO-001', position: 'Foreman' } },
    c1Cookies, c2Cookies);

  // ======= COST CODES =======
  console.log('\n\n========== COST CODES ==========');
  await createAndVerify('Cost Codes', '/api/cost-codes', '/api/cost-codes',
    { c1: { code: 'C1-CC-ISO-001', name: 'C1 Materials' }, c2: { code: 'C2-CC-ISO-001', name: 'C2 Materials' } },
    c1Cookies, c2Cookies);

  // ======= TASK GROUPS =======
  console.log('\n\n========== TASK GROUPS ==========');
  await createAndVerify('Task Groups', '/api/task-groups', '/api/task-groups',
    { c1: { name: 'C1 Task Board ISO' }, c2: { name: 'C2 Task Board ISO' } },
    c1Cookies, c2Cookies);

  // ======= DOCUMENT CATEGORIES =======
  console.log('\n\n========== DOCUMENT CATEGORIES ==========');
  await createAndVerify('Doc Categories', '/api/document-categories', '/api/document-categories',
    { c1: { categoryName: 'C1 Drawings', code: 'C1DRW', sortOrder: 0 },
      c2: { categoryName: 'C2 Drawings', code: 'C2DRW', sortOrder: 0 } },
    c1Cookies, c2Cookies);

  // ======= DOCUMENT DISCIPLINES =======
  console.log('\n\n========== DOCUMENT DISCIPLINES ==========');
  await createAndVerify('Doc Disciplines', '/api/document-disciplines', '/api/document-disciplines',
    { c1: { disciplineName: 'C1 Structural', code: 'C1STR', sortOrder: 0 },
      c2: { disciplineName: 'C2 Architectural', code: 'C2ARC', sortOrder: 0 } },
    c1Cookies, c2Cookies);

  // ======= DOCUMENT TYPES =======
  console.log('\n\n========== DOCUMENT TYPES ==========');
  await createAndVerify('Doc Types', '/api/document-types', '/api/document-types',
    { c1: { typeName: 'C1 Shop Drawing', prefix: 'C1SD', sortOrder: 0 },
      c2: { typeName: 'C2 Detail Drawing', prefix: 'C2DD', sortOrder: 0 } },
    c1Cookies, c2Cookies);

  // ======= DOCUMENT BUNDLES =======
  console.log('\n\n========== DOCUMENT BUNDLES ==========');
  await createAndVerify('Doc Bundles', '/api/document-bundles', '/api/document-bundles',
    { c1: { bundleName: 'C1 Bundle Pack' }, c2: { bundleName: 'C2 Bundle Pack' } },
    c1Cookies, c2Cookies);

  // ======= SCOPE TRADES =======
  console.log('\n\n========== SCOPE TRADES ==========');
  await createAndVerify('Scope Trades', '/api/scope-trades', '/api/scope-trades',
    { c1: { name: 'C1 Concrete Trade' }, c2: { name: 'C2 Steel Trade' } },
    c1Cookies, c2Cookies);

  // ======= BROADCAST TEMPLATES =======
  console.log('\n\n========== BROADCAST TEMPLATES ==========');
  await createAndVerify('Broadcast Templates', '/api/broadcast-templates', '/api/broadcast-templates',
    { c1: { name: 'C1 Safety Alert', message: 'Safety notice from C1', type: 'SMS' },
      c2: { name: 'C2 Delivery Notice', message: 'Delivery notice from C2', type: 'SMS' } },
    c1Cookies, c2Cookies);

  // ======= ASSETS =======
  console.log('\n\n========== ASSETS ==========');
  await createAndVerify('Assets', '/api/admin/assets', '/api/admin/assets',
    { c1: { name: 'C1 Crane ISO', assetNumber: 'C1-AST-ISO-001', category: 'Equipment', status: 'ACTIVE' },
      c2: { name: 'C2 Excavator ISO', assetNumber: 'C2-AST-ISO-001', category: 'Equipment', status: 'ACTIVE' } },
    c1Cookies, c2Cookies);

  // ======= GET-ONLY ENDPOINTS (verify isolation) =======
  console.log('\n\n========== GET-ONLY ENDPOINTS ==========');
  await testGetIsolation('Users', '/api/users', c1Cookies, c2Cookies);
  await testGetIsolation('Documents', '/api/documents', c1Cookies, c2Cookies);
  await testGetIsolation('Contracts', '/api/contracts', c1Cookies, c2Cookies);
  await testGetIsolation('CAPEX Requests', '/api/capex-requests', c1Cookies, c2Cookies);
  await testGetIsolation('Asset Repair Requests', '/api/asset-repair-requests', c1Cookies, c2Cookies);
  await testGetIsolation('Broadcasts', '/api/broadcasts', c1Cookies, c2Cookies);
  await testGetIsolation('Tenders', '/api/tenders', c1Cookies, c2Cookies);
  await testGetIsolation('Scopes', '/api/scopes', c1Cookies, c2Cookies);
  await testGetIsolation('Daily Logs', '/api/daily-logs', c1Cookies, c2Cookies);
  await testGetIsolation('Timer Sessions', '/api/timer-sessions', c1Cookies, c2Cookies);
  await testGetIsolation('Panels', '/api/panels', c1Cookies, c2Cookies);
  await testGetIsolation('Chat Conversations', '/api/chat/conversations', c1Cookies, c2Cookies);
  await testGetIsolation('Chat Topics', '/api/chat/topics', c1Cookies, c2Cookies);
  await testGetIsolation('Chat Unread', '/api/chat/total-unread', c1Cookies, c2Cookies);
  await testGetIsolation('Tasks', '/api/tasks', c1Cookies, c2Cookies);
  await testGetIsolation('Task Notifications', '/api/task-notifications', c1Cookies, c2Cookies);
  await testGetIsolation('Dashboard Stats', '/api/dashboard/stats', c1Cookies, c2Cookies);
  await testGetIsolation('Dashboard Due Tasks', '/api/dashboard/my-due-tasks', c1Cookies, c2Cookies);
  await testGetIsolation('Drafting Program', '/api/drafting-program', c1Cookies, c2Cookies);
  await testGetIsolation('Weekly Job Reports', '/api/weekly-job-reports', c1Cookies, c2Cookies);
  await testGetIsolation('Weekly Wage Reports', '/api/weekly-wage-reports', c1Cookies, c2Cookies);
  await testGetIsolation('Invitations', '/api/admin/invitations', c1Cookies, c2Cookies);
  await testGetIsolation('Checklist Templates', '/api/checklist/templates', c1Cookies, c2Cookies);
  await testGetIsolation('Checklist Entity Types', '/api/checklist/entity-types', c1Cookies, c2Cookies);
  await testGetIsolation('Logo/Branding', '/api/settings/logo', c1Cookies, c2Cookies);
  await testGetIsolation('My Permissions', '/api/my-permissions', c1Cookies, c2Cookies);
  await testGetIsolation('User Settings', '/api/user/settings', c1Cookies, c2Cookies);
  await testGetIsolation('EOT Claims', '/api/eot-claims', c1Cookies, c2Cookies);
  await testGetIsolation('CFMEU Calendars', '/api/admin/cfmeu-calendars', c1Cookies, c2Cookies);
  await testGetIsolation('Companies (admin)', '/api/admin/companies', c1Cookies, c2Cookies);
  await testGetIsolation('Devices', '/api/admin/devices', c1Cookies, c2Cookies);
  await testGetIsolation('Cost Codes w/Children', '/api/cost-codes-with-children', c1Cookies, c2Cookies);
  await testGetIsolation('Checklist Entity Subtypes', '/api/checklist/entity-subtypes', c1Cookies, c2Cookies);
  
  // Optional endpoints (may 404 with no data)
  for (const [label, path] of [
    ['Sales Opportunities', '/api/sales-opportunities'],
    ['Hire Bookings', '/api/hire-bookings'],
    ['Progress Claims', '/api/progress-claims'],
    ['Load Lists', '/api/load-lists'],
    ['Activity Templates', '/api/activity-templates'],
    ['Activity Stages', '/api/activity-stages'],
  ]) {
    console.log(`\n--- ${label} ---`);
    const c1R = await request('GET', path, c1Cookies);
    const c2R = await request('GET', path, c2Cookies);
    const ok1 = c1R.status < 400 || c1R.status === 404;
    const ok2 = c2R.status < 400 || c2R.status === 404;
    check(`${label} - C1 works`, ok1, `Status: ${c1R.status}`);
    check(`${label} - C2 works`, ok2, `Status: ${c2R.status}`);
    const d1 = extractArray(c1R.body);
    const d2 = extractArray(c2R.body);
    if (d1.length > 0 && d1[0]?.companyId) {
      check(`${label} - C1 isolation`, !d1.some(i => i.companyId === COMPANY2.id));
      check(`${label} - C2 isolation`, !d2.some(i => i.companyId === COMPANY1.id));
    }
    console.log(`  C1: ${c1R.status} (${d1.length}), C2: ${c2R.status} (${d2.length})`);
  }

  // ======= CROSS-COMPANY ACCESS TESTS =======
  console.log('\n\n========== CROSS-COMPANY ACCESS TESTS ==========');
  
  if (jobResult.c1Create.body?.id) {
    const xJob = await request('GET', `/api/jobs/${jobResult.c1Create.body.id}`, c2Cookies);
    check('Cross-access - C2 cannot see C1 job', xJob.status >= 400 || !xJob.body?.id,
      `C2 got status ${xJob.status} for C1 job`);
  }
  
  if (custResult.c2Create.body?.id) {
    const xCust = await request('GET', `/api/customers/${custResult.c2Create.body.id}`, c1Cookies);
    check('Cross-access - C1 cannot see C2 customer', xCust.status >= 400 || !xCust.body?.id,
      `C1 got status ${xCust.status} for C2 customer`);
  }

  // ======= SUMMARY =======
  console.log('\n\n========================================');
  console.log('=== COMPREHENSIVE TEST RESULTS ===');
  console.log('========================================');
  console.log(`PASSED: ${results.pass}`);
  console.log(`FAILED: ${results.fail}`);
  console.log(`TOTAL:  ${results.pass + results.fail}`);
  if (results.errors.length > 0) {
    console.log('\nFailed tests:');
    results.errors.forEach(e => console.log(`  ${e}`));
  }
  console.log('========================================');
  
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
