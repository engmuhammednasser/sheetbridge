<?php
$_SERVER['HTTP_HOST'] = '127.0.0.1:18765';
require dirname(__DIR__) . '/.runtime/wordpress/wp-load.php';
if (wp_get_environment_type() !== 'local' || DB_NAME !== 'sheetbridge_test') exit(2);
$product = new WC_Product_Simple(); $product->set_name('Browser approval check'); $product->set_regular_price('100'); $product->set_status('draft'); $product->save();
$product = SheetBridge\Products::fresh($product->get_id());
$job = (new SheetBridge\Sync())->preview(['request_id' => 'browser_' . bin2hex(random_bytes(12)), 'action' => 'update', 'product_id' => $product->get_id(), 'revision' => SheetBridge\Products::snapshot($product)['revision'], 'changes' => ['regular_price' => '125']]);
echo 'Browser test request: ' . $job['id'] . "\n";
