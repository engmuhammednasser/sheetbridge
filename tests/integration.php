<?php
$_SERVER['HTTP_HOST'] = '127.0.0.1:18765';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTPS'] = 'on';
require dirname(__DIR__) . '/.runtime/wordpress/wp-load.php';
use SheetBridge\{Settings, Validation, Products, Storage, Sync, Problem};
if (wp_get_environment_type() !== 'local' || DB_NAME !== 'sheetbridge_test') throw new RuntimeException('Isolated test database required.');
wp_set_current_user(get_user_by('login', 'sb_local_admin')->ID);
$run = bin2hex(random_bytes(6));
$count = 0;
$sync = new Sync();
$settings = Settings::defaults(); $settings['fields'] = Validation::fields(); $settings['allow_create'] = true; $settings['meta_keys'] = ['sb_supplier'];
update_option('sheetbridge_settings', $settings, false);
function check(bool $value, string $label): void { global $count; if (!$value) throw new RuntimeException('FAIL ' . $label); $count++; echo "PASS $label\n"; }
function fails(callable $callback, string $reason): void { try { $callback(); throw new RuntimeException('Expected ' . $reason); } catch (Problem $error) { check($error->reason === $reason, $reason . ' rejected'); } }
function proposal(int $id, array $changes): array { global $run; return ['request_id' => $run . '_' . bin2hex(random_bytes(8)), 'action' => 'update', 'product_id' => $id, 'revision' => Products::snapshot(Products::fresh($id))['revision'], 'changes' => $changes]; }
function createProduct(string $type = 'simple'): WC_Product { global $run; $p = $type === 'variable' ? new WC_Product_Variable() : new WC_Product_Simple(); $p->set_name('Test ' . $run); $p->set_sku($run . '_' . bin2hex(random_bytes(3))); $p->set_status('publish'); if ($type === 'simple') { $p->set_regular_price('100'); $p->set_manage_stock(true); $p->set_stock_quantity(10); } $p->save(); return $p; }

Storage::assertTransactional(); check(true, 'InnoDB preflight');
$product = createProduct(); $id = $product->get_id();
$input = proposal($id, ['regular_price' => '120', 'sku' => '000' . $run]);
$job = $sync->preview($input);
check(Products::fresh($id)->get_regular_price('edit') === '100', 'preview never writes products');
check($sync->preview($input)['id'] === $job['id'], 'preview is idempotent');
$different = $input; $different['changes']['regular_price'] = '130';
fails(fn() => $sync->preview($different), 'request_id_reused');
$done = $sync->apply($job['id']);
check($done['state'] === 'applied' && Products::fresh($id)->get_regular_price('edit') === '120', 'approved price persisted');
check(Products::fresh($id)->get_sku('edit') === '000' . $run, 'SKU leading zeros persist');
check($sync->apply($job['id'])['state'] === 'applied', 'repeated apply is idempotent');

$stale = proposal($id, ['name' => 'Stale name']);
$p = Products::fresh($id); $p->set_name('Newer name'); $p->save();
fails(fn() => $sync->preview($stale), 'conflict');
$job = $sync->preview(proposal($id, ['regular_price' => '140']));
$p = Products::fresh($id); $p->set_regular_price('150'); $p->save();
fails(fn() => $sync->apply($job['id']), 'conflict');
check(Products::fresh($id)->get_regular_price('edit') === '150', 'conflict preserves newer edit');

$job = $sync->preview(proposal($id, ['stock_adjustment' => 5]));
wc_update_product_stock($id, 3, 'decrease');
$sync->apply($job['id']);
check((int) Products::fresh($id)->get_stock_quantity() === 12, 'sale between preview and approval preserved');
$sync->apply($job['id']);
check((int) Products::fresh($id)->get_stock_quantity() === 12, 'stock delta cannot apply twice');
wc_update_product_stock($id, 2, 'decrease');
$reverse = $sync->reverse($job['id']);
$sync->apply($reverse['id']);
check((int) Products::fresh($id)->get_stock_quantity() === 5, 'stock reversal preserves later sale');
check($sync->reverse($job['id'])['id'] === $reverse['id'], 'reversal itself is idempotent');
$job = $sync->preview(proposal($id, ['stock_adjustment' => -6]));
fails(fn() => $sync->apply($job['id']), 'insufficient_stock');
check((int) Products::fresh($id)->get_stock_quantity() === 5, 'excessive reduction leaves stock unchanged');

$job = $sync->preview(proposal($id, ['sale_price' => '99'])); $sync->apply($job['id']);
$job = $sync->preview(proposal($id, ['sale_price' => null])); $sync->apply($job['id']);
check(Products::fresh($id)->get_sale_price('edit') === '', 'clear sale removes discount');
fails(fn() => $sync->preview(proposal($id, ['sale_price' => '999'])), 'sale_price_invalid');
fails(fn() => $sync->preview(proposal($id, ['initial_stock' => 20])), 'absolute_stock_forbidden');

