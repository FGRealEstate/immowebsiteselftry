/* F&G Design-System (Design-Sprint-Brief, 28.10.2026): Kopf, Menüs, Karussells, Bild-Einblendung, FAQ.
   Läuft auf Seiten mit `fgSystem: true`. Formulare, Assistent und Widgets bleiben in fg-design.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Kopf: Glasstreifen über dem Titelbild, nach 80 px Grundton mit Haarlinie (Design-Pass 3 §2.4).
     Ab 600 px beim Scrollen nach unten ausgeblendet, beim Scrollen nach oben wieder da; nie bei offenem Menü oder Fokus im Kopf. ---------- */
  const header = document.querySelector('[data-fgs-header]');
  let lastY = window.scrollY;
  const syncHeader = () => {
    if (!header) return;
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 80);
    if (y <= 600 || header.classList.contains('is-open') || header.contains(document.activeElement)) { header.classList.remove('is-hidden'); lastY = y; return; }
    if (Math.abs(y - lastY) < 6) return; // kleine Bewegungen (Trackpad) zählen zusammen
    header.classList.toggle('is-hidden', y > lastY);
    lastY = y;
  };
  header?.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  /* ---------- Menüfelder ---------- */
  const items = Array.from(document.querySelectorAll('[data-fgs-nav-item]'));
  const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Update 22 §7.1: Fotokarten laden erst beim ersten Öffnen; offenes Feld = Kopf Navy und Navy-Schicht über der Seite
  const loadCards = () => document.querySelectorAll('.fgs-panel-card [data-srcset], .fgs-panel-card [data-src]').forEach((el) => {
    if (el.dataset.srcset) { el.srcset = el.dataset.srcset; el.removeAttribute('data-srcset'); }
    if (el.dataset.src) { el.src = el.dataset.src; el.removeAttribute('data-src'); }
  });
  const setOpen = (item, open) => {
    if (open) loadCards();
    item.classList.toggle('is-open', open);
    item.querySelector('[data-fgs-nav-trigger]')?.setAttribute('aria-expanded', String(open));
    const any = items.some((i) => i.classList.contains('is-open'));
    header?.classList.toggle('is-open', any);
    document.body.classList.toggle('fgs-nav-open', any);
  };
  const closeAll = (except) => items.forEach((item) => { if (item !== except) setOpen(item, false); });
  items.forEach((item) => {
    const trigger = item.querySelector('[data-fgs-nav-trigger]');
    let timer;
    // Mit der Maus öffnet schon das Darüberfahren; ein Klick darauf schließt dann nicht wieder (Update 22 §7.1)
    trigger?.addEventListener('click', (event) => { const open = (hoverCapable && event.detail > 0 && item.matches(':hover')) || !item.classList.contains('is-open'); closeAll(item); setOpen(item, open); });
    if (hoverCapable) {
      item.addEventListener('mouseenter', () => { clearTimeout(timer); closeAll(item); setOpen(item, true); });
      item.addEventListener('mouseleave', () => { timer = setTimeout(() => setOpen(item, false), 150); });
    }
    item.addEventListener('focusout', (event) => { if (!item.contains(event.relatedTarget)) setOpen(item, false); });
  });
  document.addEventListener('click', (event) => { if (!event.target.closest('[data-fgs-nav-item]')) closeAll(); });

  /* ---------- Handy-Menü ---------- */
  const burger = document.querySelector('[data-fgs-burger]');
  const mobile = document.getElementById('fgs-mobile');
  // Update 22 §2: eigene Vollbild-Ebene; beim Öffnen Fokus auf Schließen, Tab bleibt im Menü, die Seite steht
  const closeBtn = mobile?.querySelector('[data-fgs-mobile-close]');
  const setMobile = (open) => {
    if (!burger || !mobile) return;
    mobile.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    document.body.classList.toggle('fgs-menu-open', open);
    root.classList.toggle('fgs-menu-open', open);
    if (open) { requestAnimationFrame(() => requestAnimationFrame(() => mobile.classList.add('is-in'))); closeBtn?.focus(); }
    else mobile.classList.remove('is-in');
  };
  burger?.addEventListener('click', () => setMobile(mobile.hidden));
  closeBtn?.addEventListener('click', () => { setMobile(false); burger?.focus(); });
  mobile?.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const f = Array.from(mobile.querySelectorAll('a[href], button, summary')).filter((el) => el.getClientRects().length);
    if (!f.length) return;
    if (event.shiftKey && document.activeElement === f[0]) { event.preventDefault(); f[f.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === f[f.length - 1]) { event.preventDefault(); f[0].focus(); }
  });
  mobile?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMobile(false)));
  window.addEventListener('resize', () => { if (window.innerWidth >= 1280) setMobile(false); }, { passive: true }); // Design-Pass 3: Menü ab 1280 px
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = items.find((i) => i.classList.contains('is-open'));
    if (open) { setOpen(open, false); open.querySelector('[data-fgs-nav-trigger]')?.focus(); }
    if (mobile && !mobile.hidden) { setMobile(false); burger?.focus(); }
  });

  /* ---------- S4 Karussell: Pfeile, Ziehen mit der Maus, Fortschrittslinie ---------- */
  document.querySelectorAll('[data-fgs-rail]').forEach((rail) => {
    const track = rail.querySelector('.fgs-rail-track');
    if (!track) return;
    const prev = rail.querySelector('[data-dir="-1"]');
    const next = rail.querySelector('[data-dir="1"]');
    const bar = rail.querySelector('.fgs-rail-progress span');
    // Design-Pass 3 §3.5 (Gebiete, Omniyat): vorn eine breite Karte (.is-lead), die übrigen schmal. Ab 768 px macht
    // Pfeil, Ziehen, Wischen oder Darüberfahren die nächste Karte zur breiten; die Breite wechselt per CSS in 0,8 s.
    // Darunter normales Karussell mit 82 vw breiten Karten.
    const fold = rail.classList.contains('fgs-rail--fold');
    const cards = Array.from(track.querySelectorAll(':scope > li'));
    const wide = () => fold && window.matchMedia('(min-width: 768px)').matches;
    let lead = 0, lockUntil = 0, goal = null, idle = 0;
    const px = (name) => parseFloat(getComputedStyle(rail).getPropertyValue(name)) || 0;
    const pitch = () => px('--fgs-fold-schmal') + px('--fgs-fold-abstand');
    // Eigenes Scrollen im Takt der Breitenänderung (0,8 s, cubic-bezier(.65,0,.35,1) = easeInOutCubic), damit die
    // breite Karte beim Wechsel an ihrem Platz bleibt. goal: Ziel des eigenen Scrollens; endet das Scrollen dort, war
    // es kein Wischen des Besuchers. Wischen, Mausrad oder Klicken bricht das eigene Scrollen ab.
    let anim = 0;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const glide = (left) => {
      goal = Math.max(0, Math.min(left, track.scrollWidth - track.clientWidth));
      cancelAnimationFrame(anim);
      if (reduceMotion) { track.scrollLeft = goal; anim = 0; return; }
      const from = track.scrollLeft, to = goal, start = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - start) / 800);
        track.scrollLeft = from + (to - from) * ease(t);
        anim = t < 1 ? requestAnimationFrame(frame) : 0;
      };
      anim = requestAnimationFrame(frame);
    };
    if (fold) ['wheel', 'touchstart', 'pointerdown'].forEach((type) => track.addEventListener(type, () => { cancelAnimationFrame(anim); anim = 0; }, { passive: true }));
    // Karte i nach vorn; mit vorn=true an den Anfang der Spur, sonst nur so weit, dass sie ganz zu sehen ist
    const setLead = (i, vorn) => {
      i = Math.max(0, Math.min(cards.length - 1, i));
      if (i !== lead) { cards[lead]?.classList.remove('is-lead'); lead = i; }
      cards[lead]?.classList.add('is-lead');
      lockUntil = performance.now() + 850;
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const left = pad + lead * pitch();
      const right = left + px('--fgs-fold-breit');
      let to = track.scrollLeft;
      if (vorn || left < to + pad) to = left - pad;
      // Update 22 §4: links immer an einer Kartenkante anhalten, damit links keine halbe Karte steht
      else if (right > to + track.clientWidth - pad) to = Math.ceil((right - track.clientWidth + pad) / pitch()) * pitch();
      glide(to);
      update();
    };
    if (fold && cards.length) {
      // beim Laden ohne Übergang breit
      cards[0].style.transition = 'none';
      cards[0].classList.add('is-lead');
      void cards[0].offsetWidth;
      cards[0].style.transition = '';
      cards.forEach((card, i) => {
        // nur bei echter Mausbewegung: Beim Scrollen der Seite unter einer ruhenden Maus bleibt das Karussell am Anfang (Update 22 §4)
        card.addEventListener('pointermove', (event) => {
          if (event.pointerType !== 'mouse' || !(event.movementX || event.movementY) || !wide() || down || performance.now() < lockUntil) return;
          if (i !== lead) setLead(i, false);
        });
      });
      track.addEventListener('focusin', (event) => {
        const i = cards.findIndex((card) => card.contains(event.target));
        if (i >= 0 && wide()) setLead(i, false);
      });
      // Nach dem Wischen oder Scrollen mit dem Trackpad: die Karte am Anfang wird die breite
      track.addEventListener('scroll', () => {
        clearTimeout(idle);
        idle = setTimeout(() => {
          if (!wide() || down || anim) return;
          if (goal !== null && Math.abs(track.scrollLeft - goal) < 3) { goal = null; return; }
          goal = null;
          setLead(Math.round(track.scrollLeft / pitch()), true);
        }, 140);
      }, { passive: true });
    }
    const step = () => {
      const card = track.querySelector(':scope > li');
      if (!card) return track.clientWidth * 0.8;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      return card.getBoundingClientRect().width + gap;
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const scrollable = max > 2;
      rail.classList.toggle('is-static', !scrollable);
      if (prev) prev.disabled = !scrollable || track.scrollLeft <= 2;
      if (next) next.disabled = !scrollable || track.scrollLeft >= max - 2;
      if (wide()) {
        if (prev) prev.disabled = lead <= 0;
        if (next) next.disabled = lead >= cards.length - 1;
      }
      if (bar) {
        const visible = scrollable ? track.clientWidth / track.scrollWidth : 1;
        bar.style.width = `${Math.max(visible * 100, 8)}%`;
        bar.style.transform = `translateX(${scrollable ? (track.scrollLeft / max) * (1 / Math.max(visible, 0.08) - 1) * 100 : 0}%)`;
      }
    };
    [prev, next].forEach((btn) => btn?.addEventListener('click', () => {
      if (wide()) { setLead(lead + Number(btn.dataset.dir), true); return; }
      track.scrollBy({ left: Number(btn.dataset.dir) * step(), behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();

    // Eine Folie pro Ansicht (Bewertungen): Die Höhe folgt der aktuellen Folie (Jesu, 29.10.2026, Fix 3).
    // Die Folien behalten ihre eigene Höhe (CSS), die Spur bekommt die Höhe der Folie, die gerade zu sehen ist.
    // Der ResizeObserver fängt „Weiterlesen“, nachladende Schriften und neue Breiten ab.
    // Update 8 §3.4 (29.10.2026): ebenso die Bewertungskarten der Gebietsseiten (fgs-rail--quotes); zeigt die Ansicht
    // mehrere Karten, gilt die höchste davon.
    if (rail.classList.contains('fgs-rail--single') || rail.classList.contains('fgs-rail--quotes')) {
      const slides = Array.from(track.querySelectorAll(':scope > li'));
      const fit = () => {
        const first = Math.min(slides.length - 1, Math.max(0, Math.round(track.scrollLeft / step())));
        const count = Math.max(1, Math.round((track.clientWidth + 2) / step()));
        const shown = slides.slice(first, first + count);
        if (shown.length) track.style.height = `${Math.max(...shown.map((slide) => slide.offsetHeight))}px`;
      };
      track.addEventListener('scroll', () => requestAnimationFrame(fit), { passive: true });
      if ('ResizeObserver' in window) {
        const watch = new ResizeObserver(() => fit());
        slides.forEach((slide) => watch.observe(slide));
      } else {
        window.addEventListener('resize', fit, { passive: true });
      }
      fit();
      rail.classList.add('is-fitted');
    }

    // Ziehen nur mit der Maus; Finger und Trackpad scrollen nativ mit Einrasten
    let startX = 0, startLeft = 0, moved = false, down = false;
    track.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      down = true; moved = false; startX = event.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener('pointermove', (event) => {
      if (!down) return;
      const dx = event.clientX - startX;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
      if (moved) track.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      track.classList.remove('is-dragging');
      if (wide()) { setLead(Math.round(track.scrollLeft / pitch()), true); return; }
      // auf die nächste Karte einrasten
      const s = step();
      track.scrollTo({ left: Math.round(track.scrollLeft / s) * s, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    track.addEventListener('click', (event) => { if (moved) { event.preventDefault(); moved = false; } }, true);
    track.addEventListener('dragstart', (event) => event.preventDefault());
  });

  /* ---------- S4 Bewertungen: lange Texte auf- und zuklappen (Design-Pass 3 §3.9: auch die Pull-Quote-Bewertungen) ---------- */
  // Design-Pass 3 §3.9: der Knopf wird nach dem Laden der Schriften und bei neuer Breite neu geprüft; vorher blieb er
  // stehen, wenn der Text erst in der schmaleren Ansicht oder mit der Ersatzschrift über fünf Zeilen ging.
  document.querySelectorAll('.fgs-quote, .fgs-rq').forEach((card) => {
    const text = card.querySelector('blockquote p');
    if (!text) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fgs-link fgs-quote-more';
    button.setAttribute('aria-expanded', 'false');
    button.textContent = 'Weiterlesen';
    button.addEventListener('click', () => {
      const open = !card.classList.contains('is-open');
      card.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? 'Weniger anzeigen' : 'Weiterlesen';
    });
    card.querySelector('blockquote').after(button);
    const check = () => { if (!card.classList.contains('is-open')) button.hidden = text.scrollHeight <= text.clientHeight + 2; };
    check();
    document.fonts?.ready.then(check);
    window.addEventListener('resize', check, { passive: true });
  });

  /* ---------- Bilder einblenden (Text nie) ----------
     Design-Pass 3 §2.1: Auf Seiten mit Bewegung (html.fgs-mo, base.njk) öffnen sich Bilder ab 400 px Breite mit Rahmen und
     Maßstab (is-gross, CSS am Ende von fg-system.css); kleinere blenden wie bisher ein. */
  const reveals = Array.from(document.querySelectorAll('.fgs-reveal'));
  if (reveals.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveals.forEach((el) => el.classList.add('is-in'));
    } else {
      const motion = root.classList.contains('fgs-mo');
      const show = (el) => {
        if (!el.classList.contains('is-gross')) { el.classList.add('is-in'); return; }
        el.classList.add('is-enthuellt');
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
        setTimeout(() => el.classList.remove('is-enthuellt'), 1300);
      };
      const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const img = el.querySelector('img');
        if (!img || img.complete) show(el); else { img.addEventListener('load', () => show(el), { once: true }); img.addEventListener('error', () => show(el), { once: true }); }
        io.unobserve(el);
      }), { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
      const sizes = reveals.map((el) => el.getBoundingClientRect());
      reveals.forEach((el, n) => {
        const r = sizes[n];
        if (motion && r.width >= 400) el.classList.add('is-gross');
        // Was beim Laden schon sichtbar ist, erscheint sofort (kein Flackern im ersten Bildschirm); große Bilder öffnen sich dabei
        if (r.top < window.innerHeight && r.bottom > 0) show(el); else io.observe(el);
      });
    }
  }

  /* ---------- Update 22 §8.5: Pause-Knopf (Diaschau, Laufband). aria-label wechselt zwischen „… anhalten“ und „… abspielen“. ---------- */
  const pauseKnopf = (btn, an) => {
    btn.classList.toggle('is-gestoppt', an);
    btn.setAttribute('aria-label', `${btn.dataset.fgsPause} ${an ? 'abspielen' : 'anhalten'}`);
  };
  document.querySelectorAll('.fgs-ticker-ctl [data-fgs-pause]').forEach((btn) => {
    const band = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', () => { const an = !band.classList.contains('is-gestoppt'); band.classList.toggle('is-gestoppt', an); pauseKnopf(btn, an); });
  });

  /* ---------- Design-Pass 3 §3.1: Diaschau im Titelbild der Startseite (Makro heroSlides) ----------
     Je Folie 6 s, dann blendet die nächste in 1,6 s darüber. Den Takt gibt die Animation des Fortschrittssegments vor
     (animationend), damit Pause und Ken Burns gleich laufen. Die Folien 2–5 laden erst nach dem load-Ereignis, und zwar
     nacheinander: zuerst Folie 2, jede weitere, sobald die vorige zu sehen ist (Handy-LCP, §6.1). Ist die nächste noch nicht
     da, wartet die Diaschau. Angehalten wird außer Sicht und im Hintergrund-Tab; bei reduzierter Bewegung bleibt
     die erste Folie stehen. */
  const slideShow = document.querySelector('[data-fgs-slides]');
  if (slideShow && !reduceMotion) {
    const hero = slideShow.closest('.fgs-hero');
    const slides = Array.from(slideShow.querySelectorAll('.fgs-slide'));
    const segs = Array.from(hero.querySelectorAll('.fgs-slides-progress li'));
    const ort = hero.querySelector('.fgs-slides-ort');
    let cur = 0;
    let waiting = false;
    const ready = (s) => { const img = s.querySelector('img'); return !img.hasAttribute('data-src') && img.complete && img.naturalWidth > 0; };
    const fetchSlide = (s) => {
      const img = s.querySelector('img[data-src]');
      if (!img) return;
      img.addEventListener('load', () => { if (waiting) next(); });
      s.querySelectorAll('[data-srcset]').forEach((el) => { el.srcset = el.dataset.srcset; el.removeAttribute('data-srcset'); });
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    };
    const go = (n) => {
      slides.forEach((s) => { if (s !== slides[cur]) s.classList.remove('is-vor'); });
      slides[cur].classList.replace('is-on', 'is-vor');
      slides[cur].setAttribute('aria-hidden', 'true');
      slides[n].classList.add('is-on');
      slides[n].removeAttribute('aria-hidden');
      segs[cur].classList.remove('is-on');
      segs[n].classList.add('is-on');
      ort.textContent = slides[n].dataset.ort;
      cur = n;
      fetchSlide(slides[(n + 1) % slides.length]);
    };
    const next = () => {
      const n = (cur + 1) % slides.length;
      waiting = !ready(slides[n]);
      if (!waiting) go(n);
    };
    segs.forEach((li) => li.addEventListener('animationend', () => { if (li.classList.contains('is-on')) next(); }));
    const load = () => fetchSlide(slides[1]);
    if (document.readyState === 'complete') load(); else window.addEventListener('load', load, { once: true });
    let inView = true;
    let gestoppt = false;
    const pause = () => hero.classList.toggle('is-pause', gestoppt || !inView || document.hidden);
    // Update 22 §8.5: Knopf Pause/Wiedergabe
    hero.querySelector('[data-fgs-pause]')?.addEventListener('click', (event) => { gestoppt = !gestoppt; pauseKnopf(event.currentTarget, gestoppt); pause(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { inView = e.isIntersecting; pause(); }).observe(hero);
    document.addEventListener('visibilitychange', pause);
    hero.classList.add('is-laeuft');
  }

  /* ---------- Design-Pass 3 §3.2 Teil 2: Leistungs-Slider (Makro leistungsSlider) ----------
     Alle 7 s die nächste Leistung (Takt aus der Animation der Fortschrittslinie), Überblendung 1,2 s in CSS. Pfeile, Wischen auf
     Touch. Pause beim Darüberfahren, bei Fokus im Slider, außer Sicht und im Hintergrund-Tab. Bei reduzierter Bewegung kein
     Automatismus, die Linie zeigt dann die Stelle (1/3, 2/3, 3/3). */
  document.querySelectorAll('[data-fgs-svc]').forEach((svc) => {
    const slides = Array.from(svc.querySelectorAll('.fgs-svc-slide'));
    const bar = svc.querySelector('.fgs-svc-progress span');
    let cur = 0;
    const restart = () => {
      if (reduceMotion) { bar.style.transform = `scaleX(${(cur + 1) / slides.length})`; return; }
      svc.classList.remove('is-laeuft');
      void bar.offsetWidth;
      svc.classList.add('is-laeuft');
    };
    const go = (n) => {
      n = (n + slides.length) % slides.length;
      if (n === cur) return;
      const from = slides[cur];
      from.classList.remove('is-on');
      from.setAttribute('aria-hidden', 'true');
      from.inert = true;
      slides[n].classList.add('is-on');
      slides[n].removeAttribute('aria-hidden');
      slides[n].inert = false;
      cur = n;
      restart();
    };
    bar.addEventListener('animationend', () => go(cur + 1));
    svc.querySelectorAll('.fgs-svc-btn').forEach((b) => b.addEventListener('click', () => go(cur + Number(b.dataset.dir))));
    let x0 = null;
    let y0 = 0;
    svc.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    svc.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });
    let hover = false;
    let inView = true;
    const pause = () => svc.classList.toggle('is-pause', hover || svc.contains(document.activeElement) || !inView || document.hidden);
    svc.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = true; pause(); } });
    svc.addEventListener('pointerleave', () => { hover = false; pause(); });
    svc.addEventListener('focusin', pause);
    svc.addEventListener('focusout', () => setTimeout(pause));
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { inView = e.isIntersecting; pause(); }).observe(svc);
    document.addEventListener('visibilitychange', pause);
    restart();
  });

  /* ---------- Design-Pass 3 §3.6: Foto im Bildband läuft mit 0,85-facher Scrollgeschwindigkeit ----------
     Gegenüber dem Band verschiebt sich das Foto um 15 % des Wegs; in der Fenstermitte steht es genau mittig. */
  const parallax = Array.from(document.querySelectorAll('[data-fgs-parallax]'));
  if (parallax.length && !reduceMotion && 'IntersectionObserver' in window) {
    const RATE = 0.15;
    const shown = new Set();
    let queued = false;
    const place = () => {
      queued = false;
      const vh = window.innerHeight;
      shown.forEach((band) => {
        const r = band.getBoundingClientRect();
        const room = parseFloat(band.style.getPropertyValue('--fgs-par')) || 0;
        const shift = Math.max(-room, Math.min(room, -RATE * (r.top + r.height / 2 - vh / 2)));
        band.querySelector('.fgs-band-media').style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
      });
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
    const measure = () => {
      parallax.forEach((band) => band.style.setProperty('--fgs-par', `${Math.ceil(RATE / 2 * (window.innerHeight + band.offsetHeight)) + 1}px`));
      queue();
    };
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
      entry.target.classList.toggle('is-parallax', entry.isIntersecting);
      if (entry.isIntersecting) shown.add(entry.target); else shown.delete(entry.target);
      queue();
    }));
    measure();
    parallax.forEach((band) => io.observe(band));
    window.addEventListener('scroll', () => { if (shown.size) queue(); }, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
  }

  /* ---------- Design-Pass 3 §3.7: Zahlen zählen einmal hoch, wenn die Reihe ins Bild kommt (1,6 s, power2.out) ----------
     Gezählt wird die erste Zahl im Text („100+“, „über 4 Mio. €“, „5,0“ mit einer Nachkommastelle); der Rest bleibt stehen.
     Steht die Endzahl in einer Zeile, bekommt der Text beim Zählen ein Feld so breit wie die Endzahl (in em, wächst mit
     der Schrift), damit die Spalten nicht springen; danach wieder reiner Text. Gemessen wird nach dem Laden der Schriften. Screenreader lesen nur die Endzahl (.fgs-sr), bei reduzierter Bewegung
     steht sie gleich da. */
  const countRows = Array.from(document.querySelectorAll('[data-fgs-count]'));
  if (countRows.length && !reduceMotion && 'IntersectionObserver' in window) {
    const powerOut = (t) => 1 - (1 - t) * (1 - t);
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => countRows.forEach((row) => {
      const items = Array.from(row.querySelectorAll('.fgs-count-now')).map((now) => {
        const text = now.textContent;
        const m = text.match(/\d+(?:,\d+)?/);
        if (!m) return null;
        const places = (m[0].split(',')[1] || '').length;
        const value = parseFloat(m[0].replace(',', '.'));
        if (now.getClientRects().length === 1) {
          now.style.width = `${(now.getBoundingClientRect().width / parseFloat(getComputedStyle(now).fontSize)).toFixed(4)}em`;
          now.classList.add('is-counting');
        }
        const show = (v) => { now.textContent = text.slice(0, m.index) + v.toFixed(places).replace('.', ',') + text.slice(m.index + m[0].length); };
        return { now, text, value, show };
      }).filter(Boolean);
      if (!items.length) return;
      items.forEach((x) => x.show(0));
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const step = (time) => {
          const t = Math.min(1, (time - start) / 1600);
          if (t < 1) {
            items.forEach((x) => x.show(x.value * powerOut(t)));
            requestAnimationFrame(step);
          } else {
            items.forEach((x) => { x.now.textContent = x.text; x.now.classList.remove('is-counting'); x.now.style.width = ''; });
          }
        };
        requestAnimationFrame(step);
      }, { rootMargin: '0px 0px -15% 0px' });
      io.observe(row);
    }));
  }

  /* ---------- Design-Pass 3 §3.11: langsamer Zoom im Abschlussrahmen, nur solange der Rahmen im Bild ist ----------
     Die Animation selbst steht im CSS (.is-zooming, bei reduzierter Bewegung keine). Außer Sicht steht das Foto wieder bei 1. */
  const closingFrames = document.querySelectorAll('[data-fgs-closing]');
  if (closingFrames.length && !reduceMotion) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((entry) => entry.target.classList.toggle('is-zooming', entry.isIntersecting)));
      closingFrames.forEach((frame) => io.observe(frame));
    } else {
      closingFrames.forEach((frame) => frame.classList.add('is-zooming'));
    }
    // Update 22 §8.5: Pause-Knopf; angehalten bleibt das Foto, wo es gerade steht
    closingFrames.forEach((frame) => frame.querySelector('[data-fgs-pause]')?.addEventListener('click', (event) => {
      const an = !frame.classList.contains('is-gestoppt');
      frame.classList.toggle('is-gestoppt', an);
      pauseKnopf(event.currentTarget, an);
    }));
  }

  /* ---------- Design-Pass 3 §2.5: Seitenindex (ab 1.280 px, Darstellung im CSS) ----------
     Ein Link je H2 der Seite im Wortlaut der H2; Seiten mit weniger als drei H2 bekommen keinen. Die Spalte reicht von der ersten
     H2 bis zum Abschlussrahmen. Aktiv ist der Abschnitt, dessen H2 zuletzt das Band bei 30–40 % der Fensterhöhe erreicht hat
     (IntersectionObserver mit rootMargin "-30% 0px -60% 0px"). Ein Klick scrollt weich zur H2, abgesetzt um die Kopfhöhe
     (wie scroll-padding-top: Kopf + 16 px). Über Fotos und dunklen Flächen ist der Index ausgeblendet. ---------- */
  const ixMain = document.body.classList.contains('fgs-indexed') ? document.querySelector('main') : null;
  if (ixMain) {
    const heads = Array.from(ixMain.querySelectorAll('h2')).filter((h) => !h.closest('[hidden], [aria-hidden="true"], .fgs-sr'));
    if (heads.length < 3) {
      document.body.classList.remove('fgs-indexed');
    } else {
      const slug = (text) => text.toLowerCase().replace(/­/g, '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'abschnitt';
      const label = (h) => {
        const copy = h.cloneNode(true);
        copy.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
        copy.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove()); // .fgs-sr bleibt: „Pankow: Prenzlauer Berg …“ wie im Quelltext
        return copy.textContent.replace(/\s+/g, ' ').trim();
      };
      const track = document.createElement('div');
      track.className = 'fgs-ix-track';
      const nav = document.createElement('nav');
      nav.className = 'fgs-ix';
      nav.setAttribute('aria-label', 'Inhalt dieser Seite');
      const list = document.createElement('ol');
      const links = heads.map((h) => {
        if (!h.id) {
          const base = 'abschnitt-' + slug(label(h));
          let id = base;
          for (let n = 2; document.getElementById(id); n += 1) id = base + '-' + n;
          h.id = id;
        }
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = label(h);
        li.appendChild(a);
        list.appendChild(li);
        return a;
      });
      nav.appendChild(list);
      track.appendChild(nav);
      const first = Array.from(ixMain.children).find((el) => el.contains(heads[0]));
      ixMain.insertBefore(track, first || ixMain.firstChild);

      const closing = ixMain.querySelector(':scope > .fgs-closing');
      const place = () => {
        const mainTop = ixMain.getBoundingClientRect().top;
        const start = heads[0].getBoundingClientRect().top - mainTop;
        const end = closing ? closing.getBoundingClientRect().top - mainTop : ixMain.offsetHeight;
        track.style.top = Math.round(start) + 'px';
        track.style.height = Math.max(0, Math.round(end - start)) + 'px';
      };

      const syncMore = () => nav.classList.toggle('is-more', nav.scrollTop + nav.clientHeight < nav.scrollHeight - 1);
      nav.addEventListener('scroll', syncMore, { passive: true });
      let current = -1;
      const setCurrent = () => {
        const line = window.innerHeight * 0.4;
        let cur = -1;
        heads.forEach((h, i) => { if (h.getBoundingClientRect().top < line) cur = i; });
        if (cur === current) return;
        current = cur;
        links.forEach((a, i) => {
          a.classList.toggle('is-current', i === cur);
          if (i === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
        const a = links[cur];
        if (a && nav.scrollHeight > nav.clientHeight + 1 && (a.offsetTop < nav.scrollTop || a.offsetTop + a.offsetHeight > nav.scrollTop + nav.clientHeight - 40)) {
          nav.scrollTop = a.offsetTop - (nav.clientHeight - a.offsetHeight) / 2;
        }
        syncMore();
      };

      // Fotos, Videos und dunkle Flächen, die in die Spalte reichen (Bildbänder, Fotos am linken Rand, verschobene Karussellkarten)
      const covers = Array.from(ixMain.querySelectorAll('img, video, .fgs-band, .fgs-on-dark')).filter((el) => !el.closest('.fgs-hero, .fgs-closing, .fgs-ix-track'));
      let coverQueued = false;
      const checkCover = () => {
        coverQueued = false;
        if (!track.offsetParent) return;
        setCurrent(); // Sprünge und schnelles Scrollen überspringen das Band, ohne dass der Observer meldet
        const r = nav.getBoundingClientRect();
        const hit = covers.some((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top;
        });
        nav.classList.toggle('is-covered', hit);
      };
      const queueCover = () => { if (!coverQueued) { coverQueued = true; requestAnimationFrame(checkCover); } };

      nav.addEventListener('click', (event) => {
        const a = event.target.closest('a');
        const h = a && document.getElementById(decodeURIComponent(a.hash.slice(1)));
        if (!h) return;
        event.preventDefault();
        const offset = (header ? header.offsetHeight : 0) + 16;
        window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - offset, behavior: reduceMotion ? 'auto' : 'smooth' });
        if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      });

      place();
      setCurrent();
      checkCover();
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(setCurrent, { rootMargin: '-30% 0px -60% 0px' });
        heads.forEach((h) => io.observe(h));
      }
      document.addEventListener('scroll', queueCover, { passive: true, capture: true }); // auch das seitliche Scrollen der Karussells
      window.addEventListener('resize', () => { place(); syncMore(); queueCover(); });
      window.addEventListener('load', () => { place(); queueCover(); });
      if ('ResizeObserver' in window) new ResizeObserver(() => { place(); queueCover(); }).observe(ixMain);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    }
  }

  /* ---------- S7: sechs Fragen, dann „Weitere Fragen“ ---------- */
  document.querySelectorAll('[data-fgs-faq]').forEach((faq) => {
    const button = faq.querySelector('[data-fgs-faq-more]');
    if (!button) return;
    button.addEventListener('click', () => {
      const open = !faq.classList.contains('is-expanded');
      faq.classList.toggle('is-expanded', open);
      button.setAttribute('aria-expanded', String(open));
      button.querySelector('span').textContent = open ? 'Weniger Fragen' : 'Weitere Fragen';
      if (open) faq.querySelector('.fgs-faq-item.is-extra summary')?.focus();
    });
    // Sprung auf eine versteckte Frage (#frage-…) klappt die Liste auf
    const target = location.hash && faq.querySelector(location.hash);
    if (target && target.closest('.is-extra')) button.click();
  });

  /* ---------- S5: aktuelles Kapitel im Inhaltsverzeichnis ---------- */
  document.querySelectorAll('[data-fgs-toc]').forEach((toc) => {
    const links = Array.from(toc.querySelectorAll('a[href^="#"]'));
    const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    if (!targets.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-current', a.hash.slice(1) === entry.target.id));
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    targets.forEach((t) => io.observe(t));
  });

  /* ---------- Design-Pass 2 §4/§5: Aufklapper (details.fgs-more) sind beim Laden zu. Ein Sprung auf ihren Anker, auf ein Kapitel,
     das einen enthält (#lage-2 aus dem Orte-Karussell), oder auf ein Ziel darin klappt ihn auf. ---------- */
  const openPanel = (hash) => {
    if (!hash || hash.length < 2) return;
    let el = null;
    try { el = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return; }
    if (!el) return;
    const box = el.matches('details.fgs-more') ? el : (el.closest('details.fgs-more') || el.querySelector('details.fgs-more'));
    if (box && !box.open) box.open = true;
  };
  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a[href^="#"]');
    if (link) openPanel(link.getAttribute('href'));
  });
  window.addEventListener('hashchange', () => openPanel(location.hash));
  openPanel(location.hash);

  /* ---------- Design-Pass 2 §4.5: Ablauf als Reihe (ab 1.240 px). Jede Spalte zeigt Nummer, Titel und ersten Satz; ein Klick öffnet
     den Rest des Schritts im Feld unter der Reihe, ein zweiter Klick schließt ihn. Der Titel wird dafür zum Button. Schmaler bleibt die
     senkrechte Liste mit dem ganzen Text. Ein Sprung auf #schritt-… öffnet den Schritt. ---------- */
  const stepLists = Array.from(document.querySelectorAll('[data-fgs-steps]'));
  if (stepLists.length) {
    const rowMq = window.matchMedia('(min-width: 1240px)');
    const setStep = (list, item) => {
      Array.from(list.children).forEach((li) => {
        const on = li === item;
        li.classList.toggle('is-open', on);
        const btn = li.querySelector('.fgs-step-toggle');
        if (btn) btn.setAttribute('aria-expanded', String(on));
      });
    };
    const layoutSteps = () => stepLists.forEach((list) => {
      let row = rowMq.matches;
      list.classList.toggle('is-row', row);
      // Peer, Sichtprüfung 31.10.2026: Die Spalten sind mindestens so breit wie ihr längstes Wort. Passt die Reihe so nicht in
      // die Seite, bleibt die senkrechte Liste.
      if (row && list.scrollWidth > list.clientWidth + 1) { row = false; list.classList.remove('is-row'); }
      Array.from(list.children).forEach((li) => {
        const h = li.querySelector('h3');
        const panel = li.querySelector('.fgs-step-panel');
        if (!h || !panel) return;
        let btn = h.querySelector('.fgs-step-toggle');
        if (row && !btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'fgs-step-toggle';
          btn.setAttribute('aria-controls', panel.id);
          btn.setAttribute('aria-expanded', String(li.classList.contains('is-open')));
          while (h.firstChild) btn.appendChild(h.firstChild);
          h.appendChild(btn);
        } else if (!row && btn) {
          while (btn.firstChild) h.insertBefore(btn.firstChild, btn);
          btn.remove();
        }
      });
      if (!row) Array.from(list.children).forEach((li) => li.classList.remove('is-open'));
    });
    stepLists.forEach((list) => list.addEventListener('click', (event) => {
      if (!list.classList.contains('is-row')) return;
      const li = event.target.closest('li');
      if (!li || li.parentElement !== list || !li.querySelector('.fgs-step-panel') || event.target.closest('.fgs-step-panel')) return;
      setStep(list, li.classList.contains('is-open') ? null : li);
    }));
    const openStep = (hash) => {
      if (!hash || !hash.startsWith('#schritt-')) return;
      const panel = document.getElementById(decodeURIComponent(hash.slice(1)));
      const list = panel && panel.closest('[data-fgs-steps]');
      if (list && list.classList.contains('is-row')) setStep(list, panel.closest('li'));
    };
    layoutSteps();
    if (rowMq.addEventListener) rowMq.addEventListener('change', layoutSteps); else rowMq.addListener(layoutSteps);
    let stepsBreite = window.innerWidth;
    let stepsTimer = 0;
    const stepsNeu = () => { clearTimeout(stepsTimer); stepsTimer = setTimeout(layoutSteps, 150); };
    window.addEventListener('resize', () => { if (window.innerWidth !== stepsBreite && rowMq.matches) { stepsBreite = window.innerWidth; stepsNeu(); } });
    if (document.fonts) document.fonts.ready.then(layoutSteps);
    window.addEventListener('hashchange', () => openStep(location.hash));
    openStep(location.hash);
  }

  /* ---------- Quellen: ein Sprung auf eine Fußnote (#quelle-…) klappt die Liste auf ---------- */
  const openSource = (hash) => {
    if (!hash || !hash.startsWith('#quelle-')) return null;
    const item = document.getElementById(decodeURIComponent(hash.slice(1)));
    const box = item && item.closest('details.fgs-sources');
    if (box && !box.open) box.open = true;
    return box ? item : null;
  };
  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a[href^="#quelle-"]');
    if (link) openSource(link.getAttribute('href'));
  });
  window.addEventListener('hashchange', () => openSource(location.hash));
  const sourceOnLoad = openSource(location.hash);
  if (sourceOnLoad) requestAnimationFrame(() => sourceOnLoad.scrollIntoView());
})();
