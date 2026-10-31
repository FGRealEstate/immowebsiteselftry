/* F&G Redesign: Kopfbereich, Mobilmenü, Assistent auf Klick, Hero-Video, Einblendungen.
   Läuft auf allen Seiten; alles Seitenspezifische prüft zuerst, ob das Element existiert. */
(() => {
  'use strict';
  const doc = document.documentElement;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Kopfhöhe für ältere Stylesheets (Sticky-Seitenleisten) ---------- */
  const header = document.querySelector('[data-fg-site-header]');
  const syncHeaderHeight = () => {
    if (header) doc.style.setProperty('--fg-header-height', header.offsetHeight + 'px');
  };
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight, { passive: true });

  /* ---------- Desktop-Menü ---------- */
  const items = Array.from(document.querySelectorAll('[data-fgd-nav-item]'));
  const hoverCapable = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const setOpen = (item, open) => {
    item.classList.toggle('is-open', open);
    const trigger = item.querySelector('[data-fgd-nav-trigger]');
    if (trigger) trigger.setAttribute('aria-expanded', String(open));
  };
  const closeAll = (except) => items.forEach((item) => { if (item !== except) setOpen(item, false); });

  items.forEach((item) => {
    const trigger = item.querySelector('[data-fgd-nav-trigger]');
    let leaveTimer;
    trigger?.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      closeAll(item);
      setOpen(item, open);
    });
    if (hoverCapable) {
      item.addEventListener('mouseenter', () => { clearTimeout(leaveTimer); closeAll(item); setOpen(item, true); });
      item.addEventListener('mouseleave', () => { leaveTimer = setTimeout(() => setOpen(item, false), 160); });
    }
    item.addEventListener('focusout', (event) => {
      if (!item.contains(event.relatedTarget)) setOpen(item, false);
    });
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-fgd-nav-item]')) closeAll();
  });

  /* ---------- Mobilmenü ---------- */
  const burger = document.querySelector('[data-fgd-burger]');
  const mobile = document.getElementById('fgd-mobile');
  const setMobile = (open) => {
    if (!burger || !mobile) return;
    mobile.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    document.body.classList.toggle('fgd-menu-open', open);
    if (open) mobile.scrollTop = 0;
  };
  burger?.addEventListener('click', () => setMobile(mobile.hidden));
  mobile?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMobile(false)));
  window.addEventListener('resize', () => { if (window.innerWidth >= 1200) setMobile(false); }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = items.find((item) => item.classList.contains('is-open'));
    if (open) { setOpen(open, false); open.querySelector('[data-fgd-nav-trigger]')?.focus(); }
    if (mobile && !mobile.hidden) { setMobile(false); burger?.focus(); }
  });

  /* ---------- Assistent: Skripte erst beim ersten Klick laden ---------- */
  const assistantButton = document.querySelector('[data-fgd-assistant]');
  const assistantRoot = document.querySelector('[data-fg-ai-assistant]');
  const loadCss = (href) => new Promise((resolve) => {
    if (document.querySelector(`link[href="${href}"]`)) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.onload = resolve; link.onerror = resolve;
    document.head.appendChild(link);
  });
  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src; script.onload = resolve; script.onerror = reject;
    document.body.appendChild(script);
  });
  let assistantState = 'idle';
  assistantButton?.addEventListener('click', async () => {
    const realLauncher = () => assistantRoot?.querySelector('[data-fg-ai-launcher]');
    if (assistantState === 'ready') { realLauncher()?.click(); return; }
    if (assistantState === 'loading' || !assistantRoot) return;
    assistantState = 'loading';
    assistantButton.classList.add('is-loading');
    assistantButton.setAttribute('aria-busy', 'true');
    try {
      await Promise.all([loadCss('/fg-assistant.css'), loadCss('/vendor/fontawesome/css/all.min.css')]);
      await loadScript('/fg-knowledge.js');
      await loadScript('/fg-assistant.js');
      assistantRoot.hidden = false;
      assistantState = 'ready';
      realLauncher()?.click();
    } catch (error) {
      assistantState = 'idle';
    } finally {
      assistantButton.classList.remove('is-loading');
      assistantButton.removeAttribute('aria-busy');
      updateLauncher();
    }
  });

  /* Handy: Der Startknopf erscheint erst nach einem halben Bildschirm, damit er im ersten Bildschirm keinen Button verdeckt.
     Das CSS verbirgt ihn dort von Anfang an (html.fgd-js), damit beim Laden nichts aufblitzt; ohne JS bleibt er sichtbar.
     Kurze Seiten und ein schon geöffneter Assistent zeigen ihn immer. */
  /* Design-Pass 2 (Entscheidungen 29.10.2026, Blatt 6): am Handy blendet er beim Runterscrollen aus und beim Hochscrollen
     wieder ein. Kleine Bewegungen unter 8 px ändern die Richtung nicht, damit er nicht flackert. */
  const narrowScreen = window.matchMedia('(max-width: 639px)');
  let lastY = window.scrollY;
  let scrollingUp = false;
  function updateLauncher() {
    if (!assistantButton) return;
    const y = window.scrollY;
    if (y > lastY + 8) { scrollingUp = false; lastY = y; }
    else if (y < lastY - 8) { scrollingUp = true; lastY = y; }
    const room = document.documentElement.scrollHeight - window.innerHeight;
    const show = !narrowScreen.matches || assistantState !== 'idle' || room < window.innerHeight * 0.5 || (y > window.innerHeight * 0.5 && scrollingUp);
    assistantButton.classList.toggle('is-shown', show);
  }
  if (assistantButton) {
    updateLauncher();
    window.addEventListener('scroll', updateLauncher, { passive: true });
    window.addEventListener('resize', updateLauncher, { passive: true });
  }

  /* Unter 768 px (Update 7, Frage 15): auf /immobilienbewertung/ kein Startknopf, sonst ausgeblendet,
     solange ein Seitenabschnitt mit Formular im Bild ist. Der Assistent selbst zählt nicht als Formular. */
  const formScreen = window.matchMedia('(max-width: 767px)');
  const noLauncherPage = location.pathname.startsWith('/immobilienbewertung/');
  const formsInView = new Set();
  function updateFormHide() {
    if (!assistantButton) return;
    assistantButton.classList.toggle('is-form-hidden', formScreen.matches && (noLauncherPage || formsInView.size > 0));
  }
  if (assistantButton) {
    const formSections = new Set([...document.querySelectorAll('form')]
      .filter((form) => !form.closest('.fg-ai-assistant'))
      .map((form) => form.closest('section') || form));
    if (formSections.size && 'IntersectionObserver' in window) {
      const formObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) formsInView.add(entry.target); else formsInView.delete(entry.target); });
        updateFormHide();
      });
      formSections.forEach((section) => formObserver.observe(section));
    }
    updateFormHide();
    formScreen.addEventListener('change', updateFormHide);
  }

  /* ---------- Hero-Video: erst nach dem Posterbild laden ---------- */
  const video = document.querySelector('[data-fgd-hero-video]');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (video && !reduceMotion && !saveData) {
    const start = () => {
      video.src = video.dataset.src;
      video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
      const attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(() => {});
    };
    if (document.readyState === 'complete') setTimeout(start, 300);
    else window.addEventListener('load', () => setTimeout(start, 300), { once: true });
  }

  /* ---------- FAQ: „Eigene Frage stellen“ (an website-question) ---------- */
  const faqToggle = document.querySelector('[data-faq-question-toggle]');
  const faqPanel = document.getElementById('faq-question-panel');
  const faqForm = document.querySelector('[data-faq-question-form]');
  const faqStatus = document.querySelector('[data-faq-question-status]');
  faqToggle?.addEventListener('click', () => {
    if (!faqPanel) return;
    const willOpen = faqPanel.hidden;
    faqPanel.hidden = !willOpen;
    faqToggle.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) requestAnimationFrame(() => faqPanel.querySelector('input[name="name"]')?.focus({ preventScroll: true }));
  });
  faqForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!faqForm.reportValidity()) return;
    const submit = faqForm.querySelector('button[type="submit"]');
    const original = submit.innerHTML;
    submit.disabled = true;
    submit.textContent = 'Wird gesendet …';
    if (faqStatus) faqStatus.hidden = true;
    const fd = new FormData(faqForm);
    const payload = {
      name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), question: fd.get('question'),
      company_website: fd.get('company_website'), privacy_consent: fd.get('privacy_consent') === 'true',
      source_url: location.href.split('#')[0] + '#faq'
    };
    try {
      const response = await fetch('/.netlify/functions/website-question', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Versand fehlgeschlagen');
      faqForm.reset();
      if (faqStatus) { faqStatus.className = 'fgd-status is-success'; faqStatus.textContent = 'Vielen Dank. Ihre Frage wurde direkt an uns gesendet.'; faqStatus.hidden = false; }
    } catch (error) {
      if (faqStatus) { faqStatus.className = 'fgd-status is-error'; faqStatus.textContent = 'Die Nachricht konnte gerade nicht versendet werden. Bitte schreiben Sie an info@fg-realestate.de.'; faqStatus.hidden = false; }
    } finally {
      submit.disabled = false;
      submit.innerHTML = original;
    }
  });

  /* ---------- Bewertung: Felder je Objektart (Update 19 §5) ----------
     data-fgd-nicht="Typ|Typ" an einem Feld: bei diesen Objektarten ausgeblendet und abgeschaltet, damit es
     nicht mitgeschickt wird. Bei „Grundstück“ heißt Schritt 3 so, wie data-fgd-step-grundstueck und
     data-fgd-legende-grundstueck es sagen. Ohne Skript bleiben alle Felder sichtbar. */
  document.querySelectorAll('[data-fgd-wizard]').forEach((form) => {
    const felder = [...form.querySelectorAll('[data-fgd-nicht]')];
    if (!felder.length) return;
    const step = form.querySelector('[data-fgd-step-grundstueck]');
    const legend = step ? step.querySelector('legend') : null;
    const nameLi = step ? form.querySelectorAll('.fgd-wizard-names li')[[...form.querySelectorAll('[data-fgd-step]')].indexOf(step)] : null;
    const normal = step ? { name: step.dataset.fgdStep, legend: legend ? legend.textContent : '' } : null;
    const apply = () => {
      const checked = form.querySelector('input[name="object_type"]:checked');
      const typ = checked ? checked.value : '';
      felder.forEach((feld) => {
        const aus = feld.dataset.fgdNicht.split('|').includes(typ);
        feld.hidden = aus;
        feld.querySelectorAll('input, select, textarea').forEach((el) => { el.disabled = aus; });
      });
      if (!step) return;
      const plot = typ === 'Grundstück';
      step.dataset.fgdStep = plot ? step.dataset.fgdStepGrundstueck : normal.name;
      if (legend) legend.textContent = plot ? step.dataset.fgdLegendeGrundstueck : normal.legend;
      if (nameLi) nameLi.textContent = step.dataset.fgdStep;
    };
    form.addEventListener('change', (event) => { if (event.target.name === 'object_type') apply(); });
    apply();
  });

  /* ---------- Bewertung in fünf Schritten (immobilienbewertung.njk) ----------
     <form data-fgd-wizard> mit <fieldset data-fgd-step="Name"> je Schritt. Ohne Skript bleibt es ein
     Formular mit allen Feldern. Mit Skript: ein Schritt sichtbar, Fortschritt oben, Weiter prüft nur die
     Felder des Schritts. Die Antworten bleiben im Formular (kein Speicher im Browser), Feldnamen und
     Versand macht unverändert der Block [data-fgd-lead-form] weiter unten. Der Submit-Listener hier läuft
     zuerst (Capture) und hält Absenden zurück, solange nicht der letzte Schritt offen ist. */
  document.querySelectorAll('[data-fgd-wizard]').forEach((form) => {
    const steps = [...form.querySelectorAll('[data-fgd-step]')];
    if (steps.length < 2) return;
    const progress = form.querySelector('[data-fgd-wizard-progress]');
    const nr = form.querySelector('[data-fgd-wizard-nr]');
    const name = form.querySelector('[data-fgd-wizard-name]');
    const bar = form.querySelector('.fgd-wizard-bar');
    const names = [...form.querySelectorAll('.fgd-wizard-names li')];
    const back = form.querySelector('[data-fgd-wizard-back]');
    const next = form.querySelector('[data-fgd-wizard-next]');
    const submit = form.querySelector('button[type="submit"]');
    const fields = (step) => [...step.querySelectorAll('input, select, textarea')].filter((el) => el.name && el.name !== 'company_website');
    let current = 0;
    const show = (index, moveFocus) => {
      current = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((step, i) => { step.hidden = i !== current; });
      const label = steps[current].dataset.fgdStep;
      if (nr) nr.textContent = String(current + 1);
      if (name) name.textContent = label;
      if (bar) {
        bar.setAttribute('aria-valuenow', String(current + 1));
        bar.setAttribute('aria-valuetext', `Schritt ${current + 1} von ${steps.length}: ${label}`);
        const fill = bar.querySelector('span');
        if (fill) fill.style.width = `${((current + 1) / steps.length) * 100}%`;
      }
      names.forEach((li, i) => { li.classList.toggle('is-current', i === current); li.classList.toggle('is-done', i < current); });
      if (back) back.hidden = current === 0;
      if (next) next.hidden = current === steps.length - 1;
      if (submit) submit.hidden = current !== steps.length - 1;
      if (!moveFocus) return;
      const legend = steps[current].querySelector('legend');
      if (legend) { legend.tabIndex = -1; legend.focus({ preventScroll: true }); }
      // Fortschritt soll nach dem Wechsel unter dem Sticky-Kopf sichtbar sein (scroll-padding-top am html)
      const pad = parseFloat(getComputedStyle(doc).scrollPaddingTop) || 0;
      if (form.getBoundingClientRect().top < pad) form.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    // Erstes ungültiges Feld eines Schritts melden; true, wenn alles passt
    const check = (index) => {
      const bad = fields(steps[index]).find((el) => !el.checkValidity());
      if (!bad) return true;
      show(index, false);
      bad.reportValidity();
      return false;
    };
    const forward = () => { if (check(current)) show(current + 1, true); };
    if (progress) progress.hidden = false;
    if (back) back.addEventListener('click', () => show(current - 1, true));
    if (next) next.addEventListener('click', forward);
    form.addEventListener('submit', (event) => {
      const last = current === steps.length - 1;
      // Im letzten Schritt alle Schritte prüfen; every() hält beim ersten Fehler an und zeigt diesen Schritt
      if (last && steps.every((step, i) => check(i))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!last) forward();
    }, true);
    show(0, false);
  });

  /* ---------- Anfrageformulare im neuen Design (an propstack-lead) ----------
     <form data-fgd-lead-form data-concern="…"> mit Feldern first_name, last_name, email, phone,
     optional concern (Auswahl), object_type, location, timeframe, message und property_details[…].
     Pflicht laut Funktion: Vorname, Nachname, E-Mail, Anliegen, Datenschutz.
     Eine Auswahl-Option mit data-endpoint="website-question" (Kontakt: „Sonstiges“) geht stattdessen an
     website-question, weil propstack-lead ohne erkennbares Anliegen ablehnt. */
  document.querySelectorAll('[data-fgd-lead-form]').forEach((form) => {
    const status = form.querySelector('[data-fgd-lead-status]');
    const done = form.parentElement.querySelector('[data-fgd-lead-done]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      const showDone = () => { form.hidden = true; if (done) { done.hidden = false; done.focus?.(); } };
      if (fd.get('company_website')) { showDone(); return; }
      submit.disabled = true;
      submit.textContent = 'Wird gesendet …';
      if (status) status.hidden = true;
      const details = {};
      const extra = [];
      for (const [key, value] of fd.entries()) {
        const match = key.match(/^property_details\[(.+)\]$/);
        if (match && String(value).trim()) details[match[1]] = String(value).trim();
        if (key.startsWith('extra:') && String(value).trim()) extra.push(`${key.slice(6)}: ${String(value).trim()}`);
      }
      // Nur Formulare mit data-form-type (Gewerbe, Update 5): Kennung in den Objektdaten, damit sie in Propstack
      // in Notiz und Rohdaten steht. Alle anderen Formulare schicken unverändert dieselbe Nutzlast.
      if (form.dataset.formType) details.form_type = form.dataset.formType;
      const params = new URLSearchParams(location.search);
      const message = [fd.get('message'), ...extra].filter((v) => v && String(v).trim()).join('\n');
      const chosen = form.querySelector('select[name="concern"]')?.selectedOptions[0];
      const toQuestion = chosen?.dataset.endpoint === 'website-question';
      const endpoint = toQuestion ? 'website-question' : 'propstack-lead';
      const payload = toQuestion ? {
        name: [fd.get('first_name'), fd.get('last_name')].filter(Boolean).join(' '), email: fd.get('email'), phone: fd.get('phone') || '',
        question: `Thema: ${chosen.textContent.trim()}\n${message}`, company_website: '', privacy_consent: fd.get('privacy_consent') === 'true',
        source_url: location.href
      } : {
        first_name: fd.get('first_name'), last_name: fd.get('last_name'), email: fd.get('email'), phone: fd.get('phone') || '',
        concern: fd.get('concern') || form.dataset.concern || '',
        object_type: fd.get('object_type') || '', location: fd.get('location') || '', budget: fd.get('budget') || '',
        timeframe: fd.get('timeframe') || '', contact_preference: fd.get('contact_preference') || (fd.get('phone') ? 'Telefon' : 'E-Mail'),
        message, privacy_consent: fd.get('privacy_consent') === 'true', property_details: details,
        source_url: location.href,
        utm_source: params.get('utm_source') || '', utm_medium: params.get('utm_medium') || '', utm_campaign: params.get('utm_campaign') || '',
        utm_content: params.get('utm_content') || '', utm_term: params.get('utm_term') || ''
      };
      try {
        const response = await fetch(`/.netlify/functions/${endpoint}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || 'Versand fehlgeschlagen');
        form.reset();
        showDone();
      } catch (error) {
        if (status) {
          status.className = 'fgd-status is-error';
          status.textContent = 'Die Anfrage konnte gerade nicht gesendet werden. Bitte rufen Sie uns an oder schreiben Sie an info@fg-realestate.de.';
          status.hidden = false;
        }
      } finally {
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
  });

  /* ---------- Bewertung: Nachfrage aus der Bestätigungsmail (Update 19 §5) ----------
     /immobilienbewertung/nachfrage/?k=…&typ=…&gf=1. Zeigt die Fragen für alle und die zur Objektart (typ);
     gf=1 blendet die Grundstücksgröße aus, weil sie schon in der ersten Anfrage stand. Ohne k gibt es keinen
     Versand, sondern den Hinweis auf den Link aus der E-Mail. Versand als JSON an bewertung-nachfrage. */
  document.querySelectorAll('[data-fgd-nachfrage-form]').forEach((form) => {
    const card = form.parentElement;
    const status = form.querySelector('[data-fgd-nachfrage-status]');
    const done = card.querySelector('[data-fgd-nachfrage-done]');
    const params = new URLSearchParams(location.search);
    const k = params.get('k') || '';
    const typ = params.get('typ') || '';
    const abschalten = (el, aus) => {
      el.hidden = aus;
      el.querySelectorAll('input, select, textarea').forEach((feld) => { feld.disabled = aus; });
    };
    if (!k) {
      form.hidden = true;
      const ohne = card.querySelector('[data-fgd-nachfrage-ohne-link]');
      if (ohne) ohne.hidden = false;
      return;
    }
    form.elements.k.value = k;
    form.elements.typ.value = typ;
    const gruppen = [...form.querySelectorAll('[data-fgd-nachfrage-typ]')];
    // Unbekannte Objektart: alle Fragen zeigen; Grundstück und Gewerbe: nur die Frage für alle
    if (gruppen.some((g) => g.dataset.fgdNachfrageTyp === typ) || typ === 'grundstueck' || typ === 'gewerbe') {
      gruppen.forEach((g) => abschalten(g, g.dataset.fgdNachfrageTyp !== typ));
    }
    if (params.get('gf') === '1') form.querySelectorAll('[data-fgd-nachfrage-ohne-gf]').forEach((el) => abschalten(el, true));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      const showDone = () => { form.hidden = true; if (done) { done.hidden = false; done.focus?.(); } };
      if (fd.get('company_website')) { showDone(); return; }
      const payload = {};
      for (const key of new Set(fd.keys())) {
        payload[key] = ['wohnung_aussen', 'haus_aussen'].includes(key) ? fd.getAll(key) : String(fd.get(key)).trim();
      }
      submit.disabled = true;
      submit.textContent = 'Wird gesendet …';
      if (status) status.hidden = true;
      try {
        const response = await fetch('/.netlify/functions/bewertung-nachfrage', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || 'Versand fehlgeschlagen');
        form.reset();
        showDone();
      } catch (error) {
        if (status) {
          status.className = 'fgd-status is-error';
          status.textContent = meldung(error.message);
          status.hidden = false;
        }
      } finally {
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
    // Meldungen der Funktion zu Eingaben zeigen wir wörtlich, alles andere als allgemeiner Hinweis
    function meldung(message) {
      return /^(Bitte|Der Link|Unbekannte|Eine Zahl|Die Angabe)/.test(message || '')
        ? message
        : 'Die Antworten konnten gerade nicht gesendet werden. Bitte rufen Sie uns an oder schreiben Sie an info@fg-realestate.de.';
    }
  });

  /* Suchprofil (Kaufen, Mieten, Gesuch anlegen): gleicher Versand und gleiche Felder wie das alte
     search-profile-form.njk, Ziel /.netlify/functions/propstack-search-profile.
     Pflicht laut Funktion: E-Mail, Suchgebiet, Einwilligung. */
  document.querySelectorAll('[data-fgd-search-form]').forEach((form) => {
    const status = form.querySelector('[data-fgd-search-status]');
    const done = form.parentElement.querySelector('[data-fgd-search-done]');
    form.querySelectorAll('[data-fgd-num]').forEach((input) => {
      input.addEventListener('input', () => { input.value = input.value.replace(/[^\d.,]/g, ''); });
    });
    /* Felder nach Objektart (Timon, 31.10.2026): Grundstück ohne Wohnfläche und Zimmer, Mehrfamilienhaus mit Einheiten
       und Bruttorendite statt Zimmern. Was nicht passt, wird ausgeblendet und deaktiviert, geht also nicht mit. */
    const typeSelect = form.querySelector('select[name="property_type"]');
    const applyType = () => {
      const type = typeSelect ? typeSelect.value : '';
      form.querySelectorAll('[data-fgd-for]').forEach((field) => {
        const show = field.dataset.fgdFor.split(' ').includes(type);
        field.hidden = !show;
        field.querySelectorAll('input').forEach((input) => { input.disabled = !show; });
      });
      form.querySelectorAll('[data-fgd-label-gewerbe]').forEach((field) => {
        const text = field.querySelector('[data-fgd-label]');
        if (!text) return;
        if (!text.dataset.default) text.dataset.default = text.textContent;
        text.textContent = type === 'Gewerbe' ? field.dataset.fgdLabelGewerbe : text.dataset.default;
      });
      // Beispielwert („z. B. 80“) nur bei Wohnung, Haus, Kapitalanlage; beim Mehrfamilienhaus und Gewerbe passt er nicht
      form.querySelectorAll('[data-fgd-ph-for]').forEach((input) => {
        if (!input.dataset.ph) input.dataset.ph = input.placeholder;
        input.placeholder = input.dataset.fgdPhFor.split(' ').includes(type) ? input.dataset.ph : 'optional';
      });
    };
    if (typeSelect) {
      typeSelect.addEventListener('change', applyType);
      form.addEventListener('reset', () => setTimeout(applyType));
      applyType();
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      const showDone = () => { form.hidden = true; if (done) { done.hidden = false; done.focus?.(); } };
      if (fd.get('company_website')) { showDone(); return; }
      submit.disabled = true;
      submit.textContent = 'Wird übermittelt …';
      if (status) status.hidden = true;
      const params = new URLSearchParams(location.search);
      const consent = fd.get('privacy_consent') === 'true';
      const payload = {
        first_name: fd.get('first_name'), last_name: fd.get('last_name'), email: fd.get('email'), phone: fd.get('phone'),
        marketing_type: fd.get('marketing_type') || form.dataset.marketingType || 'BUY', property_type: fd.get('property_type'),
        location: fd.get('location'), budget: fd.get('budget'), rooms: fd.get('rooms'), living_space: fd.get('living_space'),
        bedrooms: fd.get('bedrooms'), bathrooms: fd.get('bathrooms'), plot_area: fd.get('plot_area'),
        units: fd.get('units'), gross_yield: fd.get('gross_yield'),
        features: fd.getAll('features'), message: fd.get('message'),
        privacy_consent: consent, newsletter_consent: consent, source_url: location.href,
        utm_source: params.get('utm_source') || '', utm_medium: params.get('utm_medium') || '', utm_campaign: params.get('utm_campaign') || '',
        utm_content: params.get('utm_content') || '', utm_term: params.get('utm_term') || ''
      };
      try {
        const response = await fetch('/.netlify/functions/propstack-search-profile', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || 'Versand fehlgeschlagen');
        form.reset();
        showDone();
      } catch (error) {
        if (status) {
          status.className = 'fgd-status is-error';
          status.textContent = 'Das Suchprofil konnte gerade nicht übermittelt werden. Bitte rufen Sie uns an oder schreiben Sie an info@fg-realestate.de.';
          status.hidden = false;
        }
      } finally {
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
  });

  /* ---------- Kaufpreisrahmen-Rechner (Finanzierung) ----------
     Gleiche Rechnung wie der bisherige Rechner in script.js: Darlehen = Rate × 12 / (Zins + Tilgung),
     Kaufpreis = (Darlehen + Eigenkapital) / (1 + Nebenkosten). */
  document.querySelectorAll('[data-fgd-afford]').forEach((root) => {
    const form = root.querySelector('form');
    const out = root.querySelector('[data-fgd-afford-result]');
    if (!form || !out) return;
    // Tausenderpunkt (Update 4, 27.10.2026): ohne Komma ist „2.450“ 2450; in Prozentfeldern (pct) bleibt der Punkt ein Dezimalpunkt.
    const num = (v, pct) => { let s = String(v || '').replace(/\s|€|%/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (!pct && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); return parseFloat(s) || 0; };
    const eur = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
    const kpi = (label, value, note, main) => `<div class="fgd-calc-kpi${main ? ' fgd-calc-kpi--main' : ''}"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`;
    const run = () => {
      const fd = new FormData(form);
      const rate = num(fd.get('rate')), eq = num(fd.get('equity'));
      const i = num(fd.get('interest'), true) / 100, t = num(fd.get('repay'), true) / 100, c = num(fd.get('costs'), true) / 100;
      if (i + t <= 0) { out.innerHTML = '<p class="fgd-calc-hint">Bitte geben Sie Sollzins und Tilgung ein.</p>'; return; }
      const loan = rate * 12 / (i + t);
      const price = (loan + eq) / (1 + c);
      out.innerHTML = kpi('Möglicher Kaufpreis', eur(price), 'erste Orientierung', true)
        + kpi('Darlehensrahmen', eur(loan)) + kpi('Gesamtbudget inkl. Nebenkosten', eur(price * (1 + c))) + kpi('Monatliche Rate', eur(rate));
    };
    form.addEventListener('submit', (event) => { event.preventDefault(); run(); });
    run();
  });

  /* ---------- Widgets der Finanzierungsplattform (Update 5, Abschnitt 2) ----------
     Der Einbettungscode steht in <template data-fgd-widget-code> (_includes/fgd-widget.njk). Er lädt nur
     mit Einwilligung in „Externe Medien“ und erst, wenn der Abschnitt in die Nähe des Bildschirms kommt.
     „Rechner laden“ im Platzhalter erteilt diese Einwilligung im Consent-Manager (die übrigen Kategorien
     bleiben, wie sie sind) und schickt `widget_open` an den dataLayer. */
  const widgets = Array.from(document.querySelectorAll('[data-fgd-widget]'));
  if (widgets.length) {
    const consentExternal = () => Boolean(window.CookieConsent && window.CookieConsent.acceptedCategory('external'));
    const near = new Set();
    const loadWidget = (root) => {
      if (root.dataset.loaded) return;
      const tpl = root.querySelector('template[data-fgd-widget-code]');
      const frame = root.querySelector('[data-fgd-widget-frame]');
      if (!tpl || !frame) return;
      root.dataset.loaded = '1';
      // Erst das Markup einsetzen, dann die Skripte einzeln in ihrer Reihenfolge: ein Inline-Skript nach
      // einem externen läuft erst, wenn das externe geladen ist (wie beim Einbetten direkt im HTML).
      const frag = document.importNode(tpl.content, true);
      const marks = Array.from(frag.querySelectorAll('script')).map((old) => {
        const mark = document.createComment('widget-script');
        old.replaceWith(mark);
        return { mark, old };
      });
      frame.appendChild(frag);
      const next = (i) => {
        if (i >= marks.length) return;
        const { mark, old } = marks[i];
        const s = document.createElement('script');
        Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
        s.text = old.text;
        if (s.src) {
          s.async = false;
          s.addEventListener('load', () => next(i + 1));
          s.addEventListener('error', () => next(i + 1));
          mark.replaceWith(s);
        } else {
          mark.replaceWith(s);
          next(i + 1);
        }
      };
      next(0);
      frame.hidden = false;
      root.querySelector('[data-fgd-widget-ph]').hidden = true;
    };
    const loadNear = () => { if (consentExternal()) widgets.forEach((w) => { if (near.has(w)) loadWidget(w); }); };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) { near.add(entry.target); io.unobserve(entry.target); } });
        loadNear();
      }, { rootMargin: '400px 0px' });
      widgets.forEach((w) => io.observe(w));
    } else {
      widgets.forEach((w) => near.add(w));
    }
    document.addEventListener('fg:consentchange', (event) => { if (event.detail && event.detail.external) loadNear(); });
    // Einwilligung aus einem früheren Besuch: Der Consent-Manager meldet sie beim Start; falls er schon fertig war, hier nachholen.
    window.setTimeout(loadNear, 0);

    widgets.forEach((root) => {
      const button = root.querySelector('[data-fgd-widget-load]');
      if (!button) return;
      button.addEventListener('click', () => {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'widget_open', widget_name: root.dataset.widgetName || '' });
        const cc = window.CookieConsent;
        if (cc && !consentExternal()) {
          const prefs = cc.getUserPreferences ? cc.getUserPreferences() : { acceptedCategories: [] };
          cc.acceptCategory(Array.from(new Set((prefs.acceptedCategories || []).concat('external'))));
          if (cc.hide) cc.hide();
        }
        if (consentExternal()) loadWidget(root);
      });
    });

    /* Lead-Messung: nur wenn _data/finanzWidgets.js leadMessage kennt (data-lead-origin, data-lead-match).
       Mit ?widgetdebug=1 schreibt die Seite jede Browser-Nachricht in die Konsole, um das Format zu finden. */
    const debug = /[?&]widgetdebug=1\b/.test(location.search);
    const leadRoots = widgets.filter((w) => w.dataset.leadOrigin && w.dataset.leadMatch);
    if (leadRoots.length || debug) {
      let last = 0;
      window.addEventListener('message', (event) => {
        let text = '';
        try { text = typeof event.data === 'string' ? event.data : JSON.stringify(event.data); } catch (err) { text = ''; }
        if (debug) console.log('[widgetdebug]', event.origin, event.data);
        const hits = leadRoots.filter((w) => w.dataset.leadOrigin === event.origin && text.indexOf(w.dataset.leadMatch) !== -1);
        // Beide Widgets kommen vom selben Anbieter: zuordnen über das iframe, das die Nachricht geschickt hat.
        const root = hits.find((w) => Array.from(w.querySelectorAll('iframe')).some((f) => f.contentWindow === event.source)) || hits[0];
        if (!root || Date.now() - last < 3000) return;
        last = Date.now();
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'generate_lead', form_type: 'finanzierungswidget', widget_name: root.dataset.widgetName || '' });
      });
    }
  }

  /* ---------- Einblendungen beim Scrollen ---------- */
  const reveals = Array.from(document.querySelectorAll('.fgd-reveal'));
  if (reveals.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveals.forEach((el) => el.classList.add('is-in'));
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer.unobserve(entry.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      reveals.forEach((el) => observer.observe(el));
    }
  }

  /* ---------- Peer, Sichtprüfung 31.10.2026: Ein Wort steht auf einer Zeile (CSS: hyphens: none). Nur ein Wort, das allein
     breiter ist als seine Zeile, wird getrennt, und dann an einer Silbe mit Trennstrich statt irgendwo: Es bekommt eine Hülle
     .fgs-trenn mit hyphens: auto. Erkannt wird es daran, dass seine Buchstaben auf zwei Zeilen liegen (das passiert mit
     hyphens: none nur, wenn overflow-wrap ein zu langes Wort bricht). In Überschriften wird vorher die Schrift verkleinert,
     höchstens auf 60 %: Passt das Wort dann, bleibt es ganz („FINANZIERUNG“, „IMMOBILIENBEWERTUNG“ in der schmalen
     Kopfspalte der Fragen bei 1.440 px); erst ein Wort, das auch so nicht passt, wird getrennt. Gemessen wird das Wort mit
     anhängendem Satzzeichen oder Bindestrich („Mietpreisbremse:“, „Charlottenburg-“), sonst rutscht das Zeichen allein in
     die nächste Zeile. Geprüft nach dem Laden der Schriften, bei neuer Breite, wenn ein
     aufklappbarer Bereich aufgeht und wenn fgs-motion.js eine Überschrift neu in Zeilen teilt (fgs:zeilen). ---------- */
  const SKIP = 'script, style, noscript, template, svg, textarea, code, pre, [contenteditable]';
  const range = document.createRange();
  const zeilen = (rects) => {
    const tops = [];
    for (const r of rects) if (r.width > 0.5 && !tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
    return tops.length;
  };
  const KOPF = 'h1, h2, h3, h4, [data-fgs-lines]';
  const KLEINST = 0.6;
  const breite = (rects) => Array.from(rects).reduce((s, r) => s + r.width, 0);
  const gebrochen = (n, a, b) => { range.setStart(n, a); range.setEnd(n, b); return zeilen(range.getClientRects()) > 1; };
  const trennen = () => {
    document.querySelectorAll('[data-fgs-passt]').forEach((k) => { k.style.fontSize = ''; k.removeAttribute('data-fgs-passt'); });
    document.querySelectorAll('.fgs-trenn.is-an').forEach((s) => s.classList.remove('is-an'));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.length >= 8 && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const treffer = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const re = /[^\s\-‐–]*[\p{L}­]{8,}[^\s\-‐–]*[\-‐–]?/gu;
      for (let m = re.exec(n.nodeValue); m; m = re.exec(n.nodeValue)) {
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const rects = range.getClientRects();
        if (zeilen(rects) > 1) treffer.push({ n, a: m.index, b: m.index + m[0].length, w: breite(rects), kopf: n.parentElement.closest(KOPF) });
      }
    }
    // Überschriften: kleinster nötiger Faktor über alle zu breiten Wörter; reicht 80 %, wird die Schrift so weit verkleinert
    const koepfe = new Map();
    treffer.forEach((t) => { if (t.kopf) koepfe.set(t.kopf, [...(koepfe.get(t.kopf) || []), t]); });
    const geloest = new Set();
    koepfe.forEach((liste, k) => {
      const cs = getComputedStyle(k);
      const frei = k.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const faktor = Math.min(...liste.map((t) => frei / t.w));
      if (!(faktor >= KLEINST && faktor < 1)) return;
      const groesse = parseFloat(cs.fontSize);
      k.style.fontSize = Math.floor(groesse * faktor * 0.985 * 10) / 10 + 'px';
      if (liste.some((t) => gebrochen(t.n, t.a, t.b))) { k.style.fontSize = ''; return; }
      k.setAttribute('data-fgs-passt', '');
      liste.forEach((t) => geloest.add(t));
    });
    // übrige: an einer Silbe trennen; von hinten, damit die Stellen im Textknoten gültig bleiben
    const proKnoten = new Map();
    treffer.filter((t) => !geloest.has(t)).forEach((t) => proKnoten.set(t.n, [...(proKnoten.get(t.n) || []), t]));
    proKnoten.forEach((stellen, n) => {
      const p = n.parentElement;
      if (p.classList.contains('fgs-trenn') && p.childNodes.length === 1) { p.classList.add('is-an'); return; }
      for (let i = stellen.length - 1; i >= 0; i--) {
        const { a, b } = stellen[i];
        n.splitText(b);
        const wort = n.splitText(a);
        const huelle = document.createElement('span');
        huelle.className = 'fgs-trenn is-an';
        wort.replaceWith(huelle);
        huelle.appendChild(wort);
      }
    });
  };
  let trennBreite = window.innerWidth;
  let trennTimer = 0;
  const trennSpaeter = () => { clearTimeout(trennTimer); trennTimer = setTimeout(trennen, 200); };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(trennen, 0));
  window.addEventListener('resize', () => { if (window.innerWidth !== trennBreite) { trennBreite = window.innerWidth; trennSpaeter(); } });
  document.addEventListener('toggle', trennSpaeter, true);
  document.addEventListener('fgs:zeilen', trennSpaeter);
})();
