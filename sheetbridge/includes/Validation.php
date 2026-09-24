<?php
namespace SheetBridge;

/** Strict wire validation. This class deliberately has no WordPress dependencies. */
final class Validation
{
    public static function fields(): array
    {
        return ['name', 'sku', 'regular_price', 'sale_price', 'description', 'short_description',
            'status', 'stock_adjustment', 'initial_stock', 'manage_stock', 'stock_status', 'backorders',
            'category_ids', 'tag_ids', 'image_id', 'gallery_ids', 'upsell_ids', 'cross_sell_ids',
            'weight', 'length', 'width', 'height', 'attributes', 'variation_attributes', 'meta'];
    }

    public static function request(array $input, array $settings): array
    {
        if (array_diff(array_keys($input), ['request_id', 'action', 'product_id', 'parent_id', 'type', 'revision', 'changes'])) {
            throw new Problem('unknown_property', 'The request contains unsupported properties.');
        }
        $key = $input['request_id'] ?? '';
        if (!is_string($key) || !preg_match('/^[a-zA-Z0-9_-]{16,80}$/D', $key)) {
            throw new Problem('invalid_request_id', 'A stable request ID of 16 to 80 letters, numbers, underscores or hyphens is required.');
        }
        $action = $input['action'] ?? 'update';
        if (!in_array($action, ['update', 'create'], true)) {
            throw new Problem('invalid_action', 'Only update and create are supported. Deletion is unavailable.');
        }
        $id = $input['product_id'] ?? 0;
        $parent = $input['parent_id'] ?? 0;
        if (!is_int($id) || $id < 0 || !is_int($parent) || $parent < 0) {
            throw new Problem('invalid_id', 'Product IDs must be nonnegative integers.');
        }
        $type = $input['type'] ?? 'simple';
        if (!in_array($type, ['simple', 'variable', 'variation'], true)) {
            throw new Problem('unsupported_type', 'Supported product types are simple, variable and variation.');
        }
        $revision = $input['revision'] ?? '';
        if (!is_string($revision) || ($action === 'update' && (!preg_match('/^[a-f0-9]{64}$/D', $revision) || !$id))) {
            throw new Problem('missing_revision', 'Refresh Catalog and use its product ID and revision.');
        }
        if ($action === 'create') {
            if (empty($settings['allow_create']) || !empty($settings['product_ids'])) {
                throw new Problem('create_disabled', 'Creation is disabled or a restricted product scope is configured.', 403);
            }
            if ($id !== 0 || ($type === 'variation' && !$parent) || ($type !== 'variation' && $parent)) {
                throw new Problem('invalid_parent', 'New variations need a parent ID; other new products must have no parent or product ID.');
            }
        } elseif ($parent || $type !== 'simple') {
            throw new Problem('immutable_type', 'Do not send parent or type for an update; the existing product type is preserved.');
        }
        $changes = $input['changes'] ?? null;
        if (!is_array($changes) || !$changes || array_is_list($changes) || count($changes) > 30) {
            throw new Problem('empty_changes', 'Provide at least one named field to change.');
        }
        foreach ($changes as $field => &$value) {
            if (!in_array($field, self::fields(), true)) {
                throw new Problem('unknown_field', 'Unsupported field: ' . $field);
            }
            if (!in_array($field, $settings['fields'], true)) {
                throw new Problem('field_forbidden', 'This field is not enabled: ' . $field, 403);
            }
            $value = self::value($field, $value, $settings);
        }
        unset($value);
        if ($action === 'create') {
            if ($type !== 'variation' && empty($changes['name'])) {
                throw new Problem('missing_name', 'New products need a name.');
            }
            if (isset($changes['status']) && $changes['status'] !== 'draft') {
                throw new Problem('draft_required', 'New products are created as drafts. Publish them in a separate reviewed update.');
            }
            if (isset($changes['stock_adjustment'])) {
                throw new Problem('initial_stock_required', 'Use initial_stock when creating a product.');
            }
            if ($type === 'variation' && empty($changes['variation_attributes'])) {
                throw new Problem('missing_attributes', 'A new variation needs variation_attributes.');
            }
        } elseif (array_key_exists('initial_stock', $changes)) {
            throw new Problem('absolute_stock_forbidden', 'Existing stock accepts relative stock_adjustment only.');
        }
        if (($changes['manage_stock'] ?? null) === false && array_key_exists('stock_adjustment', $changes)) {
            throw new Problem('stock_mode_conflict', 'Do not disable stock management while adjusting stock.');
        }
        ksort($changes);
        return ['request_id' => $key, 'action' => $action, 'product_id' => $id, 'parent_id' => $parent,
            'type' => $type, 'revision' => $revision, 'changes' => $changes];
    }

