// Supabase initialisieren
const SUPABASE_URL = "https://zhfmstklaclsesndnamm.supabase.co";        // Project URL aus Supabase
const SUPABASE_ANON_KEY = "sb_publishable_y-qvrQF5rl60FkBWo5ongg_2VbBS1qO";       // Publishable / anon key
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  const STORAGE_KEY = 'shottracker_v6';

  // aktuell eingeloggter User
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // DB state
  let db = {}; // wird später geladen
  let historySnapshot = null;

  // Chart Instanzen
  let sessionChartInstance = null;
  let dayChartInstance = null;

  // UI Referenzen
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

  let selectedDate = new Date().toISOString().slice(0,10);
  let currentSessionId = null;

  // --- Supabase Funktionen ---
  async function loadAllSessions() {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });
    if (error) console.error(error.message);
    return data || [];
  }

  async function saveSessionToDB(session) {
    const { data, error } = await supabase
      .from("sessions")
      .insert([{
        user_id: user.id,
        date: session.date,
        attempts: session.attempts,
        made: session.made,
        shots: session.shots,
        notes: session.notes,
        name: session.name
      }])
      .select();
    if (error) console.error(error.message);
    else return data[0];
  }

  async function updateSessionInDB(session) {
    const { data, error } = await supabase
      .from("sessions")
      .update({
        attempts: session.attempts,
        made: session.made,
        shots: session.shots,
        notes: session.notes,
        name: session.name
      })
      .eq("id", session.id)
      .select();
    if (error) console.error(error.message);
    else return data[0];
  }

  async function deleteSessionFromDB(sessionId) {
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId);
    if (error) console.error(error.message);
  }

  async function deleteDayFromDB(date) {
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("date", date)
      .eq("user_id", user.id);
    if (error) console.error(error.message);
  }

  // --- Hilfsfunktionen ---
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
    render();
    undoBtn.disabled = true;
  }

  function formatPct(made, attempts) {
    return attempts ? Math.round(made / attempts * 100) + '%' : '0%';
  }

  function totalForDay(day) {
    const sessions = db[day]?.sessions || [];
    const attempts = sessions.reduce((a,s) => a + (s.attempts||0), 0);
    const made = sessions.reduce((a,s) => a + (s.made||0), 0);
    return { attempts, made };
  }

  function totalAllDays() {
    let attempts = 0, made = 0;
    Object.keys(db).forEach(day => {
      db[day].sessions.forEach(s => {
        attempts += s.attempts || 0;
        made += s.made || 0;
      });
    });
    return { attempts, made };
  }

  function computeRollingAverage(dateISO, window = 7) {
    const keys = Object.keys(db).sort();
    const idx = keys.indexOf(dateISO);
    if (idx === -1) return null;
    const slice = keys.slice(Math.max(0, idx-window+1), idx+1);
    let attempts = 0, made = 0;
    slice.forEach(d => {
      db[d].sessions.forEach(s => { attempts += s.attempts||0; made += s.made||0; });
    });
    return attempts ? Math.round(made/attempts*100)+'%' : '0%';
  }

  // --- Navigation / Datum ---
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
    changeDate(d.toISOString().slice(0,10));
  });
  nextDayBtn.addEventListener('click', () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate()+1);
    changeDate(d.toISOString().slice(0,10));
  });
  datePicker.addEventListener('change', e => changeDate(e.target.value));

  // --- Session Aktionen ---
  newSessionBtn.addEventListener('click', async () => {
    takeSnapshot();
    const id = Date.now().toString();
    const name = `Session ${db[selectedDate].sessions.length + 1}`;
    const session = { id, name, attempts:0, made:0, shots:[], notes:'', date:selectedDate };
    const saved = await saveSessionToDB(session);
    db[selectedDate].sessions.push(saved);
    currentSessionId = saved.id;
    render();
  });

  renameSessionBtn.addEventListener('click', async () => {
    if (!currentSessionId) return;
    const s = db[selectedDate].sessions.find(x => x.id===currentSessionId);
    if (!s) return;
    const newName = prompt('Neuer Session-Name:', s.name);
    if (!newName) return;
    s.name = newName;
    await updateSessionInDB(s);
    render();
  });

  deleteSessionBtn.addEventListener('click', async () => {
    if (!currentSessionId) return;
    if (!confirm('Session wirklich löschen?')) return;
    await deleteSessionFromDB(currentSessionId);
    db[selectedDate].sessions = db[selectedDate].sessions.filter(s => s.id!==currentSessionId);
    currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
    render();
  });

  deleteDayBtn.addEventListener('click', async () => {
    if (!confirm('Ganzen Tag löschen?')) return;
    await deleteDayFromDB(selectedDate);
    delete db[selectedDate];
    const keys = Object.keys(db).sort();
    selectedDate = keys.length ? keys[keys.length-1] : new Date().toISOString().slice(0,10);
    ensureDay(selectedDate);
    currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null;
    render();
  });

  saveNotesBtn.addEventListener('click', async () => {
    if (!currentSessionId) return;
    const s = db[selectedDate].sessions.find(x=>x.id===currentSessionId);
    if (!s) return;
    s.notes = notesInput.value;
    await updateSessionInDB(s);
    render();
  });

  // --- Hit / Miss ---
  hitBtn.addEventListener('click', async () => {
    if (!currentSessionId) return alert('Zuerst Session erstellen');
    const s = db[selectedDate].sessions.find(x=>x.id===currentSessionId);
    s.attempts++; s.made++; s.shots.push(true);
    await updateSessionInDB(s);
    render();
  });

  missBtn.addEventListener('click', async () => {
    if (!currentSessionId) return alert('Zuerst Session erstellen');
    const s = db[selectedDate].sessions.find(x=>x.id===currentSessionId);
    s.attempts++; s.shots.push(false);
    await updateSessionInDB(s);
    render();
  });

  // --- Undo / Export ---
  undoBtn.addEventListener('click', undo);
  undoBtn.disabled = true;

  exportCsvBtn.addEventListener('click', () => {
    const rows = [['day','sessionId','sessionName','attempts','made','notes']];
    Object.keys(db).sort().forEach(day=>{
      db[day].sessions.forEach(s=>{
        rows.push([day,s.id,s.name,s.attempts,s.made,s.notes.replace(/\n/g,' ')]);
      });
    });
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download='3pt-tracker-export.csv';
    a.click();
  });

  // --- Render Funktionen ---
  function renderPastDaysList() {
    pastDaysListEl.innerHTML='';
    const keys = Object.keys(db).sort().reverse();
    if (!keys.length) { pastDaysListEl.textContent='Noch keine Einträge'; return; }
    keys.forEach(day=>{
      const totals = totalForDay(day);
      const item = document.createElement('div'); item.className='past-item';
      const btn = document.createElement('button'); btn.textContent=day; btn.dataset.day=day;
      btn.addEventListener('click', e=>changeDate(e.target.dataset.day));
      const count = document.createElement('div'); count.className='count'; count.textContent=`${totals.attempts} Würfe`;
      item.appendChild(btn); item.appendChild(count);
      if(day===selectedDate) item.style.outline='2px solid rgba(46,204,113,0.12)';
      pastDaysListEl.appendChild(item);
    });
  }

  function render() {
    ensureDay(selectedDate);
    datePicker.value = selectedDate;

    // Dropdown Session
    sessionSelect.innerHTML='';
    db[selectedDate].sessions.forEach(s=>{
      const opt = document.createElement('option'); opt.value=s.id; opt.textContent=s.name; sessionSelect.appendChild(opt);
    });
    if(currentSessionId && db[selectedDate].sessions.find(s=>s.id===currentSessionId)) sessionSelect.value=currentSessionId;
    else { currentSessionId = db[selectedDate].sessions.length ? db[selectedDate].sessions[0].id : null; sessionSelect.value=currentSessionId; }

    // Stats
    const s = db[selectedDate].sessions.find(x=>x.id===currentSessionId);
    sessionStatsEl.textContent = s ? `Session: ${s.made} / ${s.attempts} (${formatPct(s.made,s.attempts)})` : 'Session: -';
    notesInput.value = s?.notes||'';
    const dayTotals = totalForDay(selectedDate);
    dayStatsEl.textContent=`Tag: ${dayTotals.made} / ${dayTotals.attempts} (${formatPct(dayTotals.made,dayTotals.attempts)})`;
    const all = totalAllDays();
    totalStatsEl.textContent=`Gesamt: ${all.made} / ${all.attempts} (${formatPct(all.made,all.attempts)})`;
    rollingAvgEl.textContent=`7-Tage Durchschnitt (bis ${selectedDate}): ${computeRollingAverage(selectedDate)}`;

    renameSessionBtn.disabled=!s; deleteSessionBtn.disabled=!s; hitBtn.disabled=!s; missBtn.disabled=!s; saveNotesBtn.disabled=!s;

    renderSessionChart(); renderDayChart(); renderPastDaysList();
  }

  // --- Charts ---
  function renderSessionChart() {
    if(sessionChartInstance) try{sessionChartInstance.destroy();}catch{}
    const ctx=sessionChartEl.getContext('2d');
    const session=db[selectedDate]?.sessions.find(x=>x.id===currentSessionId);
    let labels=[], data=[];
    if(session?.shots?.length>0){
      let made=0; let attempts=0;
      session.shots.forEach((shot,i)=>{ attempts++; if(shot) made++; data.push(Math.round(made/attempts*100)); labels.push(i+1); });
    }else{ labels=[0]; data=[0]; }
    const shotCount=labels.length; let step=1;
    if(shotCount>50) step=10; else if(shotCount>20) step=5;
    sessionChartInstance=new Chart(ctx,{type:'line', data:{labels, datasets:[{label:'Session Quote %',data,fill:false,tension:0.2,pointRadius:3,borderWidth:2}]}, options:{animation:false,responsive:true,maintainAspectRatio:false,scales:{y:{min:0,max:100,title:{display:true,text:'Quote %'}}, x:{ticks:{autoSkip:false,callback:function(v,i){return (step<=1||i%step===0)?v:''}}, title:{display:true,text:'Wurf #'}}},plugins:{legend:{display:false}}}});
  }

  function renderDayChart() {
    if(dayChartInstance) try{dayChartInstance.destroy();}catch{}
    const ctx=dayChartEl.getContext('2d');
    const dayKeys=Object.keys(db).sort();
    const pctData=dayKeys.map(d=>{ const t=totalForDay(d); return t.attempts?Math.round(t.made/t.attempts*100):0; });
    dayChartInstance=new Chart(ctx,{type:'line',data:{labels:dayKeys,datasets:[{label:'Tagesquote %',data:pctData,fill:false,tension:0.2,pointRadius:3,borderWidth:2}]}, options:{animation:false,responsive:true,maintainAspectRatio:false,scales:{y:{min:0,max:100,title:{display:true,text:'Quote %'}}},plugins:{legend:{display:false}}}});
  }

  // --- Boot: lade DB ---
  const allSessions = await loadAllSessions();
  allSessions.forEach(s => {
    ensureDay(s.date);
    db[s.date].sessions.push(s);
  });

  ensureDay(selectedDate);
  if(!db[selectedDate].sessions.length){
    const id = Date.now().toString();
    db[selectedDate].sessions.push({id,name:'Session 1',attempts:0,made:0,shots:[],notes:'',date:selectedDate});
    currentSessionId = id;
  } else currentSessionId = db[selectedDate].sessions[0].id;

  render();

  // expose debug
  window._shottracker = { db, render };
});
