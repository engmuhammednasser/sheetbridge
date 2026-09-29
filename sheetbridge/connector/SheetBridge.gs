/**
 * SheetBridge connector 1.2.0 (protocol 1). Install in a PRIVATE STANDALONE Apps Script project.
 * Set SHOP_URL, CONNECTION_TOKEN and SPREADSHEET_ID in Project Settings > Script properties.
 * Run setup once, then syncNow. Never paste credentials into this file or a spreadsheet cell.
 */
const SB = Object.freeze({
  version: '1.2.0',
  protocol: 1,
  fields: ['name', 'sku', 'regular_price', 'sale_price', 'stock_adjustment', 'initial_stock', 'manage_stock', 'status',
    'description', 'short_description', 'stock_status', 'backorders', 'category_ids', 'tag_ids', 'image_id', 'gallery_ids',
    'upsell_ids', 'cross_sell_ids', 'weight', 'length', 'width', 'height', 'attributes', 'variation_attributes', 'meta'],
  catalog: ['id', 'sku', 'name', 'type', 'parent_id', 'stock_quantity', 'regular_price', 'sale_price', 'status', 'revision', 'details', 'select_product'],
  context: ['current_name', 'current_sku', 'current_regular_price', 'current_sale_price', 'current_stock'],
  technical: ['request_id', 'state', 'message', '_baseline', '_payload'],
  listFields: ['category_ids', 'tag_ids', 'gallery_ids', 'upsell_ids', 'cross_sell_ids'],
  jsonFields: ['attributes', 'variation_attributes', 'meta'],
  integerFields: ['stock_adjustment', 'initial_stock', 'image_id'],
});

function sbHeaders() { return ['ready', 'action', 'product_id'].concat(SB.context, ['type', 'parent_id', 'revision'], SB.fields, SB.technical); }

function sbMigrate(book) {
  for (const name of ['Changes', 'Catalog', '_SB_Catalog_Stage']) {
    const tab = book.getSheetByName(name);
    if (tab && tab.getLastRow() && !tab.getDeveloperMetadata().some(meta => meta.getKey() === 'sheetbridge')) throw new Error('This tab is not owned by SheetBridge: ' + name);
  }
  const changes = book.getSheetByName('Changes');
  const old = ['ready', 'action', 'product_id', 'type', 'parent_id', 'revision'].concat(SB.fields, SB.technical);
  if (changes && changes.getLastRow()) {
    const found = changes.getRange(1, 1, 1, old.length).getValues()[0];
    if (JSON.stringify(found) === JSON.stringify(old)) {
      // Insert whole columns; Google moves every existing row, value and protection together.
      changes.insertColumnsAfter(3, SB.context.length);
      changes.getRange(1, 4, 1, SB.context.length).setValues([SB.context]);
    }
  }
  for (const name of ['Catalog', '_SB_Catalog_Stage']) {
    const sheet = book.getSheetByName(name);
    if (!sheet || !sheet.getLastRow()) continue;
    if (sheet.getMaxColumns() < SB.catalog.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), SB.catalog.length - sheet.getMaxColumns());
    const legacy = SB.catalog.slice(0, -1);
    const found = sheet.getRange(1, 1, 1, SB.catalog.length).getValues()[0];
    if (JSON.stringify(found.slice(0, -1)) === JSON.stringify(legacy) && found[legacy.length] === '') {
      sheet.getRange(1, SB.catalog.length).setValue('select_product');
    }
  }
}

function sbAssertCompatibility(health) {
  const protocol = health.connector_protocol === undefined && ['1.0.0', '1.0.1'].includes(health.version) ? 1 : health.connector_protocol;
  if (protocol !== SB.protocol) throw new Error('Update the connector from your plugin. / حدّث الموصل من الإضافة.');
}

function setup() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Another sync is running. Retry setup shortly. / توجد مزامنة تعمل؛ أعد setup بعد قليل.');
  try { sbSetup_(); } finally { lock.releaseLock(); }
}

