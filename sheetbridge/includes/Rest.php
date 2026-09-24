<?php
namespace SheetBridge;

final class Rest
{
    public function register(): void
    {
        add_action('rest_api_init', [$this, 'routes']);
    }

    public function routes(): void
    {
        $this->route('/health', 'GET', [$this, 'health']);
        $this->route('/catalog', 'GET', function ($request) {
            if (Settings::get()['outbound_paused']) {
                throw new Problem('outbound_paused', 'Catalog refresh is paused.', 409);
            }
            return Products::catalog(max(0, (int) $request->get_param('cursor')), min(100, max(1, (int) ($request->get_param('limit') ?: 50))));
        });
        $this->route('/references', 'GET', [$this, 'references']);
        $this->route('/changes', 'POST', fn($request) => $this->publicJob((new Sync())->preview($this->body($request))));
        $this->route('/changes/(?P<key>[a-zA-Z0-9_-]{16,80})', 'GET', function ($request) {
            $job = Storage::byKey($request['key']);
            if (!$job) {
                throw new Problem('not_found', 'Request not found.', 404);
            }
            if ($job['product_id']) {
                Settings::assertScope($job['product_id']);
            }
            return $this->publicJob($job);
        });
        $this->route('/admin/dashboard', 'GET', function () {
            return ['counts' => Storage::counts(), 'settings' => Settings::get(), 'health' => $this->health(),
                'last_contact' => get_option('sheetbridge_last_contact', null), 'connection_expires' => (get_option('sheetbridge_connection', [])['expires'] ?? null)];
        }, true);
        $this->route('/admin/requests', 'GET', fn($request) => Storage::listing((int) ($request->get_param('page') ?: 1), sanitize_key((string) $request->get_param('state'))), true);
        $this->route('/admin/requests/(?P<id>\d+)', 'GET', fn($request) => Storage::get((int) $request['id']), true);
        $this->route('/admin/requests/(?P<id>\d+)/(?P<action>apply|reject|reverse)', 'POST', function ($request) {
            return (new Sync())->{$request['action']}((int) $request['id']);
        }, true);
        $this->route('/admin/preview', 'POST', fn($request) => (new Sync())->preview($this->body($request)), true);
        $this->route('/admin/settings', 'POST', fn($request) => Settings::save($this->body($request)), true, true);
        $this->route('/admin/connection', 'POST', function ($request) {
            $body = $this->body($request);
            if (($body['action'] ?? '') === 'revoke') {
                Settings::revoke();
                return ['revoked' => true];
            }
            if (($body['action'] ?? '') !== 'rotate') {
                throw new Problem('invalid_action', 'Choose rotate or revoke.');
            }
            return ['token' => Settings::rotate(), 'expires_days' => 90];
        }, true, true);
    }

    private function route(string $path, string $method, callable $handler, bool $admin = false, bool $owner = false): void
    {
        register_rest_route('sheetbridge/v1', $path, [
            'methods' => $method,
            'permission_callback' => function ($request) use ($admin, $owner) {
                if ($admin) {
                    if (!current_user_can($owner ? 'manage_options' : 'manage_woocommerce') || !wp_verify_nonce($request->get_header('X-WP-Nonce'), 'wp_rest')) {
                        return new \WP_Error('sheetbridge_forbidden', 'A permitted WordPress account and a valid security nonce are required.', ['status' => 403]);
                    }
                    return true;
                }
                return $this->authorize($request);
            },
            'callback' => function ($request) use ($handler) {
                try {
                    $response = new \WP_REST_Response($handler($request));
                    $response->header('Cache-Control', 'no-store, private');
                    return $response;
                } catch (Problem $error) {
                    return new \WP_Error('sheetbridge_' . $error->reason, $error->getMessage(), ['status' => $error->status]);
                } catch (\Throwable $error) {
                    wc_get_logger()->error('REST operation failed.', ['source' => 'sheetbridge', 'exception_type' => get_class($error)]);
                    return new \WP_Error('sheetbridge_internal', 'The operation could not finish. Check the request status before retrying.', ['status' => 500]);
                }
            },
        ]);
    }

    public function authorize(\WP_REST_Request $request): bool|\WP_Error
    {
        $local = defined('SHEETBRIDGE_ALLOW_LOCAL_HTTP') && SHEETBRIDGE_ALLOW_LOCAL_HTTP && wp_get_environment_type() === 'local' && in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
        if (!is_ssl() && !$local) {
            return new \WP_Error('sheetbridge_https_required', 'A correctly configured HTTPS connection is required.', ['status' => 403]);
        }
        $connection = get_option('sheetbridge_connection', []);
        $token = $request->get_header('X-SheetBridge-Token');
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token) || empty($connection['hash']) || ($connection['expires'] ?? 0) < time() || ($connection['site_url'] ?? '') !== home_url('/') || !hash_equals($connection['hash'], hash('sha256', $token))) {
            return new \WP_Error('sheetbridge_unauthorized', 'The connection key is invalid or expired. Generate a new key in WordPress.', ['status' => 401]);
        }
        if (!Storage::rateLimit()) {
            return new \WP_Error('sheetbridge_rate_limit', 'Too many requests. Wait one minute before retrying.', ['status' => 429]);
        }
        update_option('sheetbridge_last_contact', gmdate('c'), false);
        return true;
    }

    private function body(\WP_REST_Request $request): array
    {
        if (strlen($request->get_body()) > 262144) {
            throw new Problem('body_too_large', 'The request exceeds 256 KB.', 413);
        }
        $data = $request->get_json_params();
        if (!is_array($data) || !$data || array_is_list($data)) {
            throw new Problem('invalid_json', 'Send a JSON object.');
        }
        return $data;
    }

    public function health(): array
    {
        $database = true;
        try {
            Storage::assertTransactional();
        } catch (Problem $error) {
            $database = false;
        }
        return ['version' => SHEETBRIDGE_VERSION, 'woocommerce' => WC_VERSION, 'php' => PHP_VERSION,
            'https' => is_ssl(), 'transactional_storage' => $database, 'settings' => Settings::get(),
            'approval_required' => true, 'stock_mode' => 'relative_adjustments', 'batch_size' => 50];
    }

    public function references($request): array
    {
        if (Settings::get()['outbound_paused']) {
            throw new Problem('outbound_paused', 'Catalog refresh is paused.', 409);
        }
        $page = max(1, (int) ($request->get_param('page') ?: 1));
        $result = ['categories' => [], 'tags' => [], 'images' => []];
        foreach (['categories' => 'product_cat', 'tags' => 'product_tag'] as $key => $taxonomy) {
            $terms = get_terms(['taxonomy' => $taxonomy, 'hide_empty' => false, 'number' => 100, 'offset' => ($page - 1) * 100]);
            if (!is_wp_error($terms)) {
                foreach ($terms as $term) {
                    $result[$key][] = ['id' => $term->term_id, 'name' => $term->name];
                }
            }
        }
        foreach (get_posts(['post_type' => 'attachment', 'post_mime_type' => 'image', 'post_status' => 'inherit', 'numberposts' => 100, 'offset' => ($page - 1) * 100, 'orderby' => 'ID', 'order' => 'ASC']) as $post) {
            $result['images'][] = ['id' => $post->ID, 'name' => $post->post_title];
        }
        $result['has_more'] = count($result['categories']) === 100 || count($result['tags']) === 100 || count($result['images']) === 100;
        return $result;
    }

    private function publicJob(array $job): array
    {
        return array_intersect_key($job, array_flip(['id', 'request_key', 'state', 'product_id', 'error_code', 'error_message', 'created_at', 'updated_at']));
    }
}
