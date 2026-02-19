// script.js
const STORAGE_KEY = 'shottracker_v4';
let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
let historySnapshot = null;

// Charts
let sessionChartInstance = null;
let dayChartInstance = null;

// UI elements
const datePicker = document.getElementById('datePicker');
const prevDayBtn = document.getElementById('prevDayBtn');
const nextDayBtn = document.getElementById('nextDayBtn');
const sessionSelect = document.getElementById('sessionSelect');
const newSessionBtn = document.getElementById('newSessionBtn');
const renameSessionBtn = document.getElementById('renameSessionBtn');
const deleteSessionBtn = document.getElementById('deleteSessionBtn');
const hitBtn = document.getElementById('hitBtn');
const missBtn = document.getElementById('missBtn');
const sessionStatsEl = document.getElementById('sessionStats');
const dayStatsEl = document.getElementById('dayStats');
const totalStatsEl = document.getElementById('totalStats');
const rollingAvgEl = document.getElementById('rollingAvg');
const sessionChartEl = document.getElementById('sessionChart');
const dayChartEl = document.getElementById('dayChart');
const undoBtn = document.getElementById('undoBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const deleteDayBtn = document.getElementById('deleteDayBtn');
const notesInput = document.getElementById('notes');
const saveNotesBtn = document.getElementById('saveNotesBtn');

let selectedDate = new Date().toISOString().slice(0,10);
let currentSessionId = null;

// init date picker
datePicker.value = selectedDate;

// ensure selectedDate exists in db
function ensureDay(date) {
  if (!db[date]) db[date] = { date, sessions: [] };
}

// persist
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// snapshot for undo
function takeSnapshot() {
  historySnapshot = JSON.parse(JSON.stringify(db));
  undoBtn.disabled = false;
}

// undo
function undo() {
  if (!historySnapshot) return;
  db = historySnapshot;
  historySnapshot = null;
  persist();
  render();
  undoBtn.disabled = true;
}

// helpers
function formatPct(made, attempts) {
  return attempts ? (made/attempts*100).toFixed(1) + '%' : '0.0%';
}

function totalForDay(day) {
  const sessions = db[day].sessions || [];
  const attempts = sessions.reduce((s,a)=>s+a.attempts,0);
  const made = sessions.reduce((s,a)=>s+a.made,0);
  return { attempts, made };
}

function totalAllDays() {
  const days = Object.keys(db);
  let attempts = 0, made = 0;
  days.forEach(d=>{
    db[d].sessions.forEach(s=>{
      attempts += s.attempts;
      made += s.made;
    });
  });
  return { attempts, made };
}

function computeRollingAverage(dateISO, window=7) {
  const allDays = Object.keys(db).sort();
  const idx = allDays.indexOf(dateISO);
  if (idx === -1) return null;
  const start = Math.max(0, idx - (window-1));
  const slice = allDays.slice(start, idx+1);
  let made=0, attempts=0;
  slice.forEach(d=>{
    db[d].sessions.forEach(s=>{
      made += s.made; attempts += s.attempts;
    });
  });
  return attempts ? (made/attempts*100).toFixed(1) + '%' : '0.0%';
}

// UI actions
function changeDate(newDate) {
  selectedDate = newDate;
  datePicker.value = selectedDate;
  ensureDay(selectedDate);
  // reset session selection if session id not present
  const sessions = db[selectedDate].sessions;
  currentSessionId = sessions.length ? sessions[0].id : null;
  render();
}

prevDayBtn.onclick = () => {
  const d = new Date(selectedDate);
  d.setDate(d.getDate()-1);
  const iso = d.toISOString().slice(0,10);
  if (!db[iso]) ensureDay(iso);
  changeDate(iso);
};
nextDayBtn.onclick = () => {
  const d = new Date(selectedDate);
  d.setDate(d.getDate()+1);
  const iso = d.toISOString().slice(0,10);
  if (!db[iso]) ensureDay(iso);
  changeDate(iso);
};
datePicker.onchange = (e) => {
  const iso = e.target.value;
  ensureDay(iso);
  changeDate(iso);
};

newSessionBtn.onclick = () => {
  takeSnapshot();
  const id = Date.now().toString();
  const name = `Session ${db[selectedDate].sessions.length + 1}`;
  db[selectedDate].sessions.push({ id, name, attempts:0, made:0, createdAt: Date.now(), notes: '' });
  currentSessionId = id;
  persist();
  render();
};

sessionSelect.onchange = (e) => {
  currentSessionId = e.target.value;
  render();
};

renameSessionBtn.onclick = () => {
  if (!currentSessionId) return;
  const session = db[selectedDate].sessions.find(s=>s.id===currentSessionId);
  const newName = prompt('Neuer Session-Name:', session.name);
  if (newName===null) return;
  takeSnapshot();
  session.name = newName.trim() || session.name;
  persist();
  render();
};

deleteSessionBtn.onclick = () => {
  if (!currentSessionId) return;
  if (!confirm('Session wirklich löschen?')) return;
  takeSnapshot();
  db[selectedDate].sessions = db[selectedDate].sessions.filter(s=>s.id!==currentSessionId);
  currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
  persist();
  render();
};

deleteDayBtn.onclick = () => {
  if (!confirm('Ganzen Tag löschen? Diese Aktion ist endgültig.')) return;
  takeSnapshot();
  delete db[selectedDate];
  // pick nearest existing day or today
  const days = Object.keys(db).sort();
  selectedDate = days.length ? days[days.length-1] : new Date().toISOString().slice(0,10);
  ensureDay(selectedDate);
  currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
  persist();
  render();
};

saveNotesBtn.onclick = () => {
  if (!currentSessionId) return;
  takeSnapshot();
  const session = db[selectedDate].sessions.find(s=>s.id===currentSessionId);
  session.notes = notesInput.value;
  persist();
  render();
};

hitBtn.onclick = () => {
  if (!currentSessionId) { alert('Zuerst eine Session erstellen.'); return; }
  takeSnapshot();
  const s = db[selectedDate].sessions.find(x=>x.id===currentSessionId);
  s.attempts++; s.made++;
  persist();
  render();
};

missBtn.onclick = () => {
  if (!currentSessionId) { alert('Zuerst eine Session erstellen.'); return; }
  takeSnapshot();
  const s = db[selectedDate].sessions.find(x=>x.id===currentSessionId);
  s.attempts++;
  persist();
  render();
};

undoBtn.onclick = () => undo();
undoBtn.disabled = true;

exportCsvBtn.onclick = () => exportCsv();

function exportCsv() {
  const rows = [['day','sessionId','sessionName','attempts','made','createdAt','notes']];
  Object.keys(db).sort().forEach(day=>{
    db[day].sessions.forEach(s=>{
      rows.push([day, s.id, s.name, s.attempts, s.made, new Date(s.createdAt).toISOString(), (s.notes||'').replace(/\n/g,' ')]);
    });
  });
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '3pt-tracker-export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// rendering
function render() {
  ensureDay(selectedDate);
  datePicker.value = selectedDate;

  // sessions dropdown
  sessionSelect.innerHTML = '';
  db[selectedDate].sessions.forEach(s=>{
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    sessionSelect.appendChild(opt);
  });
  if (currentSessionId && db[selectedDate].sessions.find(s=>s.id===currentSessionId)) {
    sessionSelect.value = currentSessionId;
  } else {
    currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
    sessionSelect.value = currentSessionId;
  }

  // session stats
  if (currentSessionId) {
    const s = db[selectedDate].sessions.find(x=>x.id===currentSessionId);
    sessionStatsEl.textContent = `Session: ${s.made} / ${s.attempts} (${formatPct(s.made,s.attempts)})`;
    notesInput.value = s.notes || '';
  } else {
    sessionStatsEl.textContent = `Session: -`;
    notesInput.value = '';
  }

  // day stats
  const dayTotals = totalForDay(selectedDate);
  dayStatsEl.textContent = `Tag: ${dayTotals.made} / ${dayTotals.attempts} (${formatPct(dayTotals.made, dayTotals.attempts)})`;

  // overall stats
  const all = totalAllDays();
  totalStatsEl.textContent = `Gesamt: ${all.made} / ${all.attempts} (${formatPct(all.made, all.attempts)})`;

  // rolling avg for selected day
  const rolling = computeRollingAverage(selectedDate,7);
  rollingAvgEl.textContent = `7-Tage Durchschnitt (bis ${selectedDate}): ${rolling || 'N/A'}`;

  renderSessionChart();
  renderDayChart();
}

// charts
function renderSessionChart() {
  if (sessionChartInstance) sessionChartInstance.destroy();
  const labels = db[selectedDate].sessions.map(s=>s.name);
  const data = db[selectedDate].sessions.map(s=> s.attempts ? +(s.made/s.attempts*100).toFixed(1) : 0);
  const counts = db[selectedDate].sessions.map(s=>s.attempts);
  sessionChartInstance = new Chart(sessionChartEl, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Quote %', data, yAxisID:'y1' },
        { label: 'Würfe', data: counts, yAxisID:'y2' }
      ]
    },
    options: {
      responsive:true,
      interaction:{mode:'index', intersect:false},
      scales: {
        y1: { type:'linear', position:'left', title:{display:true,text:'Quote %'} },
        y2: { type:'linear', position:'right', title:{display:true,text:'Würfe'}, grid:{drawOnChartArea:false} }
      },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderDayChart() {
  if (dayChartInstance) dayChartInstance.destroy();
  const dayKeys = Object.keys(db).sort();
  const pctData = dayKeys.map(d => {
    const t = totalForDay(d);
    return t.attempts ? +(t.made/t.attempts*100).toFixed(1) : 0;
  });
  // rolling 7 day average as dataset
  const rolling = dayKeys.map((d,i=>{
    const sliceStart = Math.max(0, i-6);
    const slice = dayKeys.slice(sliceStart, i+1);
    let made=0, attempts=0;
    slice.forEach(x => {
      db[x].sessions.forEach(s=>{
        made += s.made; attempts += s.attempts;
      });
    });
    return attempts ? +(made/attempts*100).toFixed(1) : null;
  }));

  dayChartInstance = new Chart(dayChartEl, {
    type: 'line',
    data: {
      labels: dayKeys,
      datasets: [
        { label: 'Tagesquote %', data: pctData, fill:false, tension:0.2 },
        { label: '7-Tage Durchschnitt %', data: rolling, fill:false, tension:0.2, borderDash: [6,4] }
      ]
    },
    options: {
      responsive:true,
      interaction:{mode:'index', intersect:false},
      plugins:{ legend:{position:'bottom'} },
      scales:{ y: { title:{display:true,text:'Quote %'} } }
    }
  });
}

// initial boot
(function boot(){
  // ensure today exists
  ensureDay(selectedDate);
  // set default session if none
  if (!db[selectedDate].sessions.length) {
    const id = Date.now().toString();
    db[selectedDate].sessions.push({ id, name:'Session 1', attempts:0, made:0, createdAt: Date.now(), notes:'' });
    currentSessionId = id;
    persist();
  } else {
    currentSessionId = db[selectedDate].sessions[0].id;
  }
  render();
})();

// expose for debugging (optional)
window._shottracker = { db, persist, exportCsv };
