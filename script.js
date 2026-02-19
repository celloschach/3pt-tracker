document.addEventListener('DOMContentLoaded', () => {

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

  // helpers
  function ensureDay(date) {
    if (!db[date]) db[date] = { date, sessions: [] };
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function takeSnapshot() {
    historySnapshot = JSON.parse(JSON.stringify(db));
    undoBtn.disabled = false;
  }

  function undo() {
    if (!historySnapshot) return;
    db = historySnapshot;
    historySnapshot = null;
    persist();
    render();
    undoBtn.disabled = true;
  }

  function formatPct(made, attempts) {
    return attempts ? (Math.round(made/attempts*100)) + '%' : '0%';
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
    return attempts ? (Math.round(made/attempts*100)) + '%' : '0%';
  }

  // UI actions
  function changeDate(newDate) {
    selectedDate = newDate;
    datePicker.value = selectedDate;
    ensureDay(selectedDate);
    const sessions = db[selectedDate].sessions;
    currentSessionId = sessions.length ? sessions[0].id : null;
    render();
  }

  prevDayBtn.addEventListener('click', () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate()-1);
    const iso = d.toISOString().slice(0,10);
    ensureDay(iso);
    changeDate(iso);
  });

  nextDayBtn.addEventListener('click', () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate()+1);
    const iso = d.toISOString().slice(0,10);
    ensureDay(iso);
    changeDate(iso);
  });

  datePicker.addEventListener('change', (e) => {
    const iso = e.target.value;
    ensureDay(iso);
    changeDate(iso);
  });

  newSessionBtn.addEventListener('click', () => {
    takeSnapshot();
    const id = Date.now().toString();
    const name = `Session ${db[selectedDate].sessions.length + 1}`;
    db[selectedDate].sessions.push({ id, name, attempts:0, made:0, createdAt: Date.now(), notes: '' });
    currentSessionId = id;
    persist();
    render();
  });

  sessionSelect.addEventListener('change', (e) => {
    currentSessionId = e.target.value;
    render();
  });

  renameSessionBtn.addEventListener('click', () => {
    if (!currentSessionId) return;
    const session = db[selectedDate].sessions.find(s=>s.id===currentSessionId);
    const newName = prompt('Neuer Session-Name:', session.name);
    if (newName===null) return;
    takeSnapshot();
    session.name = newName.trim() || session.name;
    persist();
    render();
  });

  deleteSessionBtn.addEventListener('click', () => {
    if (!currentSessionId) return;
    if (!confirm('Session wirklich löschen?')) return;
    takeSnapshot();
    db[selectedDate].sessions = db[selectedDate].sessions.filter(s=>s.id!==currentSessionId);
    currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
    persist();
    render();
  });

  deleteDayBtn.addEventListener('click', () => {
    if (!confirm('Ganzen Tag löschen? Diese Aktion ist endgültig.')) return;
    takeSnapshot();
    delete db[selectedDate];
    const days = Object.keys(db).sort();
    selectedDate = days.length ? days[days.length-1] : new Date().toISOString().slice(0,10);
    ensureDay(selectedDate);
    currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
    persist();
    render();
  });

  saveNotesBtn.addEventListener('click', () => {
    if (!currentSessionId) return;
    takeSnapshot();
    const session = db[selectedDate].sessions.find(s=>s.id===currentSessionId);
    session.notes = notesInput.value;
    persist();
    render();
  });

  hitBtn.addEventListener('click', () => {
    if (!currentSessionId) { alert('Zuerst eine Session erstellen.'); return; }
    takeSnapshot();
    const s = db[selectedDate].sessions.find(x=>x.id===currentSessionId);
    s.attempts++; s.made++;
    persist();
    render();
  });

  missBtn.addEventListener('click', () => {
    if (!currentSessionId) { alert('Zuerst eine Session erstellen.'); return; }
    takeSnapshot();
    const s = db[selectedDate].sessions.find(x=>x.id===currentSessionId);
    s.attempts++;
    persist();
    render();
  });

  undoBtn.addEventListener('click', () => undo());
  undoBtn.disabled = true;

  exportCsvBtn.addEventListener('click', () => exportCsv());

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

    // disable/enable buttons based on state
    const hasSession = !!currentSessionId;
    renameSessionBtn.disabled = !hasSession;
    deleteSessionBtn.disabled = !hasSession;
    hitBtn.disabled = !hasSession;
    missBtn.disabled = !hasSession;
    saveNotesBtn.disabled = !hasSession;

    renderSessionChart();
    renderDayChart();
  }

  function renderSessionChart() {
  // alte Instanz zerstören, falls vorhanden
  if (sessionChartInstance) {
    try { sessionChartInstance.destroy(); } catch(e) {}
    sessionChartInstance = null;
  }

  // Stelle sicher, dass Canvas existiert
  if (!sessionChartEl) return;

  // Finde die aktuelle Session
  const session = db[selectedDate] && db[selectedDate].sessions
    ? db[selectedDate].sessions.find(s => s.id === currentSessionId)
    : null;

  // Bereite Labels und Daten vor (shot-by-shot). Wenn keine Würfe vorhanden sind, zeige [0].
  let labels = [];
  let data = [];

  if (session && Array.isArray(session.shots) && session.shots.length > 0) {
    let made = 0;
    let attempts = 0;
    session.shots.forEach((shot, i) => {
      attempts++;
      if (shot) made++;
      data.push(Math.round((made / attempts) * 100));
      labels.push(i + 1);
    });
  } else {
    labels = [0];
    data = [0];
  }

  // Erstelle einfachen Linien-Chart wie im ersten Script
  sessionChartInstance = new Chart(sessionChartEl, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Session Quote %',
        data: data,
        fill: false,
        tension: 0.2,
        pointRadius: 3,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          title: { display: true, text: 'Quote %' }
        },
        x: {
          title: { display: true, text: 'Wurf #' }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}


  function renderDayChart() {
    if (dayChartInstance) dayChartInstance.destroy();
    const dayKeys = Object.keys(db).sort();
    const pctData = dayKeys.map(d => {
      const t = totalForDay(d);
      return t.attempts ? Math.round(t.made/t.attempts*100) : 0;
    });

    dayChartInstance = new Chart(dayChartEl, {
      type: 'line',
      data: {
        labels: dayKeys,
        datasets: [{
          label: 'Tages Quote %',
          data: pctData,
          fill: false,
          tension: 0.2,
          pointRadius: 3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: 'Quote %' }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
  // --- /SIMPLE CHARTS ---

  // initial boot
  (function boot(){
    ensureDay(selectedDate);
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

  // expose for debug if needed
  window._shottracker = { get db(){ return db; }, persist, exportCsv: exportCsv };
});
