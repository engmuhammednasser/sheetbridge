<?php
namespace SheetBridge;

final class Sync
{
    public function preview(array $input): array
    {
        $settings = Settings::get();
        if ($settings['inbound_paused']) {
            throw new Problem('inbound_paused', 'Incoming changes are paused. Resume them in SheetBridge settings.', 409);
        }
        $request = Validation::request($input, $settings);
        $hash = hash('sha256', wp_json_encode($request));
        $existing = Storage::byKey($request['request_id']);
        if ($existing) {
            if (!hash_equals($existing['body_hash'], $hash)) {
                throw new Problem('request_id_reused', 'This request ID belongs to different changes. Create a new request ID after editing the proposal.', 409);
            }
            return $existing;
        }
        $product = $request['action'] === 'update' ? Products::fresh($request['product_id']) : null;
        $before = $product ? Products::snapshot($product) : [];
        if ($product && !hash_equals($before['revision'], $request['revision'])) {
            throw new Problem('conflict', 'The product changed after Catalog was refreshed. Refresh and review your proposal again.', 409);
        }
        Products::validate($request, $product);
        return Storage::create($request, $before, $hash);
    }

    public function apply(int $id): array
    {
        return Storage::locked(function () use ($id): array {
            global $wpdb;
            $job = Storage::get($id);
            if ($job['state'] === 'applied') {
                return $job;
            }
            if (!in_array($job['state'], ['pending', 'failed'], true)) {
                throw new Problem('not_pending', 'Only pending or failed requests can be applied. Conflicts need a new preview.', 409);
            }
            $settings = Settings::get();
            if ($settings['inbound_paused']) {
                throw new Problem('inbound_paused', 'Incoming changes are paused.', 409);
            }
            $request = Validation::request($job['payload'], $settings);
            Storage::assertTransactional();
            if ($wpdb->query('START TRANSACTION') === false) {
                throw new Problem('transaction_failed', 'The database could not start a transaction.', 503);
            }
            $touched = [];
            try {
                $lockIds = array_filter([$request['product_id'], $request['parent_id'], (int) ($job['before_data']['parent_id'] ?? 0)]);
                sort($lockIds);
                foreach (array_unique($lockIds) as $productId) {
                    $wpdb->get_results($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE ID=%d FOR UPDATE", $productId));
                    $wpdb->get_results($wpdb->prepare("SELECT meta_id FROM {$wpdb->postmeta} WHERE post_id=%d FOR UPDATE", $productId));
                    $touched[] = $productId;
                }
                if ($wpdb->last_error) {
                    throw new Problem('lock_failed', 'The database could not lock the product for this update.', 503);
                }
                $product = $request['action'] === 'update' ? Products::fresh($request['product_id']) : null;
                if ($product && !hash_equals(Products::snapshot($product)['revision'], $job['before_data']['revision'])) {
                    throw new Problem('conflict', 'The product changed since preview. No changes were applied. Refresh Catalog and submit a new proposal.', 409);
                }
                if ($product && isset($request['changes']['stock_status']) && $product->get_stock_status('edit') !== $job['before_data']['stock_status']) {
                    throw new Problem('conflict', 'The stock status changed since preview. Submit a new proposal.', 409);
                }
                Products::validate($request, $product);
                $delta = $request['changes']['stock_adjustment'] ?? 0;
                if ($product && $delta < 0 && (float) $product->get_stock_quantity('edit') + $delta < 0) {
                    throw new Problem('insufficient_stock', 'This reduction exceeds the current stock. Check recent sales and submit a smaller adjustment.', 409);
                }
                $product ??= Products::newDraft($request);
                $saved = Products::write($request, $product);
                $touched[] = $saved->get_id();
                Storage::update($id, ['state' => 'applied', 'product_id' => $saved->get_id(), 'after_data' => Products::snapshot($saved),
                    'reviewer' => get_current_user_id(), 'error_code' => '', 'error_message' => '']);
                if ($wpdb->query('COMMIT') === false) {
                    throw new Problem('commit_failed', 'The database could not confirm the write. Check the request status before retrying.', 503);
                }
            } catch (\Throwable $error) {
                $wpdb->query('ROLLBACK');
                if (isset($product) && $product->get_id()) {
                    $touched[] = $product->get_id();
                }
                foreach ($touched as $productId) {
                    clean_post_cache($productId);
                    wp_cache_delete($productId, 'post_meta');
                    wc_delete_product_transients($productId);
                }
                // A lost COMMIT acknowledgement is not permission to repeat an already durable write.
                if (Storage::get($id)['state'] === 'applied') {
                    return Storage::get($id);
                }
                $problem = $error instanceof Problem ? $error : new Problem('write_failed', 'WooCommerce could not save this request. Ask the administrator to inspect the request and hosting logs.', 503);
                Storage::update($id, ['state' => $problem->status === 409 ? 'conflict' : 'failed', 'error_code' => $problem->reason, 'error_message' => $problem->getMessage()]);
                if (!$error instanceof Problem) {
                    wc_get_logger()->error('Product operation failed.', ['source' => 'sheetbridge', 'request_id' => $id, 'exception_type' => get_class($error)]);
                }
                throw $problem;
            }
            foreach (array_unique($touched) as $productId) {
                clean_post_cache($productId);
                wp_cache_delete($productId, 'post_meta');
                wc_delete_product_transients($productId);
            }
            return Storage::get($id);
        });
    }

    public function reject(int $id): array
    {
        return Storage::locked(static function () use ($id): array {
            $job = Storage::get($id);
            if (!in_array($job['state'], ['pending', 'failed', 'conflict'], true)) {
                throw new Problem('cannot_reject', 'This request has already been applied or rejected.', 409);
            }
            Storage::update($id, ['state' => 'rejected', 'reviewer' => get_current_user_id()]);
            return Storage::get($id);
        });
    }

    public function reverse(int $id): array
    {
        $job = Storage::get($id);
        if ($job['state'] !== 'applied' || $job['payload']['action'] !== 'update') {
            throw new Problem('cannot_reverse', 'Only applied updates can be reversed. New products are managed in WooCommerce.', 409);
        }
        $existing = Storage::byKey('reversal_request_' . $id);
        if ($existing) {
            return $existing;
        }
        $current = Products::snapshot(Products::fresh($job['product_id']));
        if (!hash_equals($current['revision'], $job['after_data']['revision'])) {
            throw new Problem('reversal_conflict', 'Later product edits exist. Review them before preparing a manual reversal.', 409);
        }
        $changes = [];
        foreach ($job['payload']['changes'] as $field => $value) {
            if ($field === 'stock_adjustment') {
                $changes[$field] = -$value;
            } elseif ($field === 'meta') {
                $changes[$field] = [];
                foreach ($value as $key => $_) {
                    $changes[$field][$key] = !empty($job['before_data']['meta_present'][$key]) ? $job['before_data']['meta'][$key] : null;
                }
            } elseif ($field === 'attributes') {
                $changes[$field] = array_map(static function (array $item): array { unset($item['taxonomy']); return $item; }, $job['before_data'][$field]);
            } else {
                $previous = $job['before_data'][$field];
                $changes[$field] = $previous === '' ? null : $previous;
            }
        }
        return $this->preview(['request_id' => 'reversal_request_' . $id, 'action' => 'update', 'product_id' => $job['product_id'], 'revision' => $current['revision'], 'changes' => $changes]);
    }
}
