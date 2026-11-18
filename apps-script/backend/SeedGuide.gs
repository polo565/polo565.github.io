/**
 * HAMDI ITALIE — New Immigrant Guide seed (spec §4, section 13).
 * Questions come from the specification. Rules map answers to ORIENTATION
 * tasks (which office, where to find official information). They never decide
 * eligibility: tasks that depend on legal status are flagged depends_on_status
 * and the UI says so. Administrators edit everything afterwards.
 */
var SEED_GUIDE_QUESTIONS = [
  ['recent_arrival', 'yes_no', 'Sei arrivato in Italia da poco?', 'Have you recently arrived in Italy?', 'Êtes-vous arrivé récemment en Italie ?', 'هل وصلت إلى إيطاليا حديثاً؟'],
  ['reason', 'single_choice', 'Per quale motivo sei venuto in Italia?', 'What is your reason for coming to Italy?', 'Pour quelle raison êtes-vous venu en Italie ?', 'ما سبب قدومك إلى إيطاليا؟'],
  ['has_contract', 'yes_no', 'Hai un contratto di lavoro?', 'Do you have an employment contract?', 'Avez-vous un contrat de travail ?', 'هل لديك عقد عمل؟'],
  ['has_permesso', 'yes_no', 'Hai un permesso di soggiorno?', 'Do you have a residence permit (permesso di soggiorno)?', 'Avez-vous un titre de séjour (permesso di soggiorno) ?', 'هل لديك تصريح إقامة؟'],
  ['has_family', 'yes_no', 'Hai familiari in Italia?', 'Do you have family members in Italy?', 'Avez-vous des membres de votre famille en Italie ?', 'هل لديك أفراد من عائلتك في إيطاليا؟'],
  ['has_housing', 'yes_no', 'Hai un alloggio?', 'Do you have accommodation?', 'Avez-vous un logement ?', 'هل لديك سكن؟'],
  ['has_codice_fiscale', 'yes_no', 'Hai un codice fiscale?', 'Do you have a tax code (codice fiscale)?', 'Avez-vous un code fiscal ?', 'هل لديك رمز ضريبي (كوديتشي فيسكالي)؟'],
  ['has_residence_registration', 'yes_no', 'Sei iscritto all’anagrafe di un Comune?', 'Are you registered with a municipality (anagrafe)?', 'Êtes-vous inscrit à l’état civil d’une commune ?', 'هل أنت مسجّل في السجل المدني لبلدية؟'],
  ['has_healthcare', 'yes_no', 'Hai accesso all’assistenza sanitaria?', 'Do you have access to healthcare?', 'Avez-vous accès aux soins de santé ?', 'هل لديك إمكانية الحصول على الرعاية الصحية؟'],
  ['needs_help', 'yes_no', 'Ti serve aiuto per lavoro o pratiche familiari?', 'Do you need help with employment or family procedures?', 'Avez-vous besoin d’aide pour l’emploi ou des démarches familiales ?', 'هل تحتاج مساعدة في العمل أو الإجراءات العائلية؟']
];

var SEED_GUIDE_REASON_OPTIONS = [
  { value: 'work', label_it: 'Lavoro', label_en: 'Work', label_fr: 'Travail', label_ar: 'العمل' },
  { value: 'family', label_it: 'Famiglia', label_en: 'Family', label_fr: 'Famille', label_ar: 'العائلة' },
  { value: 'study', label_it: 'Studio', label_en: 'Study', label_fr: 'Études', label_ar: 'الدراسة' },
  { value: 'protection', label_it: 'Protezione / asilo', label_en: 'Protection / asylum', label_fr: 'Protection / asile', label_ar: 'الحماية / اللجوء' },
  { value: 'other', label_it: 'Altro', label_en: 'Other', label_fr: 'Autre', label_ar: 'سبب آخر' }
];

/*
 * [task_key, condition, service slug, official link, depends_on_status,
 *  institution, title {it,en,fr,ar}, explanation {it,en,fr,ar}]
 */
