# Validation record

Development validation: 23 September 2026. Repository preparation checks: 24 September 2026 (recorded below). All store mutations occurred in the isolated local test installation under `D:\flexstock\.runtime`. No production store or Google account was connected.

## Delivered artifacts

- `dist/sheetbridge-1.0.0.zip`: installable plugin, 17 archive entries, 63,864 bytes after the 24 September license-notice correction and rebuild.
- `dist/SheetBridge-User-Guide-AR-EN.html`: standalone bilingual guide, 47,048 bytes. Includes navigation, language switch and print styles/buttons.
- `dist/SHA256SUMS.txt`: SHA-256 checksum for the ZIP.
- `sheetbridge/`: complete release source, connector and bundled guide.

## Actual test environment

PHP 8.3.31, WordPress 7.1.2, WooCommerce 11.1.2, MariaDB 10.4.32, Node.js 24.18.1, Windows PowerShell. WordPress and WooCommerce were downloaded from their official distribution endpoints. MariaDB used a new workspace-owned data directory and loopback port 13307. The local HTTP server used loopback port 18765.

Docker was checked with `docker version --format '{{.Server.Version}}'`; its engine was unavailable. Testing proceeded with the isolated native MariaDB/PHP environment instead. Composer was available but was not needed. The supplied directory initially contained no Git repository, test runner, formatter, linter configuration or production build pipeline. No commits, branch changes or deployment were performed during the 23 September development validation.

## Commands and final results

| Command | Actual result |
|---|---|
| `php tests/unit.php` | PASS: 37 strict validation checks |
| `node tests/connector.test.cjs` | PASS: 27 connector checks, including simulated network recovery and bounded row processing |
| `node --check sheetbridge/assets/admin.js` | PASS: JavaScript syntax |
| `php tests/integration.php` | PASS: 59 checks against actual WordPress and WooCommerce |
| `php tests/concurrency.php` | PASS: 40 concurrent stock reductions plus two competing approvals resulted in 80 units, calculated as 100 - 40 + 20 once |
| `powershell -ExecutionPolicy Bypass -File scripts/validate.ps1` | PASS: all 10 release PHP files linted, admin JS parsed, 37 validation and 27 connector checks passed |
| `powershell -ExecutionPolicy Bypass -File scripts/package.ps1` | PASS: ZIP generated; expected root verified; development/runtime/credential paths excluded; standalone guide and checksum written |
| `php .runtime/wp-cli.phar plugin install 'D:\flexstock\dist\sheetbridge-1.0.0.zip' --force --activate --path=.runtime/wordpress` | PASS: ZIP unpacked and installed in the isolated store. WordPress reported the plugin was already active, then confirmed installation success |

Behavioral checks total **124**: 37 validation + 27 connector + 59 integration + 1 concurrent scenario. Syntax, archive checks and browser checks are additional.

## Scenarios actually verified

Preview does not mutate products; stale revisions conflict before submission and again before approval; permission/scope changes are rechecked; incoming pause is enforced; clear sale price works; SKU leading zeros persist; duplicate SKUs are rejected; invalid taxonomy/image IDs are rejected; safe description HTML is enforced; permitted custom fields persist and reversal restores missing metadata correctly; product creation starts as draft; request retry does not duplicate creation; draft variation combinations are reserved; parent attributes with children are protected; transaction failure after a save hook rolls back and remains retryable; failed creation removes its database row and cached post; concurrent stock adjustments preserve sales; inverse stock adjustments preserve later sales; unauthorized and insecure connector access fails; connector credentials cannot approve changes; rotation, expiration and site-URL changes invalidate credentials; admin nonce checks, payload size limits, rate limiting and pagination work.

Connector tests also verify blank versus explicit clear, rejected formula errors, preserved leading zeros, JSON and integer parsing, field permissions, stable submitted payloads after user edits, no repeated successful request, retries bounded to three attempts, redirects disabled for credential-bearing calls, safe transport errors and cursor rotation across long Changes sheets.