function sbSetup_() {
  const config = sbConfig();
  const health = sbApi('health');
  sbAssertCompatibility(health);
  const book = SpreadsheetApp.openById(config.sheetId);
  sbMigrate(book);
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
  changes.getRange(2, headers.indexOf('type') + 1, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['simple', 'variable', 'variation'], true).setAllowInvalid(false).build());
  changes.getRange(2, headers.indexOf('sku') + 1, rows, 1).setNumberFormat('@');
  changes.getRange(2, headers.indexOf('revision') + 1, rows, 1).setNumberFormat('@');
  changes.getRange(1, 1, 1, headers.length).setNotes([headers.map(key => sbColumnHelp(key))]);
  changes.setFrozenColumns(4);
  changes.hideColumns(headers.indexOf('_baseline') + 1, 2);
  catalog.hideColumns(SB.catalog.indexOf('details') + 1);
  sbProtect(catalog, 'SheetBridge Catalog');
  sbProtect(refs, 'SheetBridge References');
  sbProtect(help, 'SheetBridge Help');
  sbProtect(changes.getRange(1, 1, 1, headers.length), 'SheetBridge headers');
  for (const key of ['revision'].concat(SB.technical, SB.context)) sbProtect(changes.getRange(2, headers.indexOf(key) + 1, rows, 1), 'SheetBridge ' + key);
  help.getRange(2, 1, 12, 2).setValues([
    ['1. In a NEW Changes row, select a product by name / SKU in product_id, or paste its numeric ID.', '١. في صف جديد داخل Changes، اختر المنتج بالاسم أو SKU من product_id، أو اكتب معرّفه.'],
    ['2. Wait a moment: the private edit trigger captures the revision and baseline.', '٢. انتظر لحظة حتى يحفظ المشغّل نسخة المنتج المرجعية.'],
    ['3. Enter ONLY fields you want to change. Blank means no change.', '٣. املأ الحقول التي تريد تعديلها فقط. الخلية الفارغة تعني عدم التغيير.'],
    ['4. Use __CLEAR__ to remove a supported optional value.', '٤. اكتب __CLEAR__ لمسح قيمة اختيارية تدعم المسح.'],
    ['5. stock_adjustment: 5 adds five units; -2 removes two units.', '٥. stock_adjustment: الرقم 5 يضيف خمس وحدات و -2 يخصم وحدتين.'],
    ['6. Tick ready manually to send for review now. The five-minute schedule retries missed submissions. Approval remains in WordPress.', '٦. فعّل ready يدويًا للإرسال للمراجعة الآن. الجدولة كل خمس دقائق تعيد المحاولة عند التأخير. الاعتماد من WordPress.'],
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
  sbLayout(changes, catalog, health.settings);
}

function sbLayout(changes, catalog, settings) {
  const headers = sbHeaders();
  const visible = ['ready', 'product_id', 'state', 'message'].concat(SB.context, settings.fields);
  if (settings.allow_create) visible.push('action', 'type', 'parent_id');
  changes.showColumns(1, headers.length);
  headers.forEach((key, index) => { if (!visible.includes(key)) changes.hideColumns(index + 1); });
  changes.setColumnWidth(headers.indexOf('message') + 1, 380);
  changes.setColumnWidth(headers.indexOf('current_name') + 1, 250);
  changes.getRange(1, 4, changes.getMaxRows(), SB.context.length).setBackground('#edf4f7');
  changes.getRange(1, 4, 1, SB.context.length).setFontColor('#163846');
  catalog.hideColumns(SB.catalog.indexOf('revision') + 1, 3);
  if (catalog.getLastRow() > 1) {
    changes.getRange(2, headers.indexOf('product_id') + 1, changes.getMaxRows() - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInRange(catalog.getRange(2, SB.catalog.length, catalog.getLastRow() - 1, 1), true).setAllowInvalid(true).build());
  }
  PropertiesService.getScriptProperties().setProperty('SB_LAYOUT', JSON.stringify([settings.fields, settings.allow_create, catalog.getLastRow()]));
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
      if (['invalid', 'conflict', 'rejected'].includes(item.state) && event.range.getLastColumn() > 1 && event.range.getColumn() <= headers.indexOf('meta') + 1) {
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
        const picked = String(item.product_id).match(/ \| #(\d+)$/);
        const product = catalog[picked ? picked[1] : String(item.product_id)];
        if (product) {
          // Keep a selected label in the cell so Google does not flag it as an invalid dropdown value.
          sheet.getRange(row, headers.indexOf('current_name') + 1, 1, SB.context.length).setNumberFormat('@').setValues([[product.name, product.sku, product.regular_price, product.sale_price, product.stock_quantity].map(sbSafeCell)]);
          sbSet(sheet, row, 'revision', product.revision);
          sbSet(sheet, row, '_baseline', JSON.stringify(product));
          sbSet(sheet, row, 'action', 'update');
          sbSet(sheet, row, 'state', 'draft');
          sbSet(sheet, row, 'message', 'Baseline captured. Enter changes, then tick ready. / تم حفظ المرجع. أدخل التغييرات ثم فعّل ready.');
        } else {
          sbSet(sheet, row, 'revision', ''); sbSet(sheet, row, '_baseline', '');
          sheet.getRange(row, headers.indexOf('current_name') + 1, 1, SB.context.length).clearContent();
          sbSet(sheet, row, 'message', 'Product not in Catalog. Refresh or check the ID. / المنتج غير موجود في Catalog.');
        }
      }
    }
    // Only an explicit edit touching ready starts an immediate submission.
    if (event.range.getColumn() === 1) {
      const health = sbApi('health'); sbAssertCompatibility(health);
      const result = sbProcessChanges(sheet, health.settings, Date.now(), Array.from({length: end - start + 1}, (_, i) => start + i));
      sbReport(health, {...result, state: health.settings.inbound_paused ? 'paused' : 'success'});
    }
  } finally { lock.releaseLock(); }
}

function syncNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const started = Date.now();
  let health;
  try {
    const config = sbConfig();
    const book = SpreadsheetApp.openById(config.sheetId);
    health = sbApi('health');
    sbAssertCompatibility(health);
    const sheet = book.getSheetByName('Changes');
    if (!sheet) throw new Error('Run setup first. / شغّل setup أولًا.');
    sbCheckHeaders(sheet, sbHeaders());
    const settings = health.settings;
    const result = sbProcessChanges(sheet, settings, started);
    let complete = false;
    if (!settings.outbound_paused && Date.now() - started < 180000) complete = sbRefreshCatalog(book, started);
    const layout = JSON.stringify([settings.fields, settings.allow_create, book.getSheetByName('Catalog').getLastRow()]);
    if (PropertiesService.getScriptProperties().getProperty('SB_LAYOUT') !== layout) sbLayout(sheet, book.getSheetByName('Catalog'), settings);
    sbReport(health, {...result, state: settings.inbound_paused ? 'paused' : 'success', catalog_complete: complete});
    const help = book.getSheetByName('Help');
    const stamp = new Date().toISOString();
    help.getRange(13, 1, 1, 2).setValues([['Last run: ' + stamp + '; catalog: ' + (complete ? 'complete' : settings.outbound_paused ? 'paused' : 'in progress'), 'آخر تشغيل: ' + stamp + '؛ الكتالوج: ' + (complete ? 'اكتمل' : settings.outbound_paused ? 'متوقف' : 'جارٍ الاستكمال')]]);
  } catch (error) {
    try { sbReport(health, {state: 'error', error_kind: error.status !== undefined ? 'connection' : 'configuration'}); } catch { /* Preserve the original failure. */ }
    // Never log request headers, script properties or response bodies.
    throw new Error('SheetBridge: ' + String(error.message).slice(0, 500));
  } finally { lock.releaseLock(); }
}