var SEED_GUIDE_RULES = [
  ['codice_fiscale', { all: [{ q: 'has_codice_fiscale', eq: 'no' }] }, 'codice-fiscale', 'https://www.agenziaentrate.gov.it', false, 'Agenzia delle Entrate',
    ['Ottieni il codice fiscale', 'Get your tax code (codice fiscale)', 'Obtenez votre code fiscal', 'احصل على الرمز الضريبي'],
    ['Il codice fiscale serve per quasi tutte le pratiche (contratti, sanità, banca). Si richiede all’Agenzia delle Entrate.',
     'The tax code is needed for almost every procedure (contracts, healthcare, banking). It is issued by the Agenzia delle Entrate.',
     'Le code fiscal est nécessaire pour presque toutes les démarches (contrats, santé, banque). Il est délivré par l’Agenzia delle Entrate.',
     'الرمز الضريبي ضروري لمعظم الإجراءات (العقود، الصحة، البنك). تصدره مصلحة الضرائب (Agenzia delle Entrate).']],
  ['permesso_first', { all: [{ q: 'has_permesso', eq: 'no' }] }, 'primo-rilascio-del-permesso-di-soggiorno', 'https://www.portaleimmigrazione.it', true, 'Questura · Poste Italiane',
    ['Informati sul permesso di soggiorno', 'Find out about the residence permit', 'Renseignez-vous sur le titre de séjour', 'تعرّف على تصريح الإقامة'],
    ['Il tipo di permesso e la procedura dipendono dalla tua situazione e dal tipo di ingresso. Verifica le informazioni ufficiali o chiedi assistenza.',
     'The permit type and procedure depend on your situation and how you entered Italy. Check the official information or ask for assistance.',
     'Le type de titre et la procédure dépendent de votre situation et de votre mode d’entrée. Consultez les informations officielles ou demandez de l’aide.',
     'نوع التصريح والإجراءات تعتمد على وضعك وطريقة دخولك. راجع المعلومات الرسمية أو اطلب المساعدة.']],
  ['permesso_renew', { all: [{ q: 'has_permesso', eq: 'yes' }] }, 'rinnovo-del-permesso-di-soggiorno', 'https://www.portaleimmigrazione.it', true, 'Questura · Poste Italiane',
    ['Controlla la scadenza del permesso', 'Check your permit’s expiry date', 'Vérifiez la date d’expiration de votre titre', 'تحقّق من تاريخ انتهاء تصريحك'],
    ['Annota la data di scadenza e informati per tempo sul rinnovo.',
     'Note the expiry date and find out about renewal in good time.',
     'Notez la date d’expiration et renseignez-vous à temps sur le renouvellement.',
     'دوّن تاريخ الانتهاء واستعلم عن التجديد في الوقت المناسب.']],
  ['housing', { all: [{ q: 'has_housing', eq: 'no' }] }, 'idoneita-alloggiativa-e-ospitalita', '', false, 'Comune',
    ['Trova un alloggio stabile', 'Find stable accommodation', 'Trouvez un logement stable', 'ابحث عن سكن مستقر'],
    ['Un indirizzo è spesso necessario per la residenza e per altre pratiche. Se sei ospitato, informati sulla dichiarazione di ospitalità.',
     'An address is often needed for residence registration and other procedures. If you are hosted, ask about the hospitality declaration.',
     'Une adresse est souvent nécessaire pour la résidence et d’autres démarches. Si vous êtes hébergé, renseignez-vous sur la déclaration d’hébergement.',
     'غالباً ما يكون العنوان ضرورياً لتسجيل الإقامة وإجراءات أخرى. إذا كنت مستضافاً، استعلم عن إقرار الاستضافة.']],
  ['anagrafe', { all: [{ q: 'has_residence_registration', eq: 'no' }, { q: 'has_housing', eq: 'yes' }] }, 'iscrizione-anagrafica', 'https://www.anagrafenazionale.interno.gov.it', true, 'Comune · Ufficio Anagrafe',
    ['Iscriviti all’anagrafe del Comune', 'Register your residence at the Comune', 'Inscrivez-vous à l’état civil de la commune', 'سجّل إقامتك في البلدية'],
    ['L’iscrizione anagrafica si fa presso il Comune in cui vivi. I documenti richiesti possono dipendere dalla tua situazione.',
     'Civil registration is done at the Comune where you live. Required documents may depend on your situation.',
     'L’inscription se fait auprès de la commune où vous habitez. Les documents demandés peuvent dépendre de votre situation.',
     'يتم التسجيل في بلدية مكان سكنك. قد تختلف الوثائق المطلوبة حسب وضعك.']],
  ['healthcare', { all: [{ q: 'has_healthcare', eq: 'no' }] }, 'iscrizione-al-servizio-sanitario-nazionale', 'https://www.salute.gov.it', true, 'ASL',
    ['Informati sull’iscrizione al Servizio Sanitario', 'Find out about health service registration', 'Renseignez-vous sur l’inscription au service de santé', 'تعرّف على التسجيل في الخدمة الصحية'],
    ['L’accesso al Servizio Sanitario Nazionale e la scelta del medico di base si gestiscono con l’ASL. Le condizioni dipendono dal tipo di permesso.',
     'Access to the National Health Service and choosing a family doctor are handled by the ASL. Conditions depend on your permit type.',
     'L’accès au Service sanitaire national et le choix du médecin traitant se font auprès de l’ASL. Les conditions dépendent du type de titre.',
     'يتم الوصول إلى الخدمة الصحية الوطنية واختيار طبيب الأسرة عبر مكتب ASL. تعتمد الشروط على نوع التصريح.']],
  ['work_entry', { all: [{ q: 'reason', eq: 'work' }, { q: 'has_contract', eq: 'no' }] }, 'risorse-per-la-ricerca-di-lavoro', 'https://www.lavoro.gov.it', true, 'Centro per l’Impiego',
    ['Cerca lavoro con i canali ufficiali', 'Look for work through official channels', 'Cherchez un emploi par les canaux officiels', 'ابحث عن عمل عبر القنوات الرسمية'],
    ['Il Centro per l’Impiego offre servizi gratuiti. La possibilità di lavorare dipende dal tuo permesso di soggiorno.',
     'Job centres offer free services. Whether you can work depends on your residence permit.',
     'Les centres pour l’emploi proposent des services gratuits. La possibilité de travailler dépend de votre titre de séjour.',
     'تقدّم مراكز التوظيف خدمات مجانية. إمكانية العمل تعتمد على تصريح إقامتك.']],
  ['work_contract', { all: [{ q: 'has_contract', eq: 'yes' }] }, 'il-contratto-di-lavoro', 'https://www.lavoro.gov.it', false, 'Ispettorato del Lavoro · Patronato',
    ['Capisci il tuo contratto e la busta paga', 'Understand your contract and payslip', 'Comprenez votre contrat et votre fiche de paie', 'افهم عقدك وقسيمة راتبك'],
    ['Conserva il contratto e controlla ogni mese la busta paga.',
     'Keep your contract and check your payslip every month.',
     'Conservez votre contrat et vérifiez votre fiche de paie chaque mois.',
     'احتفظ بعقدك وراجع قسيمة راتبك كل شهر.']],
  ['family', { all: [{ q: 'has_family', eq: 'yes' }] }, 'iscrizione-scolastica', '', true, 'Comune · Scuola · INPS',
    ['Pratiche per la famiglia e i figli', 'Family and children procedures', 'Démarches pour la famille et les enfants', 'إجراءات العائلة والأطفال'],
    ['Iscrizione scolastica, Assegno Unico e altre prestazioni: i requisiti dipendono dalla situazione della famiglia.',
     'School enrolment, Assegno Unico and other benefits: requirements depend on your family’s situation.',
     'Inscription scolaire, Assegno Unico et autres prestations : les conditions dépendent de la situation familiale.',
     'التسجيل المدرسي والإعانة الموحدة ومساعدات أخرى: تعتمد الشروط على وضع العائلة.']],
  ['study', { all: [{ q: 'reason', eq: 'study' }] }, 'rinnovo-del-permesso-per-studio', 'https://www.portaleimmigrazione.it', true, 'Università · Questura',
    ['Permesso per studio', 'Study permit', 'Titre de séjour pour études', 'تصريح الإقامة للدراسة'],
    ['Verifica con la tua università e con le fonti ufficiali gli adempimenti legati al permesso per studio.',
     'Check with your university and official sources what the study permit requires.',
     'Vérifiez auprès de votre université et des sources officielles les obligations liées au titre étudiant.',
     'تحقّق مع جامعتك ومن المصادر الرسمية من متطلبات تصريح الدراسة.']],
  ['protection', { all: [{ q: 'reason', eq: 'protection' }] }, 'categorie-di-protezione-internazionale', '', true, 'Questura · Avvocati abilitati',
    ['Protezione internazionale: informati e chiedi assistenza legale', 'International protection: get informed and seek legal assistance', 'Protection internationale : informez-vous et demandez une assistance juridique', 'الحماية الدولية: تعرّف واطلب مساعدة قانونية'],
    ['Queste procedure richiedono attenzione: rivolgiti a professionisti qualificati. HAMDI ITALIE non fornisce rappresentanza legale.',
     'These procedures need care: contact qualified professionals. HAMDI ITALIE does not provide legal representation.',
     'Ces procédures demandent de l’attention : adressez-vous à des professionnels qualifiés. HAMDI ITALIE ne fournit pas de représentation juridique.',
     'هذه الإجراءات تتطلب عناية: تواصل مع مهنيين مؤهلين. لا تقدّم HAMDI ITALIE تمثيلاً قانونياً.']],
  ['digital_identity', { all: [{ q: 'has_codice_fiscale', eq: 'yes' }] }, 'spid', 'https://www.spid.gov.it', true, 'Identity providers · Comune (CIE)',
    ['Informati sull’identità digitale (SPID o CIE)', 'Find out about digital identity (SPID or CIE)', 'Renseignez-vous sur l’identité numérique (SPID ou CIE)', 'تعرّف على الهوية الرقمية (SPID أو CIE)'],
    ['Molti servizi pubblici online richiedono SPID o CIE. Non condividere mai le tue credenziali con nessuno.',
     'Many online public services require SPID or CIE. Never share your credentials with anyone.',
     'De nombreux services publics en ligne exigent SPID ou CIE. Ne partagez jamais vos identifiants.',
     'تتطلب العديد من الخدمات العامة الإلكترونية SPID أو CIE. لا تشارك بيانات دخولك مع أي شخص.']],
  ['ask_help', { any: [{ q: 'needs_help', eq: 'yes' }, { q: 'recent_arrival', eq: 'yes' }] }, 'colloquio-di-orientamento-per-nuovi-arrivati', '', false, 'HAMDI ITALIE',
    ['Chiedi un colloquio di orientamento', 'Request an orientation session', 'Demandez un entretien d’orientation', 'اطلب جلسة توجيه'],
    ['Possiamo aiutarti a organizzare i prossimi passi. Il pagamento in contanti è possibile.',
     'We can help you organise your next steps. Cash payment is possible.',
     'Nous pouvons vous aider à organiser les prochaines étapes. Le paiement en espèces est possible.',
     'يمكننا مساعدتك في تنظيم خطواتك القادمة. الدفع نقداً ممكن.']]
];

function seed_guideQuestionRows_() {
  return SEED_GUIDE_QUESTIONS.map(function (q, i) {
    return {
      key: q[0], type: q[1], order: i + 1, published: true,
      question_it: q[2], question_en: q[3], question_fr: q[4], question_ar: q[5],
      options_json: JSON.stringify(q[1] === 'single_choice' ? SEED_GUIDE_REASON_OPTIONS : [])
    };
  });
}

function seed_guideRuleRows_(serviceIdBySlug) {
  return SEED_GUIDE_RULES.map(function (r, i) {
    var rec = {
      order: i + 1, task_key: r[0], condition_json: JSON.stringify(r[1]),
      service_id: serviceIdBySlug[r[2]] || '', official_link: r[3], depends_on_status: r[4], published: true
    };
    ['it', 'en', 'fr', 'ar'].forEach(function (l, j) {
      rec['institution_' + l] = r[5];
      rec['title_' + l] = r[6][j];
      rec['explanation_' + l] = r[7][j];
    });
    return rec;
  });
}
