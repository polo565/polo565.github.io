import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import 'nav_policy.dart';

/// Which web app this APK opens.
enum AppKind { visitor, admin }

/// The URLs of the website (GitHub Pages), read from `assets/config.json`.
///
/// Every value can be overridden at build time, e.g.
/// `flutter build apk --dart-define=SITE_URL=https://polo565.github.io/`.
class ShellConfig {
  const ShellConfig({
    required this.siteUrl,
    required this.visitorUrl,
    required this.adminUrl,
  });

  final String siteUrl;
  final String visitorUrl;
  final String adminUrl;

  static const _assetPath = 'packages/hamdi_webview/assets/config.json';

  static const _defineSite = String.fromEnvironment('SITE_URL');
  static const _defineVisitor = String.fromEnvironment('VISITOR_WEB_URL');
  static const _defineAdmin = String.fromEnvironment('ADMIN_WEB_URL');

  /// Loads the bundled file, then applies any `--dart-define` overrides.
  static Future<ShellConfig> load() async {
    Map<String, dynamic> json = const {};
    try {
      json = jsonDecode(await rootBundle.loadString(_assetPath)) as Map<String, dynamic>;
    } catch (_) {
      // A missing or broken file is reported by [urlFor] returning null.
    }
    return fromJson(json, siteOverride: _defineSite, visitorOverride: _defineVisitor, adminOverride: _defineAdmin);
  }

  /// Builds a config; empty visitor/admin URLs are derived from the site URL.
  static ShellConfig fromJson(
    Map<String, dynamic> json, {
    String siteOverride = '',
    String visitorOverride = '',
    String adminOverride = '',
  }) {
    String pick(String override, String key) =>
        override.trim().isNotEmpty ? override.trim() : (json[key] is String ? (json[key] as String).trim() : '');

    var site = pick(siteOverride, 'SITE_URL');
    if (site.isNotEmpty && !site.endsWith('/')) site = '$site/';
    var visitor = pick(visitorOverride, 'VISITOR_WEB_URL');
    var admin = pick(adminOverride, 'ADMIN_WEB_URL');
    if (visitor.isEmpty) visitor = site;
    if (admin.isEmpty && site.isNotEmpty) admin = Uri.parse(site).resolve('admin/').toString();
    return ShellConfig(siteUrl: site, visitorUrl: visitor, adminUrl: admin);
  }

  /// The host the apps trust: the site's host (only pages from it open inside the app).
  String get siteHost {
    final uri = Uri.tryParse(siteUrl.isNotEmpty ? siteUrl : visitorUrl);
    return uri == null ? '' : uri.host.toLowerCase();
  }

  /// Whether [path] is the administration part of the site.
  static bool isAdminPath(String path) => path == '/admin' || path.startsWith('/admin/');

  /// The start URL for [kind], or null when it is missing, not https, or not on the site host.
  Uri? urlFor(AppKind kind) {
    final raw = kind == AppKind.visitor ? visitorUrl : adminUrl;
    final uri = Uri.tryParse(raw);
    final host = siteHost;
    if (uri == null || host.isEmpty || uri.scheme != 'https' || uri.host.toLowerCase() != host) return null;
    if (uri.userInfo.isNotEmpty || (uri.hasPort && uri.port != 443)) return null;
    // The visitor APK must never open the admin site, and the admin APK only the admin site.
    if (isAdminPath(uri.path) != (kind == AppKind.admin)) return null;
    return uri;
  }

  /// Navigation rules for the app of [kind].
  NavPolicy policyFor(AppKind kind) => NavPolicy(siteHost: siteHost, kind: kind);
}
