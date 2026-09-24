<?php
$_SERVER['HTTP_HOST'] = '127.0.0.1:18765';
require dirname(__DIR__) . '/.runtime/wordpress/wp-load.php';
use SheetBridge\{Settings, Products, Validation, Sync};
if (wp_get_environment_type() !== 'local' || DB_NAME !== 'sheetbridge_test') throw new RuntimeException('Isolated database required.');
wp_set_current_user(get_user_by('login', 'sb_local_admin')->ID);
$settings = Settings::defaults(); $settings['fields'] = Validation::fields(); update_option('sheetbridge_settings', $settings, false);
$product = new WC_Product_Simple(); $product->set_name('Concurrent stock test'); $product->set_regular_price('10'); $product->set_status('publish'); $product->set_manage_stock(true); $product->set_stock_quantity(100); $product->save();
$request = ['request_id' => 'concurrency_' . bin2hex(random_bytes(10)), 'action' => 'update', 'product_id' => $product->get_id(), 'revision' => Products::snapshot(Products::fresh($product->get_id()))['revision'], 'changes' => ['stock_adjustment' => 20]];
$job = (new Sync())->preview($request);
$workers = [];
foreach ([['sales', $product->get_id()], ['apply', $job['id']], ['apply', $job['id']]] as [$mode, $id]) {
    $pipes = [];
    $process = proc_open([PHP_BINARY, __DIR__ . '/stock-worker.php', $mode, (string) $id], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname(__DIR__));
    if (!is_resource($process)) throw new RuntimeException('Could not start concurrency worker.');
    fclose($pipes[0]); $workers[] = [$process, $pipes];
}
foreach ($workers as [$process, $pipes]) {
    $stdout = stream_get_contents($pipes[1]); $stderr = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]);
    $code = proc_close($process);
    if ($code !== 0) throw new RuntimeException('Worker failed: ' . $stderr);
    echo trim($stdout) . "\n";
}
$quantity = (int) Products::fresh($product->get_id())->get_stock_quantity();
if ($quantity !== 80) throw new RuntimeException('Concurrent stock lost updates: expected 80, received ' . $quantity);
echo "PASS 40 concurrent sales and two approvals preserve stock at 80 (100 - 40 + 20 once).\n";
