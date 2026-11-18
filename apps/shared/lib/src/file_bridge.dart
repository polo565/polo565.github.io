import 'dart:convert';

import 'package:flutter/services.dart';

/// A file the web page asks the app to save (admin downloads: documents, attachments, CSV).
///
/// The admin page sends `HamdiApp.postMessage(JSON.stringify({type:'file', name, mime, base64}))`
/// because an Android WebView cannot save the page's own blob downloads.
class PageFile {
  const PageFile({required this.name, required this.mime, required this.bytes});

  final String name;
  final String mime;
  final Uint8List bytes;

  /// Largest file accepted from the page (admin uploads are limited to 20 MB).
  static const maxBytes = 25 * 1024 * 1024;

  /// File types the admin site produces; anything else is refused.
  static const allowedMimes = {
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
  };

  /// Parses and checks a message from the page; returns null when it is not acceptable.
  static PageFile? parse(String message) {
    if (message.length > maxBytes * 4 ~/ 3 + 4096) return null;
    Object? data;
    try {
      data = jsonDecode(message);
    } catch (_) {
      return null;
    }
    if (data is! Map || data['type'] != 'file') return null;
    final mime = (data['mime'] is String ? data['mime'] as String : '').split(';').first.trim().toLowerCase();
    if (!allowedMimes.contains(mime)) return null;
    Uint8List bytes;
    try {
      bytes = base64Decode(data['base64'] as String);
    } catch (_) {
      return null;
    }
    if (bytes.isEmpty || bytes.length > maxBytes) return null;
    return PageFile(name: safeName(data['name'] is String ? data['name'] as String : '', mime), mime: mime, bytes: bytes);
  }

  static const _ext = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'text/csv': 'csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.oasis.opendocument.text': 'odt',
  };

  /// A file name without folders or odd characters, ending with the extension of its type.
  static String safeName(String raw, String mime) {
    var n = raw.split(RegExp(r'[\\/]')).last;
    n = n.replaceAll(RegExp(r'[\x00-\x1F<>:"|?*]'), '_').replaceAll(RegExp(r'^\.+'), '').trim();
    if (n.length > 100) n = n.substring(n.length - 100);
    final ext = _ext[mime] ?? 'bin';
    if (n.isEmpty) n = 'hamdi-file';
    if (!n.toLowerCase().endsWith('.$ext') && !(ext == 'jpg' && n.toLowerCase().endsWith('.jpeg'))) n = '$n.$ext';
    return n;
  }
}

/// Saves files on the phone. Implemented natively by the admin app (MediaStore → Downloads).
abstract class FileSaver {
  /// Saves the file and returns a handle to open it, or null on failure.
  Future<String?> save(PageFile file);

  /// Opens a saved file with another app; false when no app can open it.
  Future<bool> open(String handle, String mime);
}

/// [FileSaver] backed by the `hamdi/files` method channel of the host app.
class ChannelFileSaver implements FileSaver {
  const ChannelFileSaver();

  static const _channel = MethodChannel('hamdi/files');

  @override
  Future<String?> save(PageFile file) async {
    try {
      return await _channel.invokeMethod<String>('save', {'name': file.name, 'mime': file.mime, 'bytes': file.bytes});
    } catch (_) {
      return null;
    }
  }

  @override
  Future<bool> open(String handle, String mime) async {
    try {
      return await _channel.invokeMethod<bool>('open', {'uri': handle, 'mime': mime}) ?? false;
    } catch (_) {
      return false;
    }
  }
}
