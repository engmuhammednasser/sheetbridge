/**
 * SheetBridge 1.0.1. Install in a PRIVATE STANDALONE Apps Script project.
 * Set SHOP_URL, CONNECTION_TOKEN and SPREADSHEET_ID in Project Settings > Script properties.
 * Run setup once, then syncNow. Never paste credentials into this file or a spreadsheet cell.
 */
const SB = Object.freeze({
  version: '1.0.1',
  fields: ['name', 'sku', 'regular_price', 'sale_price', 'stock_adjustment', 'initial_stock', 'manage_stock', 'status',
    'description', 'short_description', 'stock_status', 'backorders', 'category_ids', 'tag_ids', 'image_id', 'gallery_ids',
    'upsell_ids', 'cross_sell_ids', 'weight', 'length', 'width', 'height', 'attributes', 'variation_attributes', 'meta'],
  catalog: ['id', 'sku', 'name', 'type', 'parent_id', 'stock_quantity', 'regular_price', 'sale_price', 'status', 'revision', 'details'],
  technical: ['request_id', 'state', 'message', '_baseline', '_payload'],
  listFields: ['category_ids', 'tag_ids', 'gallery_ids', 'upsell_ids', 'cross_sell_ids'],
  jsonFields: ['attributes', 'variation_attributes', 'meta'],
  integerFields: ['stock_adjustment', 'initial_stock', 'image_id'],
});

function sbHeaders() { return ['ready', 'action', 'product_id', 'type', 'parent_id', 'revision'].concat(SB.fields, SB.technical); }

function setup() {
  const config = sbConfig();
  const health = sbApi('health');
  if (health.version !== SB.version) throw new Error('Connector version mismatch. Download the connector from your plugin. / حدّث الموصل من الإضافة.');
  const book = SpreadsheetApp.openById(config.sheetId);
  const catalog = sbSheet(book, 'Catalog', SB.catalog);
  const changes = sbSheet(book, 'Changes', sbHeaders());
  const refs = sbSheet(book, 'References', ['kind', 'id', 'name']);
  const help = sbSheet(book, 'Help', ['English', 'العربية']);
  const stage = sbSheet(book, '_SB_Catalog_Stage', SB.catalog);
  stage.hideSheet();
  if (changes.getMaxRows() < 501) changes.insertRowsAfter(changes.getMaxRows(), 501 - changes.getMaxRows());
  // Replace only this connector's own range protections when setup is rerun.
  for (const protection of changes.getProtections(SpreadsheetApp.ProtectionType.RANGE)) {
    if (protection.getDescription().startsWith('SheetBridge ')) protection.remove();
  }
  const headers = sbHeaders();
  const rows = changes.getMaxRows() - 1;
  changes.getRange(2, 1, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  changes.getRange(2, 2, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['update', 'create'], true).setAllowInvalid(false).build());
  changes.getRange(2, 4, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['simple', 'variable', 'variation'], true).setAllowInvalid(false).build());
  changes.getRange(2, headers.indexOf('sku') + 1, rows, 1).setNumberFormat('@');
  changes.getRange(2, headers.indexOf('revision') + 1, rows, 1).setNumberFormat('@');
  changes.getRange(1, 1, 1, headers.length).setNotes([headers.map(key => sbColumnHelp(key))]);
  changes.setFrozenColumns(3);
  changes.hideColumns(headers.indexOf('_baseline') + 1, 2);
  catalog.hideColumns(SB.catalog.indexOf('details') + 1);
  sbProtect(catalog, 'SheetBridge Catalog');
  sbProtect(refs, 'SheetBridge References');
  sbProtect(help, 'SheetBridge Help');
  sbProtect(changes.getRange(1, 1, 1, headers.length), 'SheetBridge headers');
  for (const key of ['revision'].concat(SB.technical)) sbProtect(changes.getRange(2, headers.indexOf(key) + 1, rows, 1), 'SheetBridge ' + key);
  help.getRange(2, 1, 12, 2).setValues([
    ['1. Review Catalog. Copy a product ID into a NEW Changes row.', '١. راجع Catalog وانسخ معرّف المنتج إلى صف جديد في Changes.'],
    ['2. Wait a moment: the private edit trigger captures the revision and baseline.', '٢. انتظر لحظة حتى يحفظ المشغّل نسخة المنتج المرجعية.'],
    ['3. Enter ONLY fields you want to change. Blank means no change.', '٣. املأ الحقول التي تريد تعديلها فقط. الخلية الفارغة تعني عدم التغيير.'],
    ['4. Use __CLEAR__ to remove a supported optional value.', '٤. اكتب __CLEAR__ لمسح قيمة اختيارية تدعم المسح.'],
    ['5. stock_adjustment: 5 adds five units; -2 removes two units.', '٥. stock_adjustment: الرقم 5 يضيف خمس وحدات و -2 يخصم وحدتين.'],
    ['6. Tick ready. Within a trigger cycle a preview appears in WordPress.', '٦. فعّل ready. يصل طلب المراجعة إلى WordPress في إحدى دورات المزامنة.'],
    ['7. WooCommerce > SheetBridge > Reviews: review then apply.', '٧. من WooCommerce ثم SheetBridge ثم المراجعة: راجع الطلب وطبّقه.'],
    ['8. Use a NEW row for the next operation. Never recycle a successful request ID.', '٨. استخدم صفًا جديدًا للعملية التالية ولا تعِد استخدام معرّف طلب ناجح.'],
    ['For creation: action=create, type=simple/variable/variation. Leave product_id empty. New products are drafts.', 'للإنشاء: action=create وحدد type واترك product_id فارغًا. المنتجات الجديدة مسودات.'],
    ['Formula/API changes are read on schedule. API writers must supply a captured revision or use a new row prepared manually first.', 'تُقرأ نتائج المعادلات وكتابات API بالجدولة. يجب توفير revision محفوظ أو تجهيز صف جديد يدويًا أولًا.'],
    ['Do not edit headers, technical columns, or the private script. Keep all columns together when sorting.', 'لا تعدّل العناوين أو الأعمدة التقنية أو السكربت الخاص. رتّب الصفوف بكامل أعمدتها.'],
    ['Last successful cycle: not yet run.', 'آخر دورة ناجحة: لم تعمل بعد.'],
  ]);
  help.setColumnWidths(1, 2, 520); help.getDataRange().setWrap(true);
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (['syncNow', 'onSheetEdit'].includes(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger('syncNow').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(book).onEdit().create();
  sbLoadReferences(book);
  PropertiesService.getScriptProperties().setProperty('SB_CURSOR', '0');
}

function pauseSchedule() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'syncNow') ScriptApp.deleteTrigger(trigger);
  }
}

