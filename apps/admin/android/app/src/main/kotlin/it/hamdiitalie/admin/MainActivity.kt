package it.hamdiitalie.admin

import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Saves files handed over by the admin web page (documents, attachments, CSV exports)
 * into Downloads/HAMDI ITALIE through MediaStore (Android 10+, no storage permission),
 * and opens them with another app. The Dart side checks type, size and name first.
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "hamdi/files").setMethodCallHandler { call, result ->
            when (call.method) {
                "save" -> {
                    val name = call.argument<String>("name")
                    val mime = call.argument<String>("mime")
                    val bytes = call.argument<ByteArray>("bytes")
                    if (name == null || mime == null || bytes == null) {
                        result.success(null)
                    } else {
                        result.success(save(name, mime, bytes))
                    }
                }
                "open" -> result.success(open(call.argument<String>("uri"), call.argument<String>("mime")))
                else -> result.notImplemented()
            }
        }
    }

    private fun save(name: String, mime: String, bytes: ByteArray): String? {
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name)
            put(MediaStore.MediaColumns.MIME_TYPE, mime)
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/HAMDI ITALIE")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val resolver = contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
        return try {
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: throw IllegalStateException("no stream")
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            uri.toString()
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            null
        }
    }

    private fun open(uri: String?, mime: String?): Boolean {
        if (uri == null || !uri.startsWith("content://media/")) return false
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse(uri), mime ?: "*/*")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return try {
            startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (e: ActivityNotFoundException) {
            false
        }
    }
}
