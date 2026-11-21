import 'dart:ui' show PlatformDispatcher;

/// The few native texts of the app (the web site translates everything else).
class ShellStrings {
  const ShellStrings._(this.lang);

  final String lang;

  static const supported = ['ar', 'fr', 'en'];

  /// The device language when supported, otherwise Arabic (the platform default).
  static ShellStrings forDevice() => of(PlatformDispatcher.instance.locale.languageCode);

  static ShellStrings of(String code) => ShellStrings._(supported.contains(code) ? code : 'ar');

  bool get isRtl => lang == 'ar';

  static const _t = <String, List<String>>{
    // ar, fr, en
    'loading': ['جارٍ التحميل…', 'Chargement…', 'Loading…'],
    'errorTitle': ['تعذّر تحميل الصفحة', 'Impossible de charger la page', 'Couldn’t load the page'],
    'errorBody': [
      'تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.',
      'Vérifiez votre connexion Internet puis réessayez.',
      'Check your internet connection and try again.'
    ],
    'retry': ['إعادة المحاولة', 'Réessayer', 'Try again'],
    'refresh': ['تحديث', 'Actualiser', 'Refresh'],
    'back': ['رجوع', 'Retour', 'Back'],
    'home': ['الرئيسية', 'Accueil', 'Home'],
    'exitHint': ['اضغط رجوع مرة أخرى للخروج', 'Appuyez encore sur Retour pour quitter', 'Press back again to exit'],
    'noApp': ['لا يوجد تطبيق لفتح هذا الرابط', 'Aucune application ne peut ouvrir ce lien', 'No app can open this link'],
    'configTitle': ['التطبيق غير مُعدّ', 'Application non configurée', 'App not configured'],
    'configBody': [
      'عنوان الموقع غير صالح في إعدادات التطبيق. يرجى التواصل مع المسؤول.',
      'L’adresse du site est invalide dans la configuration de l’application. Contactez l’administrateur.',
      'The site address in the app configuration is invalid. Please contact the administrator.'
    ],
    'logout': ['تسجيل الخروج ومسح البيانات', 'Se déconnecter et effacer les données', 'Sign out and clear data'],
    'logoutDone': ['تم مسح بيانات الجلسة', 'Données de session effacées', 'Session data cleared'],
    'saved': ['تم الحفظ في التنزيلات', 'Enregistré dans Téléchargements', 'Saved to Downloads'],
    'open': ['فتح', 'Ouvrir', 'Open'],
    'saveFailed': ['تعذّر حفظ الملف', 'Impossible d’enregistrer le fichier', 'Couldn’t save the file'],
  };

  String t(String key) {
    final row = _t[key];
    if (row == null) return key;
    return row[supported.indexOf(lang)];
  }
}
