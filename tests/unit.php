<?php
require dirname(__DIR__) . '/sheetbridge/includes/Problem.php';
require dirname(__DIR__) . '/sheetbridge/includes/Validation.php';
use SheetBridge\Validation;
use SheetBridge\Problem;
$count = 0;
$settings = ['fields' => Validation::fields(), 'allow_create' => true, 'product_ids' => [], 'meta_keys' => ['sb_supplier']];
$base = ['request_id' => 'test_request_00001', 'action' => 'update', 'product_id' => 12, 'revision' => str_repeat('a', 64), 'changes' => ['name' => 'Example']];
function check(bool $condition, string $name): void { global $count; if (!$condition) throw new RuntimeException($name); $count++; echo "PASS $name\n"; }
function invalid(array $patch, string $reason): void {
    global $base, $settings;
    try { Validation::request(array_replace($base, $patch), $settings); throw new RuntimeException('Expected ' . $reason); }
    catch (Problem $error) { check($error->reason === $reason, $reason); }
}
check(Validation::request($base, $settings)['product_id'] === 12, 'valid update');
check(Validation::request(array_replace($base, ['changes' => ['sku' => '000123']]), $settings)['changes']['sku'] === '000123', 'SKU leading zeros');
check(Validation::request(array_replace($base, ['changes' => ['sale_price' => null]]), $settings)['changes']['sale_price'] === null, 'explicit clear');
check(Validation::request(array_replace($base, ['changes' => ['regular_price' => '0']]), $settings)['changes']['regular_price'] === '0', 'zero price is valid');
invalid(['changes' => ['regular_price' => '']], 'invalid_number');
invalid(['changes' => ['regular_price' => '-1']], 'invalid_number');
invalid(['changes' => ['regular_price' => '1,20']], 'invalid_number');
invalid(['changes' => ['regular_price' => '10 USD']], 'invalid_number');
invalid(['changes' => ['regular_price' => INF]], 'invalid_number');
invalid(['changes' => ['stock_adjustment' => 1.5]], 'invalid_stock');
invalid(['changes' => ['stock_adjustment' => 0]], 'invalid_stock');
invalid(['changes' => ['stock_adjustment' => '5']], 'invalid_stock');
invalid(['changes' => ['stock_adjustment' => 1000001]], 'invalid_stock');
invalid(['changes' => ['initial_stock' => 5]], 'absolute_stock_forbidden');
invalid(['changes' => ['stock_quantity' => 5]], 'unknown_field');
invalid(['changes' => ['status' => 'trash']], 'invalid_choice');
invalid(['action' => 'delete'], 'invalid_action');
invalid(['product_id' => '12'], 'invalid_id');
invalid(['revision' => ''], 'missing_revision');
invalid(['request_id' => 'short'], 'invalid_request_id');
invalid(['extra' => true], 'unknown_property');
invalid(['changes' => []], 'empty_changes');
invalid(['changes' => ['manage_stock' => 'yes']], 'invalid_boolean');
invalid(['changes' => ['category_ids' => [1, '2']]], 'invalid_list_id');
invalid(['changes' => ['category_ids' => '1,2']], 'invalid_list');
invalid(['changes' => ['meta' => ['_price' => '1']]], 'meta_forbidden');
invalid(['changes' => ['meta' => ['sb_supplier' => ['nested']]]], 'invalid_meta_value');
invalid(['changes' => ['image_id' => 'https://example.test/x.jpg']], 'invalid_image');
invalid(['changes' => ['attributes' => [['name' => 'pa_color', 'options' => ['Blue']]]]], 'invalid_attribute_name');
invalid(['changes' => ['attributes' => [['name' => 'Color', 'options' => ['Blue'], 'variation' => 'yes']]]], 'invalid_attribute_flag');
invalid(['changes' => ['variation_attributes' => ['color' => '']]], 'invalid_variation_option');
invalid(['changes' => ['manage_stock' => false, 'stock_adjustment' => 1]], 'stock_mode_conflict');
invalid(['action' => 'create', 'product_id' => 0, 'type' => 'variation'], 'invalid_parent');
invalid(['action' => 'create', 'product_id' => 0, 'changes' => ['name' => 'New', 'status' => 'publish']], 'draft_required');
invalid(['action' => 'create', 'product_id' => 0, 'changes' => ['name' => 'New', 'stock_adjustment' => 2]], 'initial_stock_required');
$settings['fields'] = ['name']; invalid(['changes' => ['regular_price' => '2']], 'field_forbidden');
$settings['allow_create'] = false; invalid(['action' => 'create', 'product_id' => 0], 'create_disabled');
echo "Unit checks passed: $count\n";
