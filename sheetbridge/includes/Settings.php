<?php
namespace SheetBridge;

final class Settings
{
    public static function defaults(): array
    {
        return [
            'language' => 'en', 'inbound_paused' => false, 'outbound_paused' => false,
            'allow_create' => false, 'product_ids' => [], 'meta_keys' => [],
            'fields' => ['name', 'regular_price', 'sale_price', 'stock_adjustment'],
        ];
    }

    public static function get(): array
    {
        return array_merge(self::defaults(), (array) get_option('sheetbridge_settings', []));
    }

    public static function save(array $input): array
    {
        $settings = self::defaults();
        $settings['language'] = ($input['language'] ?? 'en') === 'ar' ? 'ar' : 'en';
        foreach (['inbound_paused', 'outbound_paused', 'allow_create'] as $key) {
            $settings[$key] = !empty($input[$key]);
        }
        $fields = $input['fields'] ?? [];
        if (!is_array($fields) || array_diff($fields, Validation::fields())) {
            throw new Problem('invalid_fields', 'Choose only supported fields.');
        }
        $settings['fields'] = array_values(array_unique($fields));
        $ids = trim((string) ($input['product_ids'] ?? ''));
        if ($ids !== '' && !preg_match('/^\d+(\s*,\s*\d+)*$/D', $ids)) {
            throw new Problem('invalid_scope', 'Product scope must contain IDs separated by commas.');
        }
        $settings['product_ids'] = $ids === '' ? [] : array_values(array_unique(array_map('intval', explode(',', $ids))));
        if (in_array(0, $settings['product_ids'], true) || count($settings['product_ids']) > 500) {
            throw new Problem('invalid_scope', 'Use up to 500 positive product IDs, or leave scope empty for all products.');
        }
        $keys = trim((string) ($input['meta_keys'] ?? ''));
        foreach ($keys === '' ? [] : preg_split('/\s*,\s*/', $keys) as $key) {
            if (!preg_match('/^sb_[a-z][a-z0-9_]{0,47}$/D', $key)) {
                throw new Problem('invalid_meta_key', 'Custom field keys must start with sb_ and contain lowercase letters, numbers or underscores.');
            }
            $settings['meta_keys'][] = $key;
        }
        update_option('sheetbridge_settings', $settings, false);
        return $settings;
    }

    public static function assertScope(int $id): void
    {
        $ids = self::get()['product_ids'];
        if ($ids && !in_array($id, $ids, true)) {
            throw new Problem('outside_scope', 'This product is outside the connection scope.', 403);
        }
    }

    public static function rotate(): string
    {
        $token = bin2hex(random_bytes(32));
        update_option('sheetbridge_connection', ['hash' => hash('sha256', $token), 'expires' => time() + 90 * DAY_IN_SECONDS, 'site_url' => home_url('/')], false);
        delete_option('sheetbridge_last_contact');
        return $token;
    }

    public static function revoke(): void
    {
        delete_option('sheetbridge_connection');
    }
}
