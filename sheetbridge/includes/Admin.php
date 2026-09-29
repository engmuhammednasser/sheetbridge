<?php
namespace SheetBridge;

final class Admin
{
    public function register(): void
    {
        add_action('admin_menu', [$this, 'menu']);
        add_action('admin_enqueue_scripts', [$this, 'assets']);
        add_filter('plugin_action_links_' . plugin_basename(SHEETBRIDGE_FILE), static function (array $links): array {
            array_unshift($links, '<a href="' . esc_url(admin_url('admin.php?page=sheetbridge')) . '">' . esc_html__('Open SheetBridge', 'sheetbridge') . '</a>');
            return $links;
        });
    }

    public function menu(): void
    {
        add_submenu_page('woocommerce', 'SheetBridge', 'SheetBridge', 'manage_woocommerce', 'sheetbridge', [$this, 'render']);
    }

    public function assets(string $hook): void
    {
        if ($hook !== 'woocommerce_page_sheetbridge') {
            return;
        }
        wp_enqueue_style('sheetbridge', plugins_url('assets/admin.css', SHEETBRIDGE_FILE), [], SHEETBRIDGE_VERSION);
        wp_enqueue_script('sheetbridge', plugins_url('assets/admin.js', SHEETBRIDGE_FILE), [], SHEETBRIDGE_VERSION, true);
        wp_add_inline_script('sheetbridge', 'window.SheetBridgeConfig=' . wp_json_encode([
            'api' => rest_url('sheetbridge/v1/'), 'nonce' => wp_create_nonce('wp_rest'),
            'language' => Settings::get()['language'], 'owner' => current_user_can('manage_options'),
            'connector' => plugins_url('connector/SheetBridge.gs', SHEETBRIDGE_FILE),
            'guide' => plugins_url('docs/user-guide.html', SHEETBRIDGE_FILE),
            'illustratedGuide' => plugins_url('docs/illustrated-guide-ar.html', SHEETBRIDGE_FILE),
            'store' => home_url('/'), 'version' => SHEETBRIDGE_VERSION, 'fields' => Validation::fields(),
        ]) . ';', 'before');
    }

    public function render(): void
    {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }
        echo '<div id="sheetbridge-app" class="sb-app"><p role="status">Loading SheetBridge… / جار تحميل SheetBridge…</p></div>';
        echo '<noscript><p>Enable JavaScript to use SheetBridge. / يرجى تفعيل JavaScript لاستخدام الإضافة.</p></noscript>';
    }
}
