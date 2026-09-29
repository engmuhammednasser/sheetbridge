# Publishing SheetBridge updates

SheetBridge uses WordPress's `Update URI` hostname hook and `plugins_api` filter. The public manifest at `updates/stable.json` points to an exact versioned GitHub Release ZIP and its SHA-256. Repository source ZIPs and arbitrary package hosts are rejected. Uploading a commit alone does not publish an update.

## Prepare and publish

1. Set the plugin header, `SHEETBRIDGE_VERSION`, stable tag, guide and README download links to the new version. Rename both admin assets to `admin-<version>.js` / `admin-<version>.css`; the loader and packaging checks require these paths so stores that strip query strings still get the new UI. Keep `SHEETBRIDGE_CONNECTOR_PROTOCOL` unchanged unless the connector contract actually changes. The connector's own version only needs to change when its code changes.
2. Create `releases/<version>.json` with `tested`, UTC `published_at`, `changelog_en` and `changelog_ar`. Record only compatibility actually checked.
3. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate.ps1`, then `scripts/package.ps1`. Inspect the ZIP and confirm its root is `sheetbridge/`. Packaging produces the ZIP, checksum and an ignored `dist/sheetbridge-update.json` candidate manifest.
4. Commit and push source, release notes and the ZIP. Do not publish the candidate manifest yet.
5. Publish a stable GitHub Release named `v<version>` against that commit, with `dist/sheetbridge-<version>.zip` and `dist/SHA256SUMS.txt` as assets. Use a notes file for a multiline release description. Do not substitute GitHub's automatically generated source archive.
6. Fetch the published asset and verify its SHA-256. Then copy `dist/sheetbridge-update.json` to `updates/stable.json`, commit it and push. Publishing the manifest before the asset would advertise a broken download.
7. In WordPress, use **Plugins → SheetBridge → Check for updates**, open **View details**, then use **Update now**. Verify the active version, author, dashboard, saved settings and connector compatibility.

The release manifest is cached for two hours, and failed checks back off for five minutes. Manual Check for updates forces a fresh request. Last known good details can be retained for seven days during an outage; a failed manual check still reports the failure. WordPress scheduling controls background update checks. Administrators opt into automatic updates in WordPress; the plugin never changes that choice.

## First installation of the updater

Version 1.0.1 and earlier cannot discover GitHub releases. Install the first updater-enabled version manually. For a supervised deployment, an administrator may first add the updater class, its assets, registration and `Update URI` to the existing plugin without changing its version, then perform the real version upgrade through WordPress. Remove that temporary bootstrap by completing the full release upgrade and verify every deployed file against the released ZIP.

Older Google scripts compare exact plugin version strings. Replace their code once with connector 1.1.0, retaining the existing Script Properties and triggers. New connector code accepts protocol 1 (including legacy plugin 1.0.0/1.0.1); future compatible plugin updates do not need a script change. A protocol change still requires a coordinated connector upgrade.

## Recovery

Keep plugin files and relevant database state in a private server backup before updating. A download or checksum failure returns an error to WordPress before replacement. If the installed version itself has a problem, restore the previous verified plugin package and any required schema-compatible state from that backup. Do not delete/uninstall the plugin to update it: uninstall revokes its connection key. Do not modify an already published ZIP; publish a new version instead.

## WordPress references

- [External plugin update hook](https://developer.wordpress.org/reference/hooks/update_plugins_hostname/)
- [Plugin information hook](https://developer.wordpress.org/reference/hooks/plugins_api/)
- [WordPress updater](https://developer.wordpress.org/reference/functions/wp_update_plugins/)
