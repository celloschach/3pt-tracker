// Supabase initialisieren
const SUPABASE_URL = "DEINE_PROJECT_URL";
const SUPABASE_ANON_KEY = "DEIN_ANON_KEY";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function register() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);
  alert("Registriert! Bitte einloggen.");
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);

  // Nach Login zur App weiterleiten
  window.location.href = "index.html";
}

// Prüfen, ob User schon eingeloggt ist
(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) window.location.href = "index.html";
})();
