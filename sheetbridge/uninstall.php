<?php
/** Uninstall revokes access, but retains reviews and settings for deliberate recovery. */
defined('WP_UNINSTALL_PLUGIN') || exit;
delete_option('sheetbridge_connection');
delete_option('sheetbridge_last_contact');
delete_option('sheetbridge_connector_status');
