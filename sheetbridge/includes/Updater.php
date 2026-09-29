<?php
namespace SheetBridge;

/** Public release metadata only: store data and connection keys never leave the site. */
final class Updater
{
    public const REPOSITORY = 'https://github.com/engmuhammednasser/sheetbridge';
    public const MANIFEST = 'https://raw.githubusercontent.com/engmuhammednasser/sheetbridge/main/updates/stable.json';
    private const CACHE = 'sheetbridge_release_v1';
    private const LAST_GOOD = 'sheetbridge_release_last_good_v1';
    private const ERROR = 'sheetbridge_release_error_v1';

    public function register(): void
    {
        add_filter('update_plugins_github.com', [$this, 'update'], 10, 4);
        add_filter('plugins_api', [$this, 'information'], 10, 3);
        add_filter('plugin_row_meta', [$this, 'links'], 10, 3);
        add_filter('upgrader_pre_download', [$this, 'download'], 10, 4);
        add_action('admin_action_sheetbridge_check_updates', [$this, 'check']);
        add_action('admin_notices', [$this, 'notice']);
        add_action('network_admin_notices', [$this, 'notice']);
        add_action('upgrader_process_complete', [$this, 'completed'], 10, 2);
    }

    private static function text(string $english, string $arabic): string
    {
        return str_starts_with(determine_locale(), 'ar') ? $arabic : $english;
    }

