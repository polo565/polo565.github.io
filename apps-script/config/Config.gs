/**
 * HAMDI ITALIE — central configuration.
 *
 * Deployment-specific IDs live in Script Properties (set by setup()), never here
 * and never in the frontend. This file only holds constants and accessors.
 */

var APP = Object.freeze({
  NAME: 'HAMDI ITALIE',
  VERSION: '0.2.0',
  LANGS: ['ar', 'fr', 'en', 'it'],
  DEFAULT_LANG: 'ar',
  RTL_LANGS: ['ar'],
});

/** Script Properties keys. Values are configured per deployment. */
var PROP = Object.freeze({
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  DRIVE_ROOT_FOLDER_ID: 'DRIVE_ROOT_FOLDER_ID',
  PRIVATE_UPLOADS_FOLDER_ID: 'PRIVATE_UPLOADS_FOLDER_ID',
  PASSWORD_PEPPER: 'PASSWORD_PEPPER',
  VISITOR_WEB_URL: 'VISITOR_WEB_URL',
  ADMIN_WEB_URL: 'ADMIN_WEB_URL',
  // Set by the owner in the Apps Script editor (Project Settings → Script properties),
  // never committed to the repository.
  SUPER_ADMIN_EMAIL: 'SUPER_ADMIN_EMAIL',
  // Optional SMS/WhatsApp OTP provider; phone OTP is disabled while these are empty.
  OTP_SMS_PROVIDER: 'OTP_SMS_PROVIDER',
  OTP_SMS_API_KEY: 'OTP_SMS_API_KEY',
});

/** Security parameters (see docs/SECURITY.md). */
var SECURITY = Object.freeze({
  HASH_ITERATIONS: 10000,
  PASSWORD_MIN_LENGTH: 12,
  MAX_FAILED_LOGINS: 5,
  LOCKOUT_MINUTES: 15,
  SESSION_IDLE_MINUTES: 30,
  SESSION_ABSOLUTE_HOURS: 8,
  VISITOR_SESSION_IDLE_DAYS: 30,
  OTP_LENGTH: 6,
  OTP_TTL_MINUTES: 10,
  OTP_MAX_ATTEMPTS: 5,
  OTP_MAX_SENDS_PER_HOUR: 3,
  UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
  UPLOAD_MAX_FILES: 3,
  UPLOAD_MIME_WHITELIST: ['application/pdf', 'image/jpeg', 'image/png'],
});

var CACHE_TTL = Object.freeze({
  PUBLIC_CONTENT: 600,
  ROLE: 60,
});

/** Permission levels, ordered. */
var PERM_LEVELS = ['none', 'read', 'write', 'delete'];

/** Sections that roles can be granted access to (matches admin sidebar). */
var PERM_SECTIONS = [
  'dashboard', 'categories', 'services', 'appointments', 'payments', 'contacts', 'documents',
  'drive', 'visitors', 'faqs', 'homepage', 'media', 'languages', 'notifications',
  'cities', 'guidance', 'admins', 'roles', 'settings', 'reports', 'audit',
];

/** Recommended Drive structure (spec §9). */
var DRIVE_FOLDERS = [
  '01_IMMIGRATION', '02_PREFETTURA', '03_CAF_PATRONATO', '04_COMUNE',
  '05_CITIZENSHIP', '06_HEALTHCARE', '07_EMPLOYMENT', '08_FAMILY',
  '09_TAXATION', '10_VEHICLES', '11_HOUSING', '12_LEGAL',
  '13_NEW_IMMIGRANTS', '14_GENERAL_MEDIA', '15_LOGOS_AND_BRANDING',
];
var PRIVATE_UPLOADS_FOLDER_NAME = '99_PRIVATE_UPLOADS';

/*
 * The Google Sheet and Drive folder IDs are NOT in the code (this repository is public).
 * The owner sets them once in the Apps Script editor: Project Settings → Script properties
 * → SPREADSHEET_ID, DRIVE_ROOT_FOLDER_ID (see README.md, "Backend").
 */

/** Reads a Script Property; throws if a required one is missing. */
function getProp_(key, required) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (required && !value) {
    throw new Error('Missing configuration: Script Property "' + key + '". Run setup() first.');
  }
  return value;
}

function setProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}