## Browser checks

Opened the real local WordPress admin in the browser. Checked English/Arabic switching, RTL layout, mobile layout, dashboard diagnostics, review loading, before/after details and guide links. Verified no document-level horizontal overflow in the checked layouts. Tested the guide's language switch and navigation, and inspected Arabic and English text rendering. Full print-to-PDF output was not generated or separately inspected.

Created an isolated UI request to change a draft product price from 100 to 125. The browser displayed the expected before/after data and then the applied state. Prepared its reversal, reviewed 125 to 100, accepted the accessible in-page confirmation and observed `Changes applied` and the applied request state.

The in-app browser intermittently timed out during navigation and native JavaScript confirmation. The final plugin uses an accessible HTML dialog, which was exercised successfully. The guide and mobile UI were visually checked; wide stitched screenshots from the embedded browser were unreliable, so DOM layout/overflow checks supplemented visual inspection. No false claim of a complete cross-browser matrix is made.

## Failures found and fixed during development

- Initial sale clearing converted null into an empty string that failed approval revalidation. Clear remains explicit in the saved wire payload and is translated at the WooCommerce setter boundary. Integration regression passed.
- WooCommerce's regular child list omitted draft variations. Duplicate detection now includes draft and other non-trash variation states, and rejects overlapping Any-option combinations. Draft duplicate regression passed.
- Plain-permalink admin review URLs incorrectly used a second question mark. Requests now preserve WordPress's query-form REST route; connector URLs use query-form REST routes for both permalink modes. Actual review navigation passed.
- Switching tabs before the initial request finished could attach handlers to a detached view. Render/request generations now discard stale responses. Browser navigation and details passed afterward.
- The first concurrency harness snapshot came from a just-saved in-memory object rather than the actual exported database state. The harness now reloads the product exactly as the export path does; the concurrent scenario passed.

These initial failures were not counted as passes. The results above describe successful final executions.

## Scope and unverified areas

No live Google authorization, Apps Script trigger execution, protection behavior, Google quota exhaustion or end-to-end internet synchronization was performed. The Google API calls are implemented and connector logic is tested with mocks; a real staging spreadsheet is still required for acceptance. No production checkout, Redis/LiteSpeed/page-cache combination, third-party inventory/pricing integration, penetration test, load benchmark or minimum-version compatibility matrix was run.

Declared minimums are PHP 8.1 / WordPress 6.5 / WooCommerce 9.0; only the actual versions above were tested. Custom product storage adapters are rejected for writes. Arbitrary hooks with external side effects cannot be undone by database rollback. Audit history is retained without automatic pruning. The HTML guide provides print styling, but a PDF is not part of this delivery.

The confirmed first-release scope is one store. Multi-store reservations, vendor isolation, remote image downloads, image ALT editing, complex ACF metadata, arbitrary custom product types, global taxonomy schema creation and shared parent stock remain outside the implemented contract. The guide and README explain supported alternatives and boundaries.

The original research report remains 90,742 bytes and was not edited. Final source searches found no TODO/FIXME placeholders, console logging or native `window.confirm` in the release code. The release archive contains only the plugin files; the isolated runtime, local login helper and tests are excluded.

Use `docs/testing.md` for the staging acceptance checklist and `docs/architecture.md` for the guarantees and their limits.

## Repository preparation — 24 September 2026

Prepared the initial GitHub import for `engmuhammednasser/flexstock`. Added an Arabic README, download and documentation links, Git exclusions and line-ending rules, and a root license. Corrected the bundled license's project notice from WordPress to SheetBridge; the GPL terms and plugin behavior are unchanged. Rebuilt the ZIP so the distributed license matches the source.

