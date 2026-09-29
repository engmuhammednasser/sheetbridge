<?php
namespace SheetBridge;

final class Diagnostics
{
    public static function report(array $input): array
    {
        $allowed = ['success', 'error', 'paused'];
        $state = $input['state'] ?? '';
        if (!in_array($state, $allowed, true) || !preg_match('/^\d+\.\d+\.\d+$/D', (string) ($input['connector_version'] ?? ''))) {
            throw new Problem('invalid_report', 'Invalid connector status report.');
        }
        $previous = (array) get_option('sheetbridge_connector_status', []);
        $now = gmdate('c');
        // Never persist arbitrary remote error text, spreadsheet contents or credentials.
        $status = [
            'state' => $state, 'connector_version' => $input['connector_version'], 'reported_at' => $now,
            'last_success' => $state === 'success' ? $now : ($previous['last_success'] ?? null),
            'last_catalog' => !empty($input['catalog_complete']) && $state !== 'error' ? $now : ($previous['last_catalog'] ?? null),
            'last_submission' => !empty($input['submitted']) ? $now : ($previous['last_submission'] ?? null),
            'active_rows' => min(1000000, max(0, (int) ($input['active_rows'] ?? 0))),
            'error_rows' => min(1000000, max(0, (int) ($input['error_rows'] ?? 0))),
            'processed_rows' => min(100, max(0, (int) ($input['processed_rows'] ?? 0))),
            'error_kind' => in_array($input['error_kind'] ?? '', ['connection', 'configuration', 'row'], true) ? $input['error_kind'] : '',
        ];
        update_option('sheetbridge_connector_status', $status, false);
        return ['recorded' => true];
    }

    public static function download(): array
    {
        $settings = Settings::get();
        $connection = (array) get_option('sheetbridge_connection', []);
        $db = true;
        try { Storage::assertTransactional(); } catch (Problem $error) { $db = false; }
        return [
            'generated_at' => gmdate('c'), 'plugin' => SHEETBRIDGE_VERSION, 'wordpress' => get_bloginfo('version'),
            'woocommerce' => WC_VERSION, 'php' => PHP_VERSION, 'https' => is_ssl(), 'transactional_storage' => $db,
            'connection_configured' => !empty($connection['hash']), 'connection_expires' => $connection['expires'] ?? null,
            'inbound_paused' => $settings['inbound_paused'], 'outbound_paused' => $settings['outbound_paused'],
            'allowed_fields' => $settings['fields'], 'scoped_products' => count($settings['product_ids']),
            'custom_fields_count' => count($settings['meta_keys']), 'counts' => Storage::counts(),
            'last_contact' => get_option('sheetbridge_last_contact', null),
            'connector' => get_option('sheetbridge_connector_status', null),
        ];
    }
}
