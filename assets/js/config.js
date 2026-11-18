/*
 * HAMDI ITALIE — the ONLY place where the backend URL is set (public file: no secrets).
 *
 * API_URL is the Google Apps Script web app URL (…/exec). The site sends its requests
 * there; apps-script/HttpApi.gs answers them.
 *   - New VERSION of the same deployment → same URL → nothing to change.
 *   - NEW deployment (new URL) → change API_URL here, commit, push.
 */
window.HAMDI_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbz6p5Crqarz8AXC4wPVP85mjWthRdgzVjUCn4G3Q60Ob9F3jjmY7iF3S80-R6MHSrhj/exec'
};
