/* F&G Design-Pass 3 §2.1, §3.1, §3.2 (30.10.2026): Bewegung mit GSAP 3.15.0 (ScrollTrigger, SplitText) und Lenis 1.3.27,
   alle selbst gehostet in /vendor/. base.njk lädt das nur auf Seiten mit fgSystem und ohne fgsMotion: false (Blogartikel und
   Lexikoneinträge behalten ihre Überschriften, Nachtrag Punkt 1) und setzt vorher html.fgs-mo, wenn keine reduzierte Bewegung
   gewünscht ist. Fehlt fgs-mo (reduzierte Bewegung, oder die Skripte kamen nicht binnen 3 s), läuft hier nichts: Überschriften
   stehen, der Satz steht unter dem Titelbild, nichts wird angeheftet.
   Text, Buttons, Listen und FAQ bewegen sich nicht; einzige Ausnahme sind Kicker und Buttons im Titelbild der Startseite (§3.1).
   Die Bilder ab 400 px öffnen sich per CSS (fg-system.js, is-gross), nicht hier. */
(() => {
  'use strict';
  const root = document.documentElement;
  const { gsap, ScrollTrigger, SplitText, Lenis } = window;
  if (!root.classList.contains('fgs-mo')) return;
  if (!gsap || !ScrollTrigger || !SplitText || !Lenis) { root.classList.remove('fgs-mo'); return; }
  gsap.registerPlugin(ScrollTrigger, SplitText);
  // Update 23 D5: eine Kurve für jede Bewegung, cubic-bezier(.22, 1, .36, 1) wie --fgs-ease in fg-system.css
  const kurve = (t) => {
    const b = (p1, p2, u) => 3 * p1 * u * (1 - u) * (1 - u) + 3 * p2 * u * u * (1 - u) + u * u * u;
    let lo = 0, hi = 1, u = t;
    for (let i = 0; i < 20; i++) { u = (lo + hi) / 2; if (b(0.22, 0.36, u) < t) lo = u; else hi = u; }
    return b(1, 1, u);
  };

  /* ---------- Lenis: weiches Scrollen mit Mausrad und Trackpad, 1,1 s, Kurve aus §2.1; Touch scrollt nativ.
     Innere Scrollbereiche (Menü, Seitenindex, Inhaltsverzeichnis) scrollen selbst (allowNestedScroll). Bei offenem Menü steht
     die Seite. ---------- */
  const lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), allowNestedScroll: true, autoRaf: false });
  window.fgsBewegung = { lenis };
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  // Update 23 B8: auch bei offenem Chat auf dem Handy (fg-assistant.js setzt fg-ai-gesperrt)
  const menu = () => (document.body.classList.contains('fgs-menu-open') || document.body.classList.contains('fg-ai-gesperrt') ? lenis.stop() : lenis.start());
  new MutationObserver(menu).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ---------- Überschriften: H1 und H2 zeilenweise, je Zeile hinter einer Maske von unten (yPercent 125 → 0, Update 23 A2), 0,8 s,
     Versatz 0,08 s, Kurve D5 (vorher 0,9 s expo.out), einmal beim ersten Erscheinen; dazu die Stellen mit data-fgs-lines (Zitat der Stimme, Satz im
     Abschlussrahmen). Ausgenommen sind die Titel im Leistungs-Slider (die blenden mit ihrer Folie über), Überschriften mit
     eigener Gliederung (Kinder, die nicht inline stehen, z. B. Ort und Dienst im Titel der Gebietsseiten) und Unsichtbares.
     autoSplit teilt nach dem Laden der Schriften und bei neuer Breite neu; die zurückgegebene Animation behält ihren Stand. ---------- */
  const LINES = { type: 'lines', mask: 'lines', linesClass: 'fgs-zeile', autoSplit: true };
  const FROM = { yPercent: 125, duration: 0.8, stagger: 0.08, ease: kurve }; // 125 statt 100: Polster der Maske (Update 23 A2, fg-system.css)
  const plain = (el) => el.getClientRects().length > 0 && Array.from(el.querySelectorAll('*')).every((c) => getComputedStyle(c).display === 'inline');

  const heroH1 = document.querySelector('.fgs-hero h1');
  const slideHero = document.querySelector('.fgs-hero--slides');
  if (heroH1) {
    if (!plain(heroH1)) gsap.set(heroH1, { visibility: 'visible' });
    else {
      let first = true;
      SplitText.create(heroH1, { ...LINES, onSplit: (self) => {
        gsap.set(heroH1, { visibility: 'visible' });
        // §3.1 Startseite: Kicker blendet ein, dann die H1 Zeile für Zeile, 0,5 s danach steigen die Buttons 12 px auf (D5: je 0,4 s, vorher 0,6)
        const delay = slideHero && first ? 0.2 : 0;
        if (slideHero && first) {
          gsap.fromTo(slideHero.querySelector('.fgs-hero-text > .fgs-label'), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: kurve });
          gsap.fromTo(slideHero.querySelector('.fgs-btns'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, delay: delay + 0.5, ease: kurve });
        }
        first = false;
        document.dispatchEvent(new Event('fgs:zeilen'));
        return gsap.from(self.lines, { ...FROM, delay });
      } });
    }
  }

  const heads = Array.from(document.querySelectorAll('main h1, main h2, main [data-fgs-lines]'))
    .filter((el) => el !== heroH1 && !el.closest('.fgs-hero, .fgs-svc, .fgs-pin-statement') && plain(el));
  heads.forEach((el) => {
    let shown = false;
    let anim = null;
    SplitText.create(el, { ...LINES, onSplit: (self) => {
      anim = gsap.from(self.lines, { ...FROM, paused: !shown });
      document.dispatchEvent(new Event('fgs:zeilen')); // fg-design.js prüft zu breite Wörter neu (Sichtprüfung 31.10.2026)
      return anim;
    } });
    ScrollTrigger.create({ trigger: el, start: 'top 92%', end: 'max', onEnter: (st) => { shown = true; anim?.play(); st.kill(); } });
  });

  /* ---------- §3.2 Teil 1: Titelbild angeheftet (ab 768 px). Weg 230 vh, Fortschritt p per scrub:
     p 0–0,30 Kicker, H1 und Buttons blenden aus und steigen 40 px; p 0,38–0,66 blendet der Satz ein und steigt 30 px auf,
     gleichzeitig die Navy-Schicht (55 %) von 0 auf 1. Die Diaschau läuft dabei weiter. Mit der Tastatur springt die Seite an
     die Stelle, an der das fokussierte Element zu sehen ist. ---------- */
  const mm = gsap.matchMedia();
  const pin = document.querySelector('[data-fgs-pin]');
  if (pin) {
    mm.add('(min-width: 768px)', () => {
      const text = pin.querySelector('.fgs-hero-text');
      const satz = pin.querySelector('.fgs-pin-statement');
      // Update 22 §1: Klicks nur auf das, was zu sehen ist (Deckkraft über 0,5)
      const klickbar = () => {
        satz.classList.toggle('is-sichtbar', gsap.getProperty(satz, 'opacity') > 0.5);
        text.classList.toggle('is-aus', gsap.getProperty(text, 'opacity') < 0.5);
      };
      const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: klickbar, scrollTrigger: { trigger: pin, start: 'top top', end: 'bottom bottom', scrub: true } });
      tl.fromTo(text, { opacity: 1, y: 0 }, { opacity: 0, y: -40, duration: 0.30 }, 0)
        .fromTo(satz, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.28 }, 0.38)
        .fromTo(pin.querySelector('.fgs-pin-dark'), { opacity: 0 }, { opacity: 1, duration: 0.28 }, 0.38)
        .to({}, { duration: 0.34 }, 0.66);
      const at = (p) => { const st = tl.scrollTrigger; return st.start + (st.end - st.start) * p; };
      const toSatz = () => { if (window.scrollY < at(0.66) - 2) lenis.scrollTo(at(0.7), { immediate: true }); };
      const toTitel = () => { if (window.scrollY > at(0.05)) lenis.scrollTo(at(0), { immediate: true }); };
      satz.addEventListener('focusin', toSatz);
      text.addEventListener('focusin', toTitel);
      klickbar();
      return () => { satz.removeEventListener('focusin', toSatz); text.removeEventListener('focusin', toTitel); satz.classList.remove('is-sichtbar'); text.classList.remove('is-aus'); };
    });
  }

  /* ---------- §3.2 Teil 2: Rahmen des Leistungs-Sliders wächst von 6 vw Einzug auf volle Breite, während seine Oberkante vom
     unteren Fensterrand bis 25 % unter den oberen wandert (ab 768 px; auf dem Handy volle Breite). ---------- */
  document.querySelectorAll('[data-fgs-svc] .fgs-svc-frame').forEach((frame) => {
    mm.add('(min-width: 768px)', () => {
      gsap.fromTo(frame, { clipPath: 'inset(0% 6vw 0% 6vw)' }, { clipPath: 'inset(0% 0vw 0% 0vw)', ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'top 25%', scrub: true } });
    });
  });
})();
