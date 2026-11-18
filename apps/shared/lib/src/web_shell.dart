import 'dart:async';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'file_bridge.dart';
import 'nav_policy.dart';
import 'shell_config.dart';
import 'strings.dart';

/// Brand colours (same tokens as the web design system).
class ShellColors {
  static const background = Color(0xFFE9EDF3);
  static const primary = Color(0xFF244B68);
  static const text = Color(0xFF243746);
  static const muted = Color(0xFF718096);
  static const error = Color(0xFFC45A5A);
}

/// The whole app: a slim top bar and the HAMDI ITALIE website (GitHub Pages) in a WebView.
class HamdiShellApp extends StatelessWidget {
  const HamdiShellApp({super.key, required this.kind, required this.title, this.fileSaver, this.signOutMenu = false});

  final AppKind kind;
  final String title;

  /// When set, the page may hand files to the app (admin downloads), saved by this saver.
  final FileSaver? fileSaver;

  /// Shows a "Sign out and clear data" menu in the top bar (admin app).
  final bool signOutMenu;

  @override
  Widget build(BuildContext context) {
    final strings = ShellStrings.forDevice();
    return MaterialApp(
      title: title,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: ShellColors.primary,
          primary: ShellColors.primary,
          surface: ShellColors.background,
        ),
        scaffoldBackgroundColor: ShellColors.background,
        appBarTheme: const AppBarTheme(
          backgroundColor: ShellColors.background,
          foregroundColor: ShellColors.primary,
          elevation: 0,
          scrolledUnderElevation: 0,
          systemOverlayStyle: SystemUiOverlayStyle(
            statusBarColor: ShellColors.background,
            statusBarIconBrightness: Brightness.dark,
            systemNavigationBarColor: ShellColors.background,
            systemNavigationBarIconBrightness: Brightness.dark,
          ),
        ),
      ),
      builder: (context, child) => Directionality(
        textDirection: strings.isRtl ? TextDirection.rtl : TextDirection.ltr,
        child: child!,
      ),
      home: WebShellPage(kind: kind, title: title, strings: strings, fileSaver: fileSaver, signOutMenu: signOutMenu),
    );
  }
}

class WebShellPage extends StatefulWidget {
  const WebShellPage({
    super.key,
    required this.kind,
    required this.title,
    required this.strings,
    this.fileSaver,
    this.signOutMenu = false,
  });

  final AppKind kind;
  final String title;
  final ShellStrings strings;
  final FileSaver? fileSaver;
  final bool signOutMenu;

  @override
  State<WebShellPage> createState() => _WebShellPageState();
}

class _WebShellPageState extends State<WebShellPage> {
  WebViewController? _web;
  Uri? _startUrl;
  NavPolicy? _policy;
  bool _configLoaded = false;
  double _progress = 0;
  bool _loadedOnce = false;
  bool _failed = false;
  bool _canGoBack = false;
  DateTime? _lastBackPress;
  int _generation = 0; // a new WebView after "sign out and clear data"

  ShellStrings get s => widget.strings;

  @override
  void initState() {
    super.initState();
    ShellConfig.load().then((config) {
      if (!mounted) return;
      final start = config.urlFor(widget.kind);
      setState(() {
        _startUrl = start;
        _policy = config.policyFor(widget.kind);
        _configLoaded = true;
        if (start != null) _web = _createController(start);
      });
    });
  }

