document.addEventListener('DOMContentLoaded', function() {
    const filterButton = document.getElementById('filter-button');

    function filterImmobilien() {
        // 1. Werte aus den Dropdowns/Inputs holen
        const vermarktungInput = document.getElementById('filter-vermarktung').value;
        const objektartInput = document.getElementById('filter-objektart').value;
        const preisInput = document.getElementById('filter-preis').value;

        // 2. Alle Kacheln holen
        const kacheln = document.querySelectorAll('.immobilien-kachel');
        let trefferAnzahl = 0;

        kacheln.forEach(kachel => {
            // Daten aus den data-Attributen der Kachel lesen
            const kachelVermarktung = kachel.getAttribute('data-vermarktung');
            const kachelObjektart = kachel.getAttribute('data-objektart');
            const kachelPreis = parseInt(kachel.getAttribute('data-preis'));

            let istSichtbar = true;

            // REGEL 1: Vermarktungsart (Kauf/Miete) prüfen
            if (vermarktungInput !== 'all' && vermarktungInput !== '' && kachelVermarktung !== vermarktungInput) {
                istSichtbar = false;
            }

            // REGEL 2: Objektart prüfen
            if (objektartInput !== 'all' && objektartInput !== '' && kachelObjektart !== objektartInput) {
                istSichtbar = false;
            }

            // REGEL 3: Preis prüfen (nur wenn ein Preis eingegeben wurde)
            if (preisInput && kachelPreis > parseInt(preisInput)) {
                istSichtbar = false;
            }

            // Sichtbarkeit anwenden
            if (istSichtbar) {
                kachel.style.display = "block"; // Oder "flex", je nach Design
                trefferAnzahl++;
            } else {
                kachel.style.display = "none";
            }
        });

        // Optional: Meldung wenn keine Treffer
        const noResultsMsg = document.getElementById('no-results-msg');
        if (trefferAnzahl === 0) {
            if(noResultsMsg) noResultsMsg.style.display = 'block';
        } else {
            if(noResultsMsg) noResultsMsg.style.display = 'none';
        }
    }

    if(filterButton) {
        filterButton.addEventListener('click', filterImmobilien);
    }
});

/* =========================================================
   FG Real Estate – Investitionsrechner V2
   komplett clientseitig, ohne Backend und ohne externe Chart-Library
   ========================================================= */
