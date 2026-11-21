/**
 * HAMDI ITALIE — database schema (source of truth for sheet headers).
 * Mirrored in docs/DATABASE_SCHEMA.md. setup() creates missing sheets/columns
 * from this definition; it never deletes or reorders existing columns.
 */

/** Expands ['title'] into ['title_ar','title_fr','title_en'] (one column per APP.LANGS). */
function L_(field) {
  return APP.LANGS.map(function (lang) { return field + '_' + lang; });
}

function cols_() {
  var out = [];
  for (var i = 0; i < arguments.length; i++) {
    out = out.concat(arguments[i]);
  }
  return out;
}

var TS = ['created_at', 'updated_at'];

var SCHEMA = Object.freeze({
  Admins: { prefix: 'ADM', columns: cols_(
    ['id', 'email', 'name', 'role_id', 'password_hash', 'salt', 'iterations', 'active',
     'must_change_password', 'failed_attempts', 'locked_until', 'last_login_at'], TS) },

  Roles: { prefix: 'ROL', columns: cols_(['id', 'name', 'permissions_json', 'system'], TS) },

  // Optional accounts (spec §21). Phone is the primary identifier; email is optional.
  Visitors: { prefix: 'VIS', columns: cols_(
    ['id', 'phone', 'email', 'name', 'preferred_lang', 'password_hash', 'salt', 'iterations',
     'phone_verified', 'email_verified', 'active', 'must_change_password', 'failed_attempts',
     'locked_until', 'consent_at', 'last_login_at', 'deletion_requested_at'], TS) },

  Categories: { prefix: 'CAT', columns: cols_(
    ['id', 'code', 'slug', 'icon', 'image_document_id'], L_('title'), L_('description'),
    ['order', 'published'], TS) },

  Services: { prefix: 'SRV', columns: cols_(
    ['id', 'category_id', 'slug'], L_('title'), L_('summary'), L_('official_fee_text'),
    // Pricing (spec §22.6): the three kinds of charge are always stored and shown separately.
    ['service_price', 'assistance_fee', 'official_fee_amount', 'official_fee_verified',
     'provider_fee', 'additional_charges_json', 'discount_json', 'payment_method_ids_json',
     'currency', 'official_links_json'], L_('institutions'),
    ['city_ids_json', 'requestable', 'popular', 'order', 'published', 'verified_by',
     'verified_at', 'view_count'], TS) },

  ServiceTranslations: { prefix: 'STR', columns: [
    'id', 'service_id', 'lang', 'description', 'eligibility', 'procedure',
    'required_documents', 'notes', 'updated_at'] },

  Documents: { prefix: 'DOC', columns: cols_(
    ['id', 'drive_file_id', 'file_name', 'mime', 'size'], L_('title'), L_('description'),
    ['category_id', 'service_id', 'lang', 'visibility', 'published', 'uploaded_by'], TS) },

  Appointments: { prefix: 'APT', columns: cols_(
    ['id', 'reference', 'service_id', 'city_id', 'visitor_id', 'request_type',
     'official_confirmation_ref', 'name', 'email', 'phone', 'preferred_lang', 'message', 'status',
     'internal_notes_json', 'attachments_json', 'tracking_code_hash', 'payment_method_id',
     'amount_due', 'payment_status', 'consent_at', 'retention_until'], TS) },

  // Cash-first payments (spec §22). Status history is kept in AuditLogs.
  PaymentMethods: { prefix: 'PM', columns: cols_(
    ['id', 'code', 'type'], L_('name'), L_('instructions'), L_('location'), L_('provider_fee_text'),
    ['requires_bank_account', 'requires_card', 'deadline_days', 'active', 'order'], TS) },

  Payments: { prefix: 'PAY', columns: cols_(
    ['id', 'payment_ref', 'appointment_id', 'visitor_id', 'method_id', 'amount_due',
     'amount_received', 'currency', 'status', 'deadline_at', 'payment_date', 'recorded_by',
     'confirmed_by', 'confirmed_at', 'receipt_ref', 'evidence_file_ids_json', 'provider_txn_id',
     'refund_amount', 'refund_date', 'refund_reason', 'refunded_by', 'notes'], TS) },

  ContactRequests: { prefix: 'CON', columns: cols_(
    ['id', 'name', 'email', 'phone', 'subject', 'message', 'status', 'consent_at'], TS) },

  FAQs: { prefix: 'FAQ', columns: cols_(
    ['id', 'scope', 'ref_id'], L_('question'), L_('answer'), ['order', 'published'], TS) },

  Homepage: { prefix: 'HOM', columns: cols_(
    ['id', 'block', 'key'], L_('value'), ['order', 'published', 'updated_at']) },

  Notifications: { prefix: 'NOT', columns: [
    'id', 'channel', 'recipient', 'template', 'payload_json', 'status', 'error', 'sent_at', 'created_at'] },

  Cities: { prefix: 'CIT', columns: cols_(['id', 'name', 'province', 'region', 'active'], TS) },

  Settings: { prefix: null, columns: ['key', 'value', 'type', 'public', 'description', 'updated_at'] },

  AuditLogs: { prefix: 'LOG', columns: [
    'id', 'at', 'admin_id', 'admin_email', 'action', 'entity', 'entity_id',
    'before_json', 'after_json', 'note'] },

  GuidanceQuestions: { prefix: 'GQ', columns: cols_(
    ['id', 'key', 'order'], L_('question'), L_('help'), ['type', 'options_json', 'published']) },

  GuidanceRules: { prefix: 'GR', columns: cols_(
    ['id', 'order', 'condition_json', 'task_key'], L_('title'), L_('explanation'),
    L_('institution'), L_('documents'),
    ['official_link', 'service_id', 'depends_on_status', 'published']) },

  // Server-side sessions; `id` is the SHA-256 of the token (the token itself is never stored).
  Sessions: { prefix: null, columns: [
    'id', 'kind', 'subject_id', 'created_at', 'last_seen_at', 'idle_minutes', 'expires_at', 'revoked'] },

  UserProgress: { prefix: 'UP', columns: [
    'id', 'anon_token_hash', 'answers_json', 'completed_tasks_json', 'updated_at'] },
});

var APPOINTMENT_STATUSES = ['pending', 'under_review', 'info_required', 'approved',
  'rejected', 'completed', 'cancelled'];
var REQUEST_TYPES = ['assistance', 'provider_booking', 'official_confirmed'];

/** Spec §22.3. PAID / REFUNDED can only be set by an admin with payments:write. */
var PAYMENT_STATUSES = ['UNPAID', 'PAYMENT_PENDING', 'AWAITING_CASH_PAYMENT', 'PAID',
  'PARTIALLY_PAID', 'PAYMENT_FAILED', 'REFUND_REQUESTED', 'REFUNDED', 'CANCELLED'];

/** Spec §22.1. Cash types never require a bank account or card. */
var PAYMENT_METHOD_TYPES = ['cash_office', 'cash_partner', 'cash_network', 'card', 'prepaid',
  'online_gateway', 'other'];
