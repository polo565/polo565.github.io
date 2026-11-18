/**
 * HAMDI ITALIE — initial service catalogue (spec §4), seeded by setup() into
 * an empty Services table. Titles only (4 languages), the responsible
 * institution and official portal links. NO fees, eligibility rules or
 * procedures are asserted: administrators add and verify those (spec §16.4).
 * Format per service: [it, en, fr, ar, popular?]
 */
var SEED_SERVICE_META = {
  '01': { inst: 'Questura · Poste Italiane (kit postale)', links: [['Portale Immigrazione', 'https://www.portaleimmigrazione.it'], ['Polizia di Stato', 'https://www.poliziadistato.it']] },
  '02': { inst: 'Prefettura · Sportello Unico per l’Immigrazione', links: [['Ministero dell’Interno', 'https://www.interno.gov.it']] },
  '03': { inst: 'CAF · Patronato · INPS', links: [['INPS', 'https://www.inps.it'], ['Agenzia delle Entrate', 'https://www.agenziaentrate.gov.it']] },
  '04': { inst: 'Comune · Ufficio Anagrafe', links: [['ANPR – Anagrafe nazionale', 'https://www.anagrafenazionale.interno.gov.it'], ['Carta d’identità elettronica', 'https://www.cartaidentita.interno.gov.it']] },
  '05': { inst: 'Ministero dell’Interno · Prefettura', links: [['Ministero dell’Interno', 'https://www.interno.gov.it']] },
  '06': { inst: 'ASL · Servizio Sanitario Nazionale', links: [['Ministero della Salute', 'https://www.salute.gov.it']] },
  '07': { inst: 'Centro per l’Impiego · INPS · Ispettorato del Lavoro', links: [['Ministero del Lavoro', 'https://www.lavoro.gov.it'], ['INPS', 'https://www.inps.it']] },
  '08': { inst: 'Comune · Scuola · INPS', links: [['Ministero dell’Istruzione e del Merito', 'https://www.mim.gov.it'], ['INPS', 'https://www.inps.it']] },
  '09': { inst: 'Agenzia delle Entrate', links: [['Agenzia delle Entrate', 'https://www.agenziaentrate.gov.it'], ['SPID', 'https://www.spid.gov.it']] },
  '10': { inst: 'Motorizzazione Civile', links: [['Portale dell’Automobilista', 'https://www.ilportaledellautomobilista.it']] },
  '11': { inst: 'Agenzia delle Entrate · Comune', links: [['Agenzia delle Entrate', 'https://www.agenziaentrate.gov.it'], ['ARERA (energia e acqua)', 'https://www.arera.it']] },
  '12': { inst: 'Avvocati abilitati · Tribunale · Ordine degli Avvocati', links: [['Ministero della Giustizia', 'https://www.giustizia.it']] },
  '13': { inst: 'HAMDI ITALIE', links: [['Portale Integrazione Migranti', 'https://integrazionemigranti.gov.it']] }
};

