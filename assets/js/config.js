/*
 * HAMDI CAF — the ONLY place where the backend URL is set (public file: no secrets).
 *
 * API_URL = the "Web app" URL (…/exec) of the Apps Script project in apps-script/.
 * Copy it from Apps Script: Deploy → Manage deployments. Then run `node tools/stamp.js`,
 * commit and push.
 *   - New VERSION of the same deployment → same URL → nothing to change here.
 *   - NEW deployment → new URL → change it here.
 */
window.HAMDI_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxp2S16sgQ1DFJfuXA0PpZRjRveazyH-K9VYlcKjYM6kGQ7uYHU7GtYe5yk4PqhJDVuug/exec'
};
