<?php
/** Local test server only. Never include this file in a release ZIP. */
$root = dirname(__DIR__) . '/.runtime/wordpress';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/_test-login' && in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1'], true)) {
    require $root . '/wp-load.php';
    if (wp_get_environment_type() !== 'local' || DB_NAME !== 'sheetbridge_test') {
        http_response_code(403);
        exit;
    }
    $admin = get_user_by('login', 'sb_local_admin');
    wp_set_current_user($admin->ID);
    wp_set_auth_cookie($admin->ID, false, false);
    wp_safe_redirect(admin_url('admin.php?page=sheetbridge'));
    exit;
}
if ($path !== '/' && is_file($root . $path)) {
    return false;
}
require $root . '/index.php';
