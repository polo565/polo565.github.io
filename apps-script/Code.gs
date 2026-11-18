/**
 * HAMDI ITALIE — backend (API only).
 *
 * The website is hosted on GitHub Pages (https://polo565.github.io/). This Apps Script
 * project serves no pages: it is the API the site calls.
 *   POST /exec  → JSON API, see backend/HttpApi.gs
 *   GET  /exec  → small JSON status (useful to check that the deployment is live)
 */
var SITE_URL = 'https://polo565.github.io/';

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ app: APP.NAME, api: 'ok', version: APP.VERSION, site: SITE_URL }))
    .setMimeType(ContentService.MimeType.JSON);
}
