/* ══════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════ */
const API_BASE = 'http://localhost:8000';

/* ══════════════════════════════════════════════
   NAV PILL BUTTONS
══════════════════════════════════════════════ */
const pills = document.querySelectorAll('.pill[data-target]');

pills.forEach(pill => {
  pill.addEventListener('click', () => {
    /* 1. Mark this pill active, clear others */
    pills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    /* 2. Smooth-scroll to the target section */
    const target = document.getElementById(pill.dataset.target);
    if (!target) return;
    const offset = 24; // breathing room above card
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });

    /* 3. Green glow pulse on the card */
    target.classList.add('section-highlight');
    setTimeout(() => target.classList.remove('section-highlight'), 1400);
  });
});

/* Auto-highlight pill as user scrolls through sections */
const sectionIds = ['cardQuiz', 'cardSandbox', 'cardMeter', 'cardAi', 'cardOutcome', 'cardPanic', 'cardWhatif'];

const pillMap = {};
pills.forEach(p => { pillMap[p.dataset.target] = p; });

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting && pillMap[entry.target.id]) {
      pills.forEach(p => p.classList.remove('active'));
      pillMap[entry.target.id].classList.add('active');
    }
  });
}, { threshold: 0.35 });

sectionIds.forEach(id => {
  const el = document.getElementById(id);
  if (el) sectionObserver.observe(el);
});

/* ══════════════════════════════════════════════
   API HELPERS
══════════════════════════════════════════════ */
async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* API health check */
async function checkHealth() {
  const dot = document.getElementById('apiDot');
  const lbl = document.getElementById('apiLabel');
  try {
    await apiGet('/health');
    dot.className = 'api-dot ok';
    lbl.textContent = 'FastAPI connected';
  } catch {
    dot.className = 'api-dot err';
    lbl.textContent = 'API offline — running locally';
  }
}
checkHealth();

/* ══════════════════════════════════════════════
   CARD GLOW
══════════════════════════════════════════════ */
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    card.style.setProperty('--my', ((e.clientY - r.top)  / r.height* 100).toFixed(1) + '%');
  });
});

/* ══════════════════════════════════════════════
   SLIDERS
══════════════════════════════════════════════ */
function syncSlider(el, pct) { el.style.setProperty('--pct', pct + '%'); }

const amtSlider   = document.getElementById('amtSlider');
const horizSlider = document.getElementById('horizSlider');
const volSlider   = document.getElementById('volSlider');

amtSlider.addEventListener('input', () => {
  const v = +amtSlider.value;
  document.getElementById('amtLabel').textContent = '₹' + v.toLocaleString('en-IN');
  syncSlider(amtSlider, (v - 5000) / (500000 - 5000) * 100);
  updateAssetValues(v);
});
syncSlider(amtSlider, (50000 - 5000) / 495000 * 100);

horizSlider.addEventListener('input', () => {
  const v = +horizSlider.value;
  document.getElementById('horizLabel').textContent = v + (v === 1 ? ' Year' : ' Years');
  syncSlider(horizSlider, (v - 1) / 19 * 100);
});
syncSlider(horizSlider, 2/19*100);

const volLabels = ['', 'Low', 'Medium', 'High'];
volSlider.addEventListener('input', () => {
  const v = +volSlider.value;
  document.getElementById('volLabel').textContent = volLabels[v];
  syncSlider(volSlider, (v - 1) / 2 * 100);
});
syncSlider(volSlider, 0.5*100);

/* ══════════════════════════════════════════════
   ASSET VALUES (live as slider moves)
══════════════════════════════════════════════ */
function updateAssetValues(total) {
  const allocs = { equity: 0.4, mf: 0.3, gold: 0.2, fd: 0.1 };
  document.getElementById('eqVal').textContent   = '₹' + Math.round(total * allocs.equity).toLocaleString('en-IN');
  document.getElementById('mfVal').textContent   = '₹' + Math.round(total * allocs.mf).toLocaleString('en-IN');
  document.getElementById('goldVal').textContent = '₹' + Math.round(total * allocs.gold).toLocaleString('en-IN');
  document.getElementById('fdVal').textContent   = '₹' + Math.round(total * allocs.fd).toLocaleString('en-IN');
}

/* ══════════════════════════════════════════════
   SIMULATION  ←  FastAPI /simulate
══════════════════════════════════════════════ */
async function runSimulation() {
  const amt   = +amtSlider.value;
  const horiz = +horizSlider.value;
  const vol   = +volSlider.value;
  const btn   = document.getElementById('simBtn');

  btn.disabled = true;
  btn.textContent = '⏳ Simulating…';
  document.getElementById('loadSandbox').classList.add('active');
  document.getElementById('loadMeter').classList.add('active');

  const dot = document.getElementById('apiDot');
  dot.className = 'api-dot busy';

  try {
    const data = await apiPost('/simulate', { amount: amt, horizon: horiz, volatility: vol });
    applySimulationResult(data, amt);
    dot.className = 'api-dot ok';
  } catch (err) {
    console.warn('API unavailable, running local simulation:', err.message);
    dot.className = 'api-dot err';
    runLocalSimulation(amt, horiz, vol);
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Run Simulation';
    document.getElementById('loadSandbox').classList.remove('active');
    document.getElementById('loadMeter').classList.remove('active');
  }
}

