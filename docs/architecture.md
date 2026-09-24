# Architecture and security decisions

## Responsibilities

`Validation` checks the wire schema without WordPress dependencies. `Settings` owns permitted fields, product scope, pauses and hashed expiring credentials. `Products` translates validated changes into WooCommerce CRUD and stock calls. `Storage` stores immutable preview payloads and before/after snapshots. `Sync` coordinates approval, conflict checks, transactions, idempotency and reversals. `Rest` separates restricted connector routes from nonce-protected administrative routes. `Admin` loads the bilingual native admin application. The standalone Apps Script owns Google authorization, scheduling and spreadsheet layout.

## Product identity and conflict policy

Local WooCommerce product IDs identify updates. SKU is editable text, not an implicit fallback identity. Each export includes a SHA-256 revision over the editable product snapshot. Preview compares it with the current product. Apply acquires a site-specific database advisory lock, locks relevant post and metadata rows, clears caches, reloads the product and checks the snapshot again.

Quantity and derived stock status are excluded from the revision so legitimate sales do not invalidate an additive inventory operation. An explicit unmanaged stock-status edit gets its own comparison. Changes to stock ownership, management mode, price, SKU, content or attributes invalidate the preview. Current permissions and product scope are rechecked at approval. Existing stock cannot be set to an absolute spreadsheet value. Whole-unit deltas call `wc_update_product_stock` and preserve atomic quantity adjustments used by normal WooCommerce stock operations. A negative adjustment cannot reduce the current quantity below zero.

Reversals are new proposals, not immediate undo. They compare the post-update revision and use the inverse stock delta; a later sale remains counted. Reversal keys are deterministic so a repeated reversal request cannot silently produce another inverse operation. Unrelated later product edits conservatively require manual review.

## Idempotency and transactions

Each proposal has a durable unique request key and body hash. A retry with identical data returns the same request. Reusing a key for changed data is rejected. Product changes and the applied audit state share a transaction. Repeated approval of an applied request returns its original result. A failed transaction rolls back and exposes a failed/conflict state. A lost COMMIT acknowledgement is checked against the durable audit record before any failure state is written.

All relevant core tables must use InnoDB. The global plugin write lock serializes its approvals and creation checks; core table locks coordinate database access. This design does not claim a distributed reservation system or linearizability across arbitrary extensions. Native writes outside the connector can occur after a successful application. Database connection loss, a custom product data store, Redis/object caches, hooks with external side effects, and plugins doing their own commits require targeted staging validation. Database rollback cannot unsend external webhooks/emails or reverse remote services. No blanket ACID promise is made for arbitrary WordPress extensions.

## Connection and permissions

The credential is 256 random bits, represented as 64 hex characters, hashed with SHA-256 at rest, compared in constant time and expires in 90 days. Rotation invalidates the previous credential. No credential appears in generated source, audit records or diagnostic logs. The WordPress UI reveals a newly generated credential once to a site administrator. The private script stores it in Script properties. HTTPS is required. A local-only HTTP exception exists only behind an explicit constant, local environment and loopback address; it is not enabled by the plugin.

The credential is bound to the configured site URL. A clone or domain change requires a new key. Product writes reject custom storage adapter classes whose transaction behavior is not covered by this implementation.

The connector can read the configured product scope, read catalog references, submit previews and query request status. It cannot approve, reject, reverse or change settings. Administrative endpoints require both a logged-in capability and a valid REST nonce. `manage_options` is required for settings and credentials; `manage_woocommerce` is required for product review. Field allowlists apply to writes; product scope applies to product exports and changes. References are store-wide category/tag/image labels and IDs, not a vendor isolation mechanism. There is one connector per installation.

Inputs are bounded and typed; unknown fields, states, product types and action properties fail closed. Stock values must be whole numbers, prices have strict decimal syntax, and optional clearing is explicit. SKU uniqueness, existing terms, existing images, linked IDs and variation definitions are checked. Sanitization uses WordPress functions. Metadata keys must be explicitly configured with the dedicated `sb_` prefix; internal WooCommerce and ACF implementation fields are not writable. External image URLs are never fetched, eliminating that URL-fetching SSRF surface. SQL values use prepared statements. Rendered product content is escaped, and Sheets exports escape formula-leading strings.

## Google connector behavior

Use a private standalone script project, not a script bound to a shared spreadsheet. Google sheet editors receive the workbook, not the connection secret. Changes, including those produced by formulas or APIs, are examined by the scheduled trigger. Product-ID edits manually made in the Changes tab capture a catalog revision through a private installable edit trigger. API writers must supply a revision already captured when their proposed data was prepared.

The submitted payload and request key are saved before the network call. Recovery checks server status and resubmits only the same saved proposal when the request was never received. Editing a submitted row does not replace its server preview. Successful rows cannot rerun from polling. A new operation belongs on a new row. Formula error values are rejected before submission. No Apps Script trigger applies a WooCommerce product directly.

Catalog refresh uses a hidden staging sheet and a cursor. It preserves unsent changes because proposals live in another tab. Duplicate staged IDs are suppressed after partial runs. Catalog rows are a paged snapshot, not a single cross-product transaction. A script lock prevents two scheduled cycles from interleaving. Work is bounded to 100 Changes rows and four 50-record catalog pages per cycle, with a rotating Changes cursor and a 230-second work budget. Network retries are bounded; redirects do not forward credentials. The server allows 120 authenticated connector calls per minute. Reference setup is bounded to 500 records per category/tag/image type; additional IDs can be obtained in WooCommerce.

Google's authorization, network and quota enforcement cannot be replicated by local mocks. A live staging trial remains mandatory before adoption. The five-minute schedule does not constitute an SLA.

## Retention and removal

Audit records include product data, request states, reviewer user IDs and timestamps. They are accessible only through admin permission checks; public connector status responses contain no full snapshots. There is no telemetry or customer/order export. History and idempotency keys are retained without automatic pruning, so database size must be monitored. Uninstall revokes the key and retains history/settings. Products remain unchanged. Stop the independent Google trigger when retiring an installation. A future retention feature must preserve successful request-key tombstones before removing payloads.

## Source references used during implementation

- [WordPress REST route permissions](https://developer.wordpress.org/rest-api/extending-the-rest-api/routes-and-endpoints/)
- [WooCommerce CRUD objects](https://developer.woocommerce.com/docs/best-practices/data-management/crud-objects/)
- [WooCommerce stock functions](https://woocommerce.github.io/code-reference/files/woocommerce-includes-wc-stock-functions.html)
- [Google installable triggers](https://developers.google.com/apps-script/guides/triggers/installable)
- [Google Properties Service](https://developers.google.com/apps-script/reference/properties/properties-service)

The supplied FlexStock report guided requirements, but its external claims were not treated as verified test results for this independent implementation.
