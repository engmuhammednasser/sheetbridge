const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync('sheetbridge/connector/SheetBridge.gs', 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: 'SheetBridge.gs' });
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
const run = code => vm.runInContext(code, context);
test('future compatible plugin versions accept the same connector', () => assert.doesNotThrow(() => run(`sbAssertCompatibility({version:'1.9.0',connector_protocol:1})`)));
test('legacy plugin 1.0.0 accepts the new connector', () => assert.doesNotThrow(() => run(`sbAssertCompatibility({version:'1.0.0'})`)));
test('legacy plugin 1.0.1 accepts the new connector', () => assert.doesNotThrow(() => run(`sbAssertCompatibility({version:'1.0.1'})`)));
test('incompatible protocol requires connector upgrade', () => assert.throws(() => run(`sbAssertCompatibility({version:'2.0.0',connector_protocol:2})`), /Update the connector/));
test('unknown legacy protocol is rejected', () => assert.throws(() => run(`sbAssertCompatibility({version:'1.2.0'})`), /Update the connector/));
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
        setValues(values) { values.forEach((line, y) => line.forEach((value, x) => { data[row - 1 + y] ??= []; data[row - 1 + y][column - 1 + x] = value; })); return this; },
        setNumberFormat() { return this; },
        clearContent() { return this.setValues(Array.from({length:rows}, () => Array(columns).fill(''))); },
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
test('completed history produces no API traffic',()=>{let calls=0;context.sbApi=()=>calls++;run('sbProcessChanges(testSheet,settings,Date.now())');assert.equal(calls,0);});
sheet = fakeSheet(headers, [...Array.from({length:1500},()=>({state:'applied'})), {ready:true,action:'update',product_id:12,revision:'a'.repeat(64),regular_price:'80'}]);
context.testSheet=sheet; let traffic=[];
context.sbApi=(path,body)=>{traffic.push({path,body});return {state:'pending',product_id:12};};
test('new ready row bypasses 1500 completed rows in one cycle',()=>{run('sbProcessChanges(testSheet,settings,Date.now())');assert.equal(traffic.length,1);assert.equal(sheet.field(1502,'state'),'pending');});
sheet=fakeSheet(headers,Array.from({length:130},(_,i)=>({state:'pending',request_id:'waiting_request_'+i})));context.testSheet=sheet;properties.clear();traffic=[];
test('pending requests rotate fairly with at most 100 operations',()=>{run('sbProcessChanges(testSheet,settings,Date.now())');assert.equal(traffic.length,100);run('sbProcessChanges(testSheet,settings,Date.now())');assert.equal(traffic[100].path,'changes/waiting_request_100');assert.equal(traffic.length,200);});
sheet=fakeSheet(headers,[{ready:true,action:'update',product_id:12,revision:'a'.repeat(64),regular_price:'90'}]);context.testSheet=sheet;traffic=[];
test('paused inbound leaves new ready rows queued without submitting',()=>{run('sbProcessChanges(testSheet,{...settings,inbound_paused:true},Date.now())');assert.equal(traffic.length,0);assert.equal(sheet.field(2,'ready'),true);assert.equal(sheet.field(2,'request_id'),'');});
test('unchanged catalog generates no writes',()=>assert.equal(run('sbChangedBlocks([[1,"a"],[2,"b"]],[[1,"a"],[2,"b"]]).length'),0));
test('adjacent catalog changes are batched',()=>assert.equal(run('JSON.stringify(sbChangedBlocks([[1],[2],[3],[4]],[[1],[20],[30],[4]]))'),'[{"start":1,"rows":[[20],[30]]}]'));

// Exercise a manual ready edit through the same handler installed in Google.
const catalogHeaders=Array.from(run('SB.catalog'));
const catalogSheet=fakeSheet(catalogHeaders,[{id:12,name:'Fixture',sku:'0012',regular_price:'100',sale_price:'',stock_quantity:5,revision:'a'.repeat(64)}]);
sheet=fakeSheet(headers,[{ready:false,action:'update',product_id:'Fixture | 0012 | #12',regular_price:'120'}]);context.testSheet=sheet;
const book={getId:()=> 'test_sheet_123456789',getSheetByName:name=>name==='Catalog'?catalogSheet:sheet};
context.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})};
context.sbConfig=()=>({sheetId:book.getId()});
function edit(column){context.event={source:book,range:{getSheet:()=>({...sheet,getName:()=> 'Changes'}),getRow:()=>2,getLastRow:()=>2,getColumn:()=>column,getLastColumn:()=>column}};run('onSheetEdit(event)');}
test('picker resolves ID and captures current values and revision',()=>{edit(3);assert.equal(sheet.field(2,'product_id'),'Fixture | 0012 | #12');assert.equal(sheet.field(2,'current_sku'),'0012');assert.equal(sheet.field(2,'current_regular_price'),'100');assert.equal(sheet.field(2,'revision'),'a'.repeat(64));});
traffic=[];
context.sbApi=(path,body)=>{traffic.push({path,body});return path==='health'?{connector_protocol:1,settings:context.settings,capabilities:['connector_status']}:{state:'pending',product_id:12};};
test('manual ready immediately submits for review and reports status',()=>{sheet.data[1][0]=true;edit(1);assert.equal(sheet.field(2,'state'),'pending');assert.equal(traffic.filter(x=>x.path==='changes').length,1);assert.equal(traffic.find(x=>x.path==='changes').body.product_id,12);assert.equal(traffic.at(-1).path,'connector-status');assert.equal(traffic.at(-1).body.submitted,1);});
test('repeated ready does not create another proposal',()=>{edit(1);assert.equal(traffic.filter(x=>x.path==='changes').length,1);});
test('technical columns remain hidden from payload',()=>assert.equal(run('SB.context.some(key => SB.fields.includes(key))'),false));

const legacyHeaders=['ready','action','product_id','type','parent_id','revision',...Array.from(run('SB.fields')),...Array.from(run('SB.technical'))];
const legacy=fakeSheet(legacyHeaders,[{ready:true,product_id:12,regular_price:'120',request_id:'existing_request_123',_payload:'{"immutable":true}'}]);
legacy.getDeveloperMetadata=()=>[{getKey:()=> 'sheetbridge'}];
legacy.insertColumnsAfter=(at,count)=>legacy.data.forEach(row=>row.splice(at,0,...Array(count).fill('')));
context.migrationBook={getSheetByName:name=>name==='Changes'?legacy:null};
test('upgrade inserts context without disturbing existing request identity or payload',()=>{run('sbMigrate(migrationBook)');assert.equal(legacy.data[1][headers.indexOf('request_id')],'existing_request_123');assert.equal(legacy.data[1][headers.indexOf('_payload')],'{"immutable":true}');assert.equal(legacy.data[1][headers.indexOf('regular_price')],'120');});
test('upgrade is idempotent',()=>{const before=JSON.stringify(legacy.data);run('sbMigrate(migrationBook)');assert.equal(JSON.stringify(legacy.data),before);});
test('upgrade refuses unowned tabs before changing them',()=>{legacy.getDeveloperMetadata=()=>[];assert.throws(()=>run('sbMigrate(migrationBook)'),/not owned/);});
console.log(`All connector checks passed: ${count}`);