function applySimulationResult(data, amt) {
  const colors = ['#00e5a0','#ffd166','#ff4d6d'];
  drawChart(data.paths, colors, data.labels, amt);

  document.getElementById('chartNote').textContent =
    `3 Monte-Carlo paths over ${data.horizon} year${data.horizon>1?'s':''} · ${data.volatility_label} volatility · computed with NumPy`;

  const fmt = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  document.getElementById('bestVal').textContent  = '₹' + data.outcomes.best.value.toLocaleString('en-IN');
  document.getElementById('expVal').textContent   = '₹' + data.outcomes.exp.value.toLocaleString('en-IN');
  document.getElementById('badVal').textContent   = '₹' + data.outcomes.bad.value.toLocaleString('en-IN');
  document.getElementById('worstVal').textContent = '₹' + data.outcomes.worst.value.toLocaleString('en-IN');

  document.getElementById('bestDelta').textContent  = fmt(data.outcomes.best.delta);
  document.getElementById('expDelta').textContent   = fmt(data.outcomes.exp.delta);
  document.getElementById('badDelta').textContent   = fmt(data.outcomes.bad.delta);
  document.getElementById('worstDelta').textContent = fmt(data.outcomes.worst.delta);

  ['bestDelta','expDelta'].forEach(id => document.getElementById(id).className = 'out-delta up');
  document.getElementById('badDelta').className   = 'out-delta ' + (data.outcomes.bad.delta   >= 0 ? 'up' : 'down');
  document.getElementById('worstDelta').className = 'out-delta ' + (data.outcomes.worst.delta >= 0 ? 'up' : 'down');

  const ac = data.asset_changes;
  const changeMap = { eqChange: ac.equity, mfChange: ac.mutual_fund, goldChange: ac.gold, fdChange: ac.fd };
  for (const [id, val] of Object.entries(changeMap)) {
    const el = document.getElementById(id);
    el.textContent = (val >= 0 ? '+' : '') + val.toFixed(2) + '%';
    el.className   = 'asset-change ' + (val >= 0 ? 'up' : 'down');
  }

  const av = data.asset_values;
  document.getElementById('eqVal').textContent   = '₹' + av.equity.toLocaleString('en-IN');
  document.getElementById('mfVal').textContent   = '₹' + av.mutual_fund.toLocaleString('en-IN');
  document.getElementById('goldVal').textContent = '₹' + av.gold.toLocaleString('en-IN');
  document.getElementById('fdVal').textContent   = '₹' + av.fd.toLocaleString('en-IN');

  setMeterPct(data.loss_probability);
  document.getElementById('fearFill').style.width = Math.min(100, data.fear_index) + '%';

  typeAI(data.ai_message);
}

/* ══════════════════════════════════════════════
   LOCAL FALLBACK
══════════════════════════════════════════════ */
function runLocalSimulation(amt, horiz, vol) {
  const volMap = {
    1: { mu:0.07, sigma:0.05, label:'Low' },
    2: { mu:0.10, sigma:0.14, label:'Medium' },
    3: { mu:0.14, sigma:0.25, label:'High' }
  };
  const { mu, sigma, label } = volMap[vol];
  const months  = horiz * 12;
  const scalars = [0.7, 1.0, 1.6];
  const colors  = ['#00e5a0','#ffd166','#ff4d6d'];

  const paths = scalars.map(s => {
    let v = amt;
    const path = [amt];
    for (let m = 0; m < months; m++) {
      const ret = mu/12 + sigma/Math.sqrt(12) * randNorm() * s;
      v = Math.max(v * (1 + ret), 0);
      path.push(v);
    }
    return path;
  });

  const labels = Array.from({length: months+1}, (_,i) =>
    i === 0 ? 'Now' : (i % 12 === 0 ? `Y${i/12}` : '')
  );

  drawChart(paths, colors, labels, amt);

  const best = paths[0].at(-1), exp = paths[1].at(-1), bad = paths[2].at(-1), worst = bad * 0.75;
  const fmt = v => (v >= 0 ? '+' : '') + ((v/amt-1)*100).toFixed(1) + '%';

  document.getElementById('bestVal').textContent  = '₹' + Math.round(best).toLocaleString('en-IN');
  document.getElementById('expVal').textContent   = '₹' + Math.round(exp).toLocaleString('en-IN');
  document.getElementById('badVal').textContent   = '₹' + Math.round(bad).toLocaleString('en-IN');
  document.getElementById('worstVal').textContent = '₹' + Math.round(worst).toLocaleString('en-IN');

  [['bestDelta',best],['expDelta',exp],['badDelta',bad],['worstDelta',worst]].forEach(([id,v]) => {
    document.getElementById(id).textContent = fmt(v);
    document.getElementById(id).className   = 'out-delta ' + (v >= amt ? 'up' : 'down');
  });

  const baseRet = exp/amt - 1;
  [['eqChange',baseRet*1.3],['mfChange',baseRet*1.0],['goldChange',baseRet*0.5],['fdChange',0.065*horiz]].forEach(([id,d]) => {
    const el = document.getElementById(id);
    el.textContent = (d >= 0 ? '+' : '') + (d*100).toFixed(2) + '%';
    el.className   = 'asset-change ' + (d >= 0 ? 'up' : 'down');
  });

  const lossPct = vol===1 ? 12 : vol===2 ? 35 : 62;
  setMeterPct(lossPct);
  document.getElementById('fearFill').style.width = (lossPct * 1.2).toFixed(0) + '%';
  document.getElementById('chartNote').textContent =
    `3 Monte-Carlo paths over ${horiz} year${horiz>1?'s':''} · ${label} volatility · local fallback`;

  const aiMessages = {
    1: `Great choice for beginners! With low volatility, your ₹${amt.toLocaleString('en-IN')} is mostly in stable assets. Historical data shows less than 12% chance of losing money over ${horiz}+ years. Even in bad scenarios, capital erosion is minimal. You're building a habit — that's the real win! 🌱`,
    2: `A balanced portfolio. Equity and mutual funds give you market exposure, while gold and FD act as buffers. With ₹${amt.toLocaleString('en-IN')} over ${horiz} years, your expected returns are 10–13% p.a. Drawdowns of 20–30% can happen, but historically markets recover within 2–4 years. Stay the course! ⚖️`,
    3: `High risk, high reward territory! With stocks and high-vol assets, short-term swings of 40%+ are possible. But over ${horiz}+ years, equity historically outperforms all asset classes in India. Don't panic-sell on dips — SIP strategy would help average your cost. 🔥`
  };
  typeAI(aiMessages[vol]);
}

/* ══════════════════════════════════════════════
   CANVAS CHART
══════════════════════════════════════════════ */
function drawChart(paths, colors, labels, baseline) {
  const canvas = document.getElementById('simChart');
  const ctx    = canvas.getContext('2d');
  const dpr    = window.devicePixelRatio || 1;
  const wrap   = canvas.parentElement;
  canvas.width  = wrap.clientWidth  * dpr;
  canvas.height = wrap.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  const W = wrap.clientWidth, H = wrap.clientHeight;
  ctx.clearRect(0, 0, W, H);

  const allVals = paths.flat();
  const minV = Math.min(...allVals) * 0.95;
  const maxV = Math.max(...allVals) * 1.05;
  const len  = paths[0].length;

  const toX = i => (i / (len-1)) * (W-40) + 20;
  const toY = v => H-20 - ((v-minV) / (maxV-minV)) * (H-40);

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.setLineDash([4,4]); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(baseline));
  ctx.lineTo(toX(len-1), toY(baseline));
  ctx.stroke();
  ctx.setLineDash([]);

  paths.forEach((path, pi) => {
    const color = colors[pi];
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(path[0]));
    path.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
    ctx.lineTo(toX(len-1), H-20);
    ctx.lineTo(toX(0), H-20);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '22');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(path[0]));
    path.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke();

    const last = path[path.length-1];
    ctx.beginPath();
    ctx.arc(toX(len-1), toY(last), 4, 0, Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
  });
}

