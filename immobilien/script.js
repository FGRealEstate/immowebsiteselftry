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
   FG Real Estate – Investitionsrechner V3
   fixes: deutsche Zahlenformate, korrekte Prozent-/Tilgungslogik,
   Finanzierung nach Kaufpreis/Gesamtinvestition, Eingabeübersicht,
   saubere Druck-/PDF-Ausgabe
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
  const inputsSummary = root.querySelector('[data-input-summary]');
  const financingSummary = root.querySelector('[data-financing-summary]');
  const chartWealth = root.querySelector('[data-chart-wealth]');
  const chartCashflow = root.querySelector('[data-chart-cashflow]');
  const chartDebt = root.querySelector('[data-chart-debt]');
  const printBtn = root.querySelector('[data-print-result]');
  const recButtons = Array.from(root.querySelectorAll('[data-set-value]'));
  let current = 0;
  let lastResult = null;

  const company = {
    name: 'Fischer & Geserich Real Estate GmbH',
    address1: 'Schützenstraße 30',
    address2: '12165 Berlin',
    country: 'Deutschland',
    email: 'info@fg-realestate.de',
    phone: '0152 03083048',
    logo: '/images/fg-logo-gold-transparent.png'
  };

  const titles = ['Objekt und Kaufdaten','Miete und Bewirtschaftung','Finanzierung','Steuern und Prognose','Auswertung'];
  const requiredByStep = [ ['purchasePrice','livingArea','monthlyRent'], [], ['interestRate','repaymentRate'], [], [] ];

  const defaults = {
    brokerFeePct: 0, notaryPct: 1.5, landRegisterPct: 0.5, transferTaxPct: 6.0, otherClosingCosts: 0,
    vacancyRate: 2, maintenanceReservePerSqm: 10, nonApportionableMonthly: 0, apportionableMonthly: 0, otherNonApportionableMonthly: 0,
    rentGrowth: 2, valueGrowth: 2, afaRate: 2.5, buildingShare: 75, taxRate: 42, horizon: 20, costGrowth: 2,
    initialInvestments: 0, financePct: 90, loanAmount: 0, equity: 0
  };

  function parseLocaleNumber(value){
    let s = String(value ?? '').trim();
    if(!s) return 0;
    s = s.replace(/\s/g,'').replace(/€/g,'').replace(/%/g,'').replace(/m²/g,'');
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if(hasComma){
      s = s.replace(/\./g,'').replace(',', '.');
    } else if(hasDot){
      const parts = s.split('.');
      if(parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length > 1)) s = s.replace(/\./g,'');
    }
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : 0;
  }

  function num(name){
    const el = root.querySelector(`[name="${name}"]`);
    if(!el) return defaults[name] || 0;
    const v = parseLocaleNumber(el.value);
    return Number.isFinite(v) ? v : (defaults[name] || 0);
  }

  function setVal(name, value, formatNow=true){
    const el = root.querySelector(`[name="${name}"]`);
    if(!el) return;
    el.value = String(value).replace('.', ',');
    if(formatNow) formatInput(el);
    if(name !== 'loanAmount') updateFinancingSummary();
  }

  function eur(v, digits=0){ return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:digits,minimumFractionDigits:digits}).format(Number.isFinite(v)?v:0); }
  function pctDecimal(v, digits=2){ return new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:digits,minimumFractionDigits:digits}).format(Number.isFinite(v)?v:0); }
  function pctNumber(v, digits=2){ return new Intl.NumberFormat('de-DE',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(Number.isFinite(v)?v:0)+' %'; }
  function n(v, digits=0){ return new Intl.NumberFormat('de-DE',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(Number.isFinite(v)?v:0); }

  function formatInput(el){
    const kind = el.dataset.format;
    if(!kind || el.tagName === 'SELECT') return;
    const value = parseLocaleNumber(el.value);
    if(!Number.isFinite(value) || String(el.value).trim()==='') return;
    if(kind === 'eur') el.value = n(value, 2);
    if(kind === 'int') el.value = n(value, 0);
    if(kind === 'percent') el.value = n(value, 2);
  }

  root.querySelectorAll('input[data-format]').forEach(el=>{
    el.setAttribute('inputmode', 'decimal');
    el.setAttribute('type', 'text');
    el.addEventListener('focus', ()=>{ el.value = String(parseLocaleNumber(el.value) || '').replace('.', ','); });
    el.addEventListener('blur', ()=>{ formatInput(el); updateFinancingSummary(); });
    el.addEventListener('input', ()=>{ if(el.name === 'loanAmount') el.dataset.userTouched='1'; updateFinancingSummary(false); });
    formatInput(el);
  });

  function showStep(index){
    current = Math.max(0, Math.min(index, steps.length-1));
    steps.forEach((s,i)=>s.classList.toggle('is-active', i===current));
    stepItems.forEach((s,i)=>{ s.classList.toggle('is-active', i===current); s.classList.toggle('is-done', i<current); });
    if(currentStepEl) currentStepEl.textContent = current+1;
    if(progress) progress.style.width = ((current+1)/steps.length*100)+'%';
    if(title) title.textContent = titles[current] || '';
    updateFinancingSummary();
  }

  function validateStep(index){
    const missing = [];
    (requiredByStep[index] || []).forEach(name=>{
      const el = root.querySelector(`[name="${name}"]`);
      if(el && !parseLocaleNumber(el.value)) missing.push(el.dataset.label || name);
    });
    if(missing.length){ showWarnings(['Bitte füllen Sie zuerst diese Pflichtfelder aus: '+missing.join(', ')+'.']); return false; }
    hideWarnings(); return true;
  }
  function showWarnings(lines){ if(warnings){ warnings.innerHTML='<strong>Hinweis zur Berechnung:</strong><ul>'+lines.map(l=>`<li>${l}</li>`).join('')+'</ul>'; warnings.classList.add('is-visible'); } }
  function hideWarnings(){ if(warnings){ warnings.classList.remove('is-visible'); warnings.innerHTML=''; } }

  root.addEventListener('click', function(e){
    const next = e.target.closest('[data-next-step]');
    const prev = e.target.closest('[data-prev-step]');
    const calc = e.target.closest('[data-calc]');
    if(next){ if(validateStep(current)) showStep(current+1); }
    if(prev){ showStep(current-1); }
    if(calc){ if(validateStep(current)){ calculateAndRender(); showStep(4); } }
  });

  recButtons.forEach(btn=>btn.addEventListener('click', ()=>{ setVal(btn.dataset.target, btn.dataset.setValue); if(btn.dataset.target==='financePct') syncFinancing('mode'); }));

  let financeSyncLock = false;
  const financeModeEl = root.querySelector('[name="financeMode"]');
  const financePctEl = root.querySelector('[name="financePct"]');
  const loanEl = root.querySelector('[name="loanAmount"]');
  const equityEl = root.querySelector('[name="equity"]');

  if(printBtn){ printBtn.addEventListener('click', ()=>{ if(!lastResult) calculateAndRender(false); printResult(lastResult); }); }

  function collectInputs(){
    const purchasePrice = num('purchasePrice');
    const livingArea = num('livingArea');
    const monthlyRent = num('monthlyRent');
    const annualRent = monthlyRent * 12;
    const brokerFeePct = num('brokerFeePct');
    const notaryPct = num('notaryPct');
    const landRegisterPct = num('landRegisterPct');
    const transferTaxPct = num('transferTaxPct');
    const brokerFee = purchasePrice * brokerFeePct/100;
    const notary = purchasePrice * notaryPct/100;
    const landRegister = purchasePrice * landRegisterPct/100;
    const transferTax = purchasePrice * transferTaxPct/100;
    const otherClosingCosts = num('otherClosingCosts');
    const closingCosts = brokerFee + notary + landRegister + transferTax + otherClosingCosts;
    const initialInvestments = num('initialInvestments');
    const totalInvestment = purchasePrice + closingCosts + initialInvestments;
    const financeMode = (root.querySelector('[name="financeMode"]')?.value || 'custom');
    const financePct = num('financePct');
    let loanAmount = num('loanAmount');
    const equity = num('equity');
    return { purchasePrice,livingArea,monthlyRent,annualRent, brokerFeePct,notaryPct,landRegisterPct,transferTaxPct, brokerFee,notary,landRegister,transferTax,otherClosingCosts,closingCosts,initialInvestments,totalInvestment, equity, loanAmount, financeMode, financePct,
      interestRate: num('interestRate')/100, repaymentRate: num('repaymentRate')/100,
      nonApportionableMonthly: num('nonApportionableMonthly'), apportionableMonthly: num('apportionableMonthly'), otherNonApportionableMonthly: num('otherNonApportionableMonthly'),
      maintenanceReservePerSqm: num('maintenanceReservePerSqm'), vacancyRate: num('vacancyRate')/100,
      rentGrowth: num('rentGrowth')/100, valueGrowth: num('valueGrowth')/100, costGrowth: num('costGrowth')/100,
      afaRate: num('afaRate')/100, buildingShare: num('buildingShare')/100, taxRate: num('taxRate')/100,
      horizon: Math.max(1, Math.min(40, Math.round(num('horizon') || 20))) };
  }


  function financeBase(x){ return x.financeMode === 'purchase' ? x.purchasePrice : x.totalInvestment; }
  function suggestedLoan(){
    const x=collectInputs();
    if(x.financeMode==='custom') return Math.max(0,x.loanAmount || (x.totalInvestment-x.equity));
    return Math.max(0,financeBase(x)*x.financePct/100);
  }
  function syncFinancing(source='mode'){
    if(financeSyncLock) return;
    financeSyncLock=true;
    const x=collectInputs();
    let loan=x.loanAmount, equity=x.equity;
    if(x.financeMode==='custom'){
      if(source==='equity') loan=Math.max(0,x.totalInvestment-equity);
      else if(source==='loan') equity=Math.max(0,x.totalInvestment-loan);
      else if(!loan) loan=Math.max(0,x.totalInvestment-equity);
    } else {
      loan=Math.max(0,financeBase(x)*x.financePct/100);
      equity=Math.max(0,x.totalInvestment-loan);
    }
    if(loanEl) loanEl.value=n(loan,2);
    if(equityEl) equityEl.value=n(equity,2);
    financeSyncLock=false;
    updateFinancingSummary();
  }
  [financeModeEl,financePctEl].filter(Boolean).forEach(el=>el.addEventListener('input',()=>syncFinancing('mode')));
  if(loanEl) loanEl.addEventListener('input',()=>{ if((financeModeEl?.value||'custom')==='custom') syncFinancing('loan'); });
  if(equityEl) equityEl.addEventListener('input',()=>syncFinancing('equity'));
  root.querySelectorAll('[name="purchasePrice"],[name="brokerFeePct"],[name="notaryPct"],[name="landRegisterPct"],[name="transferTaxPct"],[name="otherClosingCosts"],[name="initialInvestments"]').forEach(el=>el.addEventListener('input',()=>syncFinancing('base')));

  function updateFinancingSummary(){
    if(!financingSummary) return;
    const x=collectInputs();
    const actualLoan=x.financeMode==='custom'?x.loanAmount:suggestedLoan();
    financingSummary.innerHTML=`<div><span>Kaufpreis</span><strong>${eur(x.purchasePrice)}</strong></div><div><span>Kaufnebenkosten</span><strong>${eur(x.closingCosts)}</strong></div><div><span>CapEx / Renovierungskosten</span><strong>${eur(x.initialInvestments)}</strong></div><div><span>Gesamtinvestition</span><strong>${eur(x.totalInvestment)}</strong></div><div><span>Darlehen</span><strong>${eur(actualLoan)}</strong></div><div><span>Erforderliches Eigenkapital</span><strong>${eur(Math.max(0,x.totalInvestment-actualLoan))}</strong></div>`;
  }

  function calculate(){
    const x = collectInputs();
    const totalInvestment = x.totalInvestment;
    if(x.financeMode !== 'custom'){ x.loanAmount = Math.max(0, financeBase(x) * x.financePct/100); x.equity = Math.max(0, totalInvestment - x.loanAmount); } else if(!x.loanAmount && x.equity){ x.loanAmount=Math.max(0,totalInvestment-x.equity); }

    // AfA-Basis: nur der Gebäudeanteil wird abgeschrieben.
    // Nebenkosten/CapEx / Renovierungskosten werden im Rechner vorsichtig mit einbezogen,
    // damit die Steuerwirkung nicht künstlich zu niedrig ausfällt.
    const allocatedClosingCosts = x.closingCosts * x.buildingShare;
    const buildingBasis = (x.purchasePrice * x.buildingShare) + allocatedClosingCosts;
    const afaAnnual = buildingBasis * x.afaRate;

    /*
      Annuitätendarlehen – dynamisch, nicht statisch:
      - Der Nutzer gibt Sollzins p.a. und anfängliche Tilgung p.a. ein.
      - Daraus entsteht die anfängliche Jahresannuität: Darlehen * (Zins + Tilgung).
      - Monatliche Rate: Jahresannuität / 12.
      - Jeden Monat wird der Zins nur auf die aktuelle Restschuld berechnet.
      - Der Tilgungsanteil ergibt sich jeden Monat als Rate minus Zinsanteil.
      - Dadurch sinkt der Zinsanteil laufend und der Tilgungsanteil steigt laufend.
      - Sonderfall: Ist die Restschuld kleiner als die geplante Rate, wird nur die Restschuld getilgt.
      Diese Logik entspricht der üblichen Annuitätendarlehens-Mechanik und reagiert vollständig
      dynamisch auf Zinssatz, Tilgung, Darlehenssumme und Laufzeit.
    */
    const monthlyRate = x.loanAmount > 0 ? (x.loanAmount * (x.interestRate + x.repaymentRate) / 12) : 0;
    const monthlyInterestRate = x.interestRate / 12;

    const rows=[];
    let debt=x.loanAmount;
    let cumulativeCashflowAfterTax=0;
    let cumulativeRepayment=0;
    let cumulativeTax=0;
    const startPropertyValue = x.purchasePrice;

    for(let year=1; year<=x.horizon; year++){
      const growthPow = Math.pow(1+x.rentGrowth, year-1);
      const costPow = Math.pow(1+x.costGrowth, year-1);
      const annualRent = x.annualRent * growthPow;
      const apportionableCosts = x.apportionableMonthly * 12 * costPow;
      const nonApportionableCosts = x.nonApportionableMonthly * 12 * costPow;
      const otherNon = x.otherNonApportionableMonthly * 12 * costPow;
      const reserve = x.maintenanceReservePerSqm * x.livingArea * costPow;
      const vacancy = annualRent * x.vacancyRate;
      const operatingCosts = nonApportionableCosts + otherNon + reserve + vacancy;

      let interest = 0;
      let principal = 0;
      let debtService = 0;
      const debtStartOfYear = debt;

      for(let month=1; month<=12; month++){
        if(debt <= 0) break;
        const monthlyInterest = debt * monthlyInterestRate;
        const scheduledPayment = Math.max(0, monthlyRate);
        const monthlyPrincipal = Math.min(debt, Math.max(0, scheduledPayment - monthlyInterest));
        const actualPayment = monthlyInterest + monthlyPrincipal;
        interest += monthlyInterest;
        principal += monthlyPrincipal;
        debtService += actualPayment;
        debt = Math.max(0, debt - monthlyPrincipal);
      }

      const cashflowBeforeTax = annualRent - operatingCosts - debtService;
      const taxableCosts = nonApportionableCosts + otherNon + vacancy;
      const taxableIncome = annualRent - taxableCosts - interest - afaAnnual;
      const tax = taxableIncome * x.taxRate;
      const cashflowAfterTax = cashflowBeforeTax - tax;
      const propertyValue = startPropertyValue * Math.pow(1+x.valueGrowth, year);
      const equityInProperty = propertyValue - debt;
      cumulativeCashflowAfterTax += cashflowAfterTax;
      cumulativeRepayment += principal;
      cumulativeTax += tax;
      const wealthGrowth = equityInProperty + cumulativeCashflowAfterTax - x.equity;
      const effectiveRepaymentRate = debtStartOfYear > 0 ? principal / debtStartOfYear : 0;

      rows.push({
        year,annualRent,operatingCosts,interest,principal,debt,debtService,
        cashflowBeforeTax,tax,cashflowAfterTax,propertyValue,equityInProperty,
        wealthGrowth,cumulativeCashflowAfterTax,cumulativeRepayment,cumulativeTax,
        monthlyRate,effectiveRepaymentRate
      });
    }

    const y1 = rows[0] || {};
    const valueIncreaseY1 = startPropertyValue * x.valueGrowth;
    const wealthIncreaseY1 = (y1.cashflowAfterTax || 0) + (y1.principal || 0) + valueIncreaseY1;
    const wealthIncreaseNoValueY1 = (y1.cashflowAfterTax || 0) + (y1.principal || 0);
    const equityRoe = x.equity ? wealthIncreaseY1 / x.equity : 0;
    const equityRoeNoValue = x.equity ? wealthIncreaseNoValueY1 / x.equity : 0;
    const firstYearNetRent = x.annualRent - (x.nonApportionableMonthly*12) - (x.otherNonApportionableMonthly*12) - (x.maintenanceReservePerSqm*x.livingArea) - (x.annualRent*x.vacancyRate);
    const netRentYield = x.purchasePrice ? firstYearNetRent / x.purchasePrice : 0;
    const grossRentYield = x.purchasePrice ? x.annualRent / x.purchasePrice : 0;
    const loanToPurchasePrice = x.purchasePrice ? x.loanAmount / x.purchasePrice : 0;
    const loanToTotalInvestment = totalInvestment ? x.loanAmount / totalInvestment : 0;
    const equityShareTotalInvestment = totalInvestment ? x.equity / totalInvestment : 0;

    const warnings=[];
    if(!x.apportionableMonthly && !x.nonApportionableMonthly) warnings.push('Hausgeld wurde nicht oder nur unvollständig angegeben. Die Berechnung nutzt dann Rücklage, Mietausfall und sonstige Kosten; mit tatsächlichem Hausgeld wird sie genauer.');
    if(!x.nonApportionableMonthly && !x.otherNonApportionableMonthly) warnings.push('Nicht umlagefähige Kosten fehlen. Verwaltung, Instandhaltung und nicht umlagefähige WEG-Kosten können den Cashflow deutlich verändern.');
    if(x.loanAmount > totalInvestment * 1.15) warnings.push('Die Darlehenssumme liegt deutlich über der Gesamtinvestition. Das kann bei mitfinanzierten Zusatzkosten Absicht sein, sollte aber fachlich geprüft werden.');
    if(Math.abs((x.equity + x.loanAmount) - totalInvestment) > Math.max(5000, totalInvestment*.05)) warnings.push('Eigenkapital plus Darlehen entspricht nicht der Gesamtinvestition. Die Berechnung läuft weiter, die Finanzierungsstruktur sollte aber geprüft werden.');
    if(x.interestRate > .15 || x.repaymentRate > .10) warnings.push('Zins oder Tilgung wirken ungewöhnlich hoch. Bitte prüfen, ob die Prozentwerte korrekt eingegeben wurden, z. B. 4,60 statt 46.');
    if(x.loanAmount > 0 && monthlyRate <= 0) warnings.push('Es wurde eine Darlehenssumme angegeben, aber keine positive Annuität. Ohne Zins oder Tilgung kann kein regulärer Tilgungsplan berechnet werden.');

    return {
      inputs:x,totalInvestment,buildingBasis,afaAnnual,monthlyRate,rows,
      grossRentYield,netRentYield,equityRoe,equityRoeNoValue,
      loanToPurchasePrice,loanToTotalInvestment,equityShareTotalInvestment,warnings
    };
  }

  function calculateAndRender(scroll=true){
    lastResult = calculate(); renderResults(lastResult); if(resultsBox) resultsBox.classList.add('is-visible');
    if(lastResult.warnings.length) showWarnings(lastResult.warnings); else hideWarnings();
    if(scroll) setTimeout(()=>resultsBox?.scrollIntoView({behavior:'smooth', block:'start'}), 80);
  }

  function renderInputSummary(r){
    if(!inputsSummary) return;
    const x=r.inputs;
    const groups = [
      ['Objekt', [['Kaufpreis',eur(x.purchasePrice)],['Wohnfläche',n(x.livingArea)+' m²'],['Monatsnettokaltmiete',eur(x.monthlyRent)],['Jahresnettokaltmiete',eur(x.annualRent)],['CapEx / Renovierungskosten',eur(x.initialInvestments)]]],
      ['Kaufnebenkosten', [['Maklerprovision',pctNumber(x.brokerFeePct,2)],['Notar',pctNumber(x.notaryPct,2)],['Grundbuchamt',pctNumber(x.landRegisterPct,2)],['Grunderwerbsteuer',pctNumber(x.transferTaxPct,2)],['Kaufnebenkosten gesamt',eur(x.closingCosts)],['Gesamtinvestition',eur(x.totalInvestment)]]],
      ['Finanzierung', [['Eigenkapital',eur(x.equity)],['Darlehenssumme',eur(x.loanAmount)],['Zinssatz p.a.',pctNumber(x.interestRate*100,2)],['Anfängliche Tilgung p.a.',pctNumber(x.repaymentRate*100,2)],['Finanzierungsmodus', financeModeLabel(x.financeMode)],['Finanzierungsquote',pctNumber(x.financePct,2)]]],
      ['Bewirtschaftung & Prognose', [['Umlagefähige Kosten mtl.',eur(x.apportionableMonthly)],['Nicht umlagefähige Kosten mtl.',eur(x.nonApportionableMonthly)],['Rücklage pro m² p.a.',eur(x.maintenanceReservePerSqm,2)],['Mietausfall',pctNumber(x.vacancyRate*100,2)],['Mietsteigerung p.a.',pctNumber(x.rentGrowth*100,2)],['Wertsteigerung p.a.',pctNumber(x.valueGrowth*100,2)],['AfA-Satz',pctNumber(x.afaRate*100,2)],['Gebäudeanteil',pctNumber(x.buildingShare*100,2)],['Steuersatz',pctNumber(x.taxRate*100,2)],['Zeitraum',x.horizon+' Jahre']]]
    ];
    inputsSummary.innerHTML = groups.map(g=>`<article class="invest-summary-card"><h3>${g[0]}</h3>${g[1].map(r=>`<div><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('')}</article>`).join('');
  }
  function financeModeLabel(mode){ return mode === 'purchase' ? 'Quote vom Kaufpreis' : mode === 'total' ? 'Quote von Gesamtinvestition' : 'Manuelle Darlehenssumme'; }

  function renderResults(r){
    renderInputSummary(r);
    const y1 = r.rows[0] || {}, yEnd = r.rows[r.rows.length-1] || {};
    if(kpiBox){
      const kpis = [
        ['Gesamtinvestition', eur(r.totalInvestment), 'Kaufpreis + Nebenkosten + CapEx / Renovierungskosten'],
        ['Bruttomietrendite', pctDecimal(r.grossRentYield), 'Jahresnettokaltmiete / Kaufpreis'],
        ['Nettomietrendite', pctDecimal(r.netRentYield), 'Miete abzüglich Mietausfall, Rücklage und nicht umlagefähiger Kosten'],
        ['Cashflow nach Steuer / Monat', eur((y1.cashflowAfterTax||0)/12), 'Jahr 1 nach Zins, Tilgung, Kosten und Steuer'],
        ['EK-Rendite Jahr 1', pctDecimal(r.equityRoe), 'Cashflow nach Steuer + Tilgung + Wertzuwachs / Eigenkapital'],
        ['EK-Rendite ohne Wertsteigerung', pctDecimal(r.equityRoeNoValue), 'Cashflow nach Steuer + Tilgung / Eigenkapital'],
        ['Kumulierter Cashflow', eur(yEnd.cumulativeCashflowAfterTax||0), `über ${r.inputs.horizon} Jahre nach Steuer`],
        ['Vermögenszuwachs am Ende', eur(yEnd.wealthGrowth||0), 'Vermögen im Objekt + kum. Cashflow - Eigenkapital']
      ];
      kpiBox.innerHTML = kpis.map(k=>`<article class="invest-kpi"><small>${k[0]}</small><strong>${k[1]}</strong><span class="invest-hint">${k[2]}</span></article>`).join('');
    }
    if(tableBody){
      tableBody.innerHTML = r.rows.map(row=>`<tr><td>Jahr ${row.year}</td><td>${eur(row.annualRent)}</td><td>${eur(row.operatingCosts)}</td><td>${eur(row.interest)}</td><td>${eur(row.principal)}</td><td>${eur(row.debt)}</td><td>${eur(row.cashflowBeforeTax)}</td><td>${eur(row.tax)}</td><td>${eur(row.cashflowAfterTax)}</td><td>${eur(row.propertyValue)}</td><td>${eur(row.equityInProperty)}</td><td>${eur(row.wealthGrowth)}</td><td>${eur(row.cumulativeCashflowAfterTax)}</td><td>${eur(row.cumulativeRepayment)}</td><td>${eur(row.cumulativeTax)}</td></tr>`).join('');
    }
    renderLineChart(chartWealth, r.rows, [{key:'propertyValue',label:'Immobilienwert'},{key:'equityInProperty',label:'Vermögen im Objekt'},{key:'wealthGrowth',label:'Vermögenszuwachs'}]);
    renderLineChart(chartCashflow, r.rows, [{key:'cashflowAfterTax',label:'Cashflow nach Steuer'},{key:'cumulativeCashflowAfterTax',label:'kumulierter Cashflow'}]);
    renderLineChart(chartDebt, r.rows, [{key:'debt',label:'Restschuld'},{key:'cumulativeRepayment',label:'kumulierte Tilgung'}]);
  }

  function renderLineChart(target, rows, series){
    if(!target || !rows.length) return;
    const w=760,h=300,pad=50, colors=['#D1B464','#91DCFF','#08082F'];
    const vals=[]; rows.forEach(r=>series.forEach(s=>vals.push(r[s.key]||0)));
    let min=Math.min(0,...vals), max=Math.max(1,...vals); if(max===min) max=min+1;
    const x=i=>pad+(i/(rows.length-1||1))*(w-pad*2), y=v=>h-pad-((v-min)/(max-min))*(h-pad*2);
    const grid=[0,.25,.5,.75,1].map(t=>{const yy=pad+t*(h-pad*2), val=max-t*(max-min); return `<line x1="${pad}" y1="${yy}" x2="${w-pad}" y2="${yy}" stroke="rgba(8,8,47,.10)"/><text x="8" y="${yy+4}" font-size="11" fill="#667085">${compact(val)}</text>`;}).join('');
    const lines=series.map((s,si)=>{const d=rows.map((r,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(r[s.key]||0).toFixed(1)).join(' '); return `<path d="${d}" fill="none" stroke="${colors[si%colors.length]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;}).join('');
    const legend=series.map((s,si)=>`<span><i style="background:${colors[si%colors.length]}"></i>${s.label}</span>`).join('');
    target.innerHTML=`<svg class="invest-svg-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Diagramm"><rect x="0" y="0" width="${w}" height="${h}" rx="18" fill="#ffffff"/>${grid}<line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="rgba(8,8,47,.18)"/>${lines}</svg><div class="invest-chart-legend">${legend}</div>`;
  }
  function compact(v){ const abs=Math.abs(v); if(abs>=1000000) return n(v/1000000,1)+' Mio.'; if(abs>=1000) return n(v/1000,0)+' Tsd.'; return n(v,0); }

  function printResult(r){
    if(!r) return;
    const yEnd = r.rows[r.rows.length-1] || {};
    const summaryHtml = inputsSummary ? inputsSummary.innerHTML : '';
    const kpiHtml = kpiBox ? kpiBox.innerHTML : '';
    const tableHtml = tableBody ? tableBody.innerHTML : '';
    const warningHtml = r.warnings.length ? `<div class="pdf-warning"><strong>Hinweise:</strong><ul>${r.warnings.map(w=>`<li>${w}</li>`).join('')}</ul></div>` : '';
    const doc = window.open('', '_blank');
    if(!doc){ window.print(); return; }
    doc.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Investitionsrechnung – Fischer & Geserich Real Estate GmbH</title><style>
      @page{size:A4;margin:14mm} *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#08082F;margin:0;background:#fff;font-size:11px;line-height:1.45}.pdf-header{display:grid;grid-template-columns:82px 1fr;gap:18px;align-items:center;border-bottom:3px solid #D1B464;padding-bottom:14px;margin-bottom:18px}.pdf-logo{background:#08082F;border-radius:18px;padding:10px;width:82px;height:82px;object-fit:contain}.pdf-header h1{font-size:22px;margin:0 0 8px}.pdf-header p{margin:2px 0;color:#344054}.pdf-title{background:#08082F;color:#fff;border-radius:22px;padding:18px 20px;margin:0 0 18px}.pdf-title h2{font-size:24px;margin:0 0 6px}.pdf-title p{margin:0;color:rgba(255,255,255,.78)}h3{font-size:15px;margin:20px 0 10px}.invest-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.invest-kpi{border:1px solid #e2e5ea;border-radius:14px;padding:11px;background:#fff}.invest-kpi small{display:block;color:#667085;font-weight:700;min-height:26px}.invest-kpi strong{display:block;font-size:18px;margin:5px 0;color:#08082F}.invest-hint{display:block;color:#667085;font-size:9px}.invest-summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0 18px}.invest-summary-card{border:1px solid #e2e5ea;border-radius:14px;padding:12px;break-inside:avoid}.invest-summary-card h3{margin:0 0 9px;font-size:14px}.invest-summary-card div{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #edf0f5;padding:6px 0}.invest-summary-card div:first-of-type{border-top:0}.invest-summary-card span{color:#667085}.invest-summary-card strong{text-align:right}.pdf-warning{background:#fff8df;border:1px solid #D1B464;border-radius:14px;padding:10px;margin:12px 0}.pdf-highlight{border:1px solid #D1B464;background:#fffaf0;border-radius:16px;padding:12px;margin:14px 0}.pdf-table{width:100%;border-collapse:collapse;font-size:8px;margin-top:8px}.pdf-table th{background:#f8f4e8;color:#08082F}.pdf-table th,.pdf-table td{border-bottom:1px solid #e9ecf2;padding:4px;text-align:right;white-space:nowrap}.pdf-table th:first-child,.pdf-table td:first-child{text-align:left}.pdf-footer{margin-top:18px;border-top:1px solid #e2e5ea;padding-top:10px;color:#667085;font-size:10px}.page-break{break-before:page}@media print{.no-print{display:none}}
    </style></head><body>
      <header class="pdf-header"><img class="pdf-logo" src="${company.logo}" alt="F&G"><div><h1>Investitionsrechnung</h1><p><strong>${company.name}</strong></p><p>${company.address1} · ${company.address2} · ${company.country}</p><p>${company.email} · ${company.phone}</p></div></header>
      <section class="pdf-title"><h2>Immobilien-Kapitalanlage prüfen</h2><p>Unverbindliche Beispielrechnung auf Basis der eingegebenen Annahmen. Keine Anlage-, Steuer- oder Finanzierungsberatung.</p></section>
      ${warningHtml}<h3>1. Ergebnisübersicht</h3><div class="invest-kpi-grid">${kpiHtml}</div><div class="pdf-highlight"><strong>Einordnung:</strong> Der Rechner bewertet das Investment nicht als gut oder schlecht. Er macht transparent, welche Annahmen Rendite, Cashflow, Tilgung, Steuerwirkung und Vermögensentwicklung treiben. Die Ergebnisse sollten im persönlichen Gespräch geprüft werden.</div>
      <h3>2. Eingaben und Annahmen</h3><div class="invest-summary-grid">${summaryHtml}</div>
      <h3 class="page-break">3. Jahr-für-Jahr-Verlauf</h3><table class="pdf-table"><thead><tr><th>Jahr</th><th>Miete</th><th>Kosten</th><th>Zinsen</th><th>Tilgung</th><th>Restschuld</th><th>CF n. St.</th><th>Wert</th><th>Vermögen</th><th>Zuwachs</th><th>kum. CF</th></tr></thead><tbody>${r.rows.map(row=>`<tr><td>Jahr ${row.year}</td><td>${eur(row.annualRent)}</td><td>${eur(row.operatingCosts)}</td><td>${eur(row.interest)}</td><td>${eur(row.principal)}</td><td>${eur(row.debt)}</td><td>${eur(row.cashflowAfterTax)}</td><td>${eur(row.propertyValue)}</td><td>${eur(row.equityInProperty)}</td><td>${eur(row.wealthGrowth)}</td><td>${eur(row.cumulativeCashflowAfterTax)}</td></tr>`).join('')}</tbody></table>
      <div class="pdf-footer"><strong>Hinweis:</strong> Diese Berechnung ist eine unverbindliche Beispielrechnung und ersetzt keine steuerliche, rechtliche oder finanzielle Beratung. Die tatsächliche Wirtschaftlichkeit hängt unter anderem von Objektzustand, Mietentwicklung, Instandhaltung, Finanzierung, Steuern, Vertragsstruktur und persönlichen Zielen ab.<br>Erstellt am ${new Date().toLocaleDateString('de-DE')} über fg-realestate.de.</div>
    </body></html>`);
    doc.document.close(); setTimeout(()=>{doc.focus(); doc.print();}, 500);
  }

  showStep(0); syncFinancing('mode');
})();


(function(){const r=document.querySelector('[data-affordability-calculator]');if(!r)return;const p=v=>{let s=String(v||'').replace(/\s|€|%/g,'');if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');return parseFloat(s)||0},eur=v=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);r.querySelector('form').addEventListener('submit',e=>{e.preventDefault();let f=new FormData(e.target),rate=p(f.get('rate')),eq=p(f.get('equity')),i=p(f.get('interest'))/100,t=p(f.get('repay'))/100,c=p(f.get('costs'))/100,loan=rate*12/(i+t),price=(loan+eq)/(1+c);r.querySelector('[data-afford-result]').innerHTML=`<div class="lab-result-kpis"><article><span>Möglicher Kaufpreis</span><strong>${eur(price)}</strong><small>erste Orientierung</small></article><article><span>Darlehensrahmen</span><strong>${eur(loan)}</strong></article><article><span>Gesamtbudget inkl. Nebenkosten</span><strong>${eur(price*(1+c))}</strong></article><article><span>Monatliche Rate</span><strong>${eur(rate)}</strong></article></div>`})})();

