(function(){
  const CONSENT_VERSION=1;
  const GA_ID='G-7GNF8PH36F';
  let analyticsLoaded=false;
  function loadAnalytics(){
    if(analyticsLoaded||!GA_ID)return; analyticsLoaded=true;
    window.dataLayer=window.dataLayer||[]; window.gtag=function(){dataLayer.push(arguments)};
    const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(GA_ID);document.head.appendChild(s);
    gtag('js',new Date());gtag('config',GA_ID,{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});
  }
  function disableAnalytics(){window['ga-disable-'+GA_ID]=true;}
  function decorateConsent(){const title=document.querySelector('.cm__title');if(title&&!title.querySelector('.fg-consent-logo')){const img=document.createElement('img');img.src='/images/fg-logo-gold-transparent.png';img.alt='Fischer & Geserich Real Estate';img.className='fg-consent-logo';title.prepend(img);}}
  function applyConsent(){decorateConsent();
    if(window.CookieConsent?.acceptedCategory('analytics')){window['ga-disable-'+GA_ID]=false;loadAnalytics();}
    else disableAnalytics();
    document.dispatchEvent(new CustomEvent('fg:consentchange',{detail:{analytics:window.CookieConsent?.acceptedCategory('analytics')||false,marketing:window.CookieConsent?.acceptedCategory('marketing')||false,external:window.CookieConsent?.acceptedCategory('external')||false}}));
  }
  function start(){
    if(!window.CookieConsent){setTimeout(start,60);return;}
    CookieConsent.run({revision:CONSENT_VERSION,autoShow:true,disablePageInteraction:false,cookie:{name:'fg_consent',expiresAfterDays:182,sameSite:'Lax'},onModalShow:decorateConsent,onFirstConsent:applyConsent,onConsent:applyConsent,onChange:applyConsent,
      categories:{necessary:{enabled:true,readOnly:true},analytics:{autoClear:{cookies:[{name:/^_ga/}]}},marketing:{autoClear:{cookies:[{name:/^_fbp$/},{name:/^_gcl/}]}},external:{}},
      language:{default:'de',translations:{de:{consentModal:{title:'Ihre Privatsphäre bei F&G',description:'Notwendige Funktionen sind immer aktiv. Statistik, Marketing und externe Medien laden wir nur nach Ihrer freiwilligen Einwilligung.',acceptAllBtn:'Alle akzeptieren',acceptNecessaryBtn:'Nur notwendige',showPreferencesBtn:'Einstellungen'},preferencesModal:{title:'Datenschutz-Einstellungen',acceptAllBtn:'Alle akzeptieren',acceptNecessaryBtn:'Nur notwendige',savePreferencesBtn:'Auswahl speichern',closeIconLabel:'Schließen',sections:[{title:'Einwilligung verwalten',description:'Sie können Ihre Auswahl jederzeit über den Link „Cookie-Einstellungen“ im Seitenfuß ändern oder widerrufen.'},{title:'Notwendig',description:'Erforderlich für Darstellung, Navigation, Formulare und Rechner. Diese Kategorie kann nicht deaktiviert werden.',linkedCategory:'necessary'},{title:'Statistik',description:'Hilft uns nach Einwilligung zu verstehen, welche Seiten und Funktionen genutzt werden. Aktuell: Google Analytics 4 mit IP-Anonymisierung.',linkedCategory:'analytics'},{title:'Marketing',description:'Dienste zur Messung und Optimierung von Werbekampagnen. Werden erst nach Einwilligung geladen.',linkedCategory:'marketing'},{title:'Externe Medien',description:'Externe Karten, Videos oder vergleichbare eingebettete Inhalte. Werden erst nach Einwilligung geladen.',linkedCategory:'external'},{title:'Weitere Informationen',description:'Details finden Sie in unserer <a href="/datenschutz.html">Datenschutzerklärung</a>.'}]}}}},guiOptions:{consentModal:{layout:'box wide',position:'bottom center',equalWeightButtons:true,flipButtons:false},preferencesModal:{layout:'box',position:'right',equalWeightButtons:true,flipButtons:false}}});
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-open-consent]');if(b){e.preventDefault();window.CookieConsent?.showPreferences();}});
  start();
})();