| Command or check | Actual result |
|---|---|
| `powershell -ExecutionPolicy Bypass -File scripts/validate.ps1` | PASS: 10 PHP syntax checks, admin JavaScript syntax, 37 domain checks, and 27 connector checks |
| `powershell -ExecutionPolicy Bypass -File scripts/package.ps1` | PASS: 17-entry plugin ZIP, standalone guide, and checksum regenerated |
| PowerShell ZIP entry/source SHA-256 comparison | PASS: all 17 archive files exactly match their source files |
| `Get-FileHash -LiteralPath dist/sheetbridge-1.0.0.zip -Algorithm SHA256` | PASS: matches `dist/SHA256SUMS.txt` |
| Standalone guide and root license hash comparisons | PASS: identical to their bundled counterparts |
| Read-only Node scan of publishable text files | PASS: no matches for the checked credential/private-key patterns; all 30 relative Markdown links resolve |
| `git diff --cached --check` | Exit 1: two existing Markdown hard-break lines in the original report and extra end-of-file blank lines in nine imported source/test files. Recorded as formatting warnings; the original files were preserved |

ZIP SHA-256: `7a473e483bfdb68ac04dd05f8257a3d63f5efb52424a69e080c692d67f40c5ff`.

The local runtime, databases, WordPress configuration, credentials, dependencies, and logs are excluded from Git. Pattern scanning is a limited pre-publication check, not a comprehensive security audit. Integration, concurrency, browser, and ZIP-installation results above are from the development validation; those suites were not rerun for the documentation/license-only repository preparation. Live Google and production-store acceptance remain outstanding.

## Repository migration — 29 September 2026

Migrated SheetBridge 1.0.0 from `engmuhammednasser/flexstock` at commit `e97d4fcd6e3a16f60c518ee9dd4eeaff1ccbc205` to `engmuhammednasser/sheetbridge`, preserving the original Git history. The working directory is now `D:\sheetbridge`. Updated the English and Arabic README repository descriptions, download links, and clone instructions. Plugin source, connector, and release artifacts were preserved without functional changes.

| Command or check | Actual result |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate.ps1` | PASS: 10 PHP syntax checks, admin JavaScript syntax, 37 domain checks, and 27 connector checks |
| Existing release ZIP inspection | PASS: 17 unique files, correct plugin root, and contents matching the checked-out source after CRLF/LF normalization |
| Byte-level ZIP/source comparison | Two files differ only in line endings after Git checkout: `sheetbridge/LICENSE.txt` and `sheetbridge/assets/admin.css`; the other 15 files match byte for byte |
| Existing release checksum | PASS: `dist/sheetbridge-1.0.0.zip` still matches `dist/SHA256SUMS.txt`; the archive was not rebuilt |
| Standalone guide and license comparison | PASS: guide matches byte for byte; license content matches after CRLF/LF normalization |
| Relative Markdown link and README URL checks | PASS: all 30 relative links resolve; download and clone URLs use the new repository |
| `git diff --check` | PASS for the migration changes |

ZIP SHA-256 remains `7a473e483bfdb68ac04dd05f8257a3d63f5efb52424a69e080c692d67f40c5ff`. The ignored `.runtime` installation is not part of the Git repository and was not copied. Integration, concurrency, browser, live Google, and store-installation tests were not rerun during this migration; earlier results above remain historical validation.

## Author attribution — 29 September 2026

Released 1.0.1 with `muhammed nasser` as the WordPress plugin author and `by muhammed nasser` in the shared admin footer and bilingual user guide. The credit uses explicit English language and left-to-right direction inside the Arabic/English layouts. Updated the version, changelog, download links, and package script; the version change also refreshes the admin asset URLs.

- Validation passed: 10 PHP syntax checks, admin JavaScript syntax, 37 domain checks, and 27 connector checks.
- Packaging passed: all 17 files in `dist/sheetbridge-1.0.1.zip` match the source byte for byte; the standalone guide matches the bundled guide.
- ZIP SHA-256: `08ff3403bd3562f458c07f2337d31cc80a60de83e22a5a3ae33a93a2e8074657`, matching `dist/SHA256SUMS.txt`.
- `git diff --check` passed. WordPress browser, installation, integration, and live Google checks were not rerun for this attribution change.
