import 'package:flutter/material.dart';
import 'package:hamdi_webview/hamdi_webview.dart';

/// HAMDI ITALIE administrator app: shows the admin website (https://polo565.github.io/admin/) in a WebView.
///
/// Installing this app grants nothing: every admin action is checked by the server
/// (login, session, role). No password, key or token is stored in the app.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HamdiShellApp(
    kind: AppKind.admin,
    title: 'HAMDI Admin',
    fileSaver: ChannelFileSaver(),
    signOutMenu: true,
  ));
}