/* ══════════════════════════════════════════════
   RISK METER
══════════════════════════════════════════════ */
function setMeterPct(pct) {
  const fill  = document.getElementById('meterFill');
  const pctEl = document.getElementById('meterPct');
  const circum = 2 * Math.PI * 60;
  fill.style.strokeDashoffset = circum * (1 - pct/100);
  const color = pct < 30 ? 'var(--accent)' : pct < 60 ? 'var(--accent3)' : 'var(--accent2)';
  fill.style.stroke  = color;
  pctEl.textContent  = pct + '%';
  pctEl.style.color  = color;
}
setTimeout(() => setMeterPct(35), 500);

/* ══════════════════════════════════════════════
   RISK SELECTOR  ←  FastAPI /risk
══════════════════════════════════════════════ */
async function setRisk(r) {
  ['Low','Med','High'].forEach(k => {
    document.getElementById('rl'+k).className = 'risk-lvl';
  });
  const clsMap  = { low:'active-low', med:'active-med', high:'active-high' };
  const capKey  = r.charAt(0).toUpperCase() + r.slice(1);
  document.getElementById('rl'+capKey).classList.add(clsMap[r]);

  document.getElementById('loadMeter').classList.add('active');
  try {
    const data = await apiPost('/risk', { level: r });
    setMeterPct(data.loss_probability);
    document.getElementById('fearFill').style.width = data.fear_index + '%';
  } catch {
    const fallback = { low:{pct:12,fear:15}, med:{pct:35,fear:40}, high:{pct:68,fear:80} };
    const m = fallback[r];
    setMeterPct(m.pct);
    document.getElementById('fearFill').style.width = m.fear + '%';
  } finally {
    document.getElementById('loadMeter').classList.remove('active');
  }
}

/* ══════════════════════════════════════════════
   AI TYPEWRITER
══════════════════════════════════════════════ */
let typeTimeout = null;
function typeAI(msg) {
  const el = document.getElementById('aiText');
  el.textContent = '';
  let i = 0;
  clearTimeout(typeTimeout);
  function step() {
    if (i < msg.length) { el.textContent += msg[i++]; typeTimeout = setTimeout(step, 16); }
  }
  step();
}

/* ══════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════ */
function randNorm() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Ticker flicker */
setInterval(() => {
  document.querySelectorAll('.ticker-item').forEach(item => {
    const valEl = item.querySelector('.t-val');
    if (!valEl) return;
    valEl.className = 't-val ' + (Math.random() > 0.45 ? 'up' : 'down');
  });
}, 3000);

/* ═══════════════════════════════════════════════════════════════
   FEATURE 1 — EMOTIONAL ALERT SYSTEM
   POST /api/panic-alert
═══════════════════════════════════════════════════════════════ */

async function runPanicAlert() {
  const drop   = parseFloat(document.getElementById('dropInput').value) || 15;
  const amt    = parseFloat(document.getElementById('panicAmt').value)  || 50000;
  const btn    = document.getElementById('panicBtn');

  btn.disabled = true;
  btn.textContent = '⏳ Consulting history…';

  try {
    const data = await fetch(`${API_BASE}/api/panic-alert`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pct: drop, amount_invested: amt, asset: 'NIFTY 50' })
    }).then(r => r.json());

    renderPanicAlert(data, drop);

  } catch (err) {
    // Full local fallback — no API needed
    renderPanicAlertLocal(drop, amt);
  } finally {
    btn.disabled = false;
    btn.textContent = '🧘 Calm Me Down';
  }
}

function renderPanicAlert(data, drop) {
  document.getElementById('panicResult').style.display = 'block';

  // Severity → banner class + icon
  const sevMap = {
    minor:       { cls: 'sev-green',  icon: '😌', color: 'var(--accent)' },
    moderate:    { cls: 'sev-yellow', icon: '😬', color: 'var(--accent3)' },
    significant: { cls: 'sev-orange', icon: '😰', color: '#ff9900' },
    severe:      { cls: 'sev-red',    icon: '😱', color: 'var(--accent2)' },
  };
  const s = sevMap[data.severity] || sevMap.moderate;

  const banner = document.getElementById('panicBanner');
  banner.className = 'panic-banner ' + s.cls;
  document.getElementById('panicIcon').textContent     = s.icon;
  document.getElementById('panicHeadline').textContent = data.headline;
  document.getElementById('panicTone').textContent     = data.tone;
  document.getElementById('panicAction').textContent   = '💡 ' + data.action;

  // Stats
  const rs = data.recovery_stats;
  document.getElementById('psAvg').textContent   = rs.avg_months;
  document.getElementById('psBest').textContent  = rs.best_months;
  document.getElementById('psWorst').textContent = rs.worst_months;
  document.getElementById('psPaperLoss').textContent =
    '₹' + Math.round(data.paper_loss_inr).toLocaleString('en-IN');

  // Crash timeline chips
  const tl = document.getElementById('crashTimeline');
  tl.innerHTML = '';
  (data.all_crashes || []).forEach(crash => {
    const isClosest = crash.event === data.closest_crash.event;
    const chip = document.createElement('div');
    chip.className = 'crash-chip' + (isClosest ? ' highlighted' : '');
    chip.innerHTML = `
      <div class="cc-event">${crash.event} (${crash.year})</div>
      <div class="cc-drop">▼ ${crash.drop}% drop</div>
      <div class="cc-rec">↗ Recovered in ${crash.recovery_months} months</div>`;
    tl.appendChild(chip);
  });
}

