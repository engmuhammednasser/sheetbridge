const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync('sheetbridge/connector/SheetBridge.gs', 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: 'SheetBridge.gs' });
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
const run = code => vm.runInContext(code, context);
run(`var settings = { fields: SB.fields, allow_create: true }; var item = { action:'update', product_id:12, revision:'a'.repeat(64), sku:'0000123', stock_adjustment:'5' };`);
test('SKU preserves leading zeros', () => assert.equal(run('sbBuildPayload(item, settings).changes.sku'), '0000123'));
test('integer stock adjustment', () => assert.equal(run('sbBuildPayload(item, settings).changes.stock_adjustment'), 5));
test('blank means no change', () => assert.equal(run(`'sale_price' in sbBuildPayload({...item,sale_price:''},settings).changes`), false));
test('explicit clear remains null', () => assert.equal(run(`sbBuildPayload({...item,sale_price:'__CLEAR__'},settings).changes.sale_price`), null));
test('formula error rejected', () => assert.throws(() => run(`sbBuildPayload({...item,regular_price:'#N/A'},settings)`), /formula error/));
test('fractional stock rejected', () => assert.throws(() => run(`sbBuildPayload({...item,stock_adjustment:'1.5'},settings)`), /whole number/));
test('boolean parser does not accept arbitrary text', () => assert.throws(() => run(`sbBuildPayload({...item,manage_stock:'maybe'},settings)`), /TRUE or FALSE/));
test('field permission enforced in connector', () => assert.throws(() => run(`sbBuildPayload(item,{...settings,fields:['sku']})`), /Field disabled/));
test('revision required for external writes', () => assert.throws(() => run(`sbBuildPayload({...item,revision:''},settings)`), /captured revision/));
test('lists parsed into integer IDs', () => assert.equal(run(`JSON.stringify(sbBuildPayload({...item,category_ids:'12, 13'},settings).changes.category_ids)`), '[12,13]'));
test('JSON errors rejected', () => assert.throws(() => run(`sbBuildPayload({...item,meta:'{bad}'},settings)`), /Invalid JSON/));
test('new products use initial stock', () => assert.equal(run(`sbBuildPayload({action:'create',product_id:'',parent_id:'',name:'New',initial_stock:'3'},settings).changes.initial_stock`), 3));
test('creation toggle enforced', () => assert.throws(() => run(`sbBuildPayload({action:'create',product_id:'',name:'New'},{...settings,allow_create:false})`), /disabled/));
test('formula injection escaped on exports', () => assert.equal(run(`sbSafeCell('=IMPORTXML("x")')`), '\'=IMPORTXML("x")'));
test('numbers are not escaped', () => assert.equal(run('sbSafeCell(-3)'), -3));
test('no requests apply products from connector', () => assert.equal(/admin\/requests|\/apply/.test(source), false));
test('headers are unique', () => assert.equal(run('new Set(sbHeaders()).size === sbHeaders().length'), true));
test('security properties absent from spreadsheet headers', () => assert.equal(run(`sbHeaders().some(x=>/token|password|secret/i.test(x))`), false));
run(`var calls=0; var sleeps=0; var responseStatus=503; var fetchedOptions; PropertiesService={getScriptProperties:()=>({getProperty:k=>({SHOP_URL:'https://example.test',CONNECTION_TOKEN:'a'.repeat(64),SPREADSHEET_ID:'spreadsheet_123456789'})[k]})}; UrlFetchApp={fetch:(url,options)=>{calls++;fetchedOptions=options;return {getResponseCode:()=>responseStatus,getContentText:()=>JSON.stringify({message:'Temporary failure'})};}};Utilities={sleep:()=>sleeps++};`);
test('transient retries are bounded', () => { assert.throws(() => run(`sbApi('health')`), /503/); assert.equal(run('calls'), 3); assert.equal(run('sleeps'), 2); });
test('redirects cannot forward credentials', () => assert.equal(run('fetchedOptions.followRedirects'), false));
test('auth failure is not retried', () => { run('calls=0;responseStatus=401'); assert.throws(() => run(`sbApi('health')`), /401/); assert.equal(run('calls'), 1); });
test('network failure has safe error without secrets', () => { run(`UrlFetchApp.fetch=()=>{throw Error('secret transport data')}`); assert.throws(() => run(`sbApi('health')`), error => !error.message.includes('secret transport data') && error.status === 0); });
console.log(`Connector checks passed: ${count}`);

