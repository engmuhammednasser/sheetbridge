# SheetBridge 1.2 delivery

- Preserve the approval, scope, revision, idempotency and relative-stock safeguards.
- Implement immediate ready submission with scheduled retry; prioritize active rows and batch technical writes.
- Simplify existing Sheets safely: hide disabled/technical columns, add protected current-product context and a product picker without moving existing columns.
- Add verified connector progress (separate contact, submission and completed catalog), setup link parsing, review identity/search and configurable price warning, sanitized diagnostics.
- Reduce unnecessary catalog writes while keeping a complete reconciliation. A durable incremental change feed and bulk approval are deferred until separately designed and tested.
- Validate locally, publish 1.2.0, update Ashhalan and its private connector, test a dedicated draft end to end, restore inbound setting.

Production backup: `private_html/sheetbridge-before-1.2.0-20260929-132330`.
Original inbound_paused=false; temporarily true during deployment. No real product changes permitted as test fixtures.
