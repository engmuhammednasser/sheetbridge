# SheetBridge for WooCommerce implementation plan

Status: implemented and packaged. The isolated local validation and browser checks are recorded in `VALIDATION.md`. Real Google authorization and site-specific staging acceptance remain external verification steps.

## Confirmed scope

Independent WooCommerce plugin for one store. Arabic and English interface and beginner guide. Existing research is background, not copied plugin code. No live store or Google account will be modified during development.

## User journey

1. Install the ZIP and activate alongside WooCommerce.
2. Choose permitted fields and create a restricted connection key.
3. Install a private standalone Google Apps Script connector and select a spreadsheet.
4. Review current products in Catalog and prepare edits in a separate Changes tab.
5. Submit rows for validation and preview; approve changes in WordPress.
6. Inspect results and conflicts; retry transient failures without duplicating successful writes.

## Architecture and safeguards

- Native WordPress admin and REST API, WooCommerce CRUD, no runtime Composer/npm dependencies.
- Separate settings, validation, product adapter, request storage, sync service, REST, and admin modules.
- Hashed, expiring connection credential; HTTPS; server-side field and product scope restrictions; admin capability and nonce checks.
- Strict input validation and explicit clear operation. New products start as drafts. No deletion endpoint.
- Preview records include product snapshots. Apply rechecks values and permissions. Conflicts require a new preview.
- Stock updates are relative adjustments through WooCommerce stock functions. Absolute quantities from stale sheets cannot overwrite sales.
- Per-request idempotency, per-product database locks, transactional writes and audit records on InnoDB. Unsupported storage fails closed for writes.
- Separate authoritative Catalog and proposed Changes tabs prevent refreshes from overwriting unsent edits.
- Polling explicitly handles formula/API changes; no claim of guaranteed real-time sync.
- Existing media IDs avoid remote image fetching and SSRF. Scalar custom fields require an administrator allowlist.
- Product management includes simple and variable parents, variations, prices, content, taxonomy assignments, local attributes, existing media, linked products, shipping fields and permitted scalar metadata. Complex third-party product types and metadata require separate adapters.
- Multi-store inventory and vendor isolation are outside the confirmed first-release scope.

## Deliverables

- `sheetbridge/` installable plugin source and connector.
- `dist/sheetbridge-1.0.0.zip`.
- Bilingual printable HTML user guide with setup, everyday tasks, error recovery and field reference.
- Developer README, architecture/security notes, acceptance checklist and reproducible tests.

## Validation

PHP syntax checks, pure validation tests, connector tests, real isolated WordPress/WooCommerce integration tests where local tooling permits, admin and guide visual checks. Record exact commands and outcomes in VALIDATION.md. Live Google authorization, public HTTPS connectivity and hosting-specific plugins remain staging acceptance steps.

## Delivery risks

External plugin side effects cannot be rolled back by a database transaction. No promise of distributed atomic inventory or complete compatibility with third-party extensions. Default human approval is intentional. Google quotas and hosting limits still apply. Docker is installed but its engine is unavailable; an isolated local MariaDB instance will be used if available.