// Exercise the orchestration with a deterministic in-memory spreadsheet, not live Google.
function fakeSheet(headers, records) {
  const data = [Array.from(headers), ...records.map(record => Array.from(headers, key => record[key] ?? ''))];
  return {
    data,
    getLastRow() { return data.length; },
    getRange(row, column, rows = 1, columns = 1) {
      return {
        getValues() { return Array.from({length: rows}, (_, y) => Array.from({length: columns}, (_, x) => data[row - 1 + y]?.[column - 1 + x] ?? '')); },
        setValue(value) { data[row - 1] ??= []; data[row - 1][column - 1] = value; return this; },
      };
    },
    field(row, key) { return data[row - 1][headers.indexOf(key)]; },
  };
}
const headers = Array.from(run('sbHeaders()'));
const properties = new Map();
context.PropertiesService = { getScriptProperties: () => ({getProperty:key => properties.get(key) || null,setProperty:(key,value) => properties.set(key,value)}) };
context.SpreadsheetApp = {flush() {}};
context.Utilities = {getUuid:()=>'test_operation_123456789'};
context.settings = {fields:Array.from(run('SB.fields')),allow_create:true,inbound_paused:false};
let sheet = fakeSheet(headers, [{ready:true,action:'update',product_id:12,revision:'a'.repeat(64),stock_adjustment:5}]);
context.testSheet = sheet;
let posts = 0;
let savedPayload;
context.sbApi = (path, body) => {
  if (body) { posts++; savedPayload = JSON.parse(JSON.stringify(body)); const error = new Error('Connection lost after server accepted request'); error.status=0; throw error; }
  return {state:'applied',product_id:12};
};
test('network ambiguity persists identity before the call', () => {
  run('sbProcessChanges(testSheet,settings,Date.now())');
  assert.equal(sheet.field(2,'state'),'retry');
  assert.equal(sheet.field(2,'request_id'),'test_operation_123456789');
  assert.equal(JSON.parse(sheet.field(2,'_payload')).changes.stock_adjustment,5);
});
test('lost response recovery polls without duplicating a write', () => {
  run('sbProcessChanges(testSheet,settings,Date.now())');
  assert.equal(sheet.field(2,'state'),'applied'); assert.equal(posts,1); assert.equal(sheet.field(2,'ready'),false);
});
test('terminal applied row stays inert', () => { run('sbProcessChanges(testSheet,settings,Date.now())'); assert.equal(posts,1); });
sheet = fakeSheet(headers,[{ready:true,action:'update',product_id:12,revision:'a'.repeat(64),regular_price:'50'}]);
context.testSheet = sheet; properties.clear(); posts=0;
context.sbApi = (path,body) => { if(body){posts++;savedPayload=JSON.parse(JSON.stringify(body));const error=new Error('Network down');error.status=0;throw error;} const error=new Error('Not found');error.status=404;throw error; };
run('sbProcessChanges(testSheet,settings,Date.now())');
sheet.data[1][headers.indexOf('regular_price')] = '999';
context.sbApi = (path,body) => { if(body){posts++;savedPayload=JSON.parse(JSON.stringify(body));return {state:'pending',product_id:12};}const error=new Error('Not found');error.status=404;throw error; };
test('retry resubmits saved payload, not edits made after submission', () => { run('sbProcessChanges(testSheet,settings,Date.now())'); assert.equal(savedPayload.changes.regular_price,'50'); assert.equal(sheet.field(2,'state'),'pending'); });
sheet=fakeSheet(headers,Array.from({length:150},()=>({state:'applied'}))); context.testSheet=sheet; properties.clear();
test('large Changes sheet rotates bounded row cursor',()=>{run('sbProcessChanges(testSheet,settings,Date.now())');assert.equal(properties.get('SB_ROW_CURSOR'),'102');run('sbProcessChanges(testSheet,settings,Date.now())');assert.equal(properties.get('SB_ROW_CURSOR'),'2');});
console.log(`All connector checks passed: ${count}`);
