/* global SheetBridgeConfig */
(() => {
  'use strict';
  const config = SheetBridgeConfig;
  const root = document.getElementById('sheetbridge-app');
  let lang = config.language;
  let tab = 'overview';
  let dashboard;
  let page = 1;
  let filter = '';
  let detail = null;
  let renderVersion = 0;
  let reviewVersion = 0;
  const arabic = {
    'Product changes, with a clear review before publishing.': 'إدارة تغييرات المنتجات مع مراجعة واضحة قبل تطبيقها.',
    Overview: 'نظرة عامة', Reviews: 'مراجعة التغييرات', Connect: 'ربط Google Sheets', Settings: 'الإعدادات', Guide: 'دليل الاستخدام',
    'Awaiting review': 'في انتظار المراجعة', Applied: 'تم التطبيق', 'Needs attention': 'تحتاج إلى متابعة',
    'Your next steps': 'خطواتك التالية', 'Configure permitted fields in Settings.': 'حدد الحقول المسموح بتعديلها من الإعدادات.',
    'Connect a private Google Apps Script to your spreadsheet.': 'اربط ملف Google Sheets بمشروع Apps Script خاص بك.',
    'Edit the Changes tab and set Ready to TRUE.': 'أدخل التعديلات في تبويب Changes واجعل Ready تساوي TRUE.',
    'Review the proposal here, then apply it.': 'راجع القيم القديمة والجديدة هنا ثم طبّق التعديل.',
    'Open setup': 'بدء الربط', 'Read the guide': 'قراءة الدليل', Diagnostics: 'فحص الاتصال',
    'HTTPS connection': 'اتصال HTTPS', 'Transactional database': 'قاعدة بيانات تدعم المعاملات', 'Last connector contact': 'آخر اتصال من الموصل',
    'No contact yet': 'لم يحدث اتصال بعد', 'Connection key expires': 'انتهاء مفتاح الربط', 'No active key': 'لا يوجد مفتاح نشط',
    Ready: 'جاهز', 'Needs setup': 'يحتاج إلى إعداد', 'Stock adjustments preserve sales': 'تعديلات المخزون تحافظ على أثر المبيعات',
    'Enter +5 to add five units or -2 to remove two. Current stock is a reference, not an editable absolute quantity.': 'اكتب +5 لإضافة خمس وحدات أو -2 لإزالة وحدتين. الكمية الحالية للعرض، ولا تستبدل المخزون برقم قديم من الشيت.',
    'All states': 'كل الحالات', pending: 'قيد المراجعة', applied: 'تم التطبيق', conflict: 'تعارض', failed: 'فشل', rejected: 'مرفوض',
    Refresh: 'تحديث', Request: 'الطلب', Product: 'المنتج', State: 'الحالة', Submitted: 'تاريخ الإرسال', View: 'عرض',
    'No requests on this page.': 'لا توجد طلبات في هذه الصفحة.', Previous: 'السابق', Next: 'التالي',
    'Review request': 'مراجعة الطلب', Field: 'الحقل', Before: 'قبل التغيير', Proposed: 'التغيير المقترح',
    'New draft': 'مسودة جديدة', 'Relative adjustment': 'إضافة أو خصم وحدات', 'Apply changes': 'تطبيق التغييرات', Reject: 'رفض',
    'Prepare reversal': 'إعداد تراجع للمراجعة', Close: 'إغلاق', 'Apply this reviewed change to the store?': 'هل تريد تطبيق التعديل الذي راجعته على المتجر؟',
    'Reject this request?': 'هل تريد رفض هذا الطلب؟', 'The reversal is a new preview. Review it before applying.': 'تم إعداد التراجع كطلب جديد. راجعه قبل التطبيق.',
    'Changes applied.': 'تم تطبيق التغييرات.', 'Request rejected.': 'تم رفض الطلب.',
    'Connect your spreadsheet': 'اربط ملف Google Sheets', 'Only the site administrator can manage connection keys and settings.': 'مدير الموقع فقط يمكنه إدارة مفاتيح الربط والإعدادات.',
    'Create a blank spreadsheet': 'أنشئ ملف Google Sheets فارغًا', 'Create a new Google spreadsheet. Copy its ID from the URL between /d/ and /edit.': 'أنشئ ملف Google Sheets جديدًا. انسخ معرّف الملف من الرابط بين /d/ و /edit.',
    'Create a private script': 'أنشئ مشروع سكربت خاصًا', 'Open a standalone Apps Script project. Paste the connector code into Code.gs. Do not share this project with sheet editors.': 'افتح مشروع Apps Script مستقلًا والصق كود الموصل في Code.gs. لا تشارك المشروع مع محرري الشيت.',
    'Download connector': 'تنزيل الموصل', 'Open Apps Script': 'فتح Apps Script', 'Add three script properties': 'أضف ثلاث خصائص للسكربت',
    'In Apps Script open Project Settings → Script properties. Add these names exactly.': 'في Apps Script افتح إعدادات المشروع ثم خصائص السكربت. أضف الأسماء التالية كما هي.',
    'Your spreadsheet ID': 'معرّف ملف Google Sheets', 'A newly generated connection key': 'مفتاح الربط الذي تنشئه هنا',
    'Generate new key': 'إنشاء مفتاح جديد', 'Revoke key': 'إلغاء مفتاح الربط',
    'A new key immediately invalidates the previous one. Continue?': 'المفتاح الجديد يلغي المفتاح السابق فورًا. هل تريد المتابعة؟',
    'Revoke the active connection key?': 'هل تريد إلغاء مفتاح الربط الحالي؟', 'Key revoked.': 'تم إلغاء المفتاح.',
    'Copy this key now. It is displayed once and expires after 90 days. Keep it only in the private script properties.': 'انسخ المفتاح الآن؛ يظهر مرة واحدة وتنتهي صلاحيته بعد 90 يومًا. احتفظ به في خصائص مشروع السكربت الخاص فقط.',
    'Run setup, then syncNow': 'شغّل setup ثم syncNow', 'Authorize the Google permissions. Setup creates Catalog, Changes, References and Help tabs, then installs a five-minute trigger. No web app deployment is needed.': 'وافق على أذونات Google. ينشئ الإعداد تبويبات Catalog وChanges وReferences وHelp، ويضيف تشغيلًا كل خمس دقائق. لا تحتاج إلى نشر تطبيق ويب.',
    'Incoming changes': 'التغييرات الواردة', 'Pause submissions and approvals': 'إيقاف إرسال التغييرات وتطبيقها',
    'Catalog refresh': 'تحديث الكتالوج', 'Pause product exports': 'إيقاف إرسال المنتجات إلى الشيت',
    'Allow new draft products': 'السماح بإنشاء منتجات كمسودات', 'New products': 'المنتجات الجديدة',
    'Permitted fields': 'الحقول المسموح بتعديلها', 'These permissions are enforced on the server for every submission and approval.': 'تُطبق هذه الصلاحيات على الخادم عند إرسال كل طلب وعند الموافقة عليه.',
    'Product scope': 'نطاق المنتجات', 'Leave empty for all products, or enter product IDs separated by commas. Include the parent ID when allowing variations. Creation is disabled when a scope is set.': 'اتركه فارغًا لجميع المنتجات أو أدخل معرّفات مفصولة بفواصل. أضف معرّف الأب عند السماح بالمتغيرات. إنشاء المنتجات يتوقف عند تحديد نطاق.',
    'Allowed custom fields': 'الحقول المخصصة المسموح بها', 'Comma-separated keys starting with sb_. Only simple scalar values are supported.': 'مفاتيح مفصولة بفواصل تبدأ بـ sb_. تدعم القيم النصية والرقمية والمنطقية البسيطة فقط.',
    'Save settings': 'حفظ الإعدادات', 'Settings saved.': 'تم حفظ الإعدادات.', 'Interface language': 'لغة الواجهة',
    'Request failed': 'تعذر تنفيذ الطلب', 'Working…': 'جار التنفيذ…', 'Clear value': 'مسح القيمة',
    Continue: 'متابعة', Cancel: 'إلغاء',
    'Connection timed out. Refresh Reviews before trying again.': 'انتهت مهلة الاتصال. حدّث المراجعات وتأكد من حالة الطلب قبل إعادة المحاولة.',
    'Manual approval is always required. Google timing depends on its trigger service.': 'كل تعديل يحتاج إلى موافقة يدوية. توقيت المزامنة يعتمد على خدمة المشغّلات من Google.',
    'Price changes over 50% deserve another check.': 'راجع بعناية أي تعديل للسعر يتجاوز 50%.',
    'A snapshot is checked again at approval. Conflicts are stopped; successful requests cannot run twice.': 'يُفحص المنتج مرة أخرى عند الموافقة. تتوقف الطلبات المتعارضة، ولا يُنفذ الطلب الناجح مرتين.',
  };
  const fieldNames = {
    name: ['Name', 'اسم المنتج'], sku: ['SKU', 'رمز SKU'], regular_price: ['Regular price', 'السعر الأساسي'], sale_price: ['Sale price', 'سعر التخفيض'],
    description: ['Description', 'الوصف الكامل'], short_description: ['Short description', 'الوصف المختصر'], status: ['Publication status', 'حالة النشر'],
    stock_adjustment: ['Stock adjustment', 'إضافة أو خصم مخزون'], initial_stock: ['Initial stock for new products', 'مخزون أولي لمنتج جديد'],
    manage_stock: ['Manage stock', 'إدارة الكمية'], stock_status: ['Stock status without quantity tracking', 'حالة التوفر دون تتبع الكمية'], backorders: ['Backorders', 'الطلبات المؤجلة'],
    category_ids: ['Category IDs', 'معرّفات التصنيفات'], tag_ids: ['Tag IDs', 'معرّفات الوسوم'], image_id: ['Featured image ID', 'معرّف الصورة الرئيسية'],
    gallery_ids: ['Gallery image IDs', 'معرّفات صور المعرض'], upsell_ids: ['Upsell IDs', 'معرّفات المنتجات الأعلى'], cross_sell_ids: ['Cross-sell IDs', 'معرّفات المنتجات المرتبطة'],
    weight: ['Weight', 'الوزن'], length: ['Length', 'الطول'], width: ['Width', 'العرض'], height: ['Height', 'الارتفاع'],
    attributes: ['Local attributes', 'الخصائص المحلية'], variation_attributes: ['Variation options', 'خيارات المتغير'], meta: ['Allowed custom fields', 'الحقول المخصصة المسموح بها'],
  };
  const t = (text) => lang === 'ar' ? (arabic[text] || text) : text;
  const errorMessages = {
    conflict: 'تغيرت بيانات المنتج بعد تجهيز الطلب. حدّث Catalog وأرسل صفًا جديدًا.',
    insufficient_stock: 'الكمية المطلوب خصمها أكبر من المخزون الحالي. راجع المبيعات ثم جهّز تعديلًا مناسبًا.',
    field_forbidden: 'هذا الحقل غير مسموح بتعديله. راجع إعدادات الحقول مع مدير الموقع.',
    outside_scope: 'المنتج خارج نطاق الاتصال المسموح به.',
    inbound_paused: 'التغييرات الواردة متوقفة. استأنفها من الإعدادات.',
    outbound_paused: 'تحديث الكتالوج متوقف. استأنفه من الإعدادات.',
    sale_price_invalid: 'سعر التخفيض يجب أن يكون أقل من السعر الأساسي. استخدم المسح الصريح لإزالة التخفيض.',
    duplicate_sku: 'رمز SKU مستخدم لمنتج آخر. اختر رمزًا مختلفًا.',
    duplicate_variation: 'يوجد متغير يغطي مجموعة الخيارات نفسها.',
    invalid_number: 'أدخل رقمًا غير سالب دون رمز عملة، واستخدم النقطة للفاصل العشري.',
    invalid_stock: 'أدخل عدد وحدات صحيحًا غير صفري للإضافة أو الخصم.',
    stock_not_managed: 'فعّل إدارة المخزون على المنتج نفسه داخل WooCommerce أولًا.',
    write_failed: 'تعذر حفظ الطلب. راجع سبب الفشل مع المسؤول ثم أعد محاولة الطلب نفسه.',
    busy: 'يجري تطبيق تعديل آخر. أعد المحاولة بعد قليل.',
    unauthorized: 'مفتاح الربط غير صحيح أو منتهي. أنشئ مفتاحًا جديدًا من WordPress.',
    forbidden: 'تحتاج إلى حساب WordPress بالصلاحية المناسبة. أعد تحميل الصفحة لتجديد التحقق.',
    rate_limit: 'طلبات كثيرة. انتظر دقيقة قبل إعادة المحاولة.',
    https_required: 'يجب ضبط اتصال HTTPS على المتجر.',
    transactional_storage_required: 'تحتاج قاعدة البيانات إلى جداول InnoDB. اطلب من مسؤول الاستضافة فحصها.',
    reversal_conflict: 'توجد تعديلات أحدث على المنتج. راجعها قبل إعداد تراجع يدوي.',
    create_disabled: 'إنشاء المنتجات غير مفعّل أو يوجد نطاق منتجات محدد.',
  };
  const errorText = (code, fallback) => lang === 'ar' ? (errorMessages[String(code || '').replace(/^sheetbridge_/, '')] || `تعذر تنفيذ الطلب: ${fallback}`) : fallback;
  const label = (key) => fieldNames[key]?.[lang === 'ar' ? 1 : 0] || key;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const date = value => value ? new Date(/Z|\+\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z').toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB') : t('No contact yet');
  const format = value => value === null ? t('Clear value') : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '—');
  const badge = state => `<span class="sb-badge sb-${esc(state)}">${esc(t(state))}</span>`;

  async function api(path, body) {
    const [route, query = ''] = path.split('?');
    const url = new URL(config.api + route);
    new URLSearchParams(query).forEach((value, key) => url.searchParams.set(key, value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(url.toString(), { signal: controller.signal, method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-WP-Nonce': config.nonce, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch (error) {
      throw new Error(error.name === 'AbortError' ? t('Connection timed out. Refresh Reviews before trying again.') : error.message);
    } finally { clearTimeout(timeout); }
    let data;
    try { data = await response.json(); } catch { throw new Error(t('Request failed') + ` (${response.status})`); }
    if (!response.ok) throw new Error(`${errorText(data.code, data.message || t('Request failed'))} [${data.code || response.status}]`);
    return data;
  }
  function notice(message, error = false) {
    const area = document.getElementById('sb-notice');
    area.className = 'sb-alert' + (error ? ' sb-error' : '');
    area.textContent = message;
    area.hidden = false;
    area.setAttribute('role', error ? 'alert' : 'status');
  }
  async function busy(button, action) {
    button.disabled = true;
    try { await action(); } catch (error) { notice(error.message, true); } finally { if (button.isConnected) button.disabled = false; }
  }
  function confirmAction(message) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'sb-confirm';
      dialog.setAttribute('aria-labelledby', 'sb-confirm-message');
      dialog.innerHTML = `<p id="sb-confirm-message">${esc(message)}</p><div class="sb-row"><button class="sb-primary" data-confirm="yes">${esc(t('Continue'))}</button><button data-confirm="no">${esc(t('Cancel'))}</button></div>`;
      const finish = accepted => { dialog.close(); dialog.remove(); resolve(accepted); };
      dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
      dialog.querySelector('[data-confirm=yes]').onclick = () => finish(true);
      dialog.querySelector('[data-confirm=no]').onclick = () => finish(false);
      root.append(dialog); dialog.showModal();
      dialog.querySelector('[data-confirm=no]').focus();
    });
  }
  function shell() {
    root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    root.innerHTML = `<header class="sb-header"><div class="sb-brand"><div class="sb-logo" aria-hidden="true">S</div><div><h1>SheetBridge</h1><p>${esc(t('Product changes, with a clear review before publishing.'))}</p></div></div><button id="sb-language">${lang === 'ar' ? 'English' : 'العربية'}</button></header>
      <nav class="sb-tabs" aria-label="SheetBridge">${['overview', 'reviews', 'connect', 'settings'].map(name => `<button data-tab="${name}" aria-selected="${tab === name}">${esc(t(name[0].toUpperCase() + name.slice(1)))}</button>`).join('')}<a class="sb-button" href="${esc(config.guide)}" target="_blank" rel="noopener">${esc(t('Guide'))} ↗</a></nav>
      <div id="sb-notice" hidden></div><main id="sb-content"></main><footer>SheetBridge ${esc(config.version)} · ${esc(t('Manual approval is always required. Google timing depends on its trigger service.'))}<div><bdi lang="en" dir="ltr">by muhammed nasser</bdi></div></footer>`;
    document.getElementById('sb-language').onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; render().catch(error => notice(error.message, true)); };
    root.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { tab = button.dataset.tab; detail = null; render().catch(error => notice(error.message, true)); });
  }
  async function render() {
    const version = ++renderVersion;
    const selectedTab = tab;
    shell();
    const content = document.getElementById('sb-content');
    content.innerHTML = `<p role="status">${esc(t('Working…'))}</p>`;
    if (!dashboard) dashboard = await api('admin/dashboard');
    if (version !== renderVersion || !content.isConnected) return;
    if (selectedTab === 'overview') overview(content);
    if (selectedTab === 'reviews') await reviews(content);
    if (selectedTab === 'connect') connect(content);
    if (selectedTab === 'settings') settings(content);
  }
  function overview(content) {
    const h = dashboard.health;
    content.innerHTML = `<div class="sb-grid">${[['Awaiting review', dashboard.counts.pending], ['Applied', dashboard.counts.applied], ['Needs attention', dashboard.counts.failed + dashboard.counts.conflict]].map(([title, count]) => `<article class="sb-card"><span>${esc(t(title))}</span><strong>${count}</strong><small>WooCommerce · Google Sheets</small></article>`).join('')}</div>
      <div class="sb-columns"><section class="sb-panel"><h2>${esc(t('Your next steps'))}</h2><ol>${['Configure permitted fields in Settings.', 'Connect a private Google Apps Script to your spreadsheet.', 'Edit the Changes tab and set Ready to TRUE.', 'Review the proposal here, then apply it.'].map(text => `<li>${esc(t(text))}</li>`).join('')}</ol><div class="sb-row"><button id="sb-start" class="sb-primary">${esc(t('Open setup'))}</button><a class="sb-button" target="_blank" rel="noopener" href="${esc(config.guide)}">${esc(t('Read the guide'))}</a></div></section>
      <section class="sb-panel"><h2>${esc(t('Diagnostics'))}</h2><ul class="sb-health">${[['HTTPS connection', h.https], ['Transactional database', h.transactional_storage]].map(([name, ok]) => `<li><span>${esc(t(name))}</span><strong>${esc(t(ok ? 'Ready' : 'Needs setup'))}</strong></li>`).join('')}<li><span>WooCommerce</span><strong>${esc(h.woocommerce)}</strong></li><li><span>${esc(t('Last connector contact'))}</span><span>${esc(date(dashboard.last_contact))}</span></li><li><span>${esc(t('Connection key expires'))}</span><span>${dashboard.connection_expires ? esc(date(new Date(dashboard.connection_expires * 1000).toISOString())) : esc(t('No active key'))}</span></li></ul></section></div>
      <section class="sb-callout"><h3>${esc(t('Stock adjustments preserve sales'))}</h3><p>${esc(t('Enter +5 to add five units or -2 to remove two. Current stock is a reference, not an editable absolute quantity.'))}</p></section>`;
    document.getElementById('sb-start').onclick = () => { tab = 'connect'; render().catch(error => notice(error.message, true)); };
  }
  async function reviews(content) {
    const version = ++reviewVersion;
    const requests = await api(`admin/requests?page=${page}&state=${encodeURIComponent(filter)}`);
    if (version !== reviewVersion || !content.isConnected) return;
    content.innerHTML = `<section class="sb-panel"><div class="sb-row sb-between"><h2>${esc(t('Reviews'))}</h2><div class="sb-row"><select id="sb-filter" aria-label="${esc(t('State'))}"><option value="">${esc(t('All states'))}</option>${['pending', 'applied', 'conflict', 'failed', 'rejected'].map(state => `<option value="${state}" ${filter === state ? 'selected' : ''}>${esc(t(state))}</option>`).join('')}</select><button id="sb-refresh">${esc(t('Refresh'))}</button></div></div>
      <div class="sb-table-wrap"><table><thead><tr>${['Request', 'Product', 'State', 'Submitted', 'View'].map(text => `<th>${esc(t(text))}</th>`).join('')}</tr></thead><tbody>${requests.map(job => `<tr><td>#${job.id}</td><td>${job.product_id || esc(t('New draft'))}</td><td>${badge(job.state)}</td><td>${esc(date(job.created_at))}</td><td><button data-view="${job.id}">${esc(t('View'))}</button></td></tr>`).join('')}</tbody></table></div>${requests.length ? '' : `<p class="sb-empty">${esc(t('No requests on this page.'))}</p>`}
      <div class="sb-row"><button id="sb-previous" ${page === 1 ? 'disabled' : ''}>${esc(t('Previous'))}</button><span>${page}</span><button id="sb-next" ${requests.length < 30 ? 'disabled' : ''}>${esc(t('Next'))}</button></div></section><div id="sb-detail"></div>`;
    document.getElementById('sb-filter').onchange = event => { filter = event.target.value; page = 1; reviews(content).catch(error => notice(error.message, true)); };
    document.getElementById('sb-refresh').onclick = () => reviews(content).catch(error => notice(error.message, true));
    document.getElementById('sb-previous').onclick = () => { page--; reviews(content).catch(error => notice(error.message, true)); };
    document.getElementById('sb-next').onclick = () => { page++; reviews(content).catch(error => notice(error.message, true)); };
    root.querySelectorAll('[data-view]').forEach(button => button.onclick = () => busy(button, async () => { detail = await api('admin/requests/' + button.dataset.view); showDetail(); }));
    if (detail) showDetail();
  }
  function showDetail() {
    const job = detail;
    const area = document.getElementById('sb-detail');
    if (!area || !job) return;
    const changes = job.payload.changes;
    const priceWarning = ['regular_price', 'sale_price'].some(field => Number(job.before_data[field]) > 0 && changes[field] !== undefined && Math.abs(Number(changes[field]) / Number(job.before_data[field]) - 1) > .5);
    area.innerHTML = `<section class="sb-panel sb-detail"><div class="sb-row sb-between"><h2>${esc(t('Review request'))} #${job.id} ${badge(job.state)}</h2><button id="sb-close">${esc(t('Close'))}</button></div><p class="sb-note">${esc(t('A snapshot is checked again at approval. Conflicts are stopped; successful requests cannot run twice.'))}</p>${job.error_message ? `<div class="sb-callout sb-error" role="alert">${esc(job.error_message)} [${esc(job.error_code)}]</div>` : ''}${priceWarning ? `<div class="sb-callout sb-warning">${esc(t('Price changes over 50% deserve another check.'))}</div>` : ''}
      <div class="sb-table-wrap"><table><thead><tr>${['Field', 'Before', 'Proposed'].map(text => `<th>${esc(t(text))}</th>`).join('')}</tr></thead><tbody>${Object.entries(changes).map(([field, value]) => `<tr><td>${esc(label(field))}</td><td><pre>${esc(format(field === 'stock_adjustment' ? job.before_data.stock_quantity : job.before_data[field]))}</pre></td><td><pre>${esc(format(value))}${field === 'stock_adjustment' ? '\n' + esc(t('Relative adjustment')) : ''}</pre></td></tr>`).join('')}</tbody></table></div><div class="sb-row" style="margin-top:20px">${['pending', 'failed'].includes(job.state) ? `<button data-action="apply" class="sb-primary">${esc(t('Apply changes'))}</button>` : ''}${['pending', 'failed', 'conflict'].includes(job.state) ? `<button data-action="reject" class="sb-danger">${esc(t('Reject'))}</button>` : ''}${job.state === 'applied' && job.payload.action === 'update' ? `<button data-action="reverse">${esc(t('Prepare reversal'))}</button>` : ''}</div></section>`;
    document.getElementById('sb-close').onclick = () => { detail = null; area.replaceChildren(); };
    area.querySelectorAll('[data-action]').forEach(button => button.onclick = () => busy(button, async () => {
      const action = button.dataset.action;
      if (action !== 'reverse' && !await confirmAction(t(action === 'apply' ? 'Apply this reviewed change to the store?' : 'Reject this request?'))) return;
      detail = await api(`admin/requests/${job.id}/${action}`, {});
      dashboard = await api('admin/dashboard');
      await reviews(document.getElementById('sb-content'));
      notice(t(action === 'reverse' ? 'The reversal is a new preview. Review it before applying.' : action === 'apply' ? 'Changes applied.' : 'Request rejected.'));
    }));
    area.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function connect(content) {
    content.innerHTML = `<section class="sb-panel"><h2>${esc(t('Connect your spreadsheet'))}</h2><ol class="sb-stack"><li><h3>${esc(t('Create a blank spreadsheet'))}</h3><p>${esc(t('Create a new Google spreadsheet. Copy its ID from the URL between /d/ and /edit.'))}</p></li>
      <li><h3>${esc(t('Create a private script'))}</h3><p>${esc(t('Open a standalone Apps Script project. Paste the connector code into Code.gs. Do not share this project with sheet editors.'))}</p><div class="sb-row"><a class="sb-button" href="${esc(config.connector)}" download="SheetBridge.gs">${esc(t('Download connector'))}</a><a class="sb-button" href="https://script.google.com/home/start" target="_blank" rel="noopener">${esc(t('Open Apps Script'))} ↗</a></div></li>
      <li><h3>${esc(t('Add three script properties'))}</h3><p>${esc(t('In Apps Script open Project Settings → Script properties. Add these names exactly.'))}</p><div class="sb-table-wrap"><table><tbody><tr><th><code>SHOP_URL</code></th><td><code dir="ltr">${esc(config.store)}</code></td></tr><tr><th><code>SPREADSHEET_ID</code></th><td>${esc(t('Your spreadsheet ID'))}</td></tr><tr><th><code>CONNECTION_TOKEN</code></th><td>${esc(t('A newly generated connection key'))}</td></tr></tbody></table></div>${config.owner ? `<div class="sb-row" style="margin-top:16px"><button id="sb-key" class="sb-primary">${esc(t('Generate new key'))}</button><button id="sb-revoke" class="sb-danger">${esc(t('Revoke key'))}</button></div><div id="sb-key-output"></div>` : `<p>${esc(t('Only the site administrator can manage connection keys and settings.'))}</p>`}</li>
      <li><h3>${esc(t('Run setup, then syncNow'))}</h3><p>${esc(t('Authorize the Google permissions. Setup creates Catalog, Changes, References and Help tabs, then installs a five-minute trigger. No web app deployment is needed.'))}</p></li></ol></section>`;
    if (config.owner) {
      document.getElementById('sb-key').onclick = event => busy(event.target, async () => {
        if (!await confirmAction(t('A new key immediately invalidates the previous one. Continue?'))) return;
        const result = await api('admin/connection', { action: 'rotate' });
        const output = document.getElementById('sb-key-output');
        output.innerHTML = `<div class="sb-callout sb-warning"><label for="sb-secret">${esc(t('Copy this key now. It is displayed once and expires after 90 days. Keep it only in the private script properties.'))}</label><input class="sb-secret" id="sb-secret" type="password" readonly autocomplete="off"><button id="sb-show-key" type="button">${esc(t('View'))}</button></div>`;
        const input = document.getElementById('sb-secret'); input.value = result.token;
        document.getElementById('sb-show-key').onclick = () => { input.type = input.type === 'password' ? 'text' : 'password'; input.select(); };
        dashboard = await api('admin/dashboard');
      });
      document.getElementById('sb-revoke').onclick = event => busy(event.target, async () => { if (await confirmAction(t('Revoke the active connection key?'))) { await api('admin/connection', { action: 'revoke' }); document.getElementById('sb-key-output').replaceChildren(); notice(t('Key revoked.')); dashboard = await api('admin/dashboard'); } });
    }
  }
  function settings(content) {
    if (!config.owner) { content.innerHTML = `<section class="sb-panel">${esc(t('Only the site administrator can manage connection keys and settings.'))}</section>`; return; }
    const s = dashboard.settings;
    content.innerHTML = `<form id="sb-settings"><section class="sb-panel"><h2>${esc(t('Settings'))}</h2><div class="sb-fields">${[['inbound_paused', 'Pause submissions and approvals'], ['outbound_paused', 'Pause product exports'], ['allow_create', 'Allow new draft products']].map(([key, text]) => `<label class="sb-check"><input type="checkbox" name="${key}" ${s[key] ? 'checked' : ''}>${esc(t(text))}</label>`).join('')}</div><div style="margin-top:18px"><label for="sb-setting-language">${esc(t('Interface language'))}</label><select id="sb-setting-language" name="language"><option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option><option value="ar" ${s.language === 'ar' ? 'selected' : ''}>العربية</option></select></div></section>
      <section class="sb-panel"><h2>${esc(t('Permitted fields'))}</h2><p>${esc(t('These permissions are enforced on the server for every submission and approval.'))}</p><div class="sb-fields">${config.fields.map(field => `<label class="sb-check"><input type="checkbox" name="fields" value="${field}" ${s.fields.includes(field) ? 'checked' : ''}>${esc(label(field))}</label>`).join('')}</div></section>
      <section class="sb-panel sb-stack"><div><label for="sb-scope">${esc(t('Product scope'))}</label><input id="sb-scope" name="product_ids" type="text" value="${esc(s.product_ids.join(','))}" dir="ltr"><p class="sb-note">${esc(t('Leave empty for all products, or enter product IDs separated by commas. Include the parent ID when allowing variations. Creation is disabled when a scope is set.'))}</p></div><div><label for="sb-meta">${esc(t('Allowed custom fields'))}</label><input id="sb-meta" name="meta_keys" type="text" value="${esc(s.meta_keys.join(','))}" dir="ltr"><p class="sb-note">${esc(t('Comma-separated keys starting with sb_. Only simple scalar values are supported.'))}</p></div><div><button class="sb-primary" type="submit">${esc(t('Save settings'))}</button></div></section></form>`;
    document.getElementById('sb-settings').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.target);
      busy(event.target.querySelector('[type=submit]'), async () => {
        dashboard.settings = await api('admin/settings', { language: form.get('language'), inbound_paused: form.has('inbound_paused'), outbound_paused: form.has('outbound_paused'), allow_create: form.has('allow_create'), fields: form.getAll('fields'), product_ids: form.get('product_ids'), meta_keys: form.get('meta_keys') });
        lang = dashboard.settings.language; await render(); notice(t('Settings saved.'));
      });
    };
  }
  render().catch(error => { if (!document.getElementById('sb-notice')) shell(); notice(error.message, true); });
})();