    private static function value(string $field, mixed $value, array $settings): mixed
    {
        if (in_array($field, ['name', 'sku', 'description', 'short_description'], true)) {
            $max = in_array($field, ['description', 'short_description'], true) ? 20000 : 200;
            if ($value === null && $field !== 'name') {
                return '';
            }
            if (!is_string($value) || strlen($value) > $max || ($field === 'name' && trim($value) === '')) {
                throw new Problem('invalid_text', $field . ' needs text within its length limit.');
            }
            return trim($value);
        }
        if (in_array($field, ['regular_price', 'sale_price', 'weight', 'length', 'width', 'height'], true)) {
            if ($value === null) {
                return null;
            }
            $text = is_int($value) || is_float($value) || is_string($value) ? (string) $value : '';
            if (!preg_match('/^\d{1,10}(\.\d{1,6})?$/D', $text) || (float) $text > 9999999999) {
                throw new Problem('invalid_number', $field . ' needs a nonnegative number with a dot decimal separator. Use explicit Clear to remove it.');
            }
            return $text;
        }
        if (in_array($field, ['stock_adjustment', 'initial_stock'], true)) {
            if (!is_int($value) || abs($value) > 1000000 || ($field === 'initial_stock' && $value < 0) || ($field === 'stock_adjustment' && $value === 0)) {
                throw new Problem('invalid_stock', 'Stock needs whole units within one million. An adjustment must be nonzero.');
            }
            return $value;
        }
        if ($field === 'manage_stock') {
            if (!is_bool($value)) {
                throw new Problem('invalid_boolean', 'manage_stock must be true or false.');
            }
            return $value;
        }
        $enums = ['status' => ['draft', 'publish', 'private'], 'stock_status' => ['instock', 'outofstock', 'onbackorder'], 'backorders' => ['no', 'notify', 'yes']];
        if (isset($enums[$field])) {
            if (!in_array($value, $enums[$field], true)) {
                throw new Problem('invalid_choice', 'Unsupported value for ' . $field . '.');
            }
            return $value;
        }
        if ($field === 'image_id') {
            if ($value === null) {
                return 0;
            }
            if (!is_int($value) || $value < 0) {
                throw new Problem('invalid_image', 'Choose an existing Media Library image ID.');
            }
            return $value;
        }
        if (in_array($field, ['category_ids', 'tag_ids', 'gallery_ids', 'upsell_ids', 'cross_sell_ids'], true)) {
            if ($value === null) {
                return [];
            }
            if (!is_array($value) || !array_is_list($value) || count($value) > 50) {
                throw new Problem('invalid_list', $field . ' needs an array of up to 50 IDs.');
            }
            foreach ($value as $id) {
                if (!is_int($id) || $id <= 0) {
                    throw new Problem('invalid_list_id', $field . ' accepts only positive integer IDs.');
                }
            }
            return array_values(array_unique($value));
        }
        if ($field === 'attributes') {
            if ($value === null) {
                return [];
            }
            if (!is_array($value) || !array_is_list($value) || count($value) > 20) {
                throw new Problem('invalid_attributes', 'Use up to 20 local attributes with name, options, visible and variation.');
            }
            $names = [];
            foreach ($value as $attribute) {
                if (!is_array($attribute) || array_diff(array_keys($attribute), ['name', 'options', 'visible', 'variation']) ||
                    !is_string($attribute['name'] ?? null) || trim($attribute['name']) === '' || strlen($attribute['name']) > 100 ||
                    !is_array($attribute['options'] ?? null) || !array_is_list($attribute['options']) || !$attribute['options'] || count($attribute['options']) > 50) {
                    throw new Problem('invalid_attribute', 'Each local attribute needs a unique name and a list of text options.');
                }
                $name = strtolower(trim($attribute['name']));
                if (in_array($name, $names, true) || str_starts_with($name, 'pa_')) {
                    throw new Problem('invalid_attribute_name', 'Attribute names must be unique and must not start with pa_.');
                }
                $names[] = $name;
                foreach ($attribute['options'] as $option) {
                    if (!is_string($option) || trim($option) === '' || strlen($option) > 100 || str_contains($option, '|')) {
                        throw new Problem('invalid_attribute_option', 'Attribute options need nonempty text without the | separator.');
                    }
                }
                foreach (['visible', 'variation'] as $flag) {
                    if (isset($attribute[$flag]) && !is_bool($attribute[$flag])) {
                        throw new Problem('invalid_attribute_flag', 'Attribute flags must be true or false.');
                    }
                }
            }
            return $value;
        }
        if ($field === 'variation_attributes') {
            if (!is_array($value) || !$value || array_is_list($value) || count($value) > 20) {
                throw new Problem('invalid_variation_attributes', 'Variation attributes need a map of attribute names to exact option values.');
            }
            foreach ($value as $key => $option) {
                if (!is_string($key) || !is_string($option) || trim($option) === '' || strlen($key) > 200 || strlen($option) > 200) {
                    throw new Problem('invalid_variation_option', 'Variation options must be nonempty text.');
                }
            }
            ksort($value);
            return $value;
        }
        if ($field === 'meta') {
            if (!is_array($value) || !$value || array_is_list($value) || count($value) > 30) {
                throw new Problem('invalid_meta', 'Custom fields need a map of permitted keys to scalar values.');
            }
            foreach ($value as $key => $item) {
                if (!in_array($key, $settings['meta_keys'], true) || !preg_match('/^sb_[a-z][a-z0-9_]{0,47}$/D', $key)) {
                    throw new Problem('meta_forbidden', 'This custom field is not permitted.', 403);
                }
                if ((!is_scalar($item) && $item !== null) || (is_string($item) && strlen($item) > 2000) || (is_float($item) && !is_finite($item))) {
                    throw new Problem('invalid_meta_value', 'Custom fields accept short text, finite numbers, booleans or explicit Clear.');
                }
            }
            ksort($value);
            return $value;
        }
        throw new Problem('unknown_field', 'Unsupported field.');
    }
}
