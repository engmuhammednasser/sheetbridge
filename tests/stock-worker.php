<?php
$_SERVER['HTTP_HOST'] = '127.0.0.1:18765';
require dirname(__DIR__) . '/.runtime/wordpress/wp-load.php';
if (wp_get_environment_type() !== 'local' || DB_NAME !== 'sheetbridge_test') exit(2);
$mode = $argv[1] ?? '';
$id = (int) ($argv[2] ?? 0);
if ($mode === 'sales') {
    for ($i = 0; $i < 40; $i++) {
        wc_update_product_stock($id, 1, 'decrease');
        usleep(8000);
    }
    echo "sales complete\n";
} elseif ($mode === 'apply') {
    wp_set_current_user(get_user_by('login', 'sb_local_admin')->ID);
    $result = (new SheetBridge\Sync())->apply($id);
    echo $result['state'] . "\n";
} else { exit(3); }