function renderPanicAlertLocal(drop, amt) {
  // Local data — mirrors backend
  const crashes = [
    { event: 'COVID-19 Crash',     year: 2020, drop: 38, recovery_months: 6  },
    { event: 'IL&FS Crisis',       year: 2018, drop: 15, recovery_months: 14 },
    { event: 'Demonetisation',     year: 2016, drop: 10, recovery_months: 5  },
    { event: 'Global Fin. Crisis', year: 2008, drop: 60, recovery_months: 36 },
    { event: 'Dot-com Bust',       year: 2000, drop: 55, recovery_months: 48 },
    { event: 'Kargil War Dip',     year: 1999, drop: 18, recovery_months: 8  },
    { event: 'Harshad Mehta Scam', year: 1992, drop: 40, recovery_months: 24 },
  ];
  const closest  = crashes.reduce((a, b) => Math.abs(a.drop - drop) < Math.abs(b.drop - drop) ? a : b);
  const similar  = crashes.filter(c => c.drop >= drop * 0.6);
  const avgRec   = Math.round(similar.reduce((s, c) => s + c.recovery_months, 0) / similar.length);
  const bestRec  = Math.min(...similar.map(c => c.recovery_months));
  const worstRec = Math.max(...similar.map(c => c.recovery_months));

  let severity, headline, tone, action, cls, icon;
  if (drop <= 5) {
    severity = 'minor'; cls = 'sev-green'; icon = '😌';
    headline = 'This is normal market noise — not a crash.';
    tone = `A ${drop}% dip is everyday volatility. NIFTY 50 sees 5%+ swings multiple times per year. Long-term investors don't even notice these.`;
    action = 'No action needed. This is the market breathing. Stay invested.';
  } else if (drop <= 15) {
    severity = 'moderate'; cls = 'sev-yellow'; icon = '😬';
    headline = `A ${drop}% correction — uncomfortable but historically brief.`;
    tone = `Corrections of this size have happened ${similar.length} times in Indian market history. Every single one recovered fully.`;
    action = 'This is a good time to invest more via SIP — you\'re buying at a discount.';
  } else if (drop <= 35) {
    severity = 'significant'; cls = 'sev-orange'; icon = '😰';
    headline = `A sharp ${drop}% fall — but the market has seen worse and bounced back.`;
    tone = `The ${closest.event} of ${closest.year} saw a ${closest.drop}% crash and recovered fully in just ${closest.recovery_months} months.`;
    action = 'Panic selling locks in losses. Those who held through similar crashes saw massive gains in the following years.';
  } else {
    severity = 'severe'; cls = 'sev-red'; icon = '😱';
    headline = `A severe ${drop}% crash — this feels like the end, but it never is.`;
    tone = 'The 2008 Global Financial Crisis dropped 60% — worse than this. It fully recovered in 36 months and then went on to new all-time highs.';
    action = 'History shows: the biggest gains come to those who held during the scariest drops. Every bear market has eventually become a bull market.';
  }

  renderPanicAlert({
    severity, headline, tone, action,
    closest_crash: closest,
    recovery_stats: { avg_months: avgRec, best_months: bestRec, worst_months: worstRec },
    paper_loss_inr: amt * drop / 100,
    all_crashes: crashes,
  }, drop);
}


/* ═══════════════════════════════════════════════════════════════
   FEATURE 2 — WHAT IF I INVESTED EARLIER?
   POST /api/what-if
═══════════════════════════════════════════════════════════════ */

// Historical data (mirrors backend, for local fallback)
const WI_DATA = {
  NIFTY50:  { 2010:6135,2011:4624,2012:5905,2013:6304,2014:8283,2015:7946,2016:8186,2017:10531,2018:10863,2019:12168,2020:13982,2021:17354,2022:18105,2023:21732,2024:23500 },
  SENSEX:   { 2010:20509,2011:15455,2012:19427,2013:21171,2014:27499,2015:26118,2016:26626,2017:34057,2018:36068,2019:41254,2020:47751,2021:58254,2022:60841,2023:72241,2024:78000 },
  GOLD:     { 2010:18500,2011:27000,2012:30600,2013:29600,2014:27000,2015:25900,2016:28600,2017:29700,2018:31400,2019:38900,2020:51000,2021:47800,2022:52700,2023:62500,2024:72000 },
  BTC:      { 2013:8000,2014:28000,2015:14500,2016:47000,2017:980000,2018:220000,2019:510000,2020:2100000,2021:4800000,2022:1700000,2023:2900000,2024:6800000 },
  RELIANCE: { 2010:1050,2011:770,2012:875,2013:880,2014:910,2015:990,2016:1025,2017:1500,2018:1175,2019:1600,2020:2350,2021:2400,2022:2775,2023:2930,2024:2945 },
  INFOSYS:  { 2010:760,2011:700,2012:2300,2013:3250,2014:3900,2015:2200,2016:1000,2017:1005,2018:750,2019:745,2020:1100,2021:1750,2022:1600,2023:1420,2024:1900 },
};

let selectedAsset = 'NIFTY50';

// Fix slider year range per asset
const ASSET_MIN_YEAR = { NIFTY50:2010, SENSEX:2010, GOLD:2010, BTC:2013, RELIANCE:2010, INFOSYS:2010 };

function selectAsset(btn) {
  document.querySelectorAll('.asset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedAsset = btn.dataset.asset;

  const slider = document.getElementById('wiYear');
  const minYr  = ASSET_MIN_YEAR[selectedAsset] || 2010;
  slider.min   = minYr;
  if (+slider.value < minYr) {
    slider.value = minYr;
    document.getElementById('wiYearLabel').textContent = minYr;
  }
  syncSlider(slider, (+slider.value - minYr) / (2023 - minYr) * 100);
}

// Year slider wiring
const wiYearSlider = document.getElementById('wiYear');
if (wiYearSlider) {
  wiYearSlider.addEventListener('input', () => {
    const v = +wiYearSlider.value;
    document.getElementById('wiYearLabel').textContent = v;
    const minYr = ASSET_MIN_YEAR[selectedAsset] || 2010;
    syncSlider(wiYearSlider, (v - minYr) / (2023 - minYr) * 100);
  });
  syncSlider(wiYearSlider, (2020 - 2010) / 13 * 100);
}

async function runWhatIf() {
  const year = parseInt(document.getElementById('wiYear').value);
  const amt  = parseFloat(document.getElementById('wiAmount').value) || 10000;
  const btn  = document.getElementById('wiBtn');

  btn.disabled = true;
  btn.textContent = '⏳ Calculating…';

  try {
    const data = await fetch(`${API_BASE}/api/what-if`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset: selectedAsset, amount: amt, year })
    }).then(r => r.json());

    if (data.error) throw new Error(data.error);
    renderWhatIf(data);

  } catch (err) {
    // Full local fallback
    renderWhatIfLocal(selectedAsset, amt, year);
  } finally {
    btn.disabled = false;
    btn.textContent = '⏳ Show Me';
  }
}

