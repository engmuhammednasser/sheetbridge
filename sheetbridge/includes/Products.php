<?php
namespace SheetBridge;

final class Products
{
    public static function reviewIdentity(array $job): array
    {
        $p = $job['product_id'] ? wc_get_product($job['product_id']) : false;
        $image = $p ? wp_get_attachment_image_url($p->get_image_id(), 'thumbnail') : false;
        $job['product'] = [
            'name' => $p ? $p->get_name() : ($job['before_data']['name'] ?? $job['payload']['changes']['name'] ?? ''),
            'sku' => $p ? $p->get_sku() : ($job['before_data']['sku'] ?? $job['payload']['changes']['sku'] ?? ''),
            'image' => $image ?: '',
            'edit_url' => $p && current_user_can('edit_post', $p->get_id()) ? get_edit_post_link($p->get_id(), 'raw') : '',
            'available' => $p && $p->get_status() !== 'trash',
        ];
        return $job;
    }

    public static function get(int $id): \WC_Product
    {
        $product = wc_get_product($id);
        if (!$product || !in_array($product->get_type(), ['simple', 'variable', 'variation'], true) || $product->get_status() === 'trash') {
            throw new Problem('unsupported_product', 'The product is unavailable or its type is unsupported.', 404);
        }
        return $product;
    }

    public static function fresh(int $id): \WC_Product
    {
        clean_post_cache($id);
        wp_cache_delete($id, 'post_meta');
        wc_delete_product_transients($id);
        return self::get($id);
    }

    public static function snapshot(\WC_Product $product): array
    {
        $data = ['id' => $product->get_id(), 'type' => $product->get_type(), 'parent_id' => $product->get_parent_id()];
        foreach (['name', 'sku', 'regular_price', 'sale_price', 'description', 'short_description', 'status', 'manage_stock',
            'stock_status', 'backorders', 'category_ids', 'tag_ids', 'image_id', 'gallery_image_ids', 'upsell_ids',
            'cross_sell_ids', 'weight', 'length', 'width', 'height'] as $key) {
            $output = $key === 'gallery_image_ids' ? 'gallery_ids' : $key;
            $data[$output] = $product->{'get_' . $key}('edit');
        }
        $data['stock_quantity'] = $product->get_stock_quantity('edit');
        $data['stock_owner_id'] = $product->get_stock_managed_by_id();
        $data['attributes'] = [];
        $data['variation_attributes'] = [];
        if ($product->is_type('variation')) {
            $data['variation_attributes'] = $product->get_attributes('edit');
        } else {
            foreach ($product->get_attributes('edit') as $attribute) {
                $data['attributes'][] = ['name' => $attribute->get_name(), 'options' => $attribute->get_options(),
                    'visible' => $attribute->get_visible(), 'variation' => $attribute->get_variation(), 'taxonomy' => $attribute->is_taxonomy()];
            }
        }
        $data['meta'] = [];
        $data['meta_present'] = [];
        foreach (Settings::get()['meta_keys'] as $key) {
            $value = $product->get_meta($key, true, 'edit');
            if (is_scalar($value) || $value === null) {
                $data['meta'][$key] = $value;
                $data['meta_present'][$key] = $product->meta_exists($key);
            }
        }
        $data['revision'] = self::revision($data);
        return $data;
    }

