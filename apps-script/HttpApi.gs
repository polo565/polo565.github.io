/**
 * HAMDI ITALIE — JSON API for the website hosted on GitHub Pages (polo565.github.io).
 *
 * TO INSTALL: add this file to the Apps Script project (editor → Files → + → Script,
 * name it "HttpApi", paste this content), then Deploy → Manage deployments → ✏ Edit →
 * Version: New version → Deploy. The /exec URL does not change.
 *
 * Request : POST <exec URL>, body (text/plain) = {"fn": "api_getHome", "args": []}
 * Response: {"ok": true, "result": …}  or  {"ok": false, "error": "CODE: message"}
 *
 * It exposes exactly the api_* functions that the HtmlService pages already call with
 * google.script.run — nothing more. Every check (admin session, roles, visitor tokens,
 * tracking codes, rate limits, uploads) stays inside those functions, on the server.
 * doGet (the original HtmlService site and the Android apps) is not affected.
 */

var HTTP_API_FN_ = /^api_[A-Za-z0-9]+(_[A-Za-z0-9]+)*$/;   // never a private name (trailing _)
var HTTP_API_MAX_CHARS_ = 45 * 1024 * 1024;                // uploads arrive as base64
var HTTP_API_MAX_ARGS_ = 8;

function doPost(e) {
  var out;
  try {
    var raw = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '';
    if (!raw || raw.length > HTTP_API_MAX_CHARS_) throw new Error('VALIDATION: Bad request.');
    var req;
    try { req = JSON.parse(raw); } catch (x) { throw new Error('VALIDATION: Bad request.'); }
    if (!req || typeof req !== 'object') throw new Error('VALIDATION: Bad request.');
    var fn = req.fn;
    var args = req.args === undefined ? [] : req.args;
    if (typeof fn !== 'string' || !HTTP_API_FN_.test(fn)) throw new Error('NOT_FOUND: Unknown function.');
    if (!Array.isArray(args) || args.length > HTTP_API_MAX_ARGS_) throw new Error('VALIDATION: Bad request.');
    var target = globalThis[fn];
    if (typeof target !== 'function') throw new Error('NOT_FOUND: Unknown function.');
    var result = target.apply(null, args);
    out = { ok: true, result: result === undefined ? null : result };
  } catch (err) {
    var msg = String((err && err.message) || err || '').replace(/^(Error|Exception):\s*/i, '');
    // api_* functions throw "CODE: message"; anything else is internal and stays hidden.
    if (!/^[A-Z][A-Z_]*: /.test(msg)) { console.error(err && err.stack ? err.stack : err); msg = 'INTERNAL: An error occurred.'; }
    out = { ok: false, error: msg };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