function renderWhatIfLocal(asset, amt, year) {
  const prices = WI_DATA[asset];
  if (!prices || !prices[year]) {
    alert(`Year ${year} data not available for ${asset}`);
    return;
  }
  const allYears  = Object.keys(prices).map(Number).sort((a,b)=>a-b);
  const latestYr  = allYears[allYears.length - 1];
  const buyPrice  = prices[year];
  const nowPrice  = prices[latestYr];
  const units     = amt / buyPrice;
  const curVal    = units * nowPrice;
  const profit    = curVal - amt;
  const multiple  = curVal / amt;
  const yearsHeld = latestYr - year;
  const cagr      = yearsHeld > 0 ? (Math.pow(multiple, 1/yearsHeld) - 1) * 100 : 0;

  const yearly = allYears.filter(y => y >= year).map(y => ({
    year: y, value: units * prices[y], return_pct: (units * prices[y] / amt - 1) * 100
  }));

  const regret = [];
  [1, 3, 5].forEach(d => {
    const dy = year + d;
    if (prices[dy]) {
      const du = amt / prices[dy];
      const dv = du * nowPrice;
      regret.push({ delayed_by: d, delayed_year: dy, delayed_value: dv, missed_gains: curVal - dv });
    }
  });

  renderWhatIf({
    asset, amount_invested: amt, current_value: curVal, profit, multiple,
    cagr, years_held: yearsHeld, invested_year: year, latest_year: latestYr,
    yearly_growth: yearly, regret_analysis: regret,
    confidence_msg: `₹${amt.toLocaleString('en-IN')} invested in ${asset} in ${year} would be worth ₹${Math.round(curVal).toLocaleString('en-IN')} today — a ${multiple.toFixed(1)}× return in ${yearsHeld} years.`,
  });
}

function renderWhatIf(data) {
  document.getElementById('wiResult').style.display = 'block';

  document.getElementById('wiInvested').textContent = '₹' + Math.round(data.amount_invested).toLocaleString('en-IN');
  document.getElementById('wiYearTag').textContent  = 'in ' + data.invested_year;
  document.getElementById('wiFinalVal').textContent = '₹' + Math.round(data.current_value).toLocaleString('en-IN');
  document.getElementById('wiCagr').textContent     = `${data.cagr.toFixed(1)}% CAGR over ${data.years_held} years`;
  document.getElementById('wiMultipleBadge').textContent = `${data.multiple.toFixed(1)}× growth`;
  document.getElementById('wiProfit').textContent =
    `+₹${Math.round(data.profit).toLocaleString('en-IN')} profit`;
  document.getElementById('wiConfidence').textContent = data.confidence_msg;

  // Year-by-year chart
  drawWiChart(data.yearly_growth, data.amount_invested);

  // Regret cards
  const reg = document.getElementById('regretSection');
  reg.innerHTML = '';
  if (data.regret_analysis && data.regret_analysis.length) {
    const hdr = document.createElement('div');
    hdr.style.cssText = 'grid-column:1/-1;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;';
    hdr.textContent = '⏰ Cost of waiting — what delays cost you';
    reg.appendChild(hdr);

    data.regret_analysis.forEach(r => {
      const card = document.createElement('div');
      card.className = 'regret-card';
      card.innerHTML = `
        <div class="rc-delay">If waited ${r.delayed_by} yr${r.delayed_by>1?'s':''}</div>
        <div class="rc-val">₹${Math.round(r.delayed_value).toLocaleString('en-IN')}</div>
        <div class="rc-miss">Lost ₹${Math.round(r.missed_gains).toLocaleString('en-IN')}</div>`;
      reg.appendChild(card);
    });
  }
}

/* ── What-If Line Chart ── */
function drawWiChart(yearlyData, invested) {
  const canvas = document.getElementById('wiChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr  = window.devicePixelRatio || 1;
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth  * dpr;
  canvas.height = wrap.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  const W = wrap.clientWidth, H = wrap.clientHeight;
  ctx.clearRect(0, 0, W, H);

  const values = yearlyData.map(d => d.value);
  const minV   = Math.min(invested * 0.7, ...values);
  const maxV   = Math.max(...values) * 1.05;
  const len    = yearlyData.length;

  const toX = i => len > 1 ? (i / (len-1)) * (W - 40) + 20 : W/2;
  const toY = v => H - 20 - ((v - minV) / (maxV - minV)) * (H - 40);

  // Invested baseline
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(invested));
  ctx.lineTo(toX(len-1), toY(invested));
  ctx.stroke();
  ctx.setLineDash([]);

  // Area fill
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(values[0]));
  values.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
  ctx.lineTo(toX(len-1), H - 20);
  ctx.lineTo(toX(0), H - 20);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#00e5a033');
  grad.addColorStop(1, '#00e5a000');
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(values[0]));
  values.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
  ctx.strokeStyle = '#00e5a0'; ctx.lineWidth = 2; ctx.stroke();

  // Year labels (every 2nd)
  ctx.fillStyle = 'rgba(107,117,145,0.8)';
  ctx.font = '9px DM Mono, monospace';
  ctx.textAlign = 'center';
  yearlyData.forEach((d, i) => {
    if (i % 2 === 0 || i === len - 1) {
      ctx.fillText(d.year, toX(i), H - 5);
    }
  });

  // End dot + label
  const last  = values[values.length - 1];
  const lastX = toX(len - 1);
  const lastY = toY(last);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#00e5a0'; ctx.fill();
}


/* ═══════════════════════════════════════════════════════════════
   INVESTOR PERSONALITY QUIZ — Module 07
   8 questions · 4 profiles · fully self-contained, no external links
═══════════════════════════════════════════════════════════════ */

