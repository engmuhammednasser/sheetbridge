# Local tests and staging acceptance

The integration suite mutates an isolated local store. It refuses to run unless `WP_ENVIRONMENT_TYPE` is `local` and the database name is `sheetbridge_test`. It creates its own products, terms and audit records. Never change the guard to point it at a production database.

## Environment used here

- Local PHP CLI with mysqli, JSON, mbstring and required WordPress extensions.
- An isolated MariaDB instance bound to 127.0.0.1:13307, with its data directory inside `.runtime/mysql`.
- Official WordPress core, WooCommerce and WP-CLI downloads under `.runtime/`.
- WordPress at `.runtime/wordpress` with the database `sheetbridge_test` and local environment configuration.
- `php scripts/install-test-store.php` installs the local test site with a generated, undisclosed random admin password. It configures only the isolated site and disables WooCommerce tracking.
- WP-CLI activates WooCommerce and SheetBridge. Copy the current plugin directory into this installation before rerunning integration tests.

The included dev router supports a loopback-only `_test-login` shortcut for visual testing of this isolated installation. It verifies the local environment and test database. It is excluded from the release ZIP and must never be deployed.

## Commands

```powershell
Copy-Item -Path 'sheetbridge\*' -Destination '.runtime\wordpress\wp-content\plugins\sheetbridge' -Recurse -Force
php tests/unit.php
node tests/connector.test.cjs
php tests/integration.php
php tests/concurrency.php
php tests/security.php
powershell -ExecutionPolicy Bypass -File scripts/validate.ps1
powershell -ExecutionPolicy Bypass -File scripts/package.ps1
```

There is no Composer/npm runtime dependency or production compilation step. PHP lint, JavaScript parsing, behavior tests and archive inspection are the applicable build gates. See `VALIDATION.md` for actual outcomes and tool availability limits.

Run integration, security and concurrency suites sequentially: they change the same isolated database settings. `tests/security.php` covers actual REST permission callbacks for anonymous callers, connector keys, subscribers, shop managers and administrators, as well as nonces, revoked scope, token lifecycle and hostile payloads. Its JSON result is saved under ignored `artifacts/qa/`.

For an explicitly authorized real store, `node tests/live-read-only.cjs https://your-store.example` sends seven small anonymous GET requests only and records denial statuses without printing response bodies. It never sends write requests or real credentials. This limited check is not a whole-site penetration test.

## Staging acceptance before deployment

1. Install the ZIP through WordPress and verify activation with the site's actual PHP/WooCommerce versions.
2. Create a private Google script and a staging-only spreadsheet. Complete real Google authorization. Check managed Workspace policies, script triggers and property storage.
3. Confirm a manual product-ID edit captures a revision. Test direct edits, formulas and the actual supplier/API writer. Verify leading-zero SKUs, formula errors and invalid prices.
4. Confirm field and product restrictions, credential rotation, expiry, pauses, and denied unauthorized REST requests through the hosting firewall/reverse proxy.
5. Verify standard price, sale removal, descriptions, images, categories, local/global attribute use and variation publishing on the storefront and cart.
6. Run checkout concurrently with positive and negative stock adjustments; include cancellations, refunds and parent-managed inventory exclusions. Test the site's actual inventory extensions and custom order statuses.
7. Disconnect and reconnect networking. Simulate 429/5xx responses. Check request recovery, conflict messages, failed-only retry and reversal after later sales.
8. Repeat with Redis/object caching, page cache, imports and the site's active third-party hooks. Observe background work, webhooks and side effects around rollback.
9. Measure representative catalog refresh time, request approval duration, database growth and checkout performance. No performance improvement or maximum supported catalog size has been claimed.
10. Assign Google ownership, reviewers, key renewal, monitoring and backup responsibility. Keep a documented rollback procedure.

Do not launch if price, stock, identity, authorization or rollback behavior is unresolved. A successful local suite does not replace the site's acceptance test.