(function(){
  const root = document.querySelector('[data-invest-calculator]');
  if(!root) return;

  const steps = Array.from(root.querySelectorAll('.invest-step-panel'));
  const stepItems = Array.from(root.querySelectorAll('.invest-step-item'));
  const currentStepEl = root.querySelector('[data-current-step]');
  const progress = root.querySelector('[data-invest-progress]');
  const title = root.querySelector('[data-step-title]');
  const warnings = root.querySelector('[data-invest-warnings]');
  const resultsBox = root.querySelector('[data-invest-results]');
  const kpiBox = root.querySelector('[data-kpis]');
  const tableBody = root.querySelector('[data-invest-table-body]');
  const chartWealth = root.querySelector('[data-chart-wealth]');
  const chartCashflow = root.querySelector('[data-chart-cashflow]');
  const chartDebt = root.querySelector('[data-chart-debt]');
  const printBtn = root.querySelector('[data-print-result]');
  const recButtons = Array.from(root.querySelectorAll('[data-set-value]'));
  let current = 0;
  let lastResult = null;

  const titles = [
    'Objekt und Kaufdaten',
    'Miete und Bewirtschaftung',
    'Finanzierung',
    'Steuern und Prognose',
    'Auswertung'
  ];

  const requiredByStep = [
    ['purchasePrice','livingArea','monthlyRent'],
    [],
    ['equity','loanAmount','interestRate','repaymentRate'],
    [],
    []
  ];

  const defaults = {
    brokerFeePct: 0,
    notaryPct: 1.5,
    landRegisterPct: 0.5,
    transferTaxPct: 6.0,
    otherClosingCosts: 0,
    vacancyRate: 2,
    maintenanceReservePerSqm: 10,
    nonApportionableMonthly: 0,
    apportionableMonthly: 0,
    otherNonApportionableMonthly: 0,
    rentGrowth: 2,
    valueGrowth: 2,
    afaRate: 2.5,
    buildingShare: 75,
    taxRate: 42,
    horizon: 20,
    costGrowth: 2,
    initialInvestments: 0
  };

  function num(name){
    const el = root.querySelector(`[name="${name}"]`);
    if(!el) return 0;
    const raw = String(el.value || '').replace(/\./g,'').replace(',', '.');
    const val = parseFloat(raw);
    if(Number.isFinite(val)) return val;
    return defaults[name] || 0;
  }

  function setVal(name, value){
    const el = root.querySelector(`[name="${name}"]`);
    if(el) el.value = value;
  }

  function eur(v, digits=0){
    return new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR', maximumFractionDigits:digits, minimumFractionDigits:digits}).format(Number.isFinite(v)?v:0);
  }
  function pct(v, digits=2){
    return new Intl.NumberFormat('de-DE', {style:'percent', maximumFractionDigits:digits, minimumFractionDigits:digits}).format((Number.isFinite(v)?v:0));
  }
  function n(v, digits=0){
    return new Intl.NumberFormat('de-DE', {maximumFractionDigits:digits, minimumFractionDigits:digits}).format(Number.isFinite(v)?v:0);
  }

  function showStep(index){
    current = Math.max(0, Math.min(index, steps.length-1));
    steps.forEach((s,i)=>s.classList.toggle('is-active', i===current));
    stepItems.forEach((s,i)=>{
      s.classList.toggle('is-active', i===current);
      s.classList.toggle('is-done', i<current);
    });
    if(currentStepEl) currentStepEl.textContent = current+1;
    if(progress) progress.style.width = ((current+1)/steps.length*100)+'%';
    if(title) title.textContent = titles[current] || '';
  }

  function validateStep(index){
    const missing = [];
    (requiredByStep[index] || []).forEach(name=>{
      const el = root.querySelector(`[name="${name}"]`);
      if(el && !String(el.value || '').trim()) missing.push(el.dataset.label || name);
    });
    if(missing.length){
      showWarnings(['Bitte füllen Sie zuerst diese Pflichtfelder aus: '+missing.join(', ')+'.']);
      return false;
    }
    hideWarnings();
    return true;
  }

  function showWarnings(lines){
    if(!warnings) return;
    warnings.innerHTML = '<strong>Hinweis zur Berechnung:</strong><ul>'+lines.map(l=>`<li>${l}</li>`).join('')+'</ul>';
    warnings.classList.add('is-visible');
  }
  function hideWarnings(){ if(warnings){ warnings.classList.remove('is-visible'); warnings.innerHTML=''; } }

  root.addEventListener('click', function(e){
    const next = e.target.closest('[data-next-step]');
    const prev = e.target.closest('[data-prev-step]');
    const calc = e.target.closest('[data-calc]');
    if(next){ if(validateStep(current)) showStep(current+1); }
    if(prev){ showStep(current-1); }
    if(calc){ if(validateStep(current)){ calculateAndRender(); showStep(4); } }
  });

  recButtons.forEach(btn=>{
    btn.addEventListener('click', function(){ setVal(btn.dataset.target, btn.dataset.setValue); });
  });

  if(printBtn){
    printBtn.addEventListener('click', function(){
      if(!lastResult) calculateAndRender();
      window.print();
    });
  }

  function collectInputs(){
    const purchasePrice = num('purchasePrice');
    const livingArea = num('livingArea');
    const monthlyRent = num('monthlyRent');
    const annualRent = monthlyRent * 12;
    const brokerFee = purchasePrice * num('brokerFeePct')/100;
    const notary = purchasePrice * num('notaryPct')/100;
    const landRegister = purchasePrice * num('landRegisterPct')/100;
    const transferTax = purchasePrice * num('transferTaxPct')/100;
    const closingCosts = brokerFee + notary + landRegister + transferTax + num('otherClosingCosts');
    return {
      purchasePrice, livingArea, monthlyRent, annualRent,
      brokerFee, notary, landRegister, transferTax, closingCosts,
      initialInvestments: num('initialInvestments'),
      equity: num('equity'),
      loanAmount: num('loanAmount'),
      interestRate: num('interestRate')/100,
      repaymentRate: num('repaymentRate')/100,
      nonApportionableMonthly: num('nonApportionableMonthly'),
      apportionableMonthly: num('apportionableMonthly'),
      otherNonApportionableMonthly: num('otherNonApportionableMonthly'),
      maintenanceReservePerSqm: num('maintenanceReservePerSqm'),
      vacancyRate: num('vacancyRate')/100,
      rentGrowth: num('rentGrowth')/100,
      valueGrowth: num('valueGrowth')/100,
      costGrowth: num('costGrowth')/100,
      afaRate: num('afaRate')/100,
      buildingShare: num('buildingShare')/100,
      taxRate: num('taxRate')/100,
      horizon: Math.max(1, Math.min(40, Math.round(num('horizon') || 20)))
    };
  }

  function calculate(){
    const x = collectInputs();
    const totalInvestment = x.purchasePrice + x.closingCosts + x.initialInvestments;
    const buildingBasis = (x.purchasePrice + x.closingCosts + x.initialInvestments) * x.buildingShare;
    const afaAnnual = buildingBasis * x.afaRate;
    const annualDebtService = x.loanAmount * (x.interestRate + x.repaymentRate);
    const rows = [];
    let debt = x.loanAmount;
    let cumulativeCashflowAfterTax = 0;
    let cumulativeRepayment = 0;
    let cumulativeTax = 0;
    let propertyValue = x.purchasePrice + x.initialInvestments;

    for(let year=1; year<=x.horizon; year++){
      const growthPow = Math.pow(1+x.rentGrowth, year-1);
      const costPow = Math.pow(1+x.costGrowth, year-1);
      const valuePow = Math.pow(1+x.valueGrowth, year);
      const annualRent = x.annualRent * growthPow;
      const apportionableCosts = x.apportionableMonthly * 12 * costPow;
      const nonApportionableCosts = x.nonApportionableMonthly * 12 * costPow;
      const otherNon = x.otherNonApportionableMonthly * 12 * costPow;
      const reserve = x.maintenanceReservePerSqm * x.livingArea * costPow;
      const vacancy = annualRent * x.vacancyRate;
      const operatingCosts = apportionableCosts + nonApportionableCosts + otherNon + reserve + vacancy;
      const interest = debt * x.interestRate;
      const scheduledPrincipal = Math.max(0, annualDebtService - interest);
      const principal = Math.min(debt, scheduledPrincipal);
      const debtService = interest + principal;
      const cashflowBeforeTax = annualRent - operatingCosts - debtService;
      const taxableIncome = annualRent - (apportionableCosts + nonApportionableCosts + otherNon + vacancy) - interest - afaAnnual;
      const tax = taxableIncome * x.taxRate;
      const cashflowAfterTax = cashflowBeforeTax - tax;
      debt = Math.max(0, debt - principal);
      propertyValue = (x.purchasePrice + x.initialInvestments) * valuePow;
      const netWorth = propertyValue - debt;
      cumulativeCashflowAfterTax += cashflowAfterTax;
      cumulativeRepayment += principal;
      cumulativeTax += tax;
      rows.push({year, annualRent, operatingCosts, interest, principal, debt, cashflowBeforeTax, tax, cashflowAfterTax, propertyValue, netWorth, cumulativeCashflowAfterTax, cumulativeRepayment, cumulativeTax});
      if(debt <= 0 && year < x.horizon){ debt = 0; }
    }

    const y1 = rows[0] || {};
    const valueIncreaseY1 = (x.purchasePrice + x.initialInvestments) * x.valueGrowth;
    const wealthIncreaseY1 = (y1.cashflowAfterTax || 0) + (y1.principal || 0) + valueIncreaseY1;
    const wealthIncreaseNoValueY1 = (y1.cashflowAfterTax || 0) + (y1.principal || 0);
    const equityRoe = x.equity ? wealthIncreaseY1 / x.equity : 0;
    const equityRoeNoValue = x.equity ? wealthIncreaseNoValueY1 / x.equity : 0;
    const netRentYield = x.purchasePrice ? (x.annualRent - (x.nonApportionableMonthly*12) - (x.maintenanceReservePerSqm*x.livingArea) - (x.annualRent*x.vacancyRate)) / x.purchasePrice : 0;
    const grossRentYield = x.purchasePrice ? x.annualRent / x.purchasePrice : 0;

    const warnings = [];
    if(!x.apportionableMonthly && !x.nonApportionableMonthly) warnings.push('Hausgeld wurde nicht oder nur unvollständig angegeben. Die Berechnung nutzt dann nur Rücklage und Mietausfall; mit tatsächlichem Hausgeld wird sie genauer.');
    if(!x.otherNonApportionableMonthly && !x.nonApportionableMonthly) warnings.push('Nicht umlagefähige Kosten fehlen. Gerade Verwaltung, Instandhaltung und WEG-Kosten können den Cashflow deutlich verändern.');
    if(x.equity && Math.abs((x.purchasePrice + x.closingCosts + x.initialInvestments - x.equity) - x.loanAmount) > Math.max(5000, x.purchasePrice*.02)) warnings.push('Eigenkapital und Darlehenssumme passen rechnerisch nicht exakt zur Gesamtinvestition. Das kann Absicht sein, sollte aber geprüft werden.');
    if(!x.purchasePrice || !x.monthlyRent || !x.livingArea) warnings.push('Für eine belastbare Mindestberechnung sind Kaufpreis, Wohnfläche und Kaltmiete erforderlich.');

    return {inputs:x, totalInvestment, buildingBasis, afaAnnual, rows, grossRentYield, netRentYield, equityRoe, equityRoeNoValue, warnings};
  }

  function calculateAndRender(){
    lastResult = calculate();
    renderResults(lastResult);
    if(resultsBox) resultsBox.classList.add('is-visible');
    if(lastResult.warnings.length) showWarnings(lastResult.warnings); else hideWarnings();
    setTimeout(()=>resultsBox?.scrollIntoView({behavior:'smooth', block:'start'}), 80);
  }

  function renderResults(r){
    if(kpiBox){
      const y1 = r.rows[0] || {};
      const yEnd = r.rows[r.rows.length-1] || {};
      const kpis = [
        ['Gesamtinvestition', eur(r.totalInvestment), 'Kaufpreis + Nebenkosten + Anfangsinvestitionen'],
        ['Bruttomietrendite', pct(r.grossRentYield), 'Jahresnettokaltmiete / Kaufpreis'],
        ['Nettomietrendite', pct(r.netRentYield), 'Miete abzüglich kalkulierbarer laufender Kosten'],
        ['Cashflow nach Steuer / Monat', eur((y1.cashflowAfterTax||0)/12), 'Jahr 1 nach Zins, Tilgung, Kosten und Steuer'],
        ['Eigenkapitalrendite p.a.', pct(r.equityRoe), 'Cashflow nach Steuer + Tilgung + Wertzuwachs / Eigenkapital'],
        ['EK-Rendite ohne Wertsteigerung', pct(r.equityRoeNoValue), 'konservativer Blick ohne Immobilienwertsteigerung'],
        ['Kumulierter Cashflow', eur(yEnd.cumulativeCashflowAfterTax||0), `über ${r.inputs.horizon} Jahre nach Steuer`],
        ['Nettovermögen am Ende', eur(yEnd.netWorth||0), 'Immobilienwert abzüglich Restschuld']
      ];
      kpiBox.innerHTML = kpis.map(k=>`<article class="invest-kpi"><small>${k[0]}</small><strong>${k[1]}</strong><span class="invest-hint">${k[2]}</span></article>`).join('');
    }
    if(tableBody){
      tableBody.innerHTML = r.rows.map(row=>`<tr>
        <td>Jahr ${row.year}</td>
        <td>${eur(row.annualRent)}</td>
        <td>${eur(row.operatingCosts)}</td>
        <td>${eur(row.interest)}</td>
        <td>${eur(row.principal)}</td>
        <td>${eur(row.debt)}</td>
        <td>${eur(row.cashflowBeforeTax)}</td>
        <td>${eur(row.tax)}</td>
        <td>${eur(row.cashflowAfterTax)}</td>
        <td>${eur(row.propertyValue)}</td>
        <td>${eur(row.netWorth)}</td>
        <td>${eur(row.cumulativeCashflowAfterTax)}</td>
        <td>${eur(row.cumulativeRepayment)}</td>
        <td>${eur(row.cumulativeTax)}</td>
      </tr>`).join('');
    }
    renderLineChart(chartWealth, r.rows, [
      {key:'propertyValue', label:'Immobilienwert'},
      {key:'netWorth', label:'Nettovermögen'}
    ]);
    renderLineChart(chartCashflow, r.rows, [
      {key:'cashflowAfterTax', label:'Cashflow nach Steuer'},
      {key:'cumulativeCashflowAfterTax', label:'kumulierter Cashflow'}
    ]);
    renderLineChart(chartDebt, r.rows, [
      {key:'debt', label:'Restschuld'},
      {key:'cumulativeRepayment', label:'kumulierte Tilgung'}
    ]);
  }

  function renderLineChart(target, rows, series){
    if(!target || !rows.length) return;
    const w=760, h=300, pad=46;
    const colors=['#D1B464','#91DCFF','#08082F'];
    const vals=[];
    rows.forEach(r=>series.forEach(s=>vals.push(r[s.key]||0)));
    let min=Math.min(0, ...vals), max=Math.max(1, ...vals);
    if(max===min) max=min+1;
    const x = i => pad + (i/(rows.length-1 || 1))*(w-pad*2);
    const y = v => h-pad - ((v-min)/(max-min))*(h-pad*2);
    const grid = [0,.25,.5,.75,1].map(t=>{
      const yy=pad + t*(h-pad*2);
      const val=max - t*(max-min);
      return `<line x1="${pad}" y1="${yy}" x2="${w-pad}" y2="${yy}" stroke="rgba(8,8,47,.10)"/><text x="8" y="${yy+4}" font-size="11" fill="#667085">${compact(val)}</text>`;
    }).join('');
    const lines = series.map((s,si)=>{
      const d=rows.map((r,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(r[s.key]||0).toFixed(1)).join(' ');
      return `<path d="${d}" fill="none" stroke="${colors[si%colors.length]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('');
    const legend = series.map((s,si)=>`<span><i style="background:${colors[si%colors.length]}"></i>${s.label}</span>`).join('');
    target.innerHTML = `<svg class="invest-svg-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Diagramm"><rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="#ffffff"/>${grid}<line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="rgba(8,8,47,.18)"/>${lines}</svg><div class="invest-chart-legend">${legend}</div>`;
  }

  function compact(v){
    const abs=Math.abs(v);
    if(abs>=1000000) return n(v/1000000,1)+' Mio.';
    if(abs>=1000) return n(v/1000,0)+' Tsd.';
    return n(v,0);
  }

  // Automatische Darlehenssumme als Komfort, sobald Kaufpreis / Kosten / EK eingetragen sind.
  ['purchasePrice','brokerFeePct','notaryPct','landRegisterPct','transferTaxPct','otherClosingCosts','initialInvestments','equity'].forEach(name=>{
    const el=root.querySelector(`[name="${name}"]`);
    if(el) el.addEventListener('change',()=>{
      const x=collectInputs();
      const suggested=Math.max(0, x.purchasePrice+x.closingCosts+x.initialInvestments-x.equity);
      const loan=root.querySelector('[name="loanAmount"]');
      if(loan && !loan.dataset.userTouched) loan.value=Math.round(suggested);
    });
  });
  const loan=root.querySelector('[name="loanAmount"]');
  if(loan) loan.addEventListener('input',()=>loan.dataset.userTouched='1');

  showStep(0);
})();
