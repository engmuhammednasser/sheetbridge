<?php
/**
 * Plugin Name: SheetBridge for WooCommerce
 * Description: Review and synchronize WooCommerce product changes from Google Sheets with explicit approvals and inventory safeguards.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Requires Plugins: woocommerce
 * WC requires at least: 9.0
 * Author: SheetBridge contributors
 * License: GPL-2.0-or-later
 * Text Domain: sheetbridge
 */

defined('ABSPATH') || exit;
define('SHEETBRIDGE_VERSION', '1.0.0');
define('SHEETBRIDGE_FILE', __FILE__);
define('SHEETBRIDGE_DIR', __DIR__ . '/');

spl_autoload_register(static function (string $class): void {
    if (str_starts_with($class, 'SheetBridge\\')) {
        $name = substr($class, strlen('SheetBridge\\'));
        if (preg_match('/^[A-Za-z]+$/', $name) && is_file(__DIR__ . '/includes/' . $name . '.php')) {
            require_once __DIR__ . '/includes/' . $name . '.php';
        }
    }
});

register_activation_hook(__FILE__, [SheetBridge\Storage::class, 'install']);
add_action('before_woocommerce_init', static function (): void {
    if (class_exists(Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});
add_action('plugins_loaded', static function (): void {
    if (!class_exists('WooCommerce') || version_compare(WC_VERSION, '9.0', '<')) {
        add_action('admin_notices', static function (): void {
            echo '<div class="notice notice-error"><p>' . esc_html__('SheetBridge requires WooCommerce 9.0 or newer.', 'sheetbridge') . '</p></div>';
        });
        return;
    }
    if (get_option('sheetbridge_db_version') !== SHEETBRIDGE_VERSION) {
        SheetBridge\Storage::install();
    }
    (new SheetBridge\Rest())->register();
    (new SheetBridge\Admin())->register();
});

