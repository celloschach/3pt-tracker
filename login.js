const SUPABASE_URL = "https://zhfmstklaclsesndnamm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_y-qvrQF5rl60FkBWo5ongg_2VbBS1qO";
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
  window.location.href = "index.html";
}

// falls User schon eingeloggt, direkt weiterleiten
(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) window.location.href = "index.html";
})();