$job = $sync->preview(proposal($id, ['name' => 'Permission test']));
$limited = $settings; $limited['fields'] = ['regular_price']; update_option('sheetbridge_settings', $limited, false);
fails(fn() => $sync->apply($job['id']), 'field_forbidden');
update_option('sheetbridge_settings', $settings, false);
$limited = $settings; $limited['product_ids'] = [$id + 100000]; update_option('sheetbridge_settings', $limited, false);
fails(fn() => $sync->preview(proposal($id, ['name' => 'Forbidden'])) , 'outside_scope');
fails(fn() => $sync->preview($input), 'outside_scope');
update_option('sheetbridge_settings', $settings, false);
$limited = $settings; $limited['inbound_paused'] = true; update_option('sheetbridge_settings', $limited, false);
fails(fn() => $sync->preview(proposal($id, ['name' => 'Paused'])), 'inbound_paused');
fails(fn() => $sync->apply($job['id']), 'inbound_paused');
update_option('sheetbridge_settings', $settings, false);
$sync->reject($job['id']); fails(fn() => $sync->apply($job['id']), 'not_pending');

$other = createProduct();
fails(fn() => $sync->preview(proposal($id, ['sku' => $other->get_sku()])), 'duplicate_sku');
fails(fn() => $sync->preview(proposal($id, ['category_ids' => [99999999]])), 'missing_term');
fails(fn() => $sync->preview(proposal($id, ['image_id' => $other->get_id()])), 'missing_image');
$term = wp_insert_term('Category ' . $run, 'product_cat');
$job = $sync->preview(proposal($id, ['category_ids' => [$term['term_id']], 'meta' => ['sb_supplier' => 'Supplier'], 'description' => '<p>Hello</p><script>alert(1)</script>']));
$sync->apply($job['id']);
check(in_array($term['term_id'], Products::fresh($id)->get_category_ids(), true), 'taxonomy assignment saved');
check(Products::fresh($id)->get_meta('sb_supplier') === 'Supplier', 'allowlisted scalar metadata saved');
check(!str_contains(Products::fresh($id)->get_description('edit'), '<script'), 'unsafe description HTML stripped');
$undo = $sync->reverse($job['id']); $sync->apply($undo['id']);
check(!Products::fresh($id)->meta_exists('sb_supplier'), 'metadata reversal restores absence rather than empty value');
fails(fn() => $sync->preview(proposal($id, ['attributes' => [['name' => 'A B', 'options' => ['One']], ['name' => 'A-B', 'options' => ['Two']]]])), 'attribute_key_collision');

$new = ['request_id' => $run . '_create_simple', 'action' => 'create', 'product_id' => 0, 'changes' => ['name' => 'Created draft', 'sku' => 'created_' . $run, 'regular_price' => '20', 'initial_stock' => 4]];
$job = $sync->preview($new); $created = $sync->apply($job['id']);
check(Products::fresh($created['product_id'])->get_status() === 'draft', 'new products are drafts');
check((int) Products::fresh($created['product_id'])->get_stock_quantity() === 4, 'new initial stock saved');
check($sync->apply($job['id'])['product_id'] === $created['product_id'], 'creation retry does not duplicate product');
$newFailure = $new; $newFailure['request_id'] .= '_rollback'; $newFailure['changes']['sku'] .= '_rollback';
$failedCreation = $sync->preview($newFailure);
$createdId = 0;
$failCreate = static function ($saved) use (&$createdId, $newFailure): void { if ($saved->get_sku() === $newFailure['changes']['sku']) { $createdId = $saved->get_id(); throw new RuntimeException('Simulated creation failure'); } };
add_action('woocommerce_after_product_object_save', $failCreate);
fails(fn() => $sync->apply($failedCreation['id']), 'write_failed');
remove_action('woocommerce_after_product_object_save', $failCreate);
check($createdId > 0 && !get_post($createdId), 'failed creation rolls back post and invalidates cache');
$recovered = $sync->apply($failedCreation['id']);
check(Products::fresh($recovered['product_id'])->get_sku() === $newFailure['changes']['sku'], 'creation recovers using same request after rollback');

