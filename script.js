const key = "shottracker_v3";
let db = JSON.parse(localStorage.getItem(key) || "{}");

const today = new Date().toISOString().slice(0,10);
document.getElementById("date").textContent = today;

if (!db[today]) {
  db[today] = { date: today, sessions: [] };
}

let currentSession = null;
let sessionChartInstance = null;
let dayChartInstance = null;

function save() {
  localStorage.setItem(key, JSON.stringify(db));
  render();
}

function newSession() {
  const id = Date.now().toString();
  db[today].sessions.push({
    id,
    name: "Session " + (db[today].sessions.length + 1),
    attempts: 0,
    made: 0,
    createdAt: Date.now()
  });
  currentSession = id;
  save();
}

function selectSession(id) {
  currentSession = id;
  render();
}

function getSession() {
  return db[today].sessions.find(s => s.id === currentSession);
}

function hit() {
  if (!currentSession) return;
  const s = getSession();
  s.attempts++;
  s.made++;
  save();
}

function miss() {
  if (!currentSession) return;
  const s = getSession();
  s.attempts++;
  save();
}

function render() {

  const select = document.getElementById("sessionSelect");
  select.innerHTML = "";

  db[today].sessions.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    select.appendChild(opt);
  });

  select.onchange = e => selectSession(e.target.value);

  if (db[today].sessions.length && !currentSession) {
    currentSession = db[today].sessions[0].id;
  }

  if (currentSession) {
    const s = getSession();
    const pct = s.attempts ? (s.made / s.attempts * 100).toFixed(1) : 0;
    document.getElementById("sessionStats").textContent =
      `Session: ${s.made} / ${s.attempts} (${pct}%)`;
  }

  const totalAttemptsDay = db[today].sessions.reduce((a, s) => a + s.attempts, 0);
  const totalMadeDay = db[today].sessions.reduce((a, s) => a + s.made, 0);
  const totalPctDay = totalAttemptsDay ? (totalMadeDay / totalAttemptsDay * 100).toFixed(1) : 0;

  document.getElementById("dayStats").textContent =
    `Tag: ${totalMadeDay} / ${totalAttemptsDay} (${totalPctDay}%)`;

  const allDays = Object.keys(db);
  const totalAttemptsAll = allDays.reduce((sum, d) =>
    sum + db[d].sessions.reduce((a, s) => a + s.attempts, 0), 0);

  const totalMadeAll = allDays.reduce((sum, d) =>
    sum + db[d].sessions.reduce((a, s) => a + s.made, 0), 0);

  const totalPctAll = totalAttemptsAll ? (totalMadeAll / totalAttemptsAll * 100).toFixed(1) : 0;

  document.getElementById("totalStats").textContent =
    `Gesamt: ${totalMadeAll} / ${totalAttemptsAll} (${totalPctAll}%)`;

  renderCharts();
}

function renderCharts() {

  if (sessionChartInstance) sessionChartInstance.destroy();
  if (dayChartInstance) dayChartInstance.destroy();

  const sessionLabels = db[today].sessions.map(s => s.name);
  const sessionData = db[today].sessions.map(s =>
    s.attempts ? (s.made / s.attempts * 100).toFixed(1) : 0
  );

  sessionChartInstance = new Chart(document.getElementById("sessionChart"), {
    type: "line",
    data: {
      labels: sessionLabels,
      datasets: [{
        label: "Session Quote %",
        data: sessionData
      }]
    }
  });

  const dayLabels = Object.keys(db).sort();
  const dayData = dayLabels.map(d => {
    const attempts = db[d].sessions.reduce((a, s) => a + s.attempts, 0);
    const made = db[d].sessions.reduce((a, s) => a + s.made, 0);
    return attempts ? (made / attempts * 100).toFixed(1) : 0;
  });

  dayChartInstance = new Chart(document.getElementById("dayChart"), {
    type: "line",
    data: {
      labels: dayLabels,
      datasets: [{
        label: "Tages Quote %",
        data: dayData
      }]
    }
  });
}

render();