function onSheetEdit(event) {
  if (!event || !event.range || event.range.getSheet().getName() !== 'Changes') return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const book = event.source;
    if (book.getId() !== sbConfig().sheetId) return;
    const sheet = event.range.getSheet();
    sbCheckHeaders(sheet, sbHeaders());
    const headers = sbHeaders();
    const start = Math.max(2, event.range.getRow());
    const end = Math.min(event.range.getLastRow(), start + 99);
    const catalog = sbCatalogMap(book);
    for (let row = start; row <= end; row++) {
      const values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
      const item = sbObject(headers, values);
      if (['invalid', 'conflict', 'rejected'].includes(item.state) && event.range.getColumn() <= headers.indexOf('meta') + 1) {
        for (const key of ['request_id', 'state', 'message', '_payload']) sbSet(sheet, row, key, '');
        sbSet(sheet, row, 'ready', false);
        item.request_id = '';
      }
      const idColumn = headers.indexOf('product_id') + 1;
      if (!item.request_id && item.action === 'create' && !item.product_id) {
        sbSet(sheet, row, 'revision', ''); sbSet(sheet, row, '_baseline', '');
        sbSet(sheet, row, 'state', 'draft');
        sbSet(sheet, row, 'message', 'New product draft. Complete the fields, then tick ready. / منتج جديد كمسودة؛ أكمل الحقول ثم فعّل ready.');
        continue;
      }
      if (!item.request_id && event.range.getColumn() <= idColumn && event.range.getLastColumn() >= idColumn) {
        const product = catalog[String(item.product_id)];
        if (product) {
          sbSet(sheet, row, 'revision', product.revision);
          sbSet(sheet, row, '_baseline', JSON.stringify(product));
          sbSet(sheet, row, 'action', 'update');
          sbSet(sheet, row, 'state', 'draft');
          sbSet(sheet, row, 'message', 'Baseline captured. Enter changes, then tick ready. / تم حفظ المرجع. أدخل التغييرات ثم فعّل ready.');
        } else {
          sbSet(sheet, row, 'revision', ''); sbSet(sheet, row, '_baseline', '');
          sbSet(sheet, row, 'message', 'Product not in Catalog. Refresh or check the ID. / المنتج غير موجود في Catalog.');
        }
      }
    }
  } finally { lock.releaseLock(); }
}

function syncNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const started = Date.now();
  try {
    const config = sbConfig();
    const book = SpreadsheetApp.openById(config.sheetId);
    const health = sbApi('health');
    if (health.version !== SB.version) throw new Error('Update the connector to match the installed plugin. / حدّث الموصل.');
    const sheet = book.getSheetByName('Changes');
    if (!sheet) throw new Error('Run setup first. / شغّل setup أولًا.');
    sbCheckHeaders(sheet, sbHeaders());
    const settings = health.settings;
    sbProcessChanges(sheet, settings, started);
    if (!settings.outbound_paused && Date.now() - started < 180000) sbRefreshCatalog(book, started);
    const help = book.getSheetByName('Help');
    help.getRange(13, 1, 1, 2).setValues([['Last completed cycle: ' + new Date().toISOString(), 'آخر دورة مكتملة: ' + new Date().toISOString()]]);
  } catch (error) {
    // Never log request headers, script properties or response bodies.
    throw new Error('SheetBridge: ' + String(error.message).slice(0, 500));
  } finally { lock.releaseLock(); }
}

function sbProcessChanges(sheet, settings, started) {
  const headers = sbHeaders();
  const last = sheet.getLastRow();
  if (last < 2) return;
  const props = PropertiesService.getScriptProperties();
  let first = Math.max(2, Number(props.getProperty('SB_ROW_CURSOR') || 2));
  if (first > last) first = 2;
  const count = Math.min(100, last - first + 1);
  const rows = sheet.getRange(first, 1, count, headers.length).getValues();
  let processed = 0;
  for (let index = 0; index < rows.length && Date.now() - started < 180000; index++) {
    const row = first + index;
    const item = sbObject(headers, rows[index]);
    processed++;
    if (['applied', 'rejected', 'conflict', 'invalid'].includes(item.state)) continue;
    if (!item.request_id && item.ready !== true && String(item.ready).toUpperCase() !== 'TRUE') continue;
    try {
      let result;
      if (item.request_id) {
        try { result = sbApi('changes/' + encodeURIComponent(item.request_id)); }
        catch (error) {
          if (error.status !== 404 || !item._payload || settings.inbound_paused) throw error;
          result = sbApi('changes', JSON.parse(item._payload));
        }
      } else {
        if (settings.inbound_paused) continue;
        const payload = sbBuildPayload(item, settings);
        payload.request_id = Utilities.getUuid();
        const serialized = JSON.stringify(payload);
        if (serialized.length > 45000) throw new Error('This row exceeds the connector size limit. Split the change. / حجم التعديل كبير؛ قسّمه.');
        sbSet(sheet, row, 'request_id', payload.request_id);
        sbSet(sheet, row, '_payload', serialized);
        sbSet(sheet, row, 'state', 'submitting');
        SpreadsheetApp.flush();
        result = sbApi('changes', payload);
      }
      sbSet(sheet, row, 'state', result.state);
      sbSet(sheet, row, 'message', result.error_message || sbStateMessage(result.state));
      if (['applied', 'rejected', 'conflict'].includes(result.state)) sbSet(sheet, row, 'ready', false);
      if (result.state === 'applied' && item.action === 'create') sbSet(sheet, row, 'product_id', result.product_id);
    } catch (error) {
      const transient = error.status === 429 || error.status >= 500 || error.status === 0;
      sbSet(sheet, row, 'state', transient ? 'retry' : 'invalid');
      sbSet(sheet, row, 'message', String(error.message).slice(0, 500));
      if (!transient) sbSet(sheet, row, 'ready', false);
      if (error.status === 401 || error.status === 403 || error.status === 429) throw error;
    }
  }
  props.setProperty('SB_ROW_CURSOR', String(first + processed > last ? 2 : first + processed));
}

