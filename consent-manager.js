(function () {
  'use strict';

  const CONSENT_VERSION = 2;
  const GTM_ID = window.FG_GTM_ID || 'GTM-5DVGRHB2';
  const MAPS_API_KEY = window.FG_GOOGLE_MAPS_API_KEY || '';
  let gtmLoaded = false;
  let mapsLoaded = false;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // Google Consent Mode defaults: no analytics/advertising before a choice.
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  function loadGtm() {
    if (gtmLoaded || !GTM_ID) return;
    gtmLoaded = true;
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    document.head.appendChild(script);
  }

  function loadGoogleMaps() {
    if (mapsLoaded || !MAPS_API_KEY) return;
    mapsLoaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(MAPS_API_KEY) + '&libraries=places';
    script.addEventListener('load', function () {
      document.dispatchEvent(new CustomEvent('fg:mapsready'));
      if (typeof window.fgInitLeadPlaces === 'function') window.fgInitLeadPlaces();
    });
    document.head.appendChild(script);
  }

  function accepted(category) {
    return Boolean(window.CookieConsent && window.CookieConsent.acceptedCategory(category));
  }

  function decorateConsent() {
    const title = document.querySelector('.cm__title');
    if (!title || title.querySelector('.fg-consent-logo')) return;
    const img = document.createElement('img');
    img.src = '/images/fg-logo-gold-transparent.png';
    img.alt = 'Fischer & Geserich Real Estate';
    img.className = 'fg-consent-logo';
    title.prepend(img);
  }

  function applyConsent() {
    const analytics = accepted('analytics');
    const marketing = accepted('marketing');
    const external = accepted('external');

    window.gtag('consent', 'update', {
      analytics_storage: analytics ? 'granted' : 'denied',
      ad_storage: marketing ? 'granted' : 'denied',
      ad_user_data: marketing ? 'granted' : 'denied',
      ad_personalization: marketing ? 'granted' : 'denied'
    });

    // GTM itself is not requested before statistics/marketing consent.
    if (analytics || marketing) loadGtm();
    if (external) loadGoogleMaps();

    document.dispatchEvent(new CustomEvent('fg:consentchange', {
      detail: { analytics, marketing, external }
    }));
  }

  function start() {
    if (!window.CookieConsent) {
      window.setTimeout(start, 50);
      return;
    }

    window.CookieConsent.run({
      revision: CONSENT_VERSION,
      autoShow: true,
      disablePageInteraction: false,
      cookie: {
        name: 'fg_consent',
        expiresAfterDays: 182,
        sameSite: 'Lax',
        secure: location.protocol === 'https:'
      },
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: { autoClear: { cookies: [{ name: /^_ga/ }] } },
        marketing: { autoClear: { cookies: [{ name: /^_fbp$/ }, { name: /^_gcl/ }] } },
        external: {}
      },
      onModalReady: decorateConsent,
      onModalShow: decorateConsent,
      onFirstConsent: applyConsent,
      onConsent: applyConsent,
      onChange: applyConsent,
      language: {
        default: 'de',
        translations: {
          de: {
            consentModal: {
              title: 'Ihre Privatsphäre bei F&G',
              description: 'Diese Website ist sofort nutzbar. Notwendige Funktionen sind immer aktiv. Statistik, Marketing und externe Medien laden wir nur nach Ihrer freiwilligen Einwilligung.',
              acceptAllBtn: 'Alle akzeptieren',
              acceptNecessaryBtn: 'Nur notwendige',
              showPreferencesBtn: 'Einstellungen'
            },
            preferencesModal: {
              title: 'Datenschutz-Einstellungen',
              acceptAllBtn: 'Alle akzeptieren',
              acceptNecessaryBtn: 'Nur notwendige',
              savePreferencesBtn: 'Auswahl speichern',
              closeIconLabel: 'Schließen',
              sections: [
                { title: 'Einwilligung verwalten', description: 'Ihre Auswahl können Sie jederzeit über „Cookie-Einstellungen“ im Seitenfuß ändern oder widerrufen.' },
                { title: 'Notwendig', description: 'Erforderlich für Darstellung, Navigation, Formulare und Rechner. Diese Kategorie kann nicht deaktiviert werden.', linkedCategory: 'necessary' },
                { title: 'Statistik', description: 'Google Tag Manager und darüber eingebundene Statistikdienste wie Google Analytics werden erst nach Ihrer Einwilligung geladen.', linkedCategory: 'analytics' },
                { title: 'Marketing', description: 'Dienste zur Messung und Optimierung von Werbekampagnen werden erst nach Ihrer Einwilligung geladen.', linkedCategory: 'marketing' },
                { title: 'Externe Medien', description: 'Externe Karten, Videos oder vergleichbare Inhalte werden erst nach Ihrer Einwilligung geladen.', linkedCategory: 'external' },
                { title: 'Weitere Informationen', description: 'Details finden Sie in unserer <a href="/datenschutz.html">Datenschutzerklärung</a>.' }
              ]
            }
          }
        }
      },
      guiOptions: {
        consentModal: { layout: 'box wide', position: 'bottom center', equalWeightButtons: true, flipButtons: false },
        preferencesModal: { layout: 'box', position: 'right', equalWeightButtons: true, flipButtons: false }
      }
    });
  }

  document.addEventListener('click', function (event) {
    const button = event.target.closest('[data-open-consent]');
    if (!button) return;
    event.preventDefault();
    window.CookieConsent && window.CookieConsent.showPreferences();
  });

  start();
})();