    /** Validate the complete download identity before offering a release to WordPress. */
    public static function validate(mixed $data): ?array
    {
        if (!is_array($data) || ($data['schema'] ?? null) !== 1 || ($data['slug'] ?? null) !== 'sheetbridge') return null;
        foreach (['version', 'requires', 'requires_php', 'tested'] as $key) {
            if (!is_string($data[$key] ?? null) || !preg_match('/^\d+\.\d+(?:\.\d+)?$/D', $data[$key])) return null;
        }
        if (!preg_match('/^\d+\.\d+\.\d+$/D', $data['version'])) return null;
        $expected = self::REPOSITORY . '/releases/download/v' . $data['version'] . '/sheetbridge-' . $data['version'] . '.zip';
        if (($data['package'] ?? null) !== $expected || !is_string($data['sha256'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $data['sha256'])) return null;
        if (!is_string($data['published_at'] ?? null) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/D', $data['published_at']) || strtotime($data['published_at']) === false) return null;
        foreach (['changelog_en', 'changelog_ar'] as $key) {
            if (!is_string($data[$key] ?? null) || strlen($data[$key]) > 20000) return null;
        }
        return array_intersect_key($data, array_flip(['schema', 'slug', 'version', 'requires', 'requires_php', 'tested', 'package', 'sha256', 'published_at', 'changelog_en', 'changelog_ar']));
    }

    public function release(bool $force = false): ?array
    {
        if (!$force) {
            $cached = get_site_transient(self::CACHE);
            if ($cached !== false) return self::validate($cached);
        }
        $url = self::MANIFEST . ($force ? '?check=' . time() : '');
        $response = wp_safe_remote_get($url, [
            'timeout' => 10, 'redirection' => 0, 'limit_response_size' => 65536,
            'headers' => ['Accept' => 'application/json'], 'user-agent' => 'SheetBridge/' . SHEETBRIDGE_VERSION,
        ]);
        $data = !is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200
            ? self::validate(json_decode(wp_remote_retrieve_body($response), true)) : null;
        if ($data !== null) {
            set_site_transient(self::CACHE, $data, 2 * HOUR_IN_SECONDS);
            set_site_transient(self::LAST_GOOD, $data, 7 * DAY_IN_SECONDS);
            delete_site_transient(self::ERROR);
            return $data;
        }
        // Keep known release details available during a temporary GitHub outage.
        $fallback = self::validate(get_site_transient(self::LAST_GOOD));
        set_site_transient(self::CACHE, $fallback ?? [], 5 * MINUTE_IN_SECONDS);
        set_site_transient(self::ERROR, true, 5 * MINUTE_IN_SECONDS);
        return $fallback;
    }

    public function update(mixed $update, array $pluginData, string $pluginFile, array $locales): mixed
    {
        if ($pluginFile !== plugin_basename(SHEETBRIDGE_FILE) || ($pluginData['UpdateURI'] ?? '') !== self::REPOSITORY) return $update;
        $release = $this->release();
        if (!$release) return $update;
        return [
            'id' => self::REPOSITORY, 'slug' => 'sheetbridge', 'version' => $release['version'],
            'url' => self::REPOSITORY, 'package' => $release['package'],
            'requires' => $release['requires'], 'requires_php' => $release['requires_php'], 'tested' => $release['tested'],
            'icons' => ['svg' => plugins_url('assets/icon.svg', SHEETBRIDGE_FILE)],
        ];
    }

    public function information(mixed $result, string $action, object $args): mixed
    {
        if ($action !== 'plugin_information' || ($args->slug ?? '') !== 'sheetbridge') return $result;
        $release = $this->release();
        $description = self::text(
            '<p>Manage WooCommerce products through Google Sheets, with a clear before/after review before changes are applied.</p><ul><li>Arabic and English interface and user guide.</li><li>Product names, prices, descriptions, categories, images and variations.</li><li>Relative stock adjustments, conflict checks and duplicate-request protection.</li><li>Private Google Apps Script connector; no service-account JSON is required.</li><li>Native WordPress release details and updates from the official SheetBridge GitHub repository.</li></ul><p>Designed for one store. Product changes require manual approval. Orders, customers, shared parent inventory and fractional stock are outside this release.</p>',
            '<p>إدارة منتجات WooCommerce من Google Sheets، مع مراجعة القيم قبل التعديل وبعده قبل تطبيق التغييرات.</p><ul><li>واجهة ودليل استخدام بالعربية والإنجليزية.</li><li>أسماء المنتجات والأسعار والأوصاف والتصنيفات والصور والمتغيرات.</li><li>إضافة وخصم المخزون مع فحص التعارض ومنع تكرار الطلبات.</li><li>موصل Google Apps Script خاص، دون الحاجة إلى ملف حساب خدمة.</li><li>عرض تفاصيل الإصدار والتحديث من مستودع SheetBridge الرسمي على GitHub داخل ووردبريس.</li></ul><p>الإضافة مخصصة لمتجر واحد. تعديلات المنتجات تحتاج موافقة يدوية. لا يشمل الإصدار الطلبات أو العملاء أو المخزون المشترك للمتغيرات أو الكميات الكسرية.</p>'
        );
        $installation = self::text(
            '<ol><li>Activate WooCommerce, then install and activate SheetBridge.</li><li>Open WooCommerce → SheetBridge and configure permitted fields.</li><li>Follow Connect to install the private Google Apps Script connector.</li><li>Prepare a small change and review it before approval.</li></ol><p>Requires HTTPS and InnoDB. Existing users of connectors 1.0.0/1.0.1 must replace their script code once with the new connector. Compatible future plugin updates do not require updating that script again.</p>',
            '<ol><li>فعّل WooCommerce، ثم ثبّت SheetBridge وفعّلها.</li><li>افتح WooCommerce ← SheetBridge وحدد الحقول المسموح بها.</li><li>اتبع خطوات الربط لتثبيت موصل Google Apps Script الخاص.</li><li>جهّز تعديلًا صغيرًا وراجعه قبل الموافقة.</li></ol><p>يلزم HTTPS وجداول InnoDB. مستخدمو الموصل 1.0.0 أو 1.0.1 يحتاجون استبدال كود السكربت مرة واحدة بالموصل الجديد؛ تحديثات البلاجن المتوافقة بعد ذلك لا تتطلب تحديث السكربت.</p>'
        );
        $faq = self::text(
            '<h4>How do updates work?</h4><p>Use Check for updates in the plugin row, then WordPress Update now. Automatic updates remain your choice in WordPress. Only published stable releases are offered, with a SHA-256 package check.</p><h4>What is sent to GitHub?</h4><p>The site requests a public release manifest and downloads the plugin ZIP. SheetBridge sends no product, customer, spreadsheet or connection-key data to GitHub.</p>',
            '<h4>كيف تعمل التحديثات؟</h4><p>اضغط «فحص التحديثات» أسفل الإضافة، ثم «التحديث الآن» في ووردبريس. تفعيل التحديثات التلقائية اختياري من إعدادات ووردبريس. تُعرض الإصدارات المستقرة المنشورة فقط مع التحقق من بصمة حزمة التثبيت.</p><h4>ما الذي يُرسل إلى GitHub؟</h4><p>يطلب الموقع معلومات الإصدار العامة وحزمة التثبيت فقط. لا ترسل SheetBridge بيانات المنتجات أو العملاء أو الشيت أو مفتاح الربط إلى GitHub.</p>'
        );
        $changelog = $release ? self::text($release['changelog_en'], $release['changelog_ar']) : self::text('Release information is temporarily unavailable. Please try Check for updates later.', 'معلومات الإصدار غير متاحة مؤقتًا. جرّب فحص التحديثات لاحقًا.');
        $info = (object) [
            'name' => 'SheetBridge for WooCommerce', 'slug' => 'sheetbridge',
            'version' => $release['version'] ?? SHEETBRIDGE_VERSION,
            'author' => '<a href="https://github.com/engmuhammednasser">muhammed nasser</a>',
            'author_profile' => 'https://github.com/engmuhammednasser', 'homepage' => self::REPOSITORY,
            'requires' => $release['requires'] ?? '6.5', 'requires_php' => $release['requires_php'] ?? '8.1',
            'tested' => $release['tested'] ?? '', 'requires_plugins' => ['woocommerce'],
            'download_link' => $release['package'] ?? '', 'external' => true,
            'banners' => ['low' => plugins_url('assets/banner.svg', SHEETBRIDGE_FILE), 'high' => plugins_url('assets/banner.svg', SHEETBRIDGE_FILE)],
            'sections' => ['description' => $description, 'installation' => $installation, 'changelog' => wpautop(esc_html($changelog)), 'faq' => $faq],
        ];
        if ($release) $info->last_updated = gmdate('Y-m-d H:i:s', strtotime($release['published_at']));
        return $info;
    }

    public function links(array $links, string $file, array $data): array
    {
        if ($file !== plugin_basename(SHEETBRIDGE_FILE)) return $links;
        // Core adds its own details link once the update transient contains our slug.
        if (empty($data['slug']) && current_user_can('install_plugins')) {
            $url = add_query_arg(['tab' => 'plugin-information', 'plugin' => 'sheetbridge', 'TB_iframe' => 'true', 'width' => 600, 'height' => 550], self_admin_url('plugin-install.php'));
            $links[] = '<a class="thickbox open-plugin-details-modal" data-title="SheetBridge for WooCommerce" href="' . esc_url($url) . '">' . esc_html__('View details') . '</a>';
        }
        if (current_user_can('update_plugins')) {
            $url = wp_nonce_url(admin_url('admin.php?action=sheetbridge_check_updates'), 'sheetbridge_check_updates');
            $links[] = '<a href="' . esc_url($url) . '">' . esc_html(self::text('Check for updates', 'فحص التحديثات')) . '</a>';
        }
        return $links;
    }

    public function check(): void
    {
        if (!current_user_can('update_plugins')) wp_die(esc_html__('Sorry, you are not allowed to update plugins for this site.'));
        check_admin_referer('sheetbridge_check_updates');
        $release = $this->release(true);
        delete_site_transient('update_plugins');
        wp_update_plugins();
        $status = get_site_transient(self::ERROR) ? 'error' : ($release && version_compare($release['version'], SHEETBRIDGE_VERSION, '>') ? 'available' : 'current');
        wp_safe_redirect(add_query_arg('sheetbridge-update', $status, self_admin_url('plugins.php')));
        exit;
    }

    public function notice(): void
    {
        if (!current_user_can('update_plugins') || (get_current_screen()->base ?? '') !== (is_network_admin() ? 'plugins-network' : 'plugins')) return;
        $status = isset($_GET['sheetbridge-update']) ? sanitize_key(wp_unslash($_GET['sheetbridge-update'])) : '';
        $messages = [
            'current' => self::text('SheetBridge: you have the latest published version.', 'SheetBridge: لديك أحدث إصدار منشور.'),
            'available' => self::text('SheetBridge: a new version is available. Use Update now in the plugin row.', 'SheetBridge: يتوفر إصدار جديد. اضغط «التحديث الآن» أسفل الإضافة.'),
            'error' => self::text('SheetBridge could not check GitHub. Please try again later; previously verified release details may still be shown.', 'تعذر فحص تحديثات SheetBridge من GitHub. حاول لاحقًا؛ قد تظهر معلومات آخر إصدار تم التحقق منه.'),
        ];
        if (isset($messages[$status])) echo '<div class="notice ' . ($status === 'error' ? 'notice-warning' : 'notice-success') . ' is-dismissible"><p>' . esc_html($messages[$status]) . '</p></div>';
    }

    public function download(mixed $reply, string $package, object $upgrader, array $extra): mixed
    {
        $ours = ($extra['plugin'] ?? '') === plugin_basename(SHEETBRIDGE_FILE) || str_starts_with($package, self::REPOSITORY . '/releases/download/');
        if (!$ours || $reply !== false) return $reply;
        $release = $this->release();
        if (!$release || $package !== $release['package']) return new \WP_Error('sheetbridge_unverified_release', self::text('The SheetBridge release could not be verified. Check for updates and try again.', 'تعذر التحقق من إصدار SheetBridge. افحص التحديثات ثم أعد المحاولة.'));
        if (!function_exists('download_url')) require_once ABSPATH . 'wp-admin/includes/file.php';
        $file = download_url($package, 60);
        if (is_wp_error($file)) return $file;
        $hash = is_file($file) ? hash_file('sha256', $file) : false;
        if (!is_string($hash) || !hash_equals($release['sha256'], $hash)) {
            wp_delete_file($file);
            return new \WP_Error('sheetbridge_checksum_mismatch', self::text('SheetBridge package verification failed. The existing plugin was not replaced.', 'فشل التحقق من حزمة SheetBridge. لم يتم استبدال الإضافة الحالية.'));
        }
        return $file;
    }

    public function completed(object $upgrader, array $extra): void
    {
        $plugins = $extra['plugins'] ?? (isset($extra['plugin']) ? [$extra['plugin']] : []);
        if (($extra['type'] ?? '') === 'plugin' && in_array(plugin_basename(SHEETBRIDGE_FILE), $plugins, true)) delete_site_transient(self::CACHE);
    }
}
