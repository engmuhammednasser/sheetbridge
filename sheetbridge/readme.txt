=== SheetBridge for WooCommerce ===
Contributors: sheetbridge
Requires at least: 6.5
Requires PHP: 8.1
Stable tag: 1.2.0
Tested up to: 7.0.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Review WooCommerce product changes from Google Sheets before applying them. Arabic and English interface and user guide.

== Description ==
Connect one store through a private standalone Apps Script project. Read Catalog, prepare Changes, and approve each request in WordPress. Existing stock uses relative adjustments. Product snapshots detect conflicting changes, request IDs prevent duplicate writes, and permissions are checked on the server.

Requires WooCommerce 9.0+, HTTPS, PHP 8.1+, and InnoDB database tables. Recent WooCommerce versions may require a newer WordPress release.

== Installation ==
1. Activate WooCommerce.
2. Upload the plugin ZIP and activate it.
3. Open WooCommerce > SheetBridge > Settings.
4. Select permitted fields and language.
5. Follow Connect to install the private standalone connector.
6. Test one product on staging before production use.

The complete Arabic/English guide is linked inside SheetBridge and bundled at docs/user-guide.html.
The Arabic customer walkthrough at docs/customer-journey-ar.html explains every setup value and its source, Google authorization, first approval, and recovery.

== Privacy and external services ==
The optional Google connector uses Google Sheets and Google Apps Script under your own Google account. It sends your configured product proposals to your store and reads scoped catalog data into your spreadsheet. Google authorization and Google's terms apply. Keep the script project private. No plugin telemetry or developer-operated relay service is used.

The WordPress database stores product snapshots and review history, plus a hash of the connection key. Uninstall revokes the key but retains history and settings; products are not deleted. Google triggers must be stopped separately.

Update checks retrieve a public release manifest from raw.githubusercontent.com/engmuhammednasser/sheetbridge/main/updates/stable.json. Updates download ZIP assets from the official GitHub repository releases and verify their SHA-256 checksums. No store, spreadsheet, customer or connection-key data is sent to GitHub by SheetBridge. Automatic updates remain optional in WordPress.

== Limitations ==
Single store, human approval required, no deletion or remote image fetching. Whole-unit stock on independently managed simple products/variations. Complex third-party product types, ACF structures, multi-store inventory and vendor isolation are outside this release. Validate hosting, cache, Google authorization and extension compatibility on staging.

== Changelog ==

= 1.2.0 =
Send manually readied rows immediately for review, prioritize active rows, select products by name/SKU and show protected current values. Add connector progress, sanitized diagnostics, setup link parsing, review search/product identity and configurable price warnings. Run connector setup once after replacing old code; preserve Script Properties. Manual WordPress approval remains required.
= 1.1.1 =
Recheck product scope before returning an existing preview on retries. Include a detailed Arabic customer walkthrough and expanded security regression coverage. Connector 1.1.0 remains compatible; no script replacement or key rotation is needed.

= 1.1.0 =
Native WordPress View details, manual update checks, stable GitHub release updates and SHA-256 package verification. Optional WordPress automatic updates remain under the administrator's control. Connector protocol compatibility avoids script replacement for future compatible plugin updates after a one-time upgrade to connector 1.1.0.

= 1.0.1 =
Credit muhammed nasser in plugin metadata, all admin page footers, and the bilingual user guide.

= 1.0.0 =
Initial implementation with bilingual admin, private Google connector, review workflow, conflict checks, idempotency, stock adjustment safeguards and reversal previews.
