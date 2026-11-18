/**
 * HAMDI ITALIE — notifications and contact requests.
 * Email goes through MailApp (consumer quota: 100 recipients/day). Every
 * notification is recorded in the Notifications sheet, sent or not.
 */

var MAIL_TEXT_ = {
  request_received: {
    en: ['Request received {ref}', 'We received your request {ref} ({service}). This is NOT an official appointment with a public office. Use your reference and personal code to follow it.'],
    fr: ['Demande reçue {ref}', 'Nous avons reçu votre demande {ref} ({service}). Ce n’est PAS un rendez-vous officiel avec une administration. Utilisez votre référence et votre code personnel pour la suivre.'],
    ar: ['تم استلام الطلب {ref}', 'استلمنا طلبك {ref} ({service}). هذا ليس موعداً رسمياً مع مكتب حكومي. استخدم الرقم المرجعي والرمز الشخصي لمتابعته.']
  },
  status_changed: {
    en: ['Request update {ref}', 'The status of your request {ref} is now: {status}.'],
    fr: ['Mise à jour de la demande {ref}', 'Le statut de votre demande {ref} est maintenant : {status}.'],
    ar: ['تحديث الطلب {ref}', 'حالة طلبك {ref} الآن: {status}.']
  },
  payment_status: {
    en: ['Payment {ref}', 'Payment {ref} status: {status}. Amount received: {amount}.'],
    fr: ['Paiement {ref}', 'Statut du paiement {ref} : {status}. Montant reçu : {amount}.'],
    ar: ['الدفعة {ref}', 'حالة الدفعة {ref}: {status}. المبلغ المستلم: {amount}.']
  },
  admin_new_request: {
    en: ['New request {ref}', 'New request {ref} for {service}.'],
    fr: ['Nouvelle demande {ref}', 'Nouvelle demande {ref} pour le service {service}.'],
    ar: ['طلب جديد {ref}', 'طلب جديد {ref} لخدمة {service}.']
  },
  admin_new_contact: {
    en: ['New contact message', 'New message from {name}. Open the admin panel to read it.'],
    fr: ['Nouveau message de contact', 'Nouveau message de {name}. Ouvrez le panneau d’administration pour le lire.'],
    ar: ['رسالة تواصل جديدة', 'رسالة جديدة من {name}. افتح لوحة الإدارة لقراءتها.']
  }
};

var MAIL_FOOTER_ = {
  en: '— HAMDI ITALIE (independent service, not a government website)',
  fr: '— HAMDI ITALIE (service indépendant, pas un site gouvernemental)',
  ar: '— HAMDI ITALIE (خدمة مستقلة، ليست موقعاً حكومياً)'
};

/** Language for messages to administrators (Settings: admin_lang, default French). */
function notify_adminLang_() { var l = settings_get_('admin_lang', 'fr'); return MAIL_FOOTER_[l] ? l : 'fr'; }

function notify_render_(template, lang, vars) {
  var t = MAIL_TEXT_[template];
  if (!t[lang]) lang = APP.DEFAULT_LANG;
  var pair = t[lang] || t.en;
  var fill = function (s) { return s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] == null ? '' : String(vars[k]); }); };
  var footer = '\n\n' + (MAIL_FOOTER_[lang] || MAIL_FOOTER_.en);
  return { subject: fill(pair[0]), body: fill(pair[1]) + footer };
}

/** Sends (if possible) and records. Never throws: notifications must not break the action. */
function notify_(recipient, template, lang, vars) {
  if (!recipient) return null;
  var msg = notify_render_(template, lang || APP.DEFAULT_LANG, vars || {});
  var status = 'queued', error = '', sentAt = '';
  try {
    if (MailApp.getRemainingDailyQuota() > 0) {
      MailApp.sendEmail({ to: recipient, subject: msg.subject, body: msg.body, name: APP.NAME });
      status = 'sent'; sentAt = nowIso_();
    } else {
      status = 'failed'; error = 'Daily email quota exhausted';
    }
  } catch (e) { status = 'failed'; error = String(e).slice(0, 300); }
  try {
    db_insert_('Notifications', {
      channel: 'email', recipient: recipient, template: template, payload_json: JSON.stringify(vars || {}),
      status: status, error: error, sent_at: sentAt
    });
  } catch (e2) { console.error('notification log failed', e2); }
  return status;
}

function notify_requestReceived_(appt, service) {
  var vars = { ref: appt.reference, service: pickLang_(service, 'title', appt.preferred_lang) };
  if (appt.email) notify_(appt.email, 'request_received', appt.preferred_lang, vars);
  var adminTo = settings_get_('notify_email', '');
  if (adminTo) notify_(adminTo, 'admin_new_request', notify_adminLang_(), { ref: appt.reference, service: pickLang_(service, 'title', notify_adminLang_()) });
}

function notify_statusChanged_(appt) {
  if (appt.email) notify_(appt.email, 'status_changed', appt.preferred_lang, { ref: appt.reference, status: appt.status });
}

function notify_paymentStatus_(payment) {
  var appt = payment.appointment_id ? db_get_('Appointments', payment.appointment_id) : null;
  if (appt && appt.email) {
    notify_(appt.email, 'payment_status', appt.preferred_lang,
      { ref: payment.payment_ref, status: payment.status, amount: payment.amount_received + ' ' + payment.currency });
  }
}

/* ---- Contact requests ----------------------------------------------------------- */
function contact_submit_(input) {
  var d = validate_(input, {
    name: { type: 'string', required: true, max: 100 },
    phone: { type: 'phone' },
    email: { type: 'email' },
    subject: { type: 'string', max: 150 },
    message: { type: 'text', required: true, max: 2000 },
    consent: { type: 'bool' }
  });
  if (!d.consent) vfail_('consent', 'required');
  if (!d.phone && !d.email) vfail_('phone', 'phone or email required');
  rateLimit_('contact:' + (d.phone || d.email), 5, 3600);
  rateLimit_('contact:global', 200, 3600);
  var rec = db_insert_('ContactRequests', {
    name: d.name, email: d.email, phone: d.phone, subject: d.subject, message: d.message,
    status: 'new', consent_at: nowIso_()
  });
  var adminTo = settings_get_('notify_email', '');
  if (adminTo) notify_(adminTo, 'admin_new_contact', notify_adminLang_(), { name: d.name });
  return { ok: true, id: rec.id };
}
