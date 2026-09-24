<?php
namespace SheetBridge;

final class Storage
{
    public static function table(): string
    {
        global $wpdb;
        return $wpdb->prefix . 'sheetbridge_requests';
    }

    public static function install(): void
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table();
        $charset = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE $table (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            request_key varchar(80) NOT NULL,
            body_hash char(64) NOT NULL,
            state varchar(20) NOT NULL DEFAULT 'pending',
            product_id bigint(20) unsigned NOT NULL DEFAULT 0,
            payload longtext NOT NULL,
            before_data longtext NOT NULL,
            after_data longtext NOT NULL,
            error_code varchar(80) NOT NULL DEFAULT '',
            error_message text NOT NULL,
            reviewer bigint(20) unsigned NOT NULL DEFAULT 0,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY request_key (request_key),
            KEY state_created (state,created_at)
        ) ENGINE=InnoDB $charset;");
        $limits = $wpdb->prefix . 'sheetbridge_limits';
        dbDelta("CREATE TABLE $limits (
            bucket varchar(64) NOT NULL,
            hits int unsigned NOT NULL DEFAULT 0,
            expires bigint unsigned NOT NULL,
            PRIMARY KEY  (bucket)
        ) ENGINE=InnoDB $charset;");
        update_option('sheetbridge_db_version', SHEETBRIDGE_VERSION, false);
    }

    public static function rateLimit(): bool
    {
        global $wpdb;
        $table = $wpdb->prefix . 'sheetbridge_limits';
        $bucket = 'connection-' . (int) floor(time() / 60);
        $result = $wpdb->query($wpdb->prepare("INSERT INTO $table (bucket,hits,expires) VALUES (%s,1,%d) ON DUPLICATE KEY UPDATE hits=hits+1", $bucket, time() + 120));
        if ($result === false) {
            return false;
        }
        $count = (int) $wpdb->get_var($wpdb->prepare("SELECT hits FROM $table WHERE bucket=%s", $bucket));
        $wpdb->query($wpdb->prepare("DELETE FROM $table WHERE expires < %d", time()));
        return $count <= 120;
    }

    public static function get(int $id): array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE id=%d', $id), ARRAY_A);
        if (!$row) {
            throw new Problem('not_found', 'This review request was not found.', 404);
        }
        return self::decode($row);
    }

    public static function byKey(string $key): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE request_key=%s', $key), ARRAY_A);
        return $row ? self::decode($row) : null;
    }

    public static function create(array $payload, array $before, string $hash): array
    {
        global $wpdb;
        $now = current_time('mysql', true);
        $ok = $wpdb->insert(self::table(), [
            'request_key' => $payload['request_id'], 'body_hash' => $hash, 'product_id' => $payload['product_id'],
            'payload' => wp_json_encode($payload), 'before_data' => wp_json_encode($before), 'after_data' => '{}',
            'state' => 'pending', 'error_message' => '', 'created_at' => $now, 'updated_at' => $now,
        ]);
        if ($ok === false) {
            $existing = self::byKey($payload['request_id']);
            if ($existing && hash_equals($existing['body_hash'], $hash)) {
                return $existing;
            }
            throw new Problem('storage_failed', 'The preview could not be saved. Retry using the same request ID.', 503);
        }
        return self::get((int) $wpdb->insert_id);
    }

    public static function update(int $id, array $values): void
    {
        global $wpdb;
        $values['updated_at'] = current_time('mysql', true);
        if (isset($values['after_data']) && is_array($values['after_data'])) {
            $values['after_data'] = wp_json_encode($values['after_data']);
        }
        if ($wpdb->update(self::table(), $values, ['id' => $id]) === false) {
            throw new Problem('storage_failed', 'The result could not be saved. Check the request status before retrying.', 503);
        }
    }

    public static function listing(int $page = 1, string $state = ''): array
    {
        global $wpdb;
        $where = $state !== '' ? $wpdb->prepare('WHERE state=%s', $state) : '';
        $rows = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . self::table() . " $where ORDER BY id DESC LIMIT 30 OFFSET %d", (max(1, $page) - 1) * 30), ARRAY_A);
        return array_map([self::class, 'decode'], $rows ?: []);
    }

    public static function counts(): array
    {
        global $wpdb;
        $result = ['pending' => 0, 'applied' => 0, 'conflict' => 0, 'failed' => 0, 'rejected' => 0];
        foreach ($wpdb->get_results('SELECT state,COUNT(*) AS total FROM ' . self::table() . ' GROUP BY state', ARRAY_A) ?: [] as $row) {
            $result[$row['state']] = (int) $row['total'];
        }
        return $result;
    }

    public static function assertTransactional(): void
    {
        global $wpdb;
        $tables = [$wpdb->posts, $wpdb->postmeta, $wpdb->terms, $wpdb->term_taxonomy, $wpdb->term_relationships,
            $wpdb->options, $wpdb->prefix . 'wc_product_meta_lookup', self::table()];
        foreach ($tables as $table) {
            $engine = $wpdb->get_var($wpdb->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s', $table));
            if (strtoupper((string) $engine) !== 'INNODB') {
                throw new Problem('transactional_storage_required', 'Product writes require InnoDB for WordPress, WooCommerce and SheetBridge tables. Ask your host to check database storage.', 503);
            }
        }
    }

    public static function locked(callable $callback): mixed
    {
        global $wpdb;
        $name = 'sheetbridge_' . substr(hash('sha256', DB_NAME . $wpdb->prefix), 0, 40);
        if ((int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s,5)', $name)) !== 1) {
            throw new Problem('busy', 'Another product change is being processed. Retry this request shortly.', 503);
        }
        try {
            return $callback();
        } finally {
            $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $name));
        }
    }

    private static function decode(array $row): array
    {
        foreach (['payload', 'before_data', 'after_data'] as $key) {
            $row[$key] = json_decode($row[$key], true, 512, JSON_THROW_ON_ERROR);
        }
        $row['id'] = (int) $row['id'];
        $row['product_id'] = (int) $row['product_id'];
        return $row;
    }
}

