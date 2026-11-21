import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:hamdi_webview/hamdi_webview.dart';

String msg(Map<String, Object?> m) => jsonEncode(m);

void main() {
  final pdf = base64Encode(utf8.encode('%PDF-1.4 test'));

  test('accepts a PDF and keeps its name', () {
    final f = PageFile.parse(msg({'type': 'file', 'name': 'Modulo 209.pdf', 'mime': 'application/pdf', 'base64': pdf}))!;
    expect(f.name, 'Modulo 209.pdf');
    expect(f.mime, 'application/pdf');
    expect(utf8.decode(f.bytes), '%PDF-1.4 test');
  });

  test('CSV with charset parameter is accepted', () {
    final f = PageFile.parse(msg({'type': 'file', 'name': 'hamdi-requests.csv', 'mime': 'text/csv;charset=utf-8', 'base64': pdf}));
    expect(f?.mime, 'text/csv');
  });

  test('refuses unknown types, bad base64, empty files and other messages', () {
    expect(PageFile.parse(msg({'type': 'file', 'name': 'x.apk', 'mime': 'application/vnd.android.package-archive', 'base64': pdf})), isNull);
    expect(PageFile.parse(msg({'type': 'file', 'name': 'x.html', 'mime': 'text/html', 'base64': pdf})), isNull);
    expect(PageFile.parse(msg({'type': 'file', 'name': 'x.pdf', 'mime': 'application/pdf', 'base64': '***'})), isNull);
    expect(PageFile.parse(msg({'type': 'file', 'name': 'x.pdf', 'mime': 'application/pdf', 'base64': ''})), isNull);
    expect(PageFile.parse(msg({'type': 'other'})), isNull);
    expect(PageFile.parse('not json'), isNull);
  });

  test('refuses files over the size limit', () {
    final big = base64Encode(List.filled(PageFile.maxBytes + 1, 65));
    expect(PageFile.parse(msg({'type': 'file', 'name': 'big.pdf', 'mime': 'application/pdf', 'base64': big})), isNull);
  });

  test('file names lose folders and odd characters and get the right extension', () {
    expect(PageFile.safeName('../../etc/passwd', 'application/pdf'), 'passwd.pdf');
    expect(PageFile.safeName(r'C:\x\a<b>.pdf', 'application/pdf'), 'a_b_.pdf');
    expect(PageFile.safeName('.hidden', 'image/png'), 'hidden.png');
    expect(PageFile.safeName('', 'text/csv'), 'hamdi-file.csv');
    expect(PageFile.safeName('photo.jpeg', 'image/jpeg'), 'photo.jpeg');
    expect(PageFile.safeName('report.exe', 'application/pdf'), 'report.exe.pdf');
  });
}