function sbBuildPayload(item, settings) {
  const action = String(item.action || 'update').trim();
  if (!['create', 'update'].includes(action)) throw new Error('action must be update or create. / اختر update أو create.');
  const payload = { action, product_id: item.product_id === '' ? 0 : sbInteger(item.product_id, 'product_id'), changes: {} };
  if (action === 'create') {
    if (!settings.allow_create) throw new Error('Product creation is disabled in WordPress. / إنشاء المنتجات غير مفعّل.');
    payload.type = String(item.type || 'simple');
    payload.parent_id = item.parent_id === '' ? 0 : sbInteger(item.parent_id, 'parent_id');
  } else {
    payload.revision = String(item.revision || '');
    if (!payload.product_id || !/^[a-f0-9]{64}$/.test(payload.revision)) throw new Error('Enter the product ID manually in a new row and wait for its revision. API writers must supply a captured revision. / أدخل معرّف المنتج في صف جديد وانتظر حفظ المرجع.');
  }
  for (const field of SB.fields) {
    const value = item[field];
    if (value === '' || value === undefined || value === null) continue;
    if (!settings.fields.includes(field)) throw new Error('Field disabled in WordPress: ' + field + ' / الحقل غير مسموح.');
    if (typeof value === 'string' && /^#(N\/A|REF!|VALUE!|DIV\/0!|ERROR!|NAME\?|NUM!|SPILL!)/.test(value)) throw new Error('Fix the formula error in ' + field + ' / أصلح خطأ المعادلة.');
    if (value === '__CLEAR__') { payload.changes[field] = null; continue; }
    if (SB.listFields.includes(field)) payload.changes[field] = String(value).split(',').map(id => sbInteger(id.trim(), field));
    else if (SB.jsonFields.includes(field)) {
      try { payload.changes[field] = JSON.parse(String(value)); } catch { throw new Error('Invalid JSON in ' + field + ' / تنسيق JSON غير صحيح.'); }
    } else if (SB.integerFields.includes(field)) payload.changes[field] = sbInteger(value, field);
    else if (field === 'manage_stock') {
      if (!['true', 'false'].includes(String(value).toLowerCase())) throw new Error('manage_stock must be TRUE or FALSE.');
      payload.changes[field] = String(value).toLowerCase() === 'true';
    } else payload.changes[field] = String(value);
  }
  if (!Object.keys(payload.changes).length) throw new Error('Enter at least one change. / أدخل تعديلًا واحدًا على الأقل.');
  return payload;
}

function sbRefreshCatalog(book, started) {
  const props = PropertiesService.getScriptProperties();
  let cursor = Number(props.getProperty('SB_CURSOR') || 0);
  const stage = book.getSheetByName('_SB_Catalog_Stage');
  const catalog = book.getSheetByName('Catalog');
  sbCheckHeaders(stage, SB.catalog); sbCheckHeaders(catalog, SB.catalog);
  if (cursor === 0 && stage.getLastRow() > 1) stage.getRange(2, 1, stage.getLastRow() - 1, SB.catalog.length).clearContent();
  const stagedIds = new Set(stage.getLastRow() < 2 ? [] : stage.getRange(2, 1, stage.getLastRow() - 1, 1).getValues().map(row => String(row[0])));
  for (let page = 0; page < 4 && Date.now() - started < 230000; page++) {
    const result = sbApi('catalog?cursor=' + cursor + '&limit=50');
    const freshProducts = result.products.filter(product => !stagedIds.has(String(product.id)));
    if (freshProducts.length) {
      // Keep the technical snapshot small; complete values are shown in the WordPress review.
      const values = freshProducts.map(product => SB.catalog.map(key => sbSafeCell(key === 'details' ? JSON.stringify({ id: product.id, revision: product.revision }) : product[key])));
      const nextRow = stage.getLastRow() + 1;
      sbEnsureRows(stage, nextRow + values.length);
      stage.getRange(nextRow, 1, values.length, SB.catalog.length).setNumberFormat('@').setValues(values);
      freshProducts.forEach(product => stagedIds.add(String(product.id)));
    }
    cursor = result.cursor;
    props.setProperty('SB_CURSOR', String(cursor));
    if (!result.has_more) {
      const values = stage.getDataRange().getValues();
      sbEnsureRows(catalog, values.length);
      catalog.getRange(1, 1, values.length, SB.catalog.length).setNumberFormat('@').setValues(values);
      if (catalog.getLastRow() > values.length) catalog.getRange(values.length + 1, 1, catalog.getLastRow() - values.length, SB.catalog.length).clearContent();
      props.setProperty('SB_CURSOR', '0');
      return;
    }
  }
}

function sbLoadReferences(book) {
  const rows = [];
  // Bounded setup work. Additional reference IDs remain available in WooCommerce.
  for (let page = 1; page <= 5; page++) {
    const data = sbApi('references?page=' + page);
    for (const kind of ['categories', 'tags', 'images']) for (const item of data[kind]) rows.push([kind, item.id, sbSafeCell(item.name)]);
    if (!data.has_more) break;
  }
  const sheet = book.getSheetByName('References');
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
  if (rows.length) { sbEnsureRows(sheet, rows.length + 1); sheet.getRange(2, 1, rows.length, 3).setValues(rows); }
}

function refreshReferences() { sbLoadReferences(SpreadsheetApp.openById(sbConfig().sheetId)); }

function sbConfig() {
  const props = PropertiesService.getScriptProperties();
  const url = (props.getProperty('SHOP_URL') || '').replace(/\/+$/, '');
  const token = props.getProperty('CONNECTION_TOKEN') || '';
  const sheetId = props.getProperty('SPREADSHEET_ID') || '';
  if (!/^https:\/\/[^\s?#@]+$/i.test(url) || !/^[a-f0-9]{64}$/.test(token) || !/^[a-zA-Z0-9_-]{15,}$/.test(sheetId)) {
    throw new Error('Check SHOP_URL (HTTPS), CONNECTION_TOKEN and SPREADSHEET_ID in private Script properties. / راجع خصائص السكربت الثلاث.');
  }
  return { url, token, sheetId };
}

function sbApi(path, body) {
  const config = sbConfig();
  const options = { method: body ? 'post' : 'get', headers: { 'X-SheetBridge-Token': config.token }, muteHttpExceptions: true, followRedirects: false };
  if (body) { options.contentType = 'application/json'; options.payload = JSON.stringify(body); }
  let last;
  const parts = path.split('?');
  // Query-form REST URLs work with both plain and pretty WordPress permalinks.
  const endpoint = config.url + '/?rest_route=' + encodeURIComponent('/sheetbridge/v1/' + parts[0]) + (parts[1] ? '&' + parts[1] : '');
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try { response = UrlFetchApp.fetch(endpoint, options); }
    catch { const error = new Error('Network error. The same request will be checked on the next cycle. / تعذر الاتصال؛ ستتم مراجعة الطلب في الدورة القادمة.'); error.status = 0; throw error; }
    const status = response.getResponseCode();
    let data;
    try { data = JSON.parse(response.getContentText()); } catch { data = {}; }
    if (status >= 200 && status < 300) return data;
    const message = typeof data.message === 'string' ? data.message : 'Connection failed. Check HTTPS, permalinks and the firewall. / افحص HTTPS والروابط الدائمة والحماية.';
    last = new Error(message.slice(0, 400) + ' [' + status + ']'); last.status = status;
    if ((status !== 429 && status < 500) || attempt === 2) throw last;
    Utilities.sleep((attempt + 1) * 1000);
  }
  throw last;
}

function sbSheet(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (sheet && sheet.getLastRow() && !sheet.getDeveloperMetadata().some(meta => meta.getKey() === 'sheetbridge')) {
    throw new Error('Use an empty spreadsheet. An existing tab is not owned by SheetBridge: ' + name);
  }
  if (!sheet) sheet = book.insertSheet(name);
  if (!sheet.getDeveloperMetadata().some(meta => meta.getKey() === 'sheetbridge')) sheet.addDeveloperMetadata('sheetbridge', SB.version);
  if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  if (sheet.getLastRow()) sbCheckHeaders(sheet, headers);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setBackground('#163846').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1); sheet.setColumnWidths(1, headers.length, 150);
  return sheet;
}

