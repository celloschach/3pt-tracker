// script.js
// Supabase initialisieren
const SUPABASE_URL = "https://zhfmstklaclsesndnamm.supabase.co";        // Project URL aus Supabase
const SUPABASE_ANON_KEY = "sb_publishable_y-qvrQF5rl60FkBWo5ongg_2VbBS1qO";       // Publishable / anon key

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'shottracker_v6';

  // load DB
  let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  let historySnapshot = null;

  // chart instances
  let sessionChartInstance = null;
  let dayChartInstance = null;

  // UI refs
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
  const pastDaysListEl = document.getElementById('pastDaysList');

  // state
  let selectedDate = new Date().toISOString().slice(0,10);
  let currentSessionId = null;

  // init
  datePicker.value = selectedDate;

  // helpers
  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function ensureDay(date) {
    if (!db[date]) db[date] = { date, sessions: [] };
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
    return attempts ? Math.round(made/attempts*100) + '%' : '0%';
  }

  function totalForDay(day) {
    const sessions = db[day] && db[day].sessions ? db[day].sessions : [];
    const attempts = sessions.reduce((acc,s)=>acc + (s.attempts||0), 0);
    const made = sessions.reduce((acc,s)=>acc + (s.made||0), 0);
    return { attempts, made };
  }

  function totalAllDays() {
    const days = Object.keys(db);
    let attempts = 0, made = 0;
    days.forEach(d => {
      db[d].sessions.forEach(s => { attempts += s.attempts || 0; made += s.made || 0; });
    });
    return { attempts, made };
  }

  function computeRollingAverage(dateISO, window = 7) {
    const keys = Object.keys(db).sort();
    const idx = keys.indexOf(dateISO);
    if (idx === -1) return null;
    const start = Math.max(0, idx - (window - 1));
    const slice = keys.slice(start, idx + 1);
    let attempts = 0, made = 0;
    slice.forEach(d => {
      db[d].sessions.forEach(s => { attempts += s.attempts || 0; made += s.made || 0; });
    });
    return attempts ? Math.round(made/attempts*100) + '%' : '0%';
  }

  // navigation / date
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
    d.setDate(d.getDate() - 1);
    const iso = d.toISOString().slice(0,10);
    ensureDay(iso);
    changeDate(iso);
  });

  nextDayBtn.addEventListener('click', () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0,10);
    ensureDay(iso);
    changeDate(iso);
  });

  datePicker.addEventListener('change', (e) => {
    const iso = e.target.value;
    ensureDay(iso);
    changeDate(iso);
  });

  // session actions
  newSessionBtn.addEventListener('click', () => {
    takeSnapshot();
    const id = Date.now().toString();
    const name = `Session ${db[selectedDate].sessions.length + 1}`;
    db[selectedDate].sessions.push({
      id,
      name,
      attempts: 0,
      made: 0,
      createdAt: Date.now(),
      notes: '',
      shots: []
    });
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
    const s = db[selectedDate].sessions.find(x => x.id === currentSessionId);
    if (!s) return;
    const newName = prompt('Neuer Session-Name:', s.name);
    if (newName === null) return;
    takeSnapshot();
    s.name = newName.trim() || s.name;
    persist();
    render();
  });

  deleteSessionBtn.addEventListener('click', () => {
    if (!currentSessionId) return;
    if (!confirm('Session wirklich löschen?')) return;
    takeSnapshot();
    db[selectedDate].sessions = db[selectedDate].sessions.filter(s => s.id !== currentSessionId);
    currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
    persist();
    render();
  });

  deleteDayBtn.addEventListener('click', () => {
    if (!confirm('Ganzen Tag löschen? Diese Aktion ist endgültig.')) return;
    takeSnapshot();
    delete db[selectedDate];
    const keys = Object.keys(db).sort();
    selectedDate = keys.length ? keys[keys.length - 1] : new Date().toISOString().slice(0,10);
    ensureDay(selectedDate);
    currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
    persist();
    render();
  });

  saveNotesBtn.addEventListener('click', () => {
    if (!currentSessionId) return;
    const s = db[selectedDate].sessions.find(x => x.id === currentSessionId);
    if (!s) return;
    takeSnapshot();
    s.notes = notesInput.value;
    persist();
    render();
  });

  // hit / miss
  hitBtn.addEventListener('click', () => {
    if (!currentSessionId) { alert('Zuerst eine Session erstellen.'); return; }
    const s = db[selectedDate].sessions.find(x => x.id === currentSessionId);
    if (!s) return;
    takeSnapshot();
    s.attempts = (s.attempts || 0) + 1;
    s.made = (s.made || 0) + 1;
    if (!Array.isArray(s.shots)) s.shots = [];
    s.shots.push(true);
    persist();
    render();
  });

  missBtn.addEventListener('click', () => {
    if (!currentSessionId) { alert('Zuerst eine Session erstellen.'); return; }
    const s = db[selectedDate].sessions.find(x => x.id === currentSessionId);
    if (!s) return;
    takeSnapshot();
    s.attempts = (s.attempts || 0) + 1;
    if (!Array.isArray(s.shots)) s.shots = [];
    s.shots.push(false);
    persist();
    render();
  });

  // undo / export
  undoBtn.addEventListener('click', () => undo());
  undoBtn.disabled = true;

  exportCsvBtn.addEventListener('click', () => exportCsv());

  function exportCsv() {
    const rows = [['day','sessionId','sessionName','attempts','made','createdAt','notes']];
    Object.keys(db).sort().forEach(day => {
      db[day].sessions.forEach(s => {
        rows.push([
          day,
          s.id,
          s.name,
          s.attempts || 0,
          s.made || 0,
          new Date(s.createdAt).toISOString(),
          (s.notes || '').replace(/\n/g, ' ')
        ]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
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

  // render past days list
  function renderPastDaysList() {
    pastDaysListEl.innerHTML = '';
    const keys = Object.keys(db).sort().reverse(); // newest first
    if (keys.length === 0) {
      pastDaysListEl.textContent = 'Noch keine Einträge';
      return;
    }
    keys.forEach(day => {
      const totals = totalForDay(day);
      const item = document.createElement('div');
      item.className = 'past-item';
      const btn = document.createElement('button');
      btn.textContent = day;
      btn.dataset.day = day;
      btn.addEventListener('click', (e) => {
        changeDate(e.target.dataset.day);
      });
      const count = document.createElement('div');
      count.className = 'count';
      count.textContent = `${totals.attempts} Würfe`;
      item.appendChild(btn);
      item.appendChild(count);
      // highlight current
      if (day === selectedDate) item.style.outline = '2px solid rgba(46,204,113,0.12)';
      pastDaysListEl.appendChild(item);
    });
  }

  // rendering
  function render() {
    ensureDay(selectedDate);
    datePicker.value = selectedDate;

    // dropdown
    sessionSelect.innerHTML = '';
    db[selectedDate].sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      sessionSelect.appendChild(opt);
    });

    if (currentSessionId && db[selectedDate].sessions.find(s => s.id === currentSessionId)) {
      sessionSelect.value = currentSessionId;
    } else {
      currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
      sessionSelect.value = currentSessionId;
    }

    // session stats
    if (currentSessionId) {
      const s = db[selectedDate].sessions.find(x => x.id === currentSessionId);
      sessionStatsEl.textContent = `Session: ${s.made || 0} / ${s.attempts || 0} (${formatPct(s.made || 0, s.attempts || 0)})`;
      notesInput.value = s.notes || '';
    } else {
      sessionStatsEl.textContent = 'Session: -';
      notesInput.value = '';
    }

    // day stats
    const dayTotals = totalForDay(selectedDate);
    dayStatsEl.textContent = `Tag: ${dayTotals.made} / ${dayTotals.attempts} (${formatPct(dayTotals.made, dayTotals.attempts)})`;

    // total stats
    const all = totalAllDays();
    totalStatsEl.textContent = `Gesamt: ${all.made} / ${all.attempts} (${formatPct(all.made, all.atempts)})`;

    // rolling
    const rolling = computeRollingAverage(selectedDate, 7);
    rollingAvgEl.textContent = `7-Tage Durchschnitt (bis ${selectedDate}): ${rolling || 'N/A'}`;

    // enable/disable UI
    const hasSession = !!currentSessionId;
    renameSessionBtn.disabled = !hasSession;
    deleteSessionBtn.disabled = !hasSession;
    hitBtn.disabled = !hasSession;
    missBtn.disabled = !hasSession;
    saveNotesBtn.disabled = !hasSession;

    renderSessionChart();
    renderDayChart();
    renderPastDaysList();
  }

  // Session chart: shot-by-shot (current session only)
  function renderSessionChart() {
    if (sessionChartInstance) {
      try { sessionChartInstance.destroy(); } catch(e) {}
      sessionChartInstance = null;
    }

    const ctx = sessionChartEl.getContext('2d');

    const session = db[selectedDate] && db[selectedDate].sessions
      ? db[selectedDate].sessions.find(s => s.id === currentSessionId)
      : null;

    let labels = [];
    let data = [];

    if (session && Array.isArray(session.shots) && session.shots.length > 0) {
      let made = 0;
      let attempts = 0;
      session.shots.forEach((shot, i) => {
        attempts++;
        if (shot) made++;
        data.push(Math.round(made / attempts * 100));
        labels.push(i + 1);
      });
    } else {
      labels = [0];
      data = [0];
    }

    // determine tick step
    const shotCount = labels.length === 1 && labels[0] === 0 ? 0 : labels.length;
    let step = 1;
    if (shotCount > 50) step = 10;
    else if (shotCount > 20) step = 5;
    else step = 1;

    sessionChartInstance = new Chart(ctx, {
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
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100, title: { display: true, text: 'Quote %' } },
          x: {
            ticks: {
              autoSkip: false,
              callback: function(value, index) {
                // always show last label
                const lastIndex = this.getTicks ? this.getTicks().length - 1 : (labels.length - 1);
                if (index === lastIndex) return value;
                if (step <= 1) return value;
                return (index % step === 0) ? value : '';
              }
            },
            title: { display: true, text: 'Wurf #' }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // Day chart: percent per day (simple line)
  function renderDayChart() {
    if (dayChartInstance) {
      try { dayChartInstance.destroy(); } catch(e) {}
      dayChartInstance = null;
    }

    const ctx = dayChartEl.getContext('2d');
    const dayKeys = Object.keys(db).sort();
    const pctData = dayKeys.map(d => {
      const t = totalForDay(d);
      return t.attempts ? Math.round(t.made / t.attempts * 100) : 0;
    });

    dayChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dayKeys,
        datasets: [{
          label: 'Tagesquote %',
          data: pctData,
          fill: false,
          tension: 0.2,
          pointRadius: 3,
          borderWidth: 2
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 100, title: { display: true, text: 'Quote %' } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  // boot: migrate old data and ensure at least one session today
  (function boot() {
    // migrate: ensure structure
    Object.keys(db).forEach(dayKey => {
      db[dayKey].sessions.forEach(s => {
        if (!Array.isArray(s.shots)) s.shots = [];
        s.attempts = s.attempts || 0;
        s.made = s.made || 0;
        s.name = s.name || ('Session ' + (Math.random().toString(36).slice(2,6)));
      });
    });

    ensureDay(selectedDate);

    if (!db[selectedDate].sessions.length) {
      const id = Date.now().toString();
      db[selectedDate].sessions.push({ id, name: 'Session 1', attempts: 0, made: 0, createdAt: Date.now(), notes: '', shots: [] });
      currentSessionId = id;
      persist();
    } else {
      currentSessionId = db[selectedDate].sessions[0].id;
    }

    render();
  })();

  // expose debug
  window._shottracker = {
    get db() { return db; },
    persist,
    exportCsv
  };
});