function sbProcessChanges(sheet, settings, started, selectedRows) {
  const headers = sbHeaders();
  const last = sheet.getLastRow();
  const summary = {processed_rows: 0, submitted: 0, active_rows: 0, error_rows: 0};
  if (last < 2) return summary;
  const props = PropertiesService.getScriptProperties();
  // Read only the three queue columns for old history, then fetch active rows.
  const ready = sheet.getRange(2, 1, last - 1, 1).getValues();
  const statuses = sheet.getRange(2, headers.indexOf('request_id') + 1, last - 1, 2).getValues();
  const fresh = [], waiting = [];
  for (let i = 0; i < statuses.length; i++) {
    const [id, state] = statuses[i];
    if (['invalid', 'conflict', 'failed'].includes(state)) summary.error_rows++;
    if (['applied', 'rejected', 'conflict', 'invalid'].includes(state)) continue;
    if (id) waiting.push(i + 2);
    else if (ready[i][0] === true || String(ready[i][0]).toUpperCase() === 'TRUE') fresh.push(i + 2);
  }
  summary.active_rows = fresh.length + waiting.length;
  const cursor = Math.max(0, Number(props.getProperty('SB_ACTIVE_CURSOR') || 0)) % (waiting.length || 1);
  const rotated = waiting.slice(cursor).concat(waiting.slice(0, cursor));
  const rows = selectedRows || fresh.slice(0, 50).concat(rotated.slice(0, 100 - Math.min(50, fresh.length)));
  let polled = 0;
  for (const row of rows.slice(0, 100)) {
    if (Date.now() - started >= 180000) break;
    const item = sbObject(headers, sheet.getRange(row, 1, 1, headers.length).getValues()[0]);
    if (['applied', 'rejected', 'conflict', 'invalid'].includes(item.state)) continue;
    if (!item.request_id && item.ready !== true && String(item.ready).toUpperCase() !== 'TRUE') continue;
    summary.processed_rows++;
    if (item.request_id) polled++;
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
        sbWriteTechnical(sheet, row, item, {request_id: payload.request_id, _payload: serialized, state: 'submitting'});
        SpreadsheetApp.flush();
        result = sbApi('changes', payload);
        summary.submitted++;
      }
      sbWriteTechnical(sheet, row, item, {state: result.state, message: result.error_message || sbStateMessage(result.state)});
      if (['applied', 'rejected', 'conflict'].includes(result.state)) sbSet(sheet, row, 'ready', false);
      if (result.state === 'applied' && item.action === 'create') sbSet(sheet, row, 'product_id', result.product_id);
    } catch (error) {
      const transient = error.status === 429 || error.status >= 500 || error.status === 0;
      sbWriteTechnical(sheet, row, item, {state: transient ? 'retry' : 'invalid', message: String(error.message).slice(0, 500)});
      summary.error_rows++;
      if (!transient) sbSet(sheet, row, 'ready', false);
      if (error.status === 401 || error.status === 403 || error.status === 429) throw error;
    }
  }
  if (!selectedRows) props.setProperty('SB_ACTIVE_CURSOR', String((cursor + polled) % (waiting.length || 1)));
  return summary;
}

function sbWriteTechnical(sheet, row, item, updates) {
  Object.assign(item, updates);
  sheet.getRange(row, sbHeaders().indexOf('request_id') + 1, 1, SB.technical.length).setValues([SB.technical.map(key => sbSafeCell(item[key]))]);
}

function sbReport(health, result) {
  if (health && (health.capabilities || []).includes('connector_status')) sbApi('connector-status', {...result, connector_version: SB.version});
}

function sbBuildPayload(item, settings) {
  const action = String(item.action || 'update').trim();
  if (!['create', 'update'].includes(action)) throw new Error('action must be update or create. / اختر update أو create.');
  const pickedId = String(item.product_id || '').match(/ \| #(\d+)$/);
  const payload = { action, product_id: item.product_id === '' ? 0 : sbInteger(pickedId ? pickedId[1] : item.product_id, 'product_id'), changes: {} };
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
      const values = freshProducts.map(product => SB.catalog.map(key => sbSafeCell(key === 'details' ? JSON.stringify({ id: product.id, revision: product.revision }) : key === 'select_product' ? sbProductLabel(product) : product[key])));
      const nextRow = stage.getLastRow() + 1;
      sbEnsureRows(stage, nextRow + values.length);
      stage.getRange(nextRow, 1, values.length, SB.catalog.length).setNumberFormat('@').setValues(values);
      freshProducts.forEach(product => stagedIds.add(String(product.id)));
    }
    cursor = result.cursor;
    props.setProperty('SB_CURSOR', String(cursor));
    if (!result.has_more) {
      const values = stage.getRange(1, 1, stage.getLastRow(), SB.catalog.length).getValues();
      sbEnsureRows(catalog, values.length);
      const previous = catalog.getRange(1, 1, values.length, SB.catalog.length).getValues();
      // A complete reconciliation still runs; unchanged catalog rows no longer cause writes.
      const blocks = sbChangedBlocks(previous, values);
      for (const block of blocks) catalog.getRange(block.start + 1, 1, block.rows.length, SB.catalog.length).setNumberFormat('@').setValues(block.rows.map(row => row.map(sbSafeCell)));
      if (catalog.getLastRow() > values.length) catalog.getRange(values.length + 1, 1, catalog.getLastRow() - values.length, SB.catalog.length).clearContent();
      props.setProperty('SB_CURSOR', '0');
      return true;
    }
  }
  return false;
}

