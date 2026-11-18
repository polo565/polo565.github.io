import 'package:flutter/material.dart';
import 'package:hamdi_webview/hamdi_webview.dart';

/// HAMDI ITALIE visitor app: shows the website (https://polo565.github.io/) in a WebView.
/// The URL comes from apps/shared/assets/config.json; nothing secret is stored here.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HamdiShellApp(kind: AppKind.visitor, title: 'HAMDI ITALIE'));
}