$parent = createProduct('variable');
$job = $sync->preview(proposal($parent->get_id(), ['attributes' => [['name' => 'Color', 'options' => ['Black', 'White'], 'variation' => true]]]));
$sync->apply($job['id']);
$new = ['request_id' => $run . '_create_variation', 'action' => 'create', 'product_id' => 0, 'parent_id' => $parent->get_id(), 'type' => 'variation', 'changes' => ['variation_attributes' => ['color' => 'Black'], 'regular_price' => '25', 'initial_stock' => 3]];
$job = $sync->preview($new); $variation = $sync->apply($job['id']);
check(Products::fresh($variation['product_id'])->get_parent_id() === $parent->get_id(), 'variation belongs to correct parent');
$duplicate = $new; $duplicate['request_id'] .= '_duplicate';
fails(fn() => $sync->preview($duplicate), 'duplicate_variation');
$job = $sync->preview(proposal($variation['product_id'], ['regular_price' => '30'])); $sync->apply($job['id']);
check(Products::fresh($variation['product_id'])->get_regular_price('edit') === '30', 'variation price updated');
fails(fn() => $sync->preview(proposal($parent->get_id(), ['regular_price' => '20'])), 'variable_child_required');
fails(fn() => $sync->preview(proposal($parent->get_id(), ['attributes' => []])), 'parent_attributes_in_use');

$prior = Products::fresh($id)->get_name('edit');
$job = $sync->preview(proposal($id, ['name' => 'Must roll back']));
$failure = static function ($saved) use ($id): void { if ($saved->get_id() === $id) throw new RuntimeException('Simulated post-save failure'); };
add_action('woocommerce_after_product_object_save', $failure);
fails(fn() => $sync->apply($job['id']), 'write_failed');
remove_action('woocommerce_after_product_object_save', $failure);
check(Products::fresh($id)->get_name('edit') === $prior, 'transaction rollback restores product after save hook failure');
check(Storage::get($job['id'])['state'] === 'failed', 'failure is visible in audit');
$sync->apply($job['id']); check(Products::fresh($id)->get_name('edit') === 'Must roll back', 'failed transaction retries once after recovery');

// Exercise the actual REST permission callbacks; credentials stay in memory.
do_action('rest_api_init');
$token = Settings::rotate();
wp_set_current_user(0);
$request = new WP_REST_Request('GET', '/sheetbridge/v1/catalog');
check(rest_do_request($request)->get_status() === 401, 'anonymous catalog access rejected');
$request->set_header('X-SheetBridge-Token', $token);
check(rest_do_request($request)->get_status() === 200, 'valid scoped connection reads catalog');
$adminRequest = new WP_REST_Request('POST', '/sheetbridge/v1/admin/requests/' . $job['id'] . '/apply');
$adminRequest->set_header('X-SheetBridge-Token', $token);
check(rest_do_request($adminRequest)->get_status() === 403, 'connection key cannot approve changes');
$_SERVER['HTTPS'] = 'off'; check(rest_do_request($request)->get_status() === 403, 'HTTP rejected'); $_SERVER['HTTPS'] = 'on';
$rotated = Settings::rotate(); check(rest_do_request($request)->get_status() === 401, 'rotation revokes previous credential');
$request->set_header('X-SheetBridge-Token', $rotated);
$connection = get_option('sheetbridge_connection'); $connection['site_url'] = 'https://another-store.example/'; update_option('sheetbridge_connection', $connection, false);
check(rest_do_request($request)->get_status() === 401, 'site URL change invalidates cloned credential');
$connection['site_url'] = home_url('/'); update_option('sheetbridge_connection', $connection, false);
$connection = get_option('sheetbridge_connection'); $connection['expires'] = time() - 1; update_option('sheetbridge_connection', $connection, false);
check(rest_do_request($request)->get_status() === 401, 'expired credential rejected');
Settings::revoke();
wp_set_current_user(get_user_by('login', 'sb_local_admin')->ID);
$nonceRequest = new WP_REST_Request('GET', '/sheetbridge/v1/admin/dashboard');
check(rest_do_request($nonceRequest)->get_status() === 403, 'admin without nonce rejected');
$nonceRequest->set_header('X-WP-Nonce', wp_create_nonce('wp_rest'));
check(rest_do_request($nonceRequest)->get_status() === 200, 'admin with nonce authorized');
$largeRequest = new WP_REST_Request('POST', '/sheetbridge/v1/admin/preview');
$largeRequest->set_header('X-WP-Nonce', wp_create_nonce('wp_rest')); $largeRequest->set_header('Content-Type', 'application/json');
$largeRequest->set_body(json_encode(['oversized' => str_repeat('x', 262144)]));
check(rest_do_request($largeRequest)->get_status() === 413, 'oversized payload rejected');
global $wpdb;
$bucket = 'connection-' . (int) floor(time() / 60);
$wpdb->replace($wpdb->prefix . 'sheetbridge_limits', ['bucket' => $bucket, 'hits' => 119, 'expires' => time() + 120]);
check(Storage::rateLimit() && !Storage::rateLimit(), 'authenticated rate limit enforced at 120 requests');
$wpdb->update($wpdb->prefix . 'sheetbridge_limits', ['hits' => 0], ['bucket' => $bucket]);
$catalog = Products::catalog(0, 1); check(count($catalog['products']) <= 1 && $catalog['has_more'], 'bounded cursor pagination');
echo "Integration checks passed: $count\n";
