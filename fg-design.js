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

  /* ---------- Bewertung: Felder je Objektart (Update 19 §5, erweitert in Update 32 §2.2) ----------
     data-fgd-nicht="Typ|Typ": bei diesen Objektarten ausgeblendet und abgeschaltet (wird nicht mitgeschickt).
     data-fgd-nur="Typ|Typ": nur bei diesen Objektarten sichtbar.
     data-fgd-pflicht="Typ|Typ" an einem Eingabefeld: bei diesen Objektarten Pflicht; ein [data-fgd-pflicht-stern] im
     selben Label zeigt dann den Stern.
     data-fgd-zeige="feldname=Wert|Wert": nur sichtbar, wenn das Feld einen dieser Werte hat (z. B. Miete bei „Vermietet“).
     data-fgd-ordnung-typen / data-fgd-ordnung an einer Optionsgruppe: bei diesen Objektarten die Optionen in dieser
     Reihenfolge (Werte mit | getrennt), sonst in der Reihenfolge der Seite.
     Schritt-Namen und Legenden je Objektart: data-fgd-step-grundstueck / data-fgd-legende-grundstueck, ebenso -gewerbe.
     Abgeschaltete Felder prüft der Browser nicht und schickt sie nicht. Ohne Skript bleiben alle Felder sichtbar. */
  document.querySelectorAll('[data-fgd-wizard]').forEach((form) => {
    const sel = '[data-fgd-nicht], [data-fgd-nur], [data-fgd-zeige]';
    if (!form.querySelector(`${sel}, [data-fgd-pflicht]`)) return;
    const liste = (wert) => String(wert || '').split('|');
    const schritte = [...form.querySelectorAll('[data-fgd-step]')].map((step, i) => ({
      step, i, name: step.dataset.fgdStep, legend: step.querySelector('legend'),
      text: step.querySelector('legend') ? step.querySelector('legend').textContent : ''
    }));
    const namen = form.querySelectorAll('.fgd-wizard-names li');
    const SLUG = { 'Grundstück': 'Grundstueck', Gewerbe: 'Gewerbe' };
    const ordnungen = [...form.querySelectorAll('[data-fgd-ordnung]')].map((gruppe) => ({ gruppe, start: [...gruppe.children] }));
    const wertVon = (name) => {
      const felder = [...form.elements].filter((el) => el.name === name && !el.disabled);
      const an = felder.find((el) => (el.type === 'radio' || el.type === 'checkbox') ? el.checked : true);
      return an ? an.value : '';
    };
    const apply = () => {
      const checked = form.querySelector('input[name="object_type"]:checked');
      const typ = checked ? checked.value : '';
      // Reihenfolge der Optionen
      ordnungen.forEach(({ gruppe, start }) => {
        const anders = liste(gruppe.dataset.fgdOrdnungTypen).includes(typ);
        const reihe = anders ? liste(gruppe.dataset.fgdOrdnung) : null;
        const sortiert = reihe
          ? [...start].sort((a, b) => reihe.indexOf(a.querySelector('input') ? a.querySelector('input').value : '') - reihe.indexOf(b.querySelector('input') ? b.querySelector('input').value : ''))
          : start;
        sortiert.forEach((el) => gruppe.appendChild(el));
      });
      // Sichtbarkeit: zweimal, weil data-fgd-zeige von Feldern abhängt, die selbst gerade erst ein- oder ausgeblendet wurden
      for (let runde = 0; runde < 2; runde += 1) {
        form.querySelectorAll(sel).forEach((el) => {
          let aus = false;
          if (el.dataset.fgdNicht && liste(el.dataset.fgdNicht).includes(typ)) aus = true;
          if (el.dataset.fgdNur && !liste(el.dataset.fgdNur).includes(typ)) aus = true;
          if (el.dataset.fgdZeige) {
            const [name, werte] = el.dataset.fgdZeige.split('=');
            if (!liste(werte).includes(wertVon(name))) aus = true;
          }
          el.hidden = aus;
          const felder = el.matches('input, select, textarea') ? [el] : el.querySelectorAll('input, select, textarea');
          // [hidden] an jede Alternative, sonst gilt es nur für die letzte und jedes Feld in [data-fgd-nicht] wäre aus
          felder.forEach((feld) => { feld.disabled = aus || !!feld.closest(':is(' + sel + ')[hidden]'); });
        });
      }
      form.querySelectorAll('[data-fgd-pflicht]').forEach((feld) => {
        const pflicht = liste(feld.dataset.fgdPflicht).includes(typ);
        feld.required = pflicht;
        const stern = feld.closest('label') ? feld.closest('label').querySelector('[data-fgd-pflicht-stern]') : null;
        if (stern) stern.hidden = !pflicht;
        if (!pflicht && feld.getAttribute('aria-invalid') === 'true') { feld.removeAttribute('aria-invalid'); const box = document.getElementById(`${feld.name.replace(/[^a-z0-9_-]/gi, '-')}-hinweis`); if (box) box.remove(); }
      });
      // Schritt-Namen und Legenden je Objektart
      const slug = SLUG[typ] || '';
      schritte.forEach(({ step, i, name, legend, text }) => {
        step.dataset.fgdStep = (slug && step.dataset[`fgdStep${slug}`]) || name;
        if (legend) legend.textContent = (slug && step.dataset[`fgdLegende${slug}`]) || text;
        if (namen[i]) namen[i].textContent = step.dataset.fgdStep;
      });
    };
    form.addEventListener('change', apply);
    apply();
  });

  /* ---------- Bewertung: Telefon Pflicht bei Anruf (Update 28 §3.1) ----------
     Feld mit data-fgd-anruf-pflicht: Pflicht, sobald contact_preference = „Telefon“ („Mit einem Anruf“) gewählt ist;
     der Stern data-fgd-anruf-stern erscheint dann im Label. Ohne Skript prüft der Server. */
  document.querySelectorAll('[data-fgd-wizard]').forEach((form) => {
    const tel = form.querySelector('[data-fgd-anruf-pflicht]');
    if (!tel) return;
    const stern = form.querySelector('[data-fgd-anruf-stern]');
    const apply = () => {
      const wahl = form.querySelector('input[name="contact_preference"]:checked');
      const anruf = !!wahl && wahl.value === 'Telefon';
      tel.required = anruf;
      if (stern) stern.hidden = !anruf;
      if (!anruf && tel.getAttribute('aria-invalid') === 'true') { tel.removeAttribute('aria-invalid'); const box = document.getElementById(`${tel.name}-hinweis`); if (box) box.remove(); }
    };
    form.addEventListener('change', (event) => { if (event.target.name === 'contact_preference') apply(); });
    apply();
  });

  /* ---------- Hinweise unter Feldern (Update 23 B3) ----------
     Feld mit data-fgd-fehlt="…" (leer) und optional data-fgd-falsch="…" (Muster passt nicht): Der Hinweis steht unter dem
     Feld, ist über aria-describedby verbunden und verschwindet, sobald das Feld stimmt. Der Fokus geht aufs erste
     ungültige Feld; hat es keinen eigenen Hinweis, meldet der Browser es wie bisher. */
  const fgdHinweis = (el) => {
    const id = `${el.name.replace(/[^a-z0-9_-]/gi, '-')}-hinweis`;
    let box = document.getElementById(id);
    if (el.checkValidity()) {
      el.removeAttribute('aria-invalid');
      if (box) box.remove();
      return;
    }
    const text = el.validity.valueMissing ? el.dataset.fgdFehlt : (el.dataset.fgdFalsch || el.dataset.fgdFehlt);
    if (!box) {
      box = document.createElement('span');
      box.id = id;
      box.className = 'fgd-feld-hinweis';
      box.setAttribute('aria-hidden', 'true');   // steht im Label; vorgelesen wird er über aria-describedby, nicht als Teil des Namens
      el.insertAdjacentElement('afterend', box);
      el.setAttribute('aria-describedby', [el.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
    }
    box.textContent = text;
    el.setAttribute('aria-invalid', 'true');
  };
  const fgdFeldHinweise = (bad) => {
    bad.filter((el) => el.dataset.fgdFehlt).forEach(fgdHinweis);
    const first = bad[0];
    if (first.dataset.fgdFehlt) first.focus();
    else first.reportValidity();
  };
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset && el.dataset.fgdFehlt && el.getAttribute('aria-invalid') === 'true') fgdHinweis(el);
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
    // Ungültige Felder eines Schritts melden (Hinweis unter jedem Feld mit data-fgd-fehlt, Fokus aufs erste); true, wenn alles passt
    const check = (index) => {
      const bad = fields(steps[index]).filter((el) => !el.checkValidity());
      if (!bad.length) return true;
      show(index, false);
      fgdFeldHinweise(bad);
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
      const bad = [...form.elements].filter((el) => el.willValidate && !el.checkValidity());
      if (bad.length) { fgdFeldHinweise(bad); return; }
      const fd = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      const showDone = () => { form.hidden = true; if (done) { done.hidden = false; done.focus?.(); } };
      // Update 23 B3: Adresse in vier Feldern (Bewertung); „location“ bleibt das Feld, das propstack-lead auswertet
      const adresse = ['street', 'house_number', 'zip_code', 'city'].map((k) => String(fd.get(k) || '').trim());
      const adressText = adresse.some(Boolean) ? `${[adresse[0], adresse[1]].filter(Boolean).join(' ')}, ${[adresse[2], adresse[3]].filter(Boolean).join(' ')}`.replace(/^, |, $/g, '') : '';
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
        object_type: fd.get('object_type') || '', location: fd.get('location') || adressText, budget: fd.get('budget') || '',
        street: adresse[0], house_number: adresse[1], zip_code: adresse[2], city: adresse[3],
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

  /* ---------- Bewertung, Schritt 2: Angaben aus der Bestätigungsmail (Update 19 §5, neu in Update 32 §2) ----------
     /immobilienbewertung/nachfrage/?k=…&typ=…&wf=…&gf=…&bj=…&mi=…&fl=…&n=…&a=1 (Link aus _shared/nachfrage.js).
     Jede Frage [data-nf-frage] trägt data-nf-typen (Objektarten, leer = alle), data-nf-ohne (nicht fragen, wenn Schritt 1
     diese Angabe schon hat) und data-nf-wenn="feld=Wert|Wert" (nur bei dieser Antwort). Ausgeblendete Fragen sind
     abgeschaltet und gehen nicht mit; Gruppen und Bereiche ohne sichtbare Frage verschwinden. Alles ist freiwillig.
     Ohne k gibt es keinen Versand, sondern den Hinweis auf den Link aus der E-Mail. Versand als JSON an bewertung-nachfrage. */
  document.querySelectorAll('[data-fgd-nachfrage-form]').forEach((form) => {
    const card = form.parentElement;
    const status = form.querySelector('[data-fgd-nachfrage-status]');
    const done = card.querySelector('[data-fgd-nachfrage-done]');
    const params = new URLSearchParams(location.search);
    const k = params.get('k') || '';
    if (!k) {
      form.hidden = true;
      card.querySelectorAll('[data-fgd-nachfrage-mail], [data-fgd-nachfrage-anruf]').forEach((el) => { el.hidden = true; });
      const ohne = card.querySelector('[data-fgd-nachfrage-ohne-link]');
      if (ohne) ohne.hidden = false;
      return;
    }
    // Links aus Update 19 nutzen alte Typen
    const ALT = { wohnung: 'etw', haus: 'efh' };
    const typ = ALT[params.get('typ')] || params.get('typ') || '';
    ['k', 'typ', 'wf', 'gf', 'bj', 'mi', 'fl', 'n', 'a'].forEach((key) => { if (form.elements[key]) form.elements[key].value = params.get(key) || ''; });
    const anruf = params.get('a') === '1';
    const mailText = card.querySelector('[data-fgd-nachfrage-mail]');
    const anrufText = card.querySelector('[data-fgd-nachfrage-anruf]');
    if (mailText) mailText.hidden = anruf;
    if (anrufText) anrufText.hidden = !anruf;
    // Mehrfamilienhaus: eigene Bezeichnungen für Stellplätze
    if (typ === 'mfh') form.querySelectorAll('[data-nf-mfh]').forEach((el) => { el.textContent = el.dataset.nfMfh; });
    const passt = (el) => !el.dataset.nfTypen || !typ || el.dataset.nfTypen.split(' ').includes(typ);
    const wert = (name) => {
      const an = [...form.querySelectorAll(`[name="${name}"]`)].find((el) => !el.disabled && (el.type === 'radio' || el.type === 'checkbox' ? el.checked : true));
      return an ? an.value : '';
    };
    const schalten = (el, aus) => {
      el.hidden = aus;
      el.querySelectorAll('input, select, textarea').forEach((feld) => { feld.disabled = aus || !!feld.closest('[data-nf-frage][hidden], .fgd-choice[hidden]'); });
    };
    const apply = () => {
      // zweimal: eine Bedingung kann an einer Frage hängen, die selbst gerade erst ein- oder ausgeblendet wurde
      for (let runde = 0; runde < 2; runde += 1) {
        form.querySelectorAll('[data-nf-frage]').forEach((el) => {
          let aus = !passt(el) || (el.dataset.nfOhne && params.get(el.dataset.nfOhne));
          if (!aus && el.dataset.nfWenn) {
            const [name, werte] = el.dataset.nfWenn.split('=');
            aus = !werte.split('|').includes(wert(name));
          }
          schalten(el, !!aus);
        });
        form.querySelectorAll('.fgd-choice[data-nf-typen]').forEach((el) => schalten(el, !passt(el)));
      }
      form.querySelectorAll('.fgs-nf-block, .fgs-nf-bereich').forEach((el) => {
        el.hidden = !el.querySelector('[data-nf-frage]:not([hidden])');
      });
    };
    form.addEventListener('change', apply);
    apply();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const bad = [...form.elements].filter((el) => el.willValidate && !el.checkValidity());
      if (bad.length) { bad[0].reportValidity(); return; }
      const fd = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      const showDone = () => {
        form.hidden = true;
        [mailText, anrufText].forEach((el) => { if (el) el.hidden = true; });
        if (done) { done.hidden = false; done.focus?.(); }
      };
      if (fd.get('company_website')) { showDone(); return; }
      const payload = {};
      for (const [key, value] of fd.entries()) if (String(value).trim()) payload[key] = String(value).trim();
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
      return /^(Bitte|Der Link|Unbekannte|Der Hinweis)/.test(message || '')
        ? message
        : 'Die Angaben konnten gerade nicht gesendet werden. Bitte rufen Sie uns an oder schreiben Sie an info@fg-realestate.de.';
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
     Der Einbettungscode steht im Attribut data-fgd-widget-code (_includes/fgd-widget.njk). Er lädt nur
     mit Einwilligung in „Externe Medien“ und erst, wenn der Abschnitt in die Nähe des Bildschirms kommt.
     „Rechner laden (externer Inhalt)“ im Platzhalter erteilt diese Einwilligung im Consent-Manager (die übrigen
     Kategorien bleiben, wie sie sind) und schickt `widget_open` an den dataLayer.
     Update 32 §4.4 (04.11.2026):
     - Während des Ladens steht „Rechner wird geladen …“ über dem Rahmen. Fertig ist der Rechner, sobald sein iframe
       geladen ist oder er seine Höhe meldet (postMessage „vh-widget-resize“ vom Anbieter, wie es dessen loader.js nutzt).
     - Ist er etwa 8 Sekunden, nachdem der Abschnitt sichtbar ist, nicht fertig, oder lädt das Skript des Anbieters nicht:
       ein kurzer Hinweis mit Direktlink (finanzWidgets.direkt). Lädt er danach doch, verschwindet der Hinweis.
     - Fehlt der Consent-Manager (Cookie-Blocker wie die „EasyList Cookie“-Liste, in Brave voreingestellt, sperren
       cookieconsent.umd.js und consent-manager.js), lädt der Knopf den Rechner für diesen Seitenaufruf; der Klick ist
       dann die Einwilligung. Vorher tat der Knopf in diesem Fall nichts. */
  const widgets = Array.from(document.querySelectorAll('[data-fgd-widget]'));
  if (widgets.length) {
    const consentExternal = () => Boolean(window.CookieConsent && window.CookieConsent.acceptedCategory('external'));
    const near = new Set();
    const LANGSAM_MS = 8000;
    const status = (root) => root.querySelector('[data-fgd-widget-status]');
    const fertig = (root) => {
      if (root.dataset.widgetState === 'fertig') return;
      root.dataset.widgetState = 'fertig';
      window.clearTimeout(root._fgdTimer);
      const st = status(root);
      if (st) st.hidden = true;
    };
    const langsam = (root, fehler) => {
      if (root.dataset.widgetState === 'fertig') return;
      root.dataset.widgetState = fehler ? 'fehler' : 'langsam';
      window.clearTimeout(root._fgdTimer);
      const st = status(root);
      if (!st) return;
      const text = st.querySelector('[data-fgd-widget-slow-text]');
      if (fehler && text && text.dataset.textError) text.textContent = text.dataset.textError;
      const link = st.querySelector('[data-fgd-widget-direct]');
      if (link && !/[?&]ref=/.test(link.href)) {
        try { link.href += (link.href.indexOf('?') < 0 ? '?' : '&') + 'ref=' + encodeURIComponent(location.href); } catch (e) { /* Link bleibt ohne ref */ }
      }
      st.querySelector('[data-fgd-widget-wait]').hidden = true;
      st.querySelector('[data-fgd-widget-slow]').hidden = false;
      st.hidden = false;
    };
    // Die 8 Sekunden zählen erst, wenn der Abschnitt zu sehen ist (geladen wird schon 400 px vorher).
    const uhrStarten = (root) => {
      if (root._fgdTimer || !root.dataset.loaded || !root._fgdSichtbar || root.dataset.widgetState) return;
      root._fgdTimer = window.setTimeout(() => langsam(root, false), LANGSAM_MS);
    };
    // Fertig-Meldungen: iframe geladen (iframe entsteht durch das Skript des Anbieters) oder Höhe per postMessage
    window.addEventListener('message', (event) => {
      const d = event.data;
      if (!d || d.type !== 'vh-widget-resize') return;
      widgets.forEach((root) => {
        const f = root.querySelector('[data-fgd-widget-frame] iframe');
        if (f && f.contentWindow === event.source) fertig(root);
      });
    });
    const iframeBeobachten = (root, frame) => {
      const dran = (f) => { if (!f._fgdLoad) { f._fgdLoad = true; f.addEventListener('load', () => fertig(root)); } };
      frame.querySelectorAll('iframe').forEach(dran);
      if (!('MutationObserver' in window)) return;
      const mo = new MutationObserver(() => {
        frame.querySelectorAll('iframe').forEach(dran);
        if (root.dataset.widgetState === 'fertig') mo.disconnect();
      });
      mo.observe(frame, { childList: true, subtree: true });
    };
    if ('IntersectionObserver' in window) {
      const sicht = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) { entry.target._fgdSichtbar = true; sicht.unobserve(entry.target); uhrStarten(entry.target); } });
      });
      widgets.forEach((w) => sicht.observe(w));
    } else {
      widgets.forEach((w) => { w._fgdSichtbar = true; });
    }
    const loadWidget = (root) => {
      if (root.dataset.loaded) return;
      // Code steht als Attribut (Update 32 §4.3: Firefox lud Skripte aus einem <template> vorab, ohne Einwilligung)
      const quelle = root.querySelector('[data-fgd-widget-code]');
      const frame = root.querySelector('[data-fgd-widget-frame]');
      if (!quelle || !frame) return;
      const tpl = document.createElement('template');
      tpl.innerHTML = quelle.getAttribute('data-fgd-widget-code') || '';
      root.dataset.loaded = '1';
      const st = status(root);
      if (st) st.hidden = false;
      iframeBeobachten(root, frame);
      uhrStarten(root);
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
          s.addEventListener('error', () => { langsam(root, true); next(i + 1); });
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
        // Ohne Consent-Manager (gesperrt) gilt der Klick als Einwilligung für diesen Seitenaufruf (Update 32 §4.4)
        root._fgdSichtbar = true;
        if (consentExternal() || !cc) loadWidget(root);
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
  const SKIP = 'script, style, noscript, template, svg, textarea, code, pre, [contenteditable], .fgs-sr';  // .fgs-sr: nur für Screenreader, 1 px breit (Update 23 B9)
  const range = document.createRange();
  const zeilen = (rects) => {
    const tops = [];
    for (const r of rects) if (r.width > 0.5 && !tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
    return tops.length;
  };
  const KOPF = 'h1, h2, h3, h4, h5, h6, [data-fgs-lines]';
  const KLEINST = 0.6;
  const breite = (rects) => Array.from(rects).reduce((s, r) => s + r.width, 0);
  /* Update 23 B9: Überschriften haben overflow-wrap: normal (fg-system.css). Ein zu langes Wort bricht dort nicht mehr um, sondern
     ragt über den Rand; erkannt wird es dann daran, dass es breiter ist als die Überschrift. */
  const frei = (k) => { const cs = getComputedStyle(k); return k.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); };
  const passtNicht = (rects, kopf) => zeilen(rects) > 1 || (!!kopf && breite(rects) > frei(kopf) + 0.5);
  const gebrochen = (n, a, b, kopf) => { range.setStart(n, a); range.setEnd(n, b); return passtNicht(range.getClientRects(), kopf); };
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
        // Update 25 §3.5: ein gesetztes &shy; ist eine erlaubte Trennstelle („Immobilien&shy;finanzierung“); geprüft wird dann
        // jedes Teilwort samt seinem &shy; für sich. Ohne &shy; ist das ein Teil, das ganze Wort, wie bisher.
        const teile = m[0].split('\u00AD');
        let a = m.index;
        teile.forEach((teil, i) => {
          const b = a + teil.length + (i < teile.length - 1 ? 1 : 0);
          range.setStart(n, a);
          range.setEnd(n, b);
          const rects = range.getClientRects();
          const kopf = n.parentElement.closest(KOPF);
          if (teil && passtNicht(rects, kopf)) treffer.push({ n, a, b, w: breite(rects), kopf });
          a = b;
        });
      }
    }
    // Überschriften: kleinster nötiger Faktor über alle zu breiten Wörter; reicht 80 %, wird die Schrift so weit verkleinert
    const koepfe = new Map();
    treffer.forEach((t) => { if (t.kopf) koepfe.set(t.kopf, [...(koepfe.get(t.kopf) || []), t]); });
    const geloest = new Set();
    koepfe.forEach((liste, k) => {
      const cs = getComputedStyle(k);
      const faktor = Math.min(...liste.map((t) => frei(k) / t.w));
      if (!(faktor >= KLEINST && faktor < 1)) return;
      const groesse = parseFloat(cs.fontSize);
      k.style.fontSize = Math.floor(groesse * faktor * 0.985 * 10) / 10 + 'px';
      if (liste.some((t) => gebrochen(t.n, t.a, t.b, k))) { k.style.fontSize = ''; return; }
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
