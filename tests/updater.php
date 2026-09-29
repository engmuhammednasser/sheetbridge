<?php
/** Standalone update transport/identity tests. No WordPress installation or network. */
require dirname(__DIR__) . '/sheetbridge/includes/Updater.php';
use SheetBridge\Updater;
define('SHEETBRIDGE_VERSION', '1.1.0');
define('SHEETBRIDGE_FILE', '/plugins/sheetbridge/sheetbridge.php');
define('HOUR_IN_SECONDS', 3600);
define('DAY_IN_SECONDS', 86400);
define('MINUTE_IN_SECONDS', 60);
class WP_Error { public function __construct(public string $code, public string $message = '') {} }
$cache = []; $requests = []; $response = []; $locale = 'en_US'; $downloads = 0; $downloadBody = 'release ZIP bytes'; $deleted = [];
function plugin_basename($file) { return str_replace('/plugins/', '', $file); }
function get_site_transient($key) { return $GLOBALS['cache'][$key] ?? false; }
function set_site_transient($key, $value, $ttl) { $GLOBALS['cache'][$key] = $value; }
function delete_site_transient($key) { unset($GLOBALS['cache'][$key]); }
function wp_safe_remote_get($url, $args) { $GLOBALS['requests'][] = [$url, $args]; return $GLOBALS['response']; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_remote_retrieve_response_code($response) { return $response['status']; }
function wp_remote_retrieve_body($response) { return $response['body']; }
function determine_locale() { return $GLOBALS['locale']; }
function plugins_url($path, $file) { return 'https://store.example/plugins/sheetbridge/' . $path; }
function esc_html($text) { return htmlspecialchars($text, ENT_QUOTES, 'UTF-8'); }
function wpautop($text) { return '<p>' . str_replace("\n\n", '</p><p>', $text) . '</p>'; }
function download_url($url, $timeout) {
    $GLOBALS['downloads']++;
    $file = tempnam(sys_get_temp_dir(), 'sheetbridge-updater-test-');
    file_put_contents($file, $GLOBALS['downloadBody']);
    return $file;
}
function wp_delete_file($path) { $GLOBALS['deleted'][] = $path; unlink($path); }
function current_user_can($capability) { return true; }
function esc_url($url) { return $url; }
function esc_html__($text) { return esc_html($text); }
function self_admin_url($path) { return 'https://store.example/wp-admin/' . $path; }
function admin_url($path) { return self_admin_url($path); }
function add_query_arg($args, $url) { return $url . '?' . http_build_query($args); }
function wp_nonce_url($url, $action) { return $url . '&_wpnonce=test'; }
$manifest = [
    'schema' => 1, 'slug' => 'sheetbridge', 'version' => '1.1.0', 'requires' => '6.5', 'requires_php' => '8.1', 'tested' => '7.0.3',
    'package' => Updater::REPOSITORY . '/releases/download/v1.1.0/sheetbridge-1.1.0.zip',
    'sha256' => hash('sha256', $downloadBody), 'published_at' => '2026-09-29T08:00:00Z',
    'changelog_en' => "Updates\n\n<script>alert(1)</script>", 'changelog_ar' => 'تحديثات الإضافة',
];
$updater = new Updater(); $count = 0;
function check($condition, $message) { global $count; if (!$condition) throw new RuntimeException($message); echo "PASS $message\n"; $count++; }
function fresh($manifest) { $GLOBALS['cache'] = []; $GLOBALS['response'] = ['status' => 200, 'body' => json_encode($manifest)]; }
check(Updater::validate($manifest) !== null, 'stable release is accepted');
foreach ([
    ['slug' => 'another-plugin'], ['schema' => 2], ['version' => '1.1.0-beta.1'], ['sha256' => 'invalid'],
    ['package' => 'https://evil.example/plugin.zip'], ['package' => Updater::REPOSITORY . '/archive/refs/heads/main.zip'],
    ['package' => Updater::REPOSITORY . '/releases/download/v1.1.0/sheetbridge-1.1.0.zip?redirect=evil'],
    ['requires_php' => ['8.1']], ['published_at' => 'tomorrow'], ['changelog_en' => ['unexpected']],
] as $patch) check(Updater::validate(array_replace($manifest, $patch)) === null, 'rejects invalid ' . array_key_first($patch));
fresh($manifest);
$untouched = (object) ['other' => true];
check($updater->update($untouched, ['UpdateURI' => Updater::REPOSITORY], 'other/main.php', []) === $untouched && !$requests, 'unrelated plugin update is untouched without network');
check($updater->information($untouched, 'query_plugins', (object) ['slug' => 'sheetbridge']) === $untouched, 'plugin search is untouched');
check($updater->information($untouched, 'plugin_information', (object) ['slug' => 'other']) === $untouched, 'other plugin details are untouched');
$update = $updater->update(false, ['UpdateURI' => Updater::REPOSITORY, 'Version' => '1.0.1'], 'sheetbridge/sheetbridge.php', []);
check($update['version'] === '1.1.0' && $update['package'] === $manifest['package'] && $update['requires_php'] === '8.1', 'native update metadata includes version package and compatibility');
check(!array_key_exists('autoupdate', $update), 'automatic updates are not forced');
check($requests[0][0] === Updater::MANIFEST && $requests[0][1]['redirection'] === 0 && !isset($requests[0][1]['body']) && $requests[0][1]['headers'] === ['Accept' => 'application/json'], 'manifest request does not transmit store or credential data');
$requestCount = count($requests); $updater->release();
check(count($requests) === $requestCount, 'repeated reads use the cache');
$info = $updater->information(false, 'plugin_information', (object) ['slug' => 'sheetbridge']);
check($info->author_profile === 'https://github.com/engmuhammednasser' && count($info->sections) === 4, 'native details include author and four sections');
check(!str_contains($info->sections['changelog'], '<script>') && str_contains($info->sections['changelog'], '&lt;script&gt;'), 'release text cannot inject HTML');
$locale = 'ar'; $info = $updater->information(false, 'plugin_information', (object) ['slug' => 'sheetbridge']);
check(str_contains($info->sections['description'], 'إدارة منتجات') && str_contains($info->sections['changelog'], 'تحديثات الإضافة'), 'Arabic details use Arabic release notes');
$locale = 'en_US';
$links = $updater->links([], 'sheetbridge/sheetbridge.php', []);
check(count($links) === 2 && str_contains($links[0], 'plugin-information') && str_contains($links[1], '_wpnonce'), 'details fallback and nonce-protected update check are present');
check(count($updater->links([], 'sheetbridge/sheetbridge.php', ['slug' => 'sheetbridge'])) === 1, 'does not duplicate the core details link');
$response = new WP_Error('timeout');
check($updater->release(true)['version'] === '1.1.0' && get_site_transient('sheetbridge_release_error_v1') === true, 'network failure preserves last verified release and records failure');
$cache = [];
check($updater->release(true) === null, 'network failure without history does not invent a release');
check($updater->information(false, 'plugin_information', (object) ['slug' => 'sheetbridge'])->download_link === '', 'offline local details do not invent a download');
fresh($manifest);
check($updater->download(false, 'https://other.example/plugin.zip', (object) [], ['plugin' => 'other/main.php']) === false && $downloads === 0, 'other plugin downloads are untouched');
$error = $updater->download(false, 'https://evil.example/plugin.zip', (object) [], ['plugin' => 'sheetbridge/sheetbridge.php']);
check(is_wp_error($error) && $downloads === 0, 'wrong package for this plugin is rejected before download');
$file = $updater->download(false, $manifest['package'], (object) [], ['plugin' => 'sheetbridge/sheetbridge.php']);
check(is_string($file) && file_get_contents($file) === $downloadBody, 'verified package reaches the core upgrader');
unlink($file);
$downloadBody = 'tampered ZIP bytes';
$error = $updater->download(false, $manifest['package'], (object) [], ['plugin' => 'sheetbridge/sheetbridge.php']);
check(is_wp_error($error) && $error->code === 'sheetbridge_checksum_mismatch' && count($deleted) === 1 && !file_exists($deleted[0]), 'tampered package is rejected and its temporary file removed');
$updater->completed((object) [], ['type' => 'plugin', 'plugins' => ['other/main.php']]);
check(get_site_transient('sheetbridge_release_v1') !== false, 'other upgrades keep this cache');
$updater->completed((object) [], ['type' => 'plugin', 'plugins' => ['sheetbridge/sheetbridge.php']]);
check(get_site_transient('sheetbridge_release_v1') === false, 'successful own upgrade invalidates the release cache');
echo "Updater checks passed: $count\n";
