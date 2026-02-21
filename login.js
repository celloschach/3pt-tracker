// login.js
// Konfiguration Supabase
const SUPABASE_URL = "https://zhfmstklaclsesndnamm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_y-qvrQF5rl60FkBWo5ongg_2VbBS1qO";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const msgEl = document.getElementById('msg');

  loginBtn.addEventListener('click', async () => {
    msgEl.textContent = '';
    const email = emailInput.value.trim();
    const password = passInput.value;
    if (!email || !password) { msgEl.textContent = 'Bitte Email und Passwort angeben.'; return; }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      msgEl.textContent = error.message || 'Login fehlgeschlagen';
      return;
    }
    // Erfolg: weiterleiten
    window.location.href = 'index.html';
  });

  signupBtn.addEventListener('click', async () => {
    msgEl.textContent = '';
    const email = emailInput.value.trim();
    const password = passInput.value;
    if (!email || !password) { msgEl.textContent = 'Bitte Email und Passwort angeben.'; return; }

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      msgEl.textContent = error.message || 'Registrierung fehlgeschlagen';
      return;
    }
    msgEl.textContent = 'Registriert. Bitte Email bestätigen (falls erforderlich) und dann einloggen.';
  });

  // Wenn bereits eingeloggt -> weiterleiten
  (async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) window.location.href = 'index.html';
  })();
});
