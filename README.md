# SheetBridge for WooCommerce

[English](README.md) | [العربية](README.ar.md)

Manage WooCommerce products through Google Sheets, with a before/after review in WordPress before changes are applied. Includes an Arabic/English interface, inventory safeguards, and a printable beginner guide.

This repository is named **flexstock**; the plugin it contains is **SheetBridge for WooCommerce**, an independent implementation for one store. It does not require FlexStock or contain its plugin code. The [original Arabic research](flexstock-woocommerce-google-sheets-report-ar.md) is included as background.

**Version 1.0.0 — ready for staging evaluation.** Local tests passed; live Google authorization, scheduled triggers, and compatibility with your store's extensions still require the [staging acceptance checklist](docs/testing.md#staging-acceptance-before-deployment). See the [validation record](VALIDATION.md) for what was actually tested.

## Downloads

| File | Use |
|---|---|
| [Installable plugin ZIP](https://github.com/engmuhammednasser/flexstock/raw/refs/heads/main/dist/sheetbridge-1.0.0.zip) | Upload this file in WordPress |
| [Arabic / English user guide](https://github.com/engmuhammednasser/flexstock/raw/refs/heads/main/dist/SheetBridge-User-Guide-AR-EN.html) | Save the HTML file, then open it in your browser; switch languages or print |
| [SHA-256 checksum](dist/SHA256SUMS.txt) | Verify the plugin download |

GitHub's **Code → Download ZIP** downloads the complete development repository. For installation, use **sheetbridge-1.0.0.zip** from the link above.

## Install

1. Activate WooCommerce on a staging copy of your store.
2. Download the installable plugin ZIP above.
3. In WordPress, open **Plugins → Add New → Upload Plugin**, select the ZIP, install, and activate.
4. Open **WooCommerce → SheetBridge**. Choose the permitted fields and products, then follow **Connect** to create a connection key.
5. Follow the bilingual guide to create a private standalone Google Apps Script project using [SheetBridge.gs](sheetbridge/connector/SheetBridge.gs) and [appsscript.json](sheetbridge/connector/appsscript.json). Set its Script Properties, run setup, and authorize Google access.
6. Prepare a small change in the spreadsheet's **Changes** tab, mark it ready, and review its before/after values in WordPress before approving.

The complete guide is also available inside the plugin. Keep connection keys in the private script's properties; do not put them in repository files or spreadsheet cells.

Declared minimums: PHP 8.1, WordPress 6.5, WooCommerce 9.0. WooCommerce's own version requirements still apply. HTTPS and InnoDB are required for the supported connection/write workflow. See [VALIDATION.md](VALIDATION.md) for the versions actually tested; the full minimum-version matrix has not been exercised.

## Workflow

The private standalone Google Apps Script polls the store every five minutes. Catalog is an authoritative summary. Changes is a separate proposal worksheet. A manual product-ID edit captures its revision. Formula/API input is read by scheduled polling, but API writers must provide the revision captured when preparing the edit. A WordPress reviewer sees before/after values and approves each request. There is no automatic product-write mode.

WordPress stores only a hash of the 90-day connection credential. The credential can read the scoped catalog and submit proposals, but cannot approve them or change settings. Site administrators manage connection settings. WooCommerce managers can review requests. The script project must remain private; share the spreadsheet as needed without sharing its script project.

## Implemented product operations

- Update existing simple products, variable parents and variations; create drafts of all three types.
- Names, SKU, regular/sale prices, descriptions, publication status, stock management/backorders, weight/dimensions.
- Relative whole-unit stock adjustments through WooCommerce stock APIs. No absolute overwrite of existing stock.
- Existing category/tag assignments, Media Library images/gallery, upsells/cross-sells.
- Local attributes on simple products and parents without children; variation options validated against the parent, including draft duplicate detection.
- Explicitly allowlisted `sb_` scalar custom fields.
- Preview, conflict detection, permissions revalidation, idempotent requests, transactional audit, retry, rejection and reversal previews.
- Independent inbound/outbound pause controls, diagnostics, limited product scope, bilingual UI and guide.

## Deliberate boundaries

One store only. No vendor isolation, multi-store reservation engine, order/customer sync, subscriptions/bundles, arbitrary metadata/ACF structures, remote image download, image ALT editing, new taxonomy-term creation, or global attribute schema editing. Existing taxonomy attributes can be used by variations. New products are drafts; trash/delete endpoints do not exist. Parent-managed shared inventory and fractional quantities are unsupported. Maintain those workflows directly in WooCommerce.

No hosted OAuth service is supplied: the private script avoids Service Account JSON setup but still needs one-time Google authorization. No claim of guaranteed real-time synchronization or unrestricted scale is made. Google and hosting quotas still apply. The connector stages up to 200 catalog records per cycle, examines up to 100 Changes rows per cycle, and loads up to 500 references of each kind on setup. Polling rotates through longer Changes sheets. Archive old rows only after their outcomes are understood; never reuse request IDs.

External hooks, emails, webhooks and persistent-cache behavior cannot be rolled back by a database transaction. See the [architecture notes](docs/architecture.md) and the [staging acceptance checklist](docs/testing.md#staging-acceptance-before-deployment).

## Layout

- `sheetbridge/`: release plugin, native admin, REST, domain validation, product adapter, connector and user guide.
- `tests/`: standalone validation tests, Node connector tests and real WordPress/WooCommerce integration tests.
- `scripts/`: local build and isolated test helpers, never included in the plugin ZIP.
- `docs/`: engineering design and acceptance guidance.
- `dist/`: installable ZIP, standalone bilingual guide, and checksum.
- `.runtime/`: excluded local WordPress/MariaDB test environment; never distributed.

## Validate and package

```powershell
git clone https://github.com/engmuhammednasser/flexstock.git
cd flexstock
powershell -ExecutionPolicy Bypass -File scripts/validate.ps1
powershell -ExecutionPolicy Bypass -File scripts/package.ps1
```

The validator runs PHP syntax checks, JavaScript parsing, 37 domain validation checks, and 27 connector checks. The package script builds the ZIP from `sheetbridge/`, exports the guide, and updates the checksum. PHP and Node.js must be on your PATH; packaging uses PowerShell's archive tools.

Integration and concurrency tests require the isolated test installation described in [docs/testing.md](docs/testing.md). Never point them at a real store. With that local database running, execute:

```powershell
php tests/integration.php
php tests/concurrency.php
```

The development scripts and test helpers are excluded from the plugin ZIP. Deploy the plugin ZIP only; never deploy this entire repository as a website.

No runtime npm or Composer dependencies, telemetry, licensing callbacks or remote asset CDN is included. The plugin uses WordPress/WooCommerce and Google Apps Script APIs.

## Documentation and license

- [Beginner guide source](sheetbridge/docs/user-guide.html) — bilingual offline HTML, also included in the plugin.
- [Architecture and security boundaries](docs/architecture.md).
- [Local tests and staging acceptance](docs/testing.md).
- [Validation results and remaining limitations](VALIDATION.md).
- [Implementation scope](IMPLEMENTATION_PLAN.md).

The plugin and connector are licensed under [GPL-2.0-or-later](LICENSE). The original research includes third-party references; those referenced products and materials remain their respective owners' work.
