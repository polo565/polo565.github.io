import 'shell_config.dart';

/// What to do with a URL the web page wants to open.
enum NavDecision {
  /// Load it inside the WebView.
  allow,

  /// Hand it to another app (browser, phone, mail, WhatsApp, Drive…).
  external,

  /// Ignore it.
  block,
}

/// Navigation rules for the WebView, kept free of Flutter so they can be unit-tested.
///
/// Only the HAMDI ITALIE website ([siteHost], GitHub Pages) runs inside the WebView. Every
/// other site opens in the user's browser (or the matching app), so a link in admin-entered
/// content can never take over the app window. The visitor app never shows the admin pages.
/// The pages' own requests to the Apps Script API are not navigations and are not affected.
class NavPolicy {
  const NavPolicy({required this.siteHost, required this.kind});

  final String siteHost;
  final AppKind kind;

  /// Whether [host] is the website's host (exact match: look-alike hosts are foreign).
  bool isSiteHost(String host) => siteHost.isNotEmpty && host.toLowerCase() == siteHost;

  static const _externalSchemes = {'tel', 'mailto', 'sms', 'smsto', 'geo', 'whatsapp'};

  /// Decides for a navigation in the main window ([mainFrame]) or in a frame.
  NavDecision decide(Uri? uri, {required bool mainFrame}) {
    if (uri == null) return NavDecision.block;
    final scheme = uri.scheme.toLowerCase();
    if (_externalSchemes.contains(scheme)) return NavDecision.external;
    switch (scheme) {
      case 'https':
        if (isSiteHost(uri.host)) {
          if (mainFrame && kind == AppKind.visitor && ShellConfig.isAdminPath(uri.path)) return NavDecision.external;
          return NavDecision.allow;
        }
        return mainFrame ? NavDecision.external : NavDecision.allow;
      case 'http':
        return mainFrame ? NavDecision.external : NavDecision.block;
      case 'about':
        return NavDecision.allow;
      case 'data':
      case 'blob':
        return mainFrame ? NavDecision.block : NavDecision.allow;
      default:
        // intent:, javascript:, file:, content:, market: and anything unknown.
        return NavDecision.block;
    }
  }
}