var SEED_SERVICES = {
  '01': [
    ['Rinnovo del permesso di soggiorno', 'Residence permit renewal', 'Renouvellement du titre de séjour', 'تجديد تصريح الإقامة', true],
    ['Rinnovo del permesso per lavoro', 'Residence permit renewal for work', 'Renouvellement du titre de séjour pour travail', 'تجديد تصريح الإقامة للعمل'],
    ['Rinnovo del permesso per motivi familiari', 'Residence permit renewal for family reasons', 'Renouvellement du titre de séjour pour motifs familiaux', 'تجديد تصريح الإقامة لأسباب عائلية'],
    ['Rinnovo del permesso per studio', 'Residence permit renewal for study', 'Renouvellement du titre de séjour pour études', 'تجديد تصريح الإقامة للدراسة'],
    ['Conversione da studio a lavoro', 'Conversion from study to work permit', 'Conversion du titre étudiant en titre de travail', 'تحويل تصريح الدراسة إلى تصريح عمل'],
    ['Conversione tra tipologie di permesso', 'Conversion between permit types', 'Conversion entre catégories de titres de séjour', 'التحويل بين أنواع تصاريح الإقامة'],
    ['Primo rilascio del permesso di soggiorno', 'First residence permit application', 'Première demande de titre de séjour', 'الطلب الأول لتصريح الإقامة'],
    ['Protezione speciale: informazioni e assistenza', 'Special protection: information and assistance', 'Protection spéciale : informations et assistance', 'الحماية الخاصة: معلومات ومساعدة'],
    ['Verifica dello stato della pratica', 'Tracking your application status', 'Suivi de l’état de votre dossier', 'متابعة حالة الملف'],
    ['Checklist documenti per tipo di permesso', 'Document checklists by permit type', 'Listes de documents par type de titre', 'قوائم الوثائق حسب نوع التصريح'],
    ['Compilazione del kit postale', 'Filling in the postal kit', 'Remplir le kit postal', 'تعبئة الطقم البريدي'],
    ['Appuntamento per le impronte digitali', 'Fingerprinting appointment information', 'Rendez-vous pour les empreintes digitales', 'معلومات موعد أخذ البصمات'],
    ['Ritiro del permesso di soggiorno', 'Collecting the residence permit', 'Retrait du titre de séjour', 'استلام تصريح الإقامة'],
    ['Carta di soggiorno', 'Residence card (carta di soggiorno)', 'Carte de séjour', 'بطاقة الإقامة'],
    ['Permesso UE per soggiornanti di lungo periodo', 'EU long-term residence permit', 'Permis UE de résident de longue durée', 'تصريح الإقامة الأوروبي طويل الأمد']
  ],
  '02': [
    ['Appuntamenti in Prefettura', 'Prefettura appointment information', 'Rendez-vous à la Prefettura', 'مواعيد البريفتورا'],
    ['Decreto Flussi', 'Decreto Flussi (entry quotas)', 'Decreto Flussi (quotas d’entrée)', 'مرسوم التدفقات'],
    ['Nulla osta al lavoro', 'Work authorisation (nulla osta)', 'Autorisation de travail (nulla osta)', 'تصريح العمل (نولا أوستا)'],
    ['Ingresso in Italia per lavoratori stranieri', 'Entry procedures for foreign workers', 'Entrée en Italie des travailleurs étrangers', 'إجراءات دخول العمال الأجانب إلى إيطاليا'],
    ['Contratto di soggiorno per lavoro', 'Employment contract procedures', 'Procédures du contrat de travail', 'إجراءات عقد العمل'],
    ['Conversione del permesso per lavoro', 'Work permit conversion procedures', 'Conversion du titre de séjour pour travail', 'إجراءات تحويل التصريح إلى تصريح عمل'],
    ['Ricongiungimento familiare', 'Family reunification', 'Regroupement familial', 'لمّ الشمل العائلي'],
    ['Documenti per il datore di lavoro', 'Documents for employers', 'Documents pour l’employeur', 'وثائق صاحب العمل'],
    ['Documenti per il lavoratore', 'Documents for employees', 'Documents pour le salarié', 'وثائق العامل'],
    ['Stato della pratica in Prefettura', 'Prefettura application status', 'État du dossier à la Prefettura', 'حالة الملف في البريفتورا']
  ],
  '03': [
    ['ISEE', 'ISEE application assistance', 'Assistance pour l’ISEE', 'المساعدة في طلب ISEE', true],
    ['Assegno Unico', 'Assegno Unico (child benefit)', 'Assegno Unico (allocation pour enfants)', 'الإعانة الموحدة للأطفال', true],
    ['NASpI', 'NASpI unemployment benefit', 'NASpI (allocation chômage)', 'إعانة البطالة NASpI', true],
    ['Assegno di Inclusione', 'Assegno di Inclusione', 'Assegno di Inclusione', 'إعانة الإدماج'],
    ['Dichiarazione 730', '730 tax return', 'Déclaration de revenus 730', 'الإقرار الضريبي 730'],
    ['Certificazione Unica (CU)', 'Certificazione Unica (CU)', 'Certificazione Unica (CU)', 'الشهادة الموحدة CU'],
    ['Domanda di pensione', 'Pension application', 'Demande de retraite', 'طلب المعاش التقاعدي'],
    ['Prestazioni per la famiglia', 'Family benefits', 'Prestations familiales', 'المساعدات العائلية'],
    ['Domande di assistenza sociale', 'Social assistance applications', 'Demandes d’aide sociale', 'طلبات المساعدة الاجتماعية'],
    ['Preparazione di documenti amministrativi', 'Administrative document preparation', 'Préparation de documents administratifs', 'إعداد الوثائق الإدارية'],
    ['Appuntamento CAF o Patronato', 'CAF or Patronato appointment request', 'Demande de rendez-vous CAF ou Patronato', 'طلب موعد في CAF أو الباتروناتو'],
    ['Comprendere i documenti ufficiali', 'Understanding official documents', 'Comprendre les documents officiels', 'فهم الوثائق الرسمية']
  ],
  '04': [
    ['Iscrizione anagrafica', 'Civil registration (iscrizione anagrafica)', 'Inscription à l’état civil', 'التسجيل في السجل المدني'],
    ['Cambio di residenza', 'Change of residence', 'Changement de résidence', 'تغيير الإقامة'],
    ['Certificato di residenza', 'Residence certificate', 'Certificat de résidence', 'شهادة الإقامة'],
    ['Stato di famiglia', 'Family status certificate', 'Certificat de composition familiale', 'شهادة الحالة العائلية'],
    ['Certificato di nascita', 'Birth certificate', 'Acte de naissance', 'شهادة الميلاد'],
    ['Certificato di matrimonio', 'Marriage certificate', 'Acte de mariage', 'شهادة الزواج'],
    ['Certificato di stato civile', 'Civil status certificate', 'Certificat d’état civil', 'شهادة الحالة المدنية'],
    ['Carta d’identità', 'Identity card', 'Carte d’identité', 'بطاقة الهوية', true],
    ['Procedure di registrazione della residenza', 'Residence registration procedures', 'Procédures d’enregistrement de la résidence', 'إجراءات تسجيل الإقامة'],
    ['Pratiche comunali per la casa', 'Housing-related municipal procedures', 'Démarches municipales liées au logement', 'الإجراءات البلدية المتعلقة بالسكن'],
    ['Appuntamento in Comune', 'Municipal appointment request', 'Demande de rendez-vous à la mairie', 'طلب موعد في البلدية'],
    ['Informazioni sui documenti comunali', 'Municipal document information', 'Informations sur les documents municipaux', 'معلومات عن الوثائق البلدية']
  ],
  '05': [
    ['Requisiti per la cittadinanza', 'Citizenship eligibility information', 'Conditions d’accès à la citoyenneté', 'شروط الحصول على الجنسية'],
    ['Cittadinanza per residenza', 'Citizenship through residence', 'Citoyenneté par résidence', 'الجنسية عن طريق الإقامة'],
    ['Cittadinanza per matrimonio', 'Citizenship through marriage', 'Citoyenneté par mariage', 'الجنسية عن طريق الزواج'],
    ['Periodi di residenza richiesti', 'Required residence periods', 'Durées de résidence requises', 'مدد الإقامة المطلوبة'],
    ['Documenti per la domanda di cittadinanza', 'Required documents for citizenship', 'Documents requis pour la citoyenneté', 'الوثائق المطلوبة لطلب الجنسية'],
    ['Certificazione di lingua italiana B1', 'Italian language B1 certificate', 'Certification de langue italienne B1', 'شهادة اللغة الإيطالية B1'],
    ['Procedura di domanda di cittadinanza', 'Citizenship application procedure', 'Procédure de demande de citoyenneté', 'إجراءات تقديم طلب الجنسية'],
    ['Verifica della domanda di cittadinanza', 'Citizenship application tracking', 'Suivi de la demande de citoyenneté', 'متابعة طلب الجنسية'],
    ['Link ufficiali per la cittadinanza', 'Official citizenship links', 'Liens officiels pour la citoyenneté', 'الروابط الرسمية للجنسية'],
    ['Novità normative sulla cittadinanza', 'Citizenship requirements and legal changes', 'Évolutions légales sur la citoyenneté', 'المستجدات القانونية حول الجنسية']
  ],
  '06': [
    ['Tessera sanitaria', 'Health card (tessera sanitaria)', 'Carte sanitaire', 'البطاقة الصحية'],
    ['Iscrizione al Servizio Sanitario Nazionale', 'Registration with the National Health Service', 'Inscription au Service sanitaire national', 'التسجيل في الخدمة الصحية الوطنية'],
    ['Scelta del medico di base', 'Choosing a family doctor', 'Choisir un médecin traitant', 'اختيار طبيب الأسرة'],
    ['Cambio del medico di base', 'Changing your family doctor', 'Changer de médecin traitant', 'تغيير طبيب الأسرة'],
    ['Prenotazione di visite mediche', 'Medical appointment information', 'Prise de rendez-vous médicaux', 'معلومات المواعيد الطبية'],
    ['Prenotazione di esami di laboratorio', 'Laboratory test appointments', 'Rendez-vous pour analyses de laboratoire', 'مواعيد التحاليل المخبرية'],
    ['Trovare l’ASL più vicina', 'Finding the nearest ASL', 'Trouver l’ASL la plus proche', 'العثور على أقرب مكتب ASL'],
    ['Esenzione ticket', 'Prescription charge exemption (esenzione ticket)', 'Exonération du ticket modérateur', 'الإعفاء من رسوم التيكت'],
    ['Ricette mediche', 'Medical prescription information', 'Ordonnances médicales', 'معلومات الوصفات الطبية'],
    ['Procedure di iscrizione sanitaria', 'Healthcare registration procedures', 'Procédures d’inscription sanitaire', 'إجراءات التسجيل الصحي']
  ],
  '07': [
    ['Risorse per la ricerca di lavoro', 'Job-search resources', 'Ressources pour chercher un emploi', 'موارد البحث عن عمل'],
    ['Diritti dei lavoratori', 'Employment rights information', 'Droits des travailleurs', 'حقوق العمال'],
    ['Il contratto di lavoro', 'Employment contract explained', 'Le contrat de travail expliqué', 'شرح عقد العمل'],
    ['La busta paga', 'Payslip explained', 'La fiche de paie expliquée', 'شرح قسيمة الراتب'],
    ['Calcolo di stipendio e straordinari', 'Salary and overtime calculations', 'Calcul du salaire et des heures supplémentaires', 'حساب الراتب والساعات الإضافية'],
    ['Periodo di prova', 'Probation period', 'Période d’essai', 'فترة التجربة'],
    ['Dimissioni', 'Resignation procedures', 'Procédure de démission', 'إجراءات الاستقالة'],
    ['Domanda NASpI', 'NASpI application', 'Demande de NASpI', 'طلب إعانة البطالة NASpI'],
    ['Iscrizione al Centro per l’Impiego', 'Job centre registration', 'Inscription au Centre pour l’emploi', 'التسجيل في مركز التوظيف'],
    ['Licenziamento', 'Dismissal information', 'Informations sur le licenciement', 'معلومات عن الفصل من العمل'],
    ['Stipendi non pagati', 'Unpaid salary information', 'Salaires impayés', 'الرواتب غير المدفوعة'],
    ['Diritti e doveri del lavoratore', 'Employee rights and responsibilities', 'Droits et devoirs du salarié', 'حقوق وواجبات العامل']
  ],
  '08': [
    ['Iscrizione scolastica', 'School enrolment', 'Inscription scolaire', 'التسجيل المدرسي'],
    ['Trasferimento scolastico', 'School transfer', 'Changement d’école', 'الانتقال إلى مدرسة أخرى'],
    ['Iscrizione all’asilo nido', 'Nursery (asilo nido) enrolment', 'Inscription à la crèche', 'التسجيل في الحضانة'],
    ['Assegno Unico per i figli', 'Assegno Unico for children', 'Assegno Unico pour les enfants', 'الإعانة الموحدة للأطفال'],
    ['ISEE per la famiglia', 'Family ISEE', 'ISEE familial', 'ISEE العائلي'],
    ['Ricongiungimento con i familiari', 'Bringing your family to Italy', 'Faire venir sa famille en Italie', 'استقدام العائلة إلى إيطاليا'],
    ['Documenti di nascita dei figli', 'Children’s birth documents', 'Documents de naissance des enfants', 'وثائق ميلاد الأطفال'],
    ['Iscrizione alla mensa scolastica', 'School meals registration', 'Inscription à la cantine scolaire', 'التسجيل في المطعم المدرسي'],
    ['Assistenza scolastica', 'School assistance information', 'Aide scolaire', 'معلومات المساعدة المدرسية'],
    ['Aiuti economici per la famiglia', 'Financial support for families', 'Aides financières aux familles', 'المساعدات المالية للأسر'],
    ['Trasporto scolastico', 'School transport', 'Transport scolaire', 'النقل المدرسي']
  ],
  '09': [
    ['Codice fiscale', 'Tax code (codice fiscale)', 'Code fiscal', 'الرمز الضريبي', true],
    ['Tessera sanitaria e codice fiscale', 'Health card and tax code procedures', 'Carte sanitaire et code fiscal', 'البطاقة الصحية والرمز الضريبي'],
    ['SPID', 'SPID digital identity', 'Identité numérique SPID', 'الهوية الرقمية SPID', true],
    ['CIE – Carta d’identità elettronica', 'CIE electronic identity card', 'CIE – carte d’identité électronique', 'بطاقة الهوية الإلكترونية CIE'],
    ['Certificazione Unica: come leggerla', 'Reading your Certificazione Unica', 'Lire sa Certificazione Unica', 'كيفية قراءة الشهادة الموحدة'],
    ['Modello 730: informazioni', '730 tax return information', 'Déclaration 730 : informations', 'معلومات عن الإقرار الضريبي 730'],
    ['Modello F24', 'F24 payment form', 'Formulaire de paiement F24', 'نموذج الدفع F24'],
    ['Situazione fiscale', 'Tax status information', 'Situation fiscale', 'الوضع الضريبي'],
    ['Comunicazioni dell’Agenzia delle Entrate', 'Understanding tax office letters', 'Comprendre les courriers de l’administration fiscale', 'فهم مراسلات مصلحة الضرائب']
  ],
  '10': [
    ['Conversione della patente estera', 'Foreign driving licence conversion', 'Conversion du permis étranger', 'تحويل رخصة القيادة الأجنبية'],
    ['Rinnovo della patente', 'Driving licence renewal', 'Renouvellement du permis', 'تجديد رخصة القيادة'],
    ['Visita medica per la patente', 'Medical examination for the licence', 'Visite médicale pour le permis', 'الفحص الطبي لرخصة القيادة'],
    ['Prima patente', 'First driving licence', 'Premier permis de conduire', 'أول رخصة قيادة'],
    ['Rinnovo dei documenti del veicolo', 'Vehicle documents renewal', 'Renouvellement des documents du véhicule', 'تجديد وثائق المركبة'],
    ['Passaggio di proprietà', 'Change of vehicle ownership', 'Changement de propriétaire du véhicule', 'نقل ملكية المركبة'],
    ['Revisione del veicolo', 'Vehicle inspection (revisione)', 'Contrôle technique', 'الفحص الدوري للمركبة'],
    ['Multe stradali', 'Traffic fines', 'Amendes routières', 'مخالفات المرور'],
    ['Il Codice della Strada', 'Highway Code explained', 'Le Code de la route expliqué', 'شرح قانون السير'],
    ['Ricorso contro le multe', 'Appealing traffic fines', 'Contester une amende', 'الطعن في مخالفات المرور']
  ],
  '11': [
    ['Registrazione del contratto d’affitto', 'Rental contract registration', 'Enregistrement du bail', 'تسجيل عقد الإيجار'],
    ['Diritti dell’inquilino', 'Tenant rights', 'Droits du locataire', 'حقوق المستأجر'],
    ['Il contratto d’affitto', 'Rental contract explained', 'Le bail expliqué', 'شرح عقد الإيجار'],
    ['Aiuti per l’affitto', 'Rental assistance information', 'Aides au loyer', 'المساعدات في الإيجار'],
    ['Cambio di residenza dopo il trasloco', 'Change of residence after moving', 'Changement de résidence après un déménagement', 'تغيير الإقامة بعد الانتقال'],
    ['Idoneità alloggiativa e ospitalità', 'Proof of accommodation', 'Justificatif d’hébergement', 'إثبات السكن'],
    ['Contratto della luce', 'Electricity contract', 'Contrat d’électricité', 'عقد الكهرباء'],
    ['Contratto del gas', 'Gas contract', 'Contrat de gaz', 'عقد الغاز'],
    ['Contratto dell’acqua', 'Water contract', 'Contrat d’eau', 'عقد الماء'],
    ['Capire le bollette', 'Understanding utility bills', 'Comprendre les factures', 'فهم الفواتير'],
    ['Pratiche amministrative per l’affitto', 'Rental administrative procedures', 'Démarches administratives liées à la location', 'الإجراءات الإدارية المتعلقة بالإيجار']
  ],
  '12': [
    ['Categorie di protezione internazionale', 'International protection categories', 'Catégories de protection internationale', 'فئات الحماية الدولية'],
    ['Diritti e doveri legati al permesso', 'Rights and obligations of permit holders', 'Droits et obligations liés au titre de séjour', 'الحقوق والواجبات المرتبطة بتصريح الإقامة'],
    ['Capire le lettere della Questura', 'Understanding Questura letters', 'Comprendre les courriers de la Questura', 'فهم مراسلات الكويستورا'],
    ['Capire le lettere della Prefettura', 'Understanding Prefettura letters', 'Comprendre les courriers de la Prefettura', 'فهم مراسلات البريفتورا'],
    ['Ricorsi amministrativi', 'Administrative appeals information', 'Recours administratifs', 'معلومات عن الطعون الإدارية'],
    ['Elenco avvocati', 'Lawyer directory', 'Annuaire d’avocats', 'دليل المحامين'],
    ['Gratuito patrocinio', 'Legal aid (gratuito patrocinio)', 'Aide juridictionnelle', 'المساعدة القضائية المجانية'],
    ['Orientamento verso l’assistenza legale', 'Legal assistance referrals', 'Orientation vers une assistance juridique', 'التوجيه نحو المساعدة القانونية'],
    ['Assistenza in emergenza', 'Emergency assistance information', 'Assistance d’urgence', 'معلومات المساعدة الطارئة']
  ],
  '13': [
    ['Colloquio di orientamento per nuovi arrivati', 'Orientation session for newcomers', 'Entretien d’orientation pour nouveaux arrivants', 'جلسة توجيه للقادمين الجدد']
  ]
};