const QUIZ_QUESTIONS = [
  {
    id: 1,
    q: "The market drops 20% in a week. What's your gut reaction?",
    sub: "Be honest — there are no wrong answers here.",
    options: [
      { key: "A", label: "Buy more immediately", detail: "Corrections are opportunities I've been waiting for.", score: { risk: 4, patience: 4, knowledge: 3 } },
      { key: "B", label: "Wait and watch", detail: "I'll reassess after things stabilise a bit.", score: { risk: 2, patience: 3, knowledge: 2 } },
      { key: "C", label: "Sell half, protect capital", detail: "Better to preserve what I have than risk more.", score: { risk: 1, patience: 1, knowledge: 1 } },
      { key: "D", label: "Panic and sell everything", detail: "I can't stomach seeing my money disappear.", score: { risk: 0, patience: 0, knowledge: 0 } },
    ]
  },
  {
    id: 2,
    q: "You have ₹1 lakh to invest. How do you split it?",
    sub: "Choose the allocation closest to what you'd actually do.",
    options: [
      { key: "A", label: "100% in stocks / crypto", detail: "Maximum growth potential — I trust the long term.", score: { risk: 4, patience: 4, knowledge: 3 } },
      { key: "B", label: "60% equity, 30% MF, 10% FD", detail: "Mostly growth with a small safety net.", score: { risk: 3, patience: 3, knowledge: 3 } },
      { key: "C", label: "40% equity, 30% gold, 30% FD", detail: "Balanced — I want growth but hate big losses.", score: { risk: 2, patience: 2, knowledge: 2 } },
      { key: "D", label: "100% in FD or savings account", detail: "Safety first. I'm not comfortable with market risk.", score: { risk: 0, patience: 1, knowledge: 1 } },
    ]
  },
  {
    id: 3,
    q: "What is your investment time horizon?",
    sub: "When do you actually need this money back?",
    options: [
      { key: "A", label: "10+ years", detail: "I'm building long-term wealth. Time is my advantage.", score: { risk: 4, patience: 4, knowledge: 3 } },
      { key: "B", label: "5–10 years", detail: "Medium-term. I want growth but will need it eventually.", score: { risk: 3, patience: 3, knowledge: 2 } },
      { key: "C", label: "2–5 years", detail: "I have a goal in a few years (house, education, etc.).", score: { risk: 1, patience: 2, knowledge: 2 } },
      { key: "D", label: "Less than 2 years", detail: "I might need this money soon.", score: { risk: 0, patience: 0, knowledge: 1 } },
    ]
  },
  {
    id: 4,
    q: "How would you describe your investment knowledge?",
    sub: "Honest self-assessment helps build the right portfolio.",
    options: [
      { key: "A", label: "Expert — I study markets daily", detail: "I understand derivatives, valuations, macro.", score: { risk: 3, patience: 3, knowledge: 4 } },
      { key: "B", label: "Intermediate — I track my portfolio", detail: "I know the basics: PE ratios, SIPs, diversification.", score: { risk: 2, patience: 2, knowledge: 3 } },
      { key: "C", label: "Beginner — I'm still learning", detail: "I know FDs, mutual funds. Markets feel confusing.", score: { risk: 1, patience: 2, knowledge: 1 } },
      { key: "D", label: "None — this is new to me", detail: "I've never invested before this.", score: { risk: 0, patience: 1, knowledge: 0 } },
    ]
  },
  {
    id: 5,
    q: "Your portfolio is up 40% in a year. What do you do?",
    sub: "A good question tests how you handle both gains and losses.",
    options: [
      { key: "A", label: "Reinvest everything, stay fully invested", detail: "Compounding is the game. I don't touch winners.", score: { risk: 4, patience: 4, knowledge: 3 } },
      { key: "B", label: "Take out 20%, let the rest ride", detail: "Book some profits while keeping exposure.", score: { risk: 3, patience: 3, knowledge: 3 } },
      { key: "C", label: "Rebalance back to original allocation", detail: "Discipline over greed. Stick to the plan.", score: { risk: 2, patience: 3, knowledge: 4 } },
      { key: "D", label: "Sell everything and celebrate", detail: "I got lucky — better to lock it in.", score: { risk: 0, patience: 0, knowledge: 0 } },
    ]
  },
  {
    id: 6,
    q: "How much of your monthly income do you currently invest?",
    sub: "Your savings rate tells us a lot about your financial discipline.",
    options: [
      { key: "A", label: "More than 30%", detail: "Investing is my top priority after essentials.", score: { risk: 4, patience: 4, knowledge: 3 } },
      { key: "B", label: "15–30%", detail: "I invest a meaningful chunk every month consistently.", score: { risk: 3, patience: 3, knowledge: 2 } },
      { key: "C", label: "5–15%", detail: "I invest when I can, but expenses eat a lot.", score: { risk: 1, patience: 2, knowledge: 2 } },
      { key: "D", label: "Less than 5% or nothing", detail: "I haven't been able to invest regularly yet.", score: { risk: 0, patience: 1, knowledge: 1 } },
    ]
  },
  {
    id: 7,
    q: "A friend gives you a \"hot tip\" on a small-cap stock. What do you do?",
    sub: "How you respond to tips reveals your investment discipline.",
    options: [
      { key: "A", label: "Research it thoroughly, then decide", detail: "Tips are starting points, not decisions.", score: { risk: 3, patience: 3, knowledge: 4 } },
      { key: "B", label: "Invest a small amount to test it", detail: "A small bet won't hurt if it goes wrong.", score: { risk: 2, patience: 2, knowledge: 2 } },
      { key: "C", label: "Invest big — my friend knows people", detail: "FOMO is real. I don't want to miss a 10×.", score: { risk: 4, patience: 0, knowledge: 0 } },
      { key: "D", label: "Ignore it completely", detail: "Tips are noise. I stick to my strategy.", score: { risk: 1, patience: 4, knowledge: 3 } },
    ]
  },
  {
    id: 8,
    q: "What's your #1 financial goal right now?",
    sub: "Your goal shapes your ideal portfolio more than anything else.",
    options: [
      { key: "A", label: "Build generational wealth", detail: "I'm investing for the long arc — decades, not years.", score: { risk: 4, patience: 4, knowledge: 3 } },
      { key: "B", label: "Retire early (FIRE)", detail: "Financial independence is my endgame.", score: { risk: 3, patience: 4, knowledge: 3 } },
      { key: "C", label: "Save for a big purchase (house, car)", detail: "I have a specific goal in 3–7 years.", score: { risk: 2, patience: 2, knowledge: 2 } },
      { key: "D", label: "Just protect my savings from inflation", detail: "I want to preserve what I have.", score: { risk: 1, patience: 2, knowledge: 1 } },
    ]
  },
];