function sbProtect(target, description) {
  const protections = target.getProtections ? target.getProtections(SpreadsheetApp.ProtectionType.SHEET) : [];
  let protection = protections.find(item => item.getDescription() === description);
  if (!protection) protection = target.protect().setDescription(description);
  protection.setWarningOnly(false);
  const owner = Session.getEffectiveUser();
  protection.addEditor(owner);
  const ownerEmail = owner.getEmail();
  const others = protection.getEditors().filter(user => user.getEmail() !== ownerEmail);
  if (others.length) protection.removeEditors(others);
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
}

function sbCheckHeaders(sheet, expected) {
  if (!sheet || JSON.stringify(sheet.getRange(1, 1, 1, expected.length).getValues()[0]) !== JSON.stringify(expected)) {
    throw new Error('Sheet headers changed. Restore the original columns before continuing. / أعد عناوين الأعمدة الأصلية.');
  }
}
function sbEnsureRows(sheet, count) { if (sheet.getMaxRows() < count) sheet.insertRowsAfter(sheet.getMaxRows(), count - sheet.getMaxRows()); }
function sbSet(sheet, row, key, value) { sheet.getRange(row, sbHeaders().indexOf(key) + 1).setValue(sbSafeCell(value)); }
function sbObject(headers, values) { return headers.reduce((result, key, index) => { result[key] = values[index]; return result; }, {}); }
function sbSafeCell(value) { return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value ?? ''; }
function sbInteger(value, field) { if (!/^[+-]?\d+$/.test(String(value).trim()) || !Number.isSafeInteger(Number(value))) throw new Error(field + ' needs a whole number. / أدخل عددًا صحيحًا.'); return Number(value); }
function sbCatalogMap(book) {
  const sheet = book.getSheetByName('Catalog'); sbCheckHeaders(sheet, SB.catalog);
  if (sheet.getLastRow() < 2) return {};
  const rows = sheet.getRange(2, SB.catalog.indexOf('details') + 1, sheet.getLastRow() - 1, 1).getValues();
  const result = {};
  for (const row of rows) if (row[0]) { const product = JSON.parse(row[0]); result[String(product.id)] = product; }
  return result;
}
function sbStateMessage(state) {
  return ({ pending: 'Awaiting WordPress review. / في انتظار المراجعة في WordPress.', applied: 'Applied once. Use a new row for another change. / تم التطبيق. استخدم صفًا جديدًا للتعديل التالي.', rejected: 'Rejected by the reviewer. / رفضه المراجع.', conflict: 'Refresh Catalog and prepare a new row. / حدّث Catalog وجهّز صفًا جديدًا.', failed: 'The reviewer can retry this request in WordPress. / يمكن للمراجع إعادة المحاولة من WordPress.' })[state] || state;
}
function sbColumnHelp(key) {
  const help = {
    ready: 'Tick only after reviewing the row. / فعّل بعد مراجعة الصف.', product_id: 'Copy the ID from Catalog into a NEW row. / انسخ معرّف المنتج إلى صف جديد.',
    revision: 'Captured automatically on manual product ID edit. Do not change. / يُحفظ تلقائيًا؛ لا تعدّله.',
    stock_adjustment: 'Whole units to add or subtract. 5 adds five; -2 removes two. / وحدات للإضافة أو الخصم.',
    sku: 'Text. Preserve leading zeroes. / نص مع الحفاظ على الأصفار في البداية.',
    attributes: 'JSON list of local attributes. See the advanced examples in the guide. / خصائص محلية بصيغة JSON؛ راجع الدليل.',
    variation_attributes: 'JSON map using exact parent attribute keys and options. / أسماء وقيم خصائص الأب بصيغة JSON.',
    meta: 'JSON object using allowed sb_ keys only. / مفاتيح sb_ المسموح بها فقط بصيغة JSON.',
  };
  return help[key] || 'Blank means no change. __CLEAR__ explicitly removes a supported optional value. / فارغ يعني عدم التغيير؛ __CLEAR__ للمسح الصريح عند دعمه.';
}