/** Lowercase ASCII slug from an Italian title. */
function slugify_(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[’']/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

/** Builds Services rows for the given category id map {code: id}. Slugs are unique. */
function seed_serviceRows_(categoryIdByCode) {
  var used = {}, rows = [];
  Object.keys(SEED_SERVICES).forEach(function (code) {
    var meta = SEED_SERVICE_META[code];
    SEED_SERVICES[code].forEach(function (s, i) {
      var slug = slugify_(s[0]);
      if (used[slug]) slug = slug + '-' + code;
      used[slug] = true;
      var rec = {
        category_id: categoryIdByCode[code], slug: slug,
        title_it: s[0], title_en: s[1], title_fr: s[2], title_ar: s[3],
        service_price: 0, assistance_fee: 0, official_fee_amount: 0, official_fee_verified: false, provider_fee: 0,
        additional_charges_json: '[]', discount_json: '', payment_method_ids_json: '[]', currency: 'EUR',
        official_links_json: JSON.stringify(meta.links.map(function (l) { return { label: l[0], url: l[1] }; })),
        city_ids_json: '[]', requestable: true, popular: !!s[4], order: i + 1, published: true, view_count: 0
      };
      APP.LANGS.forEach(function (l) { rec['institutions_' + l] = meta.inst; });
      rows.push(rec);
    });
  });
  return rows;
}
