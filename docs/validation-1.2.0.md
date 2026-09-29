# SheetBridge 1.2.0 validation

Local WordPress 7.0.3 / WooCommerce 11.0.1, isolated `sheetbridge_test` database:

- PHP and JavaScript syntax checks passed.
- 37 domain checks, 44 connector checks, 32 updater checks passed.
- 60 integration checks, 65 security checks, 14 usability/report/search checks passed.
- Concurrent stock test: 40 sales and two approvals produced 80 units from 100 - 40 + 20, with the approved delta applied once.
- A newly ready row after 1,500 completed rows submits in the same mocked cycle; at most 100 active rows are processed per cycle. This is an orchestration check, not a production speed benchmark.
- Migration retains existing request IDs and immutable payloads; repeating migration changes nothing; unowned tabs are refused.
- Unchanged catalog rows produce no output writes; full catalog reconciliation and staging still run.
- Reports distinguish submissions from completed exports and exclude credentials, product identity, site URL and arbitrary remote error text.

Browser checks and Ashhalan deployment results are recorded after live acceptance.