  WebViewController _createController(Uri start) {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(ShellColors.background)
      ..enableZoom(false)
      ..setNavigationDelegate(NavigationDelegate(
        // Also receives target="_blank" links (single-window WebView) and downloads.
        onNavigationRequest: (request) {
          final uri = Uri.tryParse(request.url);
          switch (_policy!.decide(uri, mainFrame: request.isMainFrame)) {
            case NavDecision.allow:
              return NavigationDecision.navigate;
            case NavDecision.external:
              unawaited(_openExternal(uri!));
              return NavigationDecision.prevent;
            case NavDecision.block:
              return NavigationDecision.prevent;
          }
        },
        onPageStarted: (_) {
          if (mounted) setState(() => _progress = 0);
        },
        onProgress: (progress) {
          if (mounted) setState(() => _progress = progress / 100);
        },
        onPageFinished: (_) {
          if (mounted && !_failed) setState(() => _loadedOnce = true);
          _refreshBack();
        },
        onUrlChange: (_) => _refreshBack(),
        onWebResourceError: (error) {
          // Show our screen instead of Android's raw error page when the page itself fails
          // (images or API calls failing are handled by the page).
          if (error.isForMainFrame != false && mounted) setState(() => _failed = true);
        },
      ));

    final platform = controller.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(kDebugMode);
      platform
        ..setMediaPlaybackRequiresUserGesture(true)
        ..setAllowFileAccess(false)
        ..setAllowContentAccess(false)
        ..setGeolocationEnabled(false)
        ..setMixedContentMode(MixedContentMode.neverAllow)
        ..setOnShowFileSelector(_pickFiles)
        // Camera, microphone… are never needed.
        ..setOnPlatformPermissionRequest((request) => request.deny());
      // The site needs no third-party cookies (its API calls send no cookies).
      AndroidWebViewCookieManager(const PlatformWebViewCookieManagerCreationParams())
          .setAcceptThirdPartyCookies(platform, false);
    }
    if (widget.fileSaver != null) {
      controller.addJavaScriptChannel('HamdiApp', onMessageReceived: (m) => _onPageFile(m.message));
    }
    controller.loadRequest(start);
    return controller;
  }

  /// Answers <input type="file">: lets the user pick files and hands them to the page.
  /// The server checks every file again (real type from content, size).
  Future<List<String>> _pickFiles(FileSelectorParams params) async {
    final mimes = <String>{};
    for (final raw in params.acceptTypes.expand((a) => a.split(','))) {
      final a = raw.trim().toLowerCase();
      final ext = a.startsWith('.') ? a.substring(1) : a;
      if (a.contains('/')) {
        mimes.add(a);
      } else if (_extMime.containsKey(ext)) {
        mimes.add(_extMime[ext]!);
      }
    }
    final groups = [XTypeGroup(label: 'files', mimeTypes: mimes.isEmpty ? null : mimes.toList())];
    try {
      if (params.mode == FileSelectorMode.openMultiple) {
        final files = await openFiles(acceptedTypeGroups: groups);
        return files.map((f) => Uri.file(f.path).toString()).toList();
      }
      final file = await openFile(acceptedTypeGroups: groups);
      return file == null ? const [] : [Uri.file(file.path).toString()];
    } catch (_) {
      return const [];
    }
  }

  static const _extMime = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'odt': 'application/vnd.oasis.opendocument.text',
    'csv': 'text/csv',
  };

  Future<void> _openExternal(Uri uri) async {
    var ok = false;
    try {
      ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      ok = false;
    }
    if (!ok && mounted) _snack(s.t('noApp'));
  }

  void _snack(String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), duration: const Duration(seconds: 2)));
  }

  /// Saves a file sent by the page (see [PageFile]) and offers to open it.
  Future<void> _onPageFile(String message) async {
    final saver = widget.fileSaver;
    final file = PageFile.parse(message);
    if (saver == null || file == null) {
      _snack(s.t('saveFailed'));
      return;
    }
    final handle = await saver.save(file);
    if (!mounted) return;
    if (handle == null) {
      _snack(s.t('saveFailed'));
      return;
    }
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text('${s.t('saved')}: ${file.name}'),
        duration: const Duration(seconds: 6),
        action: SnackBarAction(
          label: s.t('open'),
          onPressed: () async {
            if (!await saver.open(handle, file.mime) && mounted) _snack(s.t('noApp'));
          },
        ),
      ));
  }

  /// Deletes cookies, storage and cache, then starts a brand-new WebView (its session storage,
  /// where the admin token lives, goes with the old one).
  Future<void> _signOutAndClear() async {
    final web = _web;
    final start = _startUrl;
    if (web == null || start == null) return;
    try {
      await web.clearCache();
      await web.clearLocalStorage();
      await WebViewCookieManager().clearCookies();
    } catch (_) {
      // Best effort: the new WebView below starts without the old session anyway.
    }
    if (!mounted) return;
    setState(() {
      _generation++;
      _loadedOnce = false;
      _failed = false;
      _canGoBack = false;
      _progress = 0;
      _web = _createController(start);
    });
    _snack(s.t('logoutDone'));
  }

  Future<void> _refreshBack() async {
    final can = await _web?.canGoBack() ?? false;
    if (mounted && can != _canGoBack) setState(() => _canGoBack = can);
  }

  Future<void> _retry() async {
    setState(() {
      _failed = false;
      _progress = 0;
    });
    final current = Uri.tryParse(await _web?.currentUrl() ?? '');
    final target = (current != null && current.scheme == 'https' && (_policy?.isSiteHost(current.host) ?? false))
        ? current
        : _startUrl;
    if (target != null) await _web?.loadRequest(target);
  }

  Future<void> _onBack() async {
    if (!_failed && await (_web?.canGoBack() ?? Future.value(false))) {
      await _web!.goBack();
      return;
    }
    final now = DateTime.now();
    if (_lastBackPress != null && now.difference(_lastBackPress!) < const Duration(seconds: 2)) {
      await SystemNavigator.pop();
      return;
    }
    _lastBackPress = now;
    _snack(s.t('exitHint'));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _onBack();
      },
      child: Scaffold(
        appBar: AppBar(
          toolbarHeight: 48,
          automaticallyImplyLeading: false,
          titleSpacing: _canGoBack ? 0 : 16,
          leading: _canGoBack
              ? IconButton(tooltip: s.t('back'), icon: const BackButtonIcon(), onPressed: _onBack)
              : null,
          title: Text(
            widget.title,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, letterSpacing: 0.5),
          ),
          actions: [
            IconButton(
              tooltip: s.t('refresh'),
              icon: const Icon(Icons.refresh_rounded),
              onPressed: _web == null ? null : () => _failed ? _retry() : _web!.reload(),
            ),
            if (widget.signOutMenu)
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert_rounded),
                onSelected: (v) {
                  if (v == 'logout') _signOutAndClear();
                },
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'logout',
                    child: Row(children: [
                      const Icon(Icons.logout_rounded, size: 20),
                      const SizedBox(width: 12),
                      Flexible(child: Text(s.t('logout'))),
                    ]),
                  ),
                ],
              ),
          ],
        ),
        body: SafeArea(top: false, child: _body()),
      ),
    );
  }

  Widget _body() {
    if (!_configLoaded) return const SizedBox.shrink();
    final web = _web;
    if (web == null) {
      return _Message(icon: Icons.settings_outlined, title: s.t('configTitle'), body: s.t('configBody'));
    }
    return Stack(
      children: [
        WebViewWidget(key: ValueKey(_generation), controller: web),
        if (_progress < 1 && !_failed)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: LinearProgressIndicator(
              value: _progress == 0 ? null : _progress,
              minHeight: 3,
              backgroundColor: Colors.transparent,
            ),
          ),
        if (!_loadedOnce && !_failed)
          Positioned.fill(
            child: ColoredBox(
              color: ShellColors.background,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(width: 36, height: 36, child: CircularProgressIndicator(strokeWidth: 3)),
                    const SizedBox(height: 16),
                    Text(s.t('loading'), style: const TextStyle(color: ShellColors.muted)),
                  ],
                ),
              ),
            ),
          ),
        if (_failed)
          Positioned.fill(
            child: ColoredBox(
              color: ShellColors.background,
              child: _Message(
                icon: Icons.wifi_off_rounded,
                title: s.t('errorTitle'),
                body: s.t('errorBody'),
                action: FilledButton.icon(
                  onPressed: _retry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: Text(s.t('retry')),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.title, required this.body, this.action});

  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: const BoxDecoration(
                color: ShellColors.background,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: Color(0xFFC5CCD6), offset: Offset(6, 6), blurRadius: 14),
                  BoxShadow(color: Colors.white, offset: Offset(-6, -6), blurRadius: 14),
                ],
              ),
              child: Icon(icon, size: 40, color: ShellColors.primary),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: ShellColors.text),
            ),
            const SizedBox(height: 8),
            Text(body, textAlign: TextAlign.center, style: const TextStyle(color: ShellColors.muted, height: 1.5)),
            if (action != null) ...[const SizedBox(height: 24), action!],
          ],
        ),
      ),
    );
  }
}