function sbChangedBlocks(previous, next) {
  const blocks = [];
  for (let i = 0; i < next.length; i++) {
    if (JSON.stringify(previous[i]) === JSON.stringify(next[i])) continue;
    const block = blocks[blocks.length - 1];
    if (block && block.start + block.rows.length === i) block.rows.push(next[i]);
    else blocks.push({start: i, rows: [next[i]]});
  }
  return blocks;
}
function sbProductLabel(product) { return String(product.name).slice(0, 140) + ' | ' + String(product.sku || '—').slice(0, 60) + ' | #' + product.id; }

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
  const rawId = (props.getProperty('SPREADSHEET_ID') || '').trim();
  const match = rawId.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{15,})(?:\/|$)/);
  const sheetId = match ? match[1] : rawId;
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
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, SB.catalog.length).getValues();
  const result = {};
  for (const row of rows) if (row[0]) { const product = sbObject(SB.catalog, row); result[String(product.id)] = product; }
  return result;
}
function sbStateMessage(state) {
  return ({ pending: 'Awaiting WordPress review. / في انتظار المراجعة في WordPress.', applied: 'Applied once. Use a new row for another change. / تم التطبيق. استخدم صفًا جديدًا للتعديل التالي.', rejected: 'Rejected by the reviewer. / رفضه المراجع.', conflict: 'Refresh Catalog and prepare a new row. / حدّث Catalog وجهّز صفًا جديدًا.', failed: 'The reviewer can retry this request in WordPress. / يمكن للمراجع إعادة المحاولة من WordPress.' })[state] || state;
}
function sbColumnHelp(key) {
  if (SB.context.includes(key)) return 'Current catalog value captured when selecting the product. Read only; enter proposals in the editable fields. / قيمة مرجعية عند اختيار المنتج؛ للعرض فقط. أدخل التعديل في الحقول المسموحة.';
  const help = {
    ready: 'Tick manually to send for WordPress review. Scheduled retries remain enabled. / فعّل يدويًا للإرسال للمراجعة في ووردبريس؛ الجدولة تعيد المحاولة عند التأخير.', product_id: 'Choose a name / SKU from the dropdown or copy the ID into a NEW row. / اختر الاسم أو SKU من القائمة أو انسخ المعرّف إلى صف جديد.',
    revision: 'Captured automatically on manual product ID edit. Do not change. / يُحفظ تلقائيًا؛ لا تعدّله.',
    stock_adjustment: 'Whole units to add or subtract. 5 adds five; -2 removes two. / وحدات للإضافة أو الخصم.',
    sku: 'Text. Preserve leading zeroes. / نص مع الحفاظ على الأصفار في البداية.',
    attributes: 'JSON list of local attributes. See the advanced examples in the guide. / خصائص محلية بصيغة JSON؛ راجع الدليل.',
    variation_attributes: 'JSON map using exact parent attribute keys and options. / أسماء وقيم خصائص الأب بصيغة JSON.',
    meta: 'JSON object using allowed sb_ keys only. / مفاتيح sb_ المسموح بها فقط بصيغة JSON.',
  };
  return help[key] || 'Blank means no change. __CLEAR__ explicitly removes a supported optional value. / فارغ يعني عدم التغيير؛ __CLEAR__ للمسح الصريح عند دعمه.';
}
