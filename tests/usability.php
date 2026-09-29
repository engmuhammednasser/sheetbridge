<?php
$_SERVER['HTTP_HOST'] = '127.0.0.1:18765';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTPS'] = 'on';
require dirname(__DIR__) . '/.runtime/wordpress/wp-load.php';
use SheetBridge\{Settings, Storage, Products, Sync, Diagnostics, Problem};
if (wp_get_environment_type() !== 'local' || DB_NAME !== 'sheetbridge_test') throw new RuntimeException('Isolated database required');
wp_set_current_user(get_user_by('login', 'sb_local_admin')->ID);
$count = 0;
function check(bool $condition, string $name): void { global $count; if (!$condition) throw new RuntimeException('FAIL ' . $name); $count++; echo "PASS $name\n"; }
$original = get_option('sheetbridge_settings');
$originalStatus = get_option('sheetbridge_connector_status');
$product = new WC_Product_Simple();
$product->set_name('SB usability ' . bin2hex(random_bytes(5))); $product->set_sku('SB_UX_' . bin2hex(random_bytes(5))); $product->set_regular_price('100'); $product->set_status('draft'); $product->save();
$job = null;
try {
    update_option('sheetbridge_settings', Settings::defaults(), false);
    $saved = Settings::save(['fields' => ['regular_price'], 'price_warning_percent' => '25']);
    check($saved['price_warning_percent'] === 25, 'custom price warning saved');
    try { Settings::save(['fields' => [], 'price_warning_percent' => '0']); throw new RuntimeException('Missing validation'); } catch (Problem $error) { check($error->reason === 'invalid_threshold', 'invalid warning rejected'); }
    $job = (new Sync())->preview(['request_id' => 'usability_' . bin2hex(random_bytes(10)), 'action' => 'update', 'product_id' => $product->get_id(), 'revision' => Products::snapshot(Products::fresh($product->get_id()))['revision'], 'changes' => ['regular_price' => '130']]);
    check(count(Storage::listing(1, 'pending', $product->get_sku())) === 1, 'review found by SKU');
    check(count(Storage::listing(1, '', $product->get_name())) === 1, 'review found by product name');
    check(count(Storage::listing(1, '', "' OR 1=1 --")) === 0, 'search input remains literal');
    check(count(Storage::listing(1, '', '%')) === 0, 'SQL wildcard escaped');
    $view = Products::reviewIdentity($job);
    check($view['product']['name'] === $product->get_name() && str_contains($view['product']['edit_url'], 'post=' . $product->get_id()), 'review identity and edit link');
    delete_option('sheetbridge_connector_status');
    Diagnostics::report(['state' => 'success', 'connector_version' => '1.2.0', 'catalog_complete' => false, 'submitted' => 1, 'message' => 'SECRET_MUST_NOT_APPEAR']);
    $status = get_option('sheetbridge_connector_status');
    check($status['last_catalog'] === null && !empty($status['last_submission']), 'submission does not imply completed catalog');
    Diagnostics::report(['state' => 'paused', 'connector_version' => '1.2.0', 'catalog_complete' => true]);
    $completed = get_option('sheetbridge_connector_status')['last_catalog'];
    check(!empty($completed), 'catalog completion recorded while inbound paused');
    Diagnostics::report(['state' => 'error', 'connector_version' => '1.2.0', 'active_rows' => -9, 'error_kind' => 'SECRET_MUST_NOT_APPEAR']);
    $report = Diagnostics::download();
    check($report['connector']['last_catalog'] === $completed, 'failure retains previous successful completion');
    check($report['connector']['active_rows'] === 0 && $report['connector']['error_kind'] === '', 'reported metrics bounded and error kind allowlisted');
    $json = wp_json_encode($report);
    check(!str_contains($json, 'SECRET_MUST_NOT_APPEAR') && !str_contains($json, $product->get_sku()) && !str_contains($json, 'hash') && !str_contains($json, home_url()), 'download excludes secrets, site URL and product identity');
    rest_get_server();
    wp_set_current_user(0);
    $response = rest_do_request(new WP_REST_Request('GET', '/sheetbridge/v1/admin/diagnostics'));
    check($response->get_status() === 403, 'diagnostics requires owner and nonce');
    $response = rest_do_request(new WP_REST_Request('POST', '/sheetbridge/v1/connector-status'));
    check($response->get_status() === 401, 'status reports require connector authentication');
} finally {
    $product->delete(true);
    if ($job) { global $wpdb; $wpdb->delete(Storage::table(), ['id' => $job['id']]); }
    update_option('sheetbridge_settings', $original, false);
    if ($originalStatus === false) delete_option('sheetbridge_connector_status'); else update_option('sheetbridge_connector_status', $originalStatus, false);
}
echo "Usability checks passed: $count\n";