const QUIZ_PROFILES = {
  dragon: {
    name: "The Dragon Investor",
    emoji: "🐉",
    tagline: "Bold, fearless, and built for the long game. You see market crashes as fire sales, not disasters. Your conviction and high risk tolerance make you a natural wealth builder — if you pair that fire with discipline.",
    bannerClass: "sev-orange",
    scoreColor: "var(--accent2)",
    traits: [
      { icon: "🔥", name: "High Risk Tolerance",    desc: "You can stomach 40%+ drawdowns without panic selling." },
      { icon: "⏳", name: "Long-Term Thinking",     desc: "Decades, not quarters, are your measuring unit." },
      { icon: "📚", name: "Continuous Learner",     desc: "You actively study markets and stay informed." },
    ],
    doInvest: [
      "Direct equity (large & mid cap SIP)",
      "Small-cap funds for satellite portfolio",
      "Index ETFs (NIFTY 50, NIFTY Next 50)",
      "International funds for diversification",
    ],
    beCareful: [
      "Overconcentration in a single sector",
      "Leveraged positions without hedging",
      "Ignoring rebalancing in bull markets",
      "FOMO-driven tips and penny stocks",
    ],
    alloc: { equity: 70, mf: 20, gold: 5, fd: 5 },
    scoreBarColor: "#ff4d6d",
  },
  owl: {
    name: "The Owl Investor",
    emoji: "🦉",
    tagline: "Wise, research-driven, and patient. You never act on emotion — every decision is backed by data. You might not take the biggest risks, but your consistency and knowledge compound quietly into serious wealth.",
    bannerClass: "sev-yellow",
    scoreColor: "var(--accent3)",
    traits: [
      { icon: "🔬", name: "Research-First",         desc: "You study before every investment decision." },
      { icon: "⚖️", name: "Disciplined Rebalancer", desc: "Your portfolio stays on target through all market cycles." },
      { icon: "🧘", name: "Emotionally Stable",     desc: "News cycles don't move you — your thesis does." },
    ],
    doInvest: [
      "Diversified equity mutual funds (SIP)",
      "NIFTY 50 index ETF as core holding",
      "Gold ETF (15–20%) as a hedge",
      "Short-duration debt funds for stability",
    ],
    beCareful: [
      "Over-analysing and delaying entry",
      "Holding too much cash during bull markets",
      "Avoiding all risk even with a long horizon",
      "Paralysis by analysis on asset selection",
    ],
    alloc: { equity: 50, mf: 30, gold: 15, fd: 5 },
    scoreBarColor: "#ffd166",
  },
  turtle: {
    name: "The Turtle Investor",
    emoji: "🐢",
    tagline: "Slow and steady wins the race. You prioritise capital preservation over aggressive growth, and that's a legitimate strategy. With patience and the right instruments, your consistent approach builds real security.",
    bannerClass: "sev-green",
    scoreColor: "var(--accent)",
    traits: [
      { icon: "🛡️", name: "Capital Preserver",     desc: "You'd rather miss a gain than take a permanent loss." },
      { icon: "🔄", name: "Consistent Saver",       desc: "Regular SIPs regardless of market conditions." },
      { icon: "🌱", name: "Learning Investor",      desc: "You're building knowledge alongside your portfolio." },
    ],
    doInvest: [
      "Large-cap equity mutual funds (low volatility)",
      "Balanced advantage / hybrid funds",
      "Gold ETF as a significant hedge (25%+)",
      "FDs and RDs for guaranteed stability",
    ],
    beCareful: [
      "Keeping too much in FDs (inflation risk)",
      "Missing equity allocation entirely",
      "Reacting to short-term market volatility",
      "Not increasing SIP amount as income grows",
    ],
    alloc: { equity: 30, mf: 30, gold: 25, fd: 15 },
    scoreBarColor: "#00e5a0",
  },
  phoenix: {
    name: "The Phoenix Investor",
    emoji: "🦅",
    tagline: "You're rising from ground zero — and that's the most exciting place to start. Every expert investor once knew nothing. Your awareness that you need to learn is actually your biggest strength right now.",
    bannerClass: "sev-green",
    scoreColor: "var(--accent)",
    traits: [
      { icon: "🌟", name: "Fresh Start Energy",    desc: "No bad habits yet — perfect time to build good ones." },
      { icon: "💡", name: "Awareness Seeker",      desc: "You know what you don't know — that's rare wisdom." },
      { icon: "📈", name: "Growth Potential",      desc: "Biggest learning curve = biggest opportunity ahead." },
    ],
    doInvest: [
      "Start with ₹500/month SIP in a large-cap fund",
      "One NIFTY 50 index ETF (simple, low-cost)",
      "PPF or ELSS for tax-saving discipline",
      "Emergency fund first — 6 months expenses in FD",
    ],
    beCareful: [
      "Stock tips from social media / friends",
      "Penny stocks and F&O trading",
      "Investing money you need within 1 year",
      "Skipping the emergency fund to invest more",
    ],
    alloc: { equity: 20, mf: 40, gold: 10, fd: 30 },
    scoreBarColor: "#00e5a0",
  },
};

/* ── State ── */
let quizCurrent = 0;
let quizAnswers = new Array(QUIZ_QUESTIONS.length).fill(null);
let quizTotalScore = { risk: 0, patience: 0, knowledge: 0 };

/* ── Init ── */
function quizRender() {
  const q   = QUIZ_QUESTIONS[quizCurrent];
  const pct = ((quizCurrent) / QUIZ_QUESTIONS.length * 100).toFixed(0);

  document.getElementById('quizProgressFill').style.width = pct + '%';
  document.getElementById('quizStepLabel').textContent    = `Q ${quizCurrent + 1} / ${QUIZ_QUESTIONS.length}`;
  document.getElementById('quizPrevBtn').disabled         = quizCurrent === 0;

  const nextBtn = document.getElementById('quizNextBtn');
  nextBtn.textContent = quizCurrent === QUIZ_QUESTIONS.length - 1 ? 'See My Profile →' : 'Next →';
  nextBtn.classList.toggle('ready', quizAnswers[quizCurrent] !== null);

  const block = document.getElementById('quizQuestionBlock');
  block.innerHTML = `
    <div class="quiz-q-number">Question ${q.id} of ${QUIZ_QUESTIONS.length}</div>
    <div class="quiz-q-text">${q.q}</div>
    ${q.sub ? `<div class="quiz-q-sub">${q.sub}</div>` : ''}
    <div class="quiz-options" id="quizOptions">
      ${q.options.map((opt, idx) => `
        <button class="quiz-option${quizAnswers[quizCurrent] === idx ? ' selected' : ''}"
                onclick="quizSelect(${idx})" data-idx="${idx}">
          <div class="qo-key">${opt.key}</div>
          <div class="qo-text">
            <strong>${opt.label}</strong>
            <span>${opt.detail}</span>
          </div>
        </button>`).join('')}
    </div>`;
}

