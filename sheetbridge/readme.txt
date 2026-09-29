=== SheetBridge for WooCommerce ===
Contributors: sheetbridge
Requires at least: 6.5
Requires PHP: 8.1
Stable tag: 1.0.1
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

== Privacy and external services ==
The optional Google connector uses Google Sheets and Google Apps Script under your own Google account. It sends your configured product proposals to your store and reads scoped catalog data into your spreadsheet. Google authorization and Google's terms apply. Keep the script project private. No plugin telemetry or developer-operated relay service is used.

The WordPress database stores product snapshots and review history, plus a hash of the connection key. Uninstall revokes the key but retains history and settings; products are not deleted. Google triggers must be stopped separately.

== Limitations ==
Single store, human approval required, no deletion or remote image fetching. Whole-unit stock on independently managed simple products/variations. Complex third-party product types, ACF structures, multi-store inventory and vendor isolation are outside this release. Validate hosting, cache, Google authorization and extension compatibility on staging.

== Changelog ==
= 1.0.1 =
Credit muhammed nasser in plugin metadata, all admin page footers, and the bilingual user guide.

= 1.0.0 =
Initial implementation with bilingual admin, private Google connector, review workflow, conflict checks, idempotency, stock adjustment safeguards and reversal previews.
