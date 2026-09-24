<?php
/** Install only the isolated local test store. No real store data or account is used. */
$root = dirname(__DIR__) . '/.runtime/wordpress';
$_SERVER['HTTP_HOST'] = '127.0.0.1:18765';
define('WP_INSTALLING', true);
require $root . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
if (!is_blog_installed()) {
    wp_install('SheetBridge Test Store', 'sb_local_admin', 'local-admin@example.test', false, '', wp_generate_password(48, true, true));
}
update_option('siteurl', 'http://127.0.0.1:18765');
update_option('home', 'http://127.0.0.1:18765');
update_option('blog_public', 0);
update_option('woocommerce_allow_tracking', 'no');
update_option('woocommerce_task_list_hidden', 'yes');
update_option('woocommerce_show_marketplace_suggestions', 'no');
echo "Isolated local WordPress installation ready.\n";