function quizSelect(idx) {
  quizAnswers[quizCurrent] = idx;
  document.querySelectorAll('.quiz-option').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });
  document.getElementById('quizNextBtn').classList.add('ready');
}

function quizNext() {
  if (quizAnswers[quizCurrent] === null) return;
  if (quizCurrent < QUIZ_QUESTIONS.length - 1) {
    quizCurrent++;
    quizRender();
  } else {
    quizFinish();
  }
}

function quizPrev() {
  if (quizCurrent > 0) { quizCurrent--; quizRender(); }
}

function quizFinish() {
  // Tally scores
  let risk = 0, patience = 0, knowledge = 0;
  quizAnswers.forEach((ansIdx, qIdx) => {
    if (ansIdx === null) return;
    const s = QUIZ_QUESTIONS[qIdx].options[ansIdx].score;
    risk     += s.risk;
    patience += s.patience;
    knowledge+= s.knowledge;
  });

  const maxPerDim = QUIZ_QUESTIONS.length * 4;
  const riskPct   = risk     / maxPerDim * 100;
  const patPct    = patience / maxPerDim * 100;
  const knowPct   = knowledge/ maxPerDim * 100;
  const total     = (riskPct + patPct + knowPct) / 3;

  // Profile selection
  let profile;
  if (total >= 65 && riskPct >= 60)         profile = QUIZ_PROFILES.dragon;
  else if (total >= 55 && knowPct >= 60)    profile = QUIZ_PROFILES.owl;
  else if (total >= 35)                     profile = QUIZ_PROFILES.turtle;
  else                                      profile = QUIZ_PROFILES.phoenix;

  quizShowResult(profile, { riskPct, patPct, knowPct, total });
}

function quizShowResult(p, scores) {
  document.getElementById('quizScreen').style.display       = 'none';
  document.getElementById('quizResultScreen').style.display = 'block';

  const bannerBg = {
    'sev-green':  'rgba(0,229,160,0.08)',
    'sev-yellow': 'rgba(255,209,102,0.08)',
    'sev-orange': 'rgba(255,140,0,0.08)',
    'sev-red':    'rgba(255,77,109,0.08)',
  };
  const bannerBorder = {
    'sev-green':  'rgba(0,229,160,0.3)',
    'sev-yellow': 'rgba(255,209,102,0.3)',
    'sev-orange': 'rgba(255,140,0,0.35)',
    'sev-red':    'rgba(255,77,109,0.3)',
  };

  const dims = [
    { label: 'Risk Tolerance',   pct: scores.riskPct,  color: '#ff4d6d' },
    { label: 'Patience & Discipline', pct: scores.patPct,  color: '#ffd166' },
    { label: 'Market Knowledge', pct: scores.knowPct, color: '#00e5a0' },
  ];

  const allocBars = Object.entries(p.alloc).map(([k, v]) => {
    const colors = { equity: 'var(--accent)', mf: 'var(--accent3)', gold: '#c084fc', fd: 'var(--muted)' };
    const labels = { equity: 'Equity', mf: 'Mutual Funds', gold: 'Gold ETF', fd: 'Fixed Deposit' };
    return `<div class="pbar-row">
      <span>${labels[k]}</span>
      <div class="pbar-track"><div class="pbar-fill" style="width:${v}%;background:${colors[k]};"></div></div>
      <span class="pbar-pct">${v}%</span>
    </div>`;
  }).join('');

  document.getElementById('quizResult').innerHTML = `
    <div class="result-profile-banner"
         style="background:${bannerBg[p.bannerClass]};border-color:${bannerBorder[p.bannerClass]};">
      <div class="result-emoji">${p.emoji}</div>
      <div class="result-type-label" style="color:${p.scoreColor}">Your Investor Profile</div>
      <div class="result-type-name">${p.name}</div>
      <div class="result-tagline" style="color:var(--muted)">${p.tagline}</div>
    </div>

    <div class="result-score-bar-wrap">
      ${dims.map(d => `
        <div style="margin-bottom:14px">
          <div class="rsb-label"><span>${d.label}</span><span style="color:${d.color}">${Math.round(d.pct)}%</span></div>
          <div class="rsb-track"><div class="rsb-fill" style="width:${d.pct}%;background:${d.color}"></div></div>
        </div>`).join('')}
    </div>

    <div class="result-traits-grid">
      ${p.traits.map(t => `
        <div class="trait-card">
          <div class="trait-icon">${t.icon}</div>
          <div class="trait-name">${t.name}</div>
          <div class="trait-desc">${t.desc}</div>
        </div>`).join('')}
    </div>

    <div class="result-reco-grid">
      <div class="reco-box">
        <div class="reco-box-title">✅ Invest in these</div>
        ${p.doInvest.map(r => `<div class="reco-item"><div class="reco-dot good"></div><span>${r}</span></div>`).join('')}
      </div>
      <div class="reco-box">
        <div class="reco-box-title">⚠️ Be careful about</div>
        ${p.beCareful.map(r => `<div class="reco-item"><div class="reco-dot warn"></div><span>${r}</span></div>`).join('')}
      </div>
    </div>

    <div style="margin-bottom:16px;">
      <div class="card-label" style="margin-bottom:12px;">Recommended allocation for your profile</div>
      <div class="portfolio-bars">${allocBars}</div>
    </div>

    <button class="quiz-retake-btn" onclick="quizRetake()">↩ Retake Quiz</button>
  `;

  // Animate bars after DOM paint
  setTimeout(() => {
    document.querySelectorAll('.rsb-fill').forEach(el => {
      const w = el.style.width;
      el.style.width = '0%';
      setTimeout(() => { el.style.width = w; }, 50);
    });
  }, 100);
}

function quizRetake() {
  quizCurrent = 0;
  quizAnswers = new Array(QUIZ_QUESTIONS.length).fill(null);
  document.getElementById('quizResultScreen').style.display = 'none';
  document.getElementById('quizScreen').style.display      = 'block';
  quizRender();
}

// Boot quiz on load
quizRender();


