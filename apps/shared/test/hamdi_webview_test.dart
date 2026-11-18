import 'package:flutter_test/flutter_test.dart';
import 'package:hamdi_webview/hamdi_webview.dart';

const site = 'https://polo565.github.io/';

void main() {
  group('NavPolicy', () {
    const visitor = NavPolicy(siteHost: 'polo565.github.io', kind: AppKind.visitor);
    const admin = NavPolicy(siteHost: 'polo565.github.io', kind: AppKind.admin);
    NavDecision main(String u, [NavPolicy p = visitor]) => p.decide(Uri.parse(u), mainFrame: true);
    NavDecision frame(String u, [NavPolicy p = visitor]) => p.decide(Uri.parse(u), mainFrame: false);

    test('the website stays inside the app', () {
      expect(main(site), NavDecision.allow);
      expect(main('$site#/service/x'), NavDecision.allow);
      expect(main('https://POLO565.github.io/#/guide'), NavDecision.allow);
      expect(main('${site}admin/', admin), NavDecision.allow);
      expect(main('${site}admin/#/appointments', admin), NavDecision.allow);
    });

    test('the visitor app never shows the admin pages', () {
      expect(main('${site}admin/'), NavDecision.external);
      expect(main('${site}admin'), NavDecision.external);
      expect(main('${site}administration-info'), NavDecision.allow);
    });

    test('other sites open in another app', () {
      expect(main('https://script.google.com/macros/s/x/exec'), NavDecision.external);
      expect(main('https://drive.google.com/file/d/abc/view'), NavDecision.external);
      expect(main('https://wa.me/393331234567'), NavDecision.external);
      expect(main('https://github.com/polo565'), NavDecision.external);
      expect(main('http://polo565.github.io/'), NavDecision.external);
      // Look-alike hosts are not ours.
      expect(main('https://polo565.github.io.evil.example/x'), NavDecision.external);
      expect(main('https://evil-polo565.github.io/x'), NavDecision.external);
      expect(main('https://other.github.io/x'), NavDecision.external);
    });

    test('phone, mail and WhatsApp links open their apps from any frame', () {
      expect(main('tel:+39123'), NavDecision.external);
      expect(frame('tel:+39123'), NavDecision.external);
      expect(main('mailto:a@b.it'), NavDecision.external);
      expect(main('whatsapp://send?phone=39'), NavDecision.external);
    });

    test('dangerous schemes are blocked', () {
      expect(main('intent://scan/#Intent;scheme=zxing;end'), NavDecision.block);
      expect(main('javascript:alert(1)'), NavDecision.block);
      expect(main('file:///sdcard/x.pdf'), NavDecision.block);
      expect(main('content://x/y'), NavDecision.block);
      expect(main('data:text/html,hi'), NavDecision.block);
      expect(frame('http://example.com'), NavDecision.block);
      expect(visitor.decide(null, mainFrame: true), NavDecision.block);
    });

    test('frames may embed https and blank pages', () {
      expect(frame('about:blank'), NavDecision.allow);
      expect(frame('https://www.youtube.com/embed/x'), NavDecision.allow);
      expect(frame('blob:https://x/1'), NavDecision.allow);
    });

    test('no site host configured: nothing is ours', () {
      const none = NavPolicy(siteHost: '', kind: AppKind.visitor);
      expect(none.decide(Uri.parse(site), mainFrame: true), NavDecision.external);
    });
  });

  group('ShellConfig', () {
    test('derives visitor and admin URLs from the site URL', () {
      final c = ShellConfig.fromJson({'SITE_URL': 'https://polo565.github.io'});
      expect(c.urlFor(AppKind.visitor).toString(), site);
      expect(c.urlFor(AppKind.admin).toString(), '${site}admin/');
      expect(c.siteHost, 'polo565.github.io');
      expect(c.policyFor(AppKind.admin).kind, AppKind.admin);
    });

    test('explicit URLs and build-time overrides win', () {
      final c = ShellConfig.fromJson(
        {'SITE_URL': site, 'VISITOR_WEB_URL': '$site#/guide'},
        adminOverride: '${site}admin/#/appointments',
      );
      expect(c.urlFor(AppKind.visitor).toString(), '$site#/guide');
      expect(c.urlFor(AppKind.admin).toString(), '${site}admin/#/appointments');
    });

    test('rejects missing, non-https, foreign or crossed URLs', () {
      expect(ShellConfig.fromJson({}).urlFor(AppKind.visitor), isNull);
      expect(ShellConfig.fromJson({'SITE_URL': 'http://polo565.github.io/'}).urlFor(AppKind.visitor), isNull);
      expect(ShellConfig.fromJson({'SITE_URL': site, 'VISITOR_WEB_URL': 'https://example.com/'}).urlFor(AppKind.visitor), isNull);
      expect(ShellConfig.fromJson({'SITE_URL': site, 'VISITOR_WEB_URL': 'https://x@polo565.github.io/'}).urlFor(AppKind.visitor), isNull);
      expect(ShellConfig.fromJson({'SITE_URL': site, 'VISITOR_WEB_URL': 'https://polo565.github.io:8443/'}).urlFor(AppKind.visitor), isNull);
      // The visitor app never opens the admin site, and the reverse.
      expect(ShellConfig.fromJson({'SITE_URL': site, 'VISITOR_WEB_URL': '${site}admin/'}).urlFor(AppKind.visitor), isNull);
      expect(ShellConfig.fromJson({'SITE_URL': site, 'ADMIN_WEB_URL': site}).urlFor(AppKind.admin), isNull);
    });

    test('the bundled config file is valid and points at GitHub Pages', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final c = await ShellConfig.load();
      expect(c.urlFor(AppKind.visitor).toString(), site);
      expect(c.urlFor(AppKind.admin).toString(), '${site}admin/');
    });
  });

  test('strings fall back to Arabic and cover every key in 3 languages', () {
    expect(ShellStrings.of('it').lang, 'ar');
    expect(ShellStrings.of('ar').isRtl, isTrue);
    for (final l in ShellStrings.supported) {
      final s = ShellStrings.of(l);
      for (final k in ['loading', 'errorTitle', 'retry', 'noApp', 'exitHint', 'configTitle']) {
        expect(s.t(k), isNot(k));
        expect(s.t(k), isNotEmpty);
      }
    }
  });
}