    public static function revision(array $data): string
    {
        // Sales change quantity and derived stock status. Relative stock adjustments must survive sales.
        unset($data['revision'], $data['stock_quantity'], $data['stock_status']);
        return hash('sha256', wp_json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    public static function catalog(int $cursor, int $limit): array
    {
        global $wpdb;
        $scope = Settings::get()['product_ids'];
        $where = $scope ? ' AND ID IN (' . implode(',', array_map('intval', $scope)) . ')' : '';
        $ids = $wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE ID > %d AND post_type IN ('product','product_variation') AND post_status IN ('publish','draft','private','pending') $where ORDER BY ID ASC LIMIT %d", $cursor, $limit));
        $products = [];
        foreach ($ids as $id) {
            $product = wc_get_product((int) $id);
            if ($product && in_array($product->get_type(), ['simple', 'variable', 'variation'], true)) {
                $products[] = array_intersect_key(self::snapshot($product), array_flip(['id', 'type', 'parent_id', 'sku', 'name',
                    'stock_quantity', 'regular_price', 'sale_price', 'status', 'revision']));
            }
        }
        return ['products' => $products, 'cursor' => $ids ? (int) end($ids) : $cursor, 'has_more' => count($ids) === $limit];
    }

    public static function validate(array $request, ?\WC_Product $product): void
    {
        $changes = $request['changes'];
        $type = $product ? $product->get_type() : $request['type'];
        if ($product) {
            Settings::assertScope($product->get_id());
            if ($product->get_parent_id()) {
                Settings::assertScope($product->get_parent_id());
            }
        }
        $regular = array_key_exists('regular_price', $changes) ? ($changes['regular_price'] ?? '') : ($product ? $product->get_regular_price('edit') : '');
        $sale = array_key_exists('sale_price', $changes) ? ($changes['sale_price'] ?? '') : ($product ? $product->get_sale_price('edit') : '');
        if ($sale !== '' && ($regular === '' || (float) $sale >= (float) $regular)) {
            throw new Problem('sale_price_invalid', 'Sale price must be lower than the regular price. Clear it explicitly to remove a sale.');
        }
        if (isset($changes['sku']) && $changes['sku'] !== '') {
            $existing = wc_get_product_id_by_sku($changes['sku']);
            if ($existing && (!$product || $existing !== $product->get_id())) {
                throw new Problem('duplicate_sku', 'This SKU already belongs to another product.');
            }
        }
        foreach (['category_ids' => 'product_cat', 'tag_ids' => 'product_tag'] as $field => $taxonomy) {
            foreach ($changes[$field] ?? [] as $term) {
                if (!term_exists($term, $taxonomy)) {
                    throw new Problem('missing_term', 'A selected category or tag does not exist. Use the References tab.');
                }
            }
        }
        $images = $changes['gallery_ids'] ?? [];
        if (!empty($changes['image_id'])) {
            $images[] = $changes['image_id'];
        }
        foreach ($images as $image) {
            if (!wp_attachment_is_image($image) || get_post_status($image) === 'trash') {
                throw new Problem('missing_image', 'An image ID is not an available Media Library image.');
            }
        }
        foreach (array_merge($changes['upsell_ids'] ?? [], $changes['cross_sell_ids'] ?? []) as $id) {
            if (($product && $id === $product->get_id()) || !wc_get_product($id)) {
                throw new Problem('invalid_linked_product', 'Linked product IDs must exist and cannot refer to the product itself.');
            }
            Settings::assertScope($id);
        }
        if ($type === 'variable' && array_intersect(array_keys($changes), ['regular_price', 'sale_price', 'initial_stock', 'stock_adjustment'])) {
            throw new Problem('variable_child_required', 'Set prices and quantities on individual variations. Parent-managed stock is not supported by this connector.');
        }
        if ($type === 'variation' && array_intersect(array_keys($changes), ['attributes', 'category_ids', 'tag_ids', 'gallery_ids', 'upsell_ids', 'cross_sell_ids', 'short_description'])) {
            throw new Problem('variation_field_invalid', 'Set catalog-level attributes, categories, gallery and linked products on the parent product.');
        }
        if ($type !== 'variation' && isset($changes['variation_attributes'])) {
            throw new Problem('variation_only', 'variation_attributes can only be used on a variation.');
        }
        $managed = $changes['manage_stock'] ?? ($product ? $product->get_manage_stock('edit') : isset($changes['initial_stock']));
        if (isset($changes['stock_adjustment']) && (!$managed || !$product || $product->get_stock_managed_by_id() !== $product->get_id())) {
            throw new Problem('stock_not_managed', 'Enable stock management on this product in WooCommerce first. Shared parent stock cannot be adjusted from a variation.');
        }
        if (isset($changes['stock_status']) && $managed) {
            throw new Problem('derived_stock_status', 'Stock status is calculated from quantity when stock management is enabled.');
        }
        if (isset($changes['initial_stock']) && !$managed) {
            throw new Problem('stock_management_required', 'Initial stock requires stock management.');
        }
        if (isset($changes['stock_adjustment']) && $product && !is_int($product->get_stock_quantity('edit')) && floor((float) $product->get_stock_quantity('edit')) !== (float) $product->get_stock_quantity('edit')) {
            throw new Problem('fractional_stock_unsupported', 'This connector supports whole-unit stock only.');
        }
        if (isset($changes['attributes']) && $product) {
            foreach ($product->get_attributes('edit') as $attribute) {
                if ($attribute instanceof \WC_Product_Attribute && $attribute->is_taxonomy()) {
                    throw new Problem('global_attributes_preserved', 'Edit global taxonomy attributes in WooCommerce. This connector edits local attributes only.');
                }
            }
            if ($product->is_type('variable') && self::variationIds($product->get_id())) {
                throw new Problem('parent_attributes_in_use', 'Edit attributes of a parent with existing variations in WooCommerce to preserve its variation definitions.');
            }
        }
        if (isset($changes['attributes'])) {
            $keys = [];
            foreach ($changes['attributes'] as $attribute) {
                $key = sanitize_title(sanitize_text_field($attribute['name']));
                if ($key === '' || in_array($key, $keys, true)) {
                    throw new Problem('attribute_key_collision', 'Attribute names must produce distinct nonempty WooCommerce keys.');
                }
                $keys[] = $key;
            }
        }
        if (isset($changes['variation_attributes'])) {
            $parent = self::get($product ? $product->get_parent_id() : $request['parent_id']);
            Settings::assertScope($parent->get_id());
            if (!$parent->is_type('variable')) {
                throw new Problem('invalid_parent', 'A variation needs an existing variable parent.');
            }
            self::validateVariation($changes['variation_attributes'], $parent, $product ? $product->get_id() : 0);
        }
    }

    private static function validateVariation(array $values, \WC_Product $parent, int $current): void
    {
        $allowed = [];
        foreach ($parent->get_attributes('edit') as $attribute) {
            if (!$attribute->get_variation()) {
                continue;
            }
            $options = $attribute->is_taxonomy() ? wc_get_product_terms($parent->get_id(), $attribute->get_name(), ['fields' => 'slugs']) : $attribute->get_options();
            $allowed[sanitize_title($attribute->get_name())] = $options;
        }
        $keys = array_keys($values);
        if (array_diff($keys, array_keys($allowed)) || array_diff(array_keys($allowed), $keys)) {
            throw new Problem('variation_keys_mismatch', 'Supply every variation attribute using the parent attribute key.');
        }
        foreach ($values as $key => $value) {
            if (!in_array($value, $allowed[$key], true)) {
                throw new Problem('variation_option_mismatch', 'A variation option is not defined on its parent.');
            }
        }
        foreach (self::variationIds($parent->get_id()) as $id) {
            if ($id === $current) {
                continue;
            }
            $child = wc_get_product($id);
            if ($child) {
                $overlap = true;
                $options = $child->get_attributes('edit');
                foreach ($values as $key => $value) {
                    if (isset($options[$key]) && $options[$key] !== '' && $options[$key] !== $value) {
                        $overlap = false;
                    }
                }
                if ($overlap) {
                    throw new Problem('duplicate_variation', 'A variation already covers these options, possibly with an Any option.');
                }
            }
        }
    }

    private static function variationIds(int $parent): array
    {
        // WooCommerce's normal child list omits draft variations. Drafts also reserve their combination.
        return array_map('intval', get_posts(['post_type' => 'product_variation', 'post_parent' => $parent,
            'post_status' => ['publish', 'private', 'draft', 'pending', 'future'], 'numberposts' => -1, 'fields' => 'ids']));
    }

    public static function newDraft(array $request): \WC_Product
    {
        $product = match ($request['type']) {
            'variable' => new \WC_Product_Variable(), 'variation' => new \WC_Product_Variation(), default => new \WC_Product_Simple(),
        };
        $product->set_status('draft');
        if ($request['parent_id']) {
            $product->set_parent_id($request['parent_id']);
        }
        return $product;
    }

    public static function write(array $request, \WC_Product $product): \WC_Product
    {
        if (!in_array($product->get_data_store()->get_current_class_name(), ['WC_Product_Data_Store_CPT', 'WC_Product_Variable_Data_Store_CPT', 'WC_Product_Variation_Data_Store_CPT'], true)) {
            throw new Problem('unsupported_data_store', 'This product uses a custom storage adapter. Its transaction behavior needs a dedicated integration.', 409);
        }
        $new = $request['action'] === 'create';
        foreach ($request['changes'] as $field => $value) {
            if ($field === 'stock_adjustment' || $field === 'initial_stock') {
                continue;
            }
            if ($field === 'meta') {
                foreach ($value as $key => $item) {
                    if ($item === null) {
                        $product->delete_meta_data($key);
                    } else {
                        $product->update_meta_data($key, is_string($item) ? sanitize_text_field($item) : $item);
                    }
                }
            } elseif ($field === 'attributes') {
                $attributes = [];
                foreach ($value as $position => $item) {
                    $attribute = new \WC_Product_Attribute();
                    $attribute->set_name(sanitize_text_field($item['name']));
                    $attribute->set_options(array_map('sanitize_text_field', $item['options']));
                    $attribute->set_position($position);
                    $attribute->set_visible($item['visible'] ?? true);
                    $attribute->set_variation($item['variation'] ?? false);
                    $attributes[] = $attribute;
                }
                $product->set_attributes($attributes);
            } elseif ($field === 'variation_attributes') {
                $product->set_attributes($value);
            } elseif (in_array($field, ['description', 'short_description'], true)) {
                $product->{'set_' . $field}(wp_kses_post($value));
            } else {
                $setter = 'set_' . ($field === 'gallery_ids' ? 'gallery_image_ids' : $field);
                $product->$setter(in_array($field, ['name', 'sku'], true) ? sanitize_text_field($value) : ($value ?? ''));
            }
        }
        if ($new && isset($request['changes']['initial_stock'])) {
            $product->set_manage_stock(true);
            $product->set_stock_quantity($request['changes']['initial_stock']);
        }
        $product->save();
        if (isset($request['changes']['stock_adjustment'])) {
            $delta = $request['changes']['stock_adjustment'];
            $result = wc_update_product_stock($product, abs($delta), $delta > 0 ? 'increase' : 'decrease');
            if ($result === false || $result === null || is_wp_error($result)) {
                throw new Problem('stock_update_failed', 'WooCommerce could not apply the stock adjustment.', 503);
            }
        }
        if ($product->get_parent_id()) {
            \WC_Product_Variable::sync($product->get_parent_id());
        }
        return self::fresh($product->get_id());
    }
}
