const $ = (id) => document.getElementById(id);

function status(text, kind) {
  $('status').textContent = text;
  $('status').className = kind;
}

// Key tidak pernah ditampilkan utuh; cukup 4 karakter terakhir sebagai penanda.
async function render() {
  const { apiKey, uiTheme } = await chrome.storage.local.get(['apiKey', 'uiTheme']);
  document.documentElement.dataset.theme = uiTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  $('key').placeholder = apiKey ? `Key tersimpan (...${apiKey.slice(-4)}). Isi untuk mengganti.` : 'AQ.Ab... atau AIza...';
}

// Cek key langsung ke Gemini sebelum disimpan, supaya salah salin ketahuan sekarang, bukan saat quiz.
async function verifyKey(key) {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      headers: { 'x-goog-api-key': key }, credentials: 'omit', signal: AbortSignal.timeout(15000),
    });
    if (r.ok) return { ok: true };
    const msg = (await r.json().catch(() => ({}))).error?.message || `HTTP ${r.status}`;
    return [400, 401, 403].includes(r.status) ? { ok: false, msg } : { ok: null, msg };
  } catch (e) {
    return { ok: null, msg: e.message };
  }
}

$('save').onclick = async () => {
  const key = normalizeApiKey($('key').value);
  if (!key) return status('Format key tidak valid. Salin ulang seluruh key dari aistudio.google.com/apikey.', 'err');
  $('save').disabled = true;
  status('Mengecek key ke Gemini...', '');
  const check = await verifyKey(key);
  $('save').disabled = false;
  if (check.ok === false) return status(`Key ditolak Google: ${check.msg}`, 'err');
  await chrome.storage.local.set({ apiKey: key, hasApiKey: true });
  $('key').value = '';
  status(check.ok ? 'Key valid dan tersimpan.' : `Key tersimpan, tapi belum bisa dicek (${check.msg}).`, 'ok');
  render();
};

$('clear').onclick = async () => {
  await chrome.storage.local.remove('apiKey');
  await chrome.storage.local.set({ hasApiKey: false });
  status('Key dihapus.', 'ok');
  render();
};

render();
