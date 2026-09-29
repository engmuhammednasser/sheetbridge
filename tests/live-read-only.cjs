'use strict';
// Explicit target required. Only small anonymous GET requests are sent; never writes.
const fs = require('node:fs');
const target = process.argv[2];
if (!target || !/^https:\/\/[^\s?#]+\/?$/.test(target)) throw new Error('Pass the authorized HTTPS store URL.');
const root = target.replace(/\/+$/, '');
const cases = [
  ['anonymous health', 'health', {}],
  ['anonymous catalog', 'catalog', {}],
  ['anonymous references', 'references', {}],
  ['anonymous dashboard', 'admin/dashboard', {}],
  ['anonymous requests', 'admin/requests', {}],
  ['invalid connector key', 'health', {'X-SheetBridge-Token': '0'.repeat(64)}],
  ['malformed connector key', 'health', {'X-SheetBridge-Token': 'not-a-real-key'}],
];
(async () => {
  const results = [];
  for (const [name, route, headers] of cases) {
    const url = root + '/?rest_route=' + encodeURIComponent('/sheetbridge/v1/' + route);
    const response = await fetch(url, {method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(15000)});
    // Never report response data, even if an authorization failure exposes it.
    const passed = [401, 403].includes(response.status);
    const result = {name, status: response.status, passed};
    results.push(result);
    console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: HTTP ${response.status}`);
    await response.body?.cancel();
  }
  fs.mkdirSync('artifacts/qa', {recursive: true});
  fs.writeFileSync('artifacts/qa/live-security-results.json', JSON.stringify({testedAt: new Date().toISOString(), results}, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
})();
