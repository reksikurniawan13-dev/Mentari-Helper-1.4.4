const IS_MENTARI = location.hostname === 'mentari.unpam.ac.id'; // file ini juga dipakai di my.unpam.ac.id (lihat myunpam.js)

// Jalan di semua halaman Mentari. Semua UI extension ada di sini: tombol melayang, panel,
// snackbar pengingat, dan alert server. Mentari adalah SPA, jadi URL dipantau tiap detik.

function readToken() {
  try {
    return JSON.parse(localStorage.getItem('access'))?.[0]?.token || null;
  } catch {
    return null;
  }
}

async function syncToken() {
  const token = readToken();
  if (!token) return;
  const { token: old } = await chrome.storage.local.get('token');
  if (old !== token) chrome.storage.local.set({ token });
}

const htmlToText = (html) => new DOMParser().parseFromString(html || '', 'text/html').body.textContent.trim();

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// ---------- Tema: diambil dari halaman Mentari sendiri (MUI) ----------
const DEFAULT_THEME = { primary: 'rgb(13, 71, 161)', font: '"GitLab Sans", Poppins, system-ui, Arial, sans-serif' };

function readTheme() {
  const btn = document.querySelector('.MuiButton-containedPrimary:not(.Mui-disabled), .q-btn.bg-primary, .q-btn.bg-blue-6');
  const bg = btn && getComputedStyle(btn).backgroundColor;
  return {
    primary: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : DEFAULT_THEME.primary,
    font: getComputedStyle(document.body).fontFamily || DEFAULT_THEME.font,
  };
}

// Ikon Material (Apache 2.0), sama gaya dengan ikon MUI di Mentari.
const ICON = {
  forum: 'M15 4v7H5.17L4 12.17V4h11m1-2H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zm5 4h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1z',
  quiz: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z',
  form: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  ok: 'M16.59 7.58 10 14.17l-3.59-3.58L5 12l5 5 8-8zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
  busy: 'M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
  slow: 'M12 5.99 19.53 19H4.47L12 5.99M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z',
  none: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  chevron: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  dark: 'M9.37 5.51c-.18.64-.27 1.31-.27 1.99 0 4.08 3.32 7.4 7.4 7.4.68 0 1.35-.09 1.99-.27C17.45 17.19 14.93 19 12 19c-3.86 0-7-3.14-7-7 0-2.93 1.81-5.45 4.37-6.49zM12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z',
  light: 'M12 9c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3m0-2c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z',
};

function svg(path, size = 20) {
  const span = el('span', { className: 'ico' });
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"><path d="${path}"/></svg>`; // path konstan, aman
  return span;
}

const CSS = `
:host { all: initial; color-scheme: light;
  --bg: #fff; --text: #424242; --strong: #212121; --text2: #616161; --muted: #9e9e9e; --label: #757575;
  --divider: rgba(0,0,0,.12); --divider2: rgba(0,0,0,.08); --hover: rgba(0,0,0,.04); --field: rgba(0,0,0,.23); --field-hover: #424242;
  --accent: var(--mh-primary); --tint: color-mix(in srgb, var(--mh-primary) 10%, transparent);
  --ok-bg: rgb(237,247,237); --ok-fg: rgb(30,70,32); --ok-ic: #2e7d32;
  --warn-bg: rgb(255,244,229); --warn-fg: rgb(102,60,0); --warn-ic: #ed6c02;
  --err-bg: rgb(253,237,237); --err-fg: rgb(95,33,32); --err-ic: #d32f2f;
  --none-bg: #f5f5f5; --none-fg: #616161;
  --snack-bg: #323232; --snack-fg: #fff; --snack-act: color-mix(in srgb, var(--mh-primary) 35%, white);
  --shadow: 0 5px 5px -3px rgba(0,0,0,.2), 0 8px 10px 1px rgba(0,0,0,.14), 0 3px 14px 2px rgba(0,0,0,.12); }
/* Tema gelap: palet dark mode MUI. Warna utama Mentari dicerahkan supaya tetap terbaca. */
:host([data-theme="dark"]) { color-scheme: dark;
  --bg: #1e1e1e; --text: rgba(255,255,255,.87); --strong: #fff; --text2: rgba(255,255,255,.7); --muted: rgba(255,255,255,.5); --label: rgba(255,255,255,.7);
  --divider: rgba(255,255,255,.12); --divider2: rgba(255,255,255,.08); --hover: rgba(255,255,255,.08); --field: rgba(255,255,255,.23); --field-hover: #fff;
  --accent: color-mix(in srgb, var(--mh-primary) 40%, white); --tint: color-mix(in srgb, var(--mh-primary) 35%, transparent);
  --ok-bg: rgb(12,19,13); --ok-fg: rgb(204,232,205); --ok-ic: #66bb6a;
  --warn-bg: rgb(25,18,7); --warn-fg: rgb(255,226,183); --warn-ic: #ffa726;
  --err-bg: rgb(22,11,11); --err-fg: rgb(244,199,199); --err-ic: #f44336;
  --none-bg: #2a2a2a; --none-fg: rgba(255,255,255,.7);
  --snack-bg: #e0e0e0; --snack-fg: rgba(0,0,0,.87); --snack-act: var(--mh-primary);
  --shadow: 0 5px 5px -3px rgba(0,0,0,.5), 0 8px 10px 1px rgba(0,0,0,.4), 0 3px 14px 2px rgba(0,0,0,.35); }
/* z-index maksimum: dialog Quasar (My Unpam) memakai 6000, MUI (Mentari) 1300. */
* { box-sizing: border-box; font-family: var(--mh-font); }
.ico { display: inline-flex; }
.fab { position: fixed; left: 24px; bottom: 24px; z-index: 2147483000; width: 60px; height: 60px; border: 0; border-radius: 50%;
  display: grid; place-items: center; cursor: pointer; color: #fff; background: var(--mh-primary);
  box-shadow: 0 3px 5px -1px rgba(0,0,0,.2), 0 6px 10px 0 rgba(0,0,0,.14), 0 1px 18px 0 rgba(0,0,0,.12); }
.fab:hover { filter: brightness(.88); }
.fab .count { position: absolute; top: -2px; right: -2px; min-width: 24px; height: 24px; padding: 0 6px; border-radius: 12px;
  border: 2px solid #fff; background: #d32f2f; color: #fff; font-size: 12px; font-weight: 600; line-height: 20px; }
.card { position: fixed; left: 24px; bottom: 100px; z-index: 2147483000; width: 480px; max-width: calc(100vw - 48px);
  height: min(720px, calc(100vh - 124px)); max-height: calc(100vh - 124px);
  min-width: min(340px, calc(100vw - 48px)); min-height: min(280px, calc(100vh - 124px));
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--bg); color: var(--text); border-radius: 10px; font-size: 15px; line-height: 1.5; box-shadow: var(--shadow); }
.head { display: flex; align-items: center; gap: 14px; padding: 16px 12px 16px 20px; border-bottom: 1px solid var(--divider); }
.badge { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: var(--tint); }
.title { font-size: 18px; font-weight: 600; color: var(--strong); }
.sub, .muted { font-size: 13px; color: var(--muted); }
.actions { margin-left: auto; display: flex; gap: 4px; }
.x { width: 40px; height: 40px; flex: none; border: 0; border-radius: 50%; background: none;
  color: var(--text); opacity: .75; cursor: pointer; display: grid; place-items: center; }
.x:hover { background: var(--hover); opacity: 1; }
.body { flex: 1; min-height: 0; padding: 4px 20px 20px; overflow: auto; }
.head > div:nth-child(2) { min-width: 0; }
.title, .sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Pegangan ubah ukuran. Panel menempel di kiri bawah, jadi ditarik dari tepi atas, tepi kanan, atau sudut kanan atas. */
.grip { position: absolute; z-index: 3; touch-action: none; }
.grip-x { top: 16px; right: 0; bottom: 0; width: 6px; cursor: ew-resize; }
.grip-y { top: 0; left: 0; right: 16px; height: 6px; cursor: ns-resize; }
.grip-xy { top: 0; right: 0; width: 18px; height: 18px; cursor: nesw-resize; }
.grip-xy::before { content: ''; position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border-radius: 0 3px 0 0;
  border-top: 2px solid var(--muted); border-right: 2px solid var(--muted); opacity: .7; }
.grip:hover::before, .card.resizing .grip-xy::before { opacity: 1; border-color: var(--accent); }
.card.resizing { user-select: none; }
.card.resizing .body { pointer-events: none; }
.section { padding: 16px 0; border-bottom: 1px solid var(--divider2); }
.section:last-child { border-bottom: 0; }
h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 16px; font-weight: 600; color: var(--strong); }
h3 .ico { color: var(--accent); }
.pill { min-width: 24px; padding: 0 8px; border-radius: 12px; font-size: 13px; line-height: 24px; text-align: center; color: #fff; background: #d32f2f; }
.pill.zero { background: #2e7d32; }
.btn { margin-top: 12px; width: 100%; padding: 8px 22px; min-height: 42px; border: 0; border-radius: 10px; cursor: pointer;
  background: var(--mh-primary); color: #fff; font-size: 15px; font-weight: 500; text-transform: uppercase;
  box-shadow: -1px 4px 1px -2px rgba(0,0,0,.114), -1px 3px 2px 0 rgba(0,0,0,.055), -1px 2px 5px 0 rgba(0,0,0,.04); }
.btn:hover { filter: brightness(.88); }
.btn:disabled { background: var(--divider); color: var(--muted); box-shadow: none; cursor: default; filter: none; }
.btn.outlined { color: var(--accent); background: none; box-shadow: none; border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent); }
.btn.outlined:hover { filter: none; background: var(--hover); }
label { display: block; margin-top: 12px; font-size: 13px; color: var(--label); }
select, input { display: block; width: 100%; margin-top: 6px; padding: 10px 14px; font-size: 15px; color: var(--text); background: var(--bg);
  border: 1px solid var(--field); border-radius: 10px; outline: none; }
select:hover, input:hover { border-color: var(--field-hover); }
select:focus, input:focus { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
details summary { cursor: pointer; font-size: 15px; font-weight: 500; color: var(--text2); }
a.link { color: var(--accent); }
.status { margin-top: 12px; font-size: 14px; }
.status.err { color: var(--err-ic); }
.status.ok { color: var(--ok-ic); }
.progress { height: 4px; margin-top: 14px; overflow: hidden; border-radius: 2px; background: var(--tint); }
.progress::after { content: ''; display: block; width: 40%; height: 100%; background: var(--accent); animation: mh-slide 1.2s infinite ease-in-out; }
@keyframes mh-slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
.item { padding: 12px 0; border-bottom: 1px solid var(--divider2); }
.item:last-child { border-bottom: 0; }
.q { color: var(--text2); font-size: 14px; white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.chip { display: inline-block; margin: 8px 0 4px; padding: 4px 14px; border-radius: 16px; font-size: 14px; font-weight: 600; color: var(--accent); background: var(--tint); }
.course { margin-bottom: 10px; border: 1px solid var(--divider); border-radius: 10px; overflow: hidden; }
.course-name { padding: 10px 14px; font-size: 14px; font-weight: 600; color: var(--accent); background: color-mix(in srgb, var(--tint) 60%, transparent); }
.forum { display: flex; align-items: center; gap: 8px; padding: 12px 14px; color: var(--text); text-decoration: none; border-top: 1px solid var(--divider2); }
.forum:hover { background: var(--hover); }
.forum > span:first-child { flex: 1; }
.forum .ico { color: var(--muted); }
.tag { display: inline-block; margin-right: 8px; padding: 1px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; vertical-align: 1px;
  color: var(--accent); background: var(--tint); }
.tag.PRE_TEST, .tag.POST_TEST { color: var(--warn-ic); background: var(--warn-bg); }
.tag.KUESIONER { color: var(--ok-ic); background: var(--ok-bg); }
.note { display: block; font-size: 13px; color: var(--warn-ic); }
.empty { padding: 12px 14px; border-radius: 10px; color: var(--ok-fg); background: var(--ok-bg); }
.alert { display: flex; align-items: flex-start; gap: 12px; padding: 10px 14px; border-radius: 10px; font-size: 14px; line-height: 1.43; }
.alert .ico { margin-top: 1px; }
.alert .msg { flex: 1; }
.alert .t { font-weight: 500; margin-bottom: 2px; }
.alert.ok { background: var(--ok-bg); color: var(--ok-fg); } .alert.ok > .ico { color: var(--ok-ic); }
.alert.slow { background: var(--warn-bg); color: var(--warn-fg); } .alert.slow > .ico { color: var(--warn-ic); }
.alert.busy { background: var(--err-bg); color: var(--err-fg); } .alert.busy > .ico { color: var(--err-ic); }
.alert.none { background: var(--none-bg); color: var(--none-fg); } .alert.none > .ico { color: var(--muted); }
.toast { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); z-index: 2147483001; width: 600px; max-width: calc(100vw - 32px);
  padding: 6px 8px 6px 16px; box-shadow: var(--shadow); }
.toast > .ico { padding: 7px 0; margin: 0; }
.toast .msg { padding: 8px 0; }
.conf { margin-left: 8px; padding: 3px 10px; border-radius: 16px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.conf.tinggi { color: var(--ok-ic); background: var(--ok-bg); }
.conf.sedang { color: var(--warn-ic); background: var(--warn-bg); }
.conf.rendah { color: var(--err-ic); background: var(--err-bg); }
.label { margin-bottom: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; color: var(--accent); }
.points { margin: 0; padding-left: 20px; }
.big { margin: 2px 0; font-size: 20px; font-weight: 600; color: var(--strong); }
.roster.rekap tr > :first-child { width: auto; color: inherit; }
.roster.rekap td:not(:first-child), .roster.rekap th:not(:first-child) { width: 64px; text-align: right; }
.roster tr.low td, .roster.rekap tr.low > :first-child { color: var(--err-ic); font-weight: 600; }
.choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-top: 12px; }
.choices .btn { margin-top: 0; }
.roster.ujian { margin-top: 12px; font-size: 13px; }
.roster.ujian td, .roster.ujian th { padding: 6px 8px; }
.roster.ujian tr > :first-child { width: auto; color: inherit; }
.modal-bg { position: fixed; inset: 0; z-index: 2147483002; display: grid; place-items: center; background: rgba(0,0,0,.5); }
.modal { width: min(460px, calc(100vw - 32px)); padding: 20px 24px; border-radius: 10px; background: var(--bg); color: var(--text);
  font-size: 15px; line-height: 1.5; box-shadow: var(--shadow); }
.modal .title { margin-bottom: 8px; }
.btn.flat { color: var(--text2); background: none; box-shadow: none; }
.btn.flat:hover { filter: none; background: var(--hover); }
.toast.low { top: 130px; }
.alert .act { display: block; margin-top: 6px; padding: 0; border: 0; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: inherit; text-decoration: underline; }
.foot { padding: 10px 20px; border-top: 1px solid var(--divider); text-align: center; font-size: 12px; letter-spacing: .02em; color: var(--muted); }
.foot b { color: var(--accent); font-weight: 600; }
.mat { display: flex; align-items: center; gap: 6px; margin: 4px 0; font-size: 14px; }
.mat.ok .ico { color: var(--ok-ic); }
.mat.err { color: var(--muted); } .mat.err .ico { color: var(--warn-ic); }
.points li { margin: 4px 0; }
.roster { width: 100%; margin-top: 10px; border-collapse: collapse; font-size: 14px; }
.roster th { padding: 8px 10px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--divider); }
.roster td { padding: 8px 10px; border-bottom: 1px solid var(--divider2); }
.roster tr > :first-child { width: 44px; color: var(--muted); }
.roster td:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.roster tbody tr:hover { background: var(--hover); }
.snack { position: fixed; left: 100px; bottom: 30px; z-index: 2147483001; min-width: 288px; max-width: calc(100vw - 124px);
  display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 16px; border-radius: 10px; font-size: 15px;
  background: var(--snack-bg); color: var(--snack-fg); box-shadow: var(--shadow); }
.snack .msg { flex: 1; padding: 8px 8px 8px 0; }
.snack .act { border: 0; background: none; cursor: pointer; padding: 6px 8px; border-radius: 10px; font-size: 14px; font-weight: 600;
  text-transform: uppercase; color: var(--snack-act); }
.snack .act:hover { background: var(--hover); }
.snack .x { color: var(--snack-fg); }
`;

// Elemen extension dipasang di Shadow DOM: CSS Mentari tidak merusak tampilannya, dan sebaliknya.
function mount(id, child) {
  document.getElementById(id)?.remove();
  const host = el('div', { id, className: 'mh-host' });
  const { primary, font } = readTheme();
  host.style.setProperty('--mh-primary', primary);
  host.style.setProperty('--mh-font', font);
  host.dataset.theme = uiTheme;
  host.attachShadow({ mode: 'open' }).append(el('style', { textContent: CSS }), child);
  if (child.classList?.contains('card')) addResizeHandles(child);
  document.body.append(host);
  return host;
}

// ---------- Ukuran panel bisa diubah, dan diingat ----------
let panelSize = null; // { w, h } dalam piksel, atau null untuk ukuran awal
chrome.storage.local.get('panelSize').then(({ panelSize: v }) => { panelSize = v || null; applyPanelSize(); });

function applyPanelSize(card = document.getElementById('mh-panel')?.shadowRoot.querySelector('.card')) {
  if (!card) return;
  card.style.width = panelSize ? `${panelSize.w}px` : '';
  card.style.height = panelSize ? `${panelSize.h}px` : '';
}

function addResizeHandles(card) {
  for (const dir of ['x', 'y', 'xy']) {
    const grip = el('div', { className: `grip grip-${dir}`, title: 'Tarik untuk mengubah ukuran. Klik dua kali untuk ukuran awal.' });
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const r = card.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
      card.classList.add('resizing');
      const move = (ev) => {
        if (dir !== 'y') card.style.width = `${start.w + ev.clientX - start.x}px`;
        if (dir !== 'x') card.style.height = `${start.h - (ev.clientY - start.y)}px`; // tarik ke atas = makin tinggi
      };
      const end = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', end);
        grip.removeEventListener('pointercancel', end);
        card.classList.remove('resizing');
        const box = card.getBoundingClientRect(); // ukuran nyata setelah dibatasi min/max
        panelSize = { w: Math.round(box.width), h: Math.round(box.height) };
        applyPanelSize(card);
        chrome.storage.local.set({ panelSize });
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    });
    grip.addEventListener('dblclick', () => {
      panelSize = null;
      applyPanelSize(card);
      chrome.storage.local.remove('panelSize');
    });
    card.append(grip);
  }
  applyPanelSize(card);
}

// ---------- Tema terang / gelap ----------
// Belum pernah dipilih: ikut tema sistem. Pilihan disimpan di chrome.storage.
let uiTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

function applyTheme(theme) {
  uiTheme = theme;
  document.querySelectorAll('.mh-host').forEach((h) => { h.dataset.theme = theme; });
  const toggle = document.getElementById('mh-panel')?.shadowRoot.querySelector('.theme-toggle');
  if (toggle) toggle.replaceWith(themeToggle());
}

const themeToggle = () => el('button', {
  className: 'x theme-toggle',
  title: uiTheme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap',
  onclick: () => chrome.storage.local.set({ uiTheme: uiTheme === 'dark' ? 'light' : 'dark' }),
}, svg(uiTheme === 'dark' ? ICON.light : ICON.dark));

const unmount = (id) => document.getElementById(id)?.remove();

// Klik di luar panel menutup panel. Dipakai pointerdown, bukan click, supaya klik otomatis
// dari extension (isi quiz/kuesioner) tidak ikut menutup panel.
let keepPanelOpen = () => false; // myunpam.js menahan panel tetap terbuka selama kuesioner diisi
document.addEventListener('pointerdown', (e) => {
  if (!document.getElementById('mh-panel') || keepPanelOpen()) return;
  if (e.composedPath().some((n) => n instanceof Element && n.classList.contains('mh-host'))) return; // tombol, panel, dialog extension
  unmount('mh-panel');
}, true);
const closeButton = (id) => el('button', { className: 'x', title: 'Tutup', onclick: () => unmount(id) }, svg(ICON.close));
const button = (textContent, onclick, extra = '') => el('button', { className: `btn ${extra}`, textContent, onclick });
const setStatus = (out, text, kind = '') => out.replaceChildren(el('div', { className: `status ${kind}`, textContent: text }));

// ---------- Tombol melayang + badge jumlah forum ----------
function renderFab({ pending = [], error }) {
  const count = error ? '!' : pending.length || '';
  const fab = el('button', { className: 'fab', title: 'Mentari Helper by Rex', onclick: togglePanel }, svg(ICON.forum, 26));
  if (count) fab.append(el('span', { className: 'count', textContent: count }));
  mount('mh-fab', fab);
}

// ---------- Panel ----------
let tool = null; // alat khusus halaman ini (quiz / kuesioner), atau null

function togglePanel() {
  document.getElementById('mh-panel') ? unmount('mh-panel') : openPanel();
}

function openPanel() {
  unmount('mh-snack');
  const info = el('div');
  const card = el('div', { className: 'card' },
    el('div', { className: 'head' },
      el('div', { className: 'badge' }, svg(tool?.icon || ICON.forum)),
      el('div', {}, el('div', { className: 'title', textContent: 'Mentari Helper' }),
        el('div', { className: 'sub', textContent: 'Pengingat forum, bantuan quiz, kuesioner' })),
      el('div', { className: 'actions' }, themeToggle(), closeButton('mh-panel'))),
    el('div', { className: 'body' }, ...(tool ? [el('div', { className: 'section' }, tool.node)] : []), info, settingsSection()),
    el('div', { className: 'foot' }, 'Mentari Helper · made by ', el('b', { textContent: 'Rex' })));
  mount('mh-panel', card).info = info;
  renderInfo();
}

// Bagian yang berubah saat data dari background berubah: status server + daftar tugas yang belum selesai.
async function renderInfo() {
  const info = document.getElementById('mh-panel')?.info;
  if (!info) return;
  const { pending = [], error, checkedAt, server, classes } = await chrome.storage.local.get(['pending', 'error', 'checkedAt', 'server', 'classes']);
  const level = server?.level || 'none';
  const checked = checkedAt && !error;

  const list = !pending.length
    ? (checked ? [el('div', { className: 'empty', textContent: 'Semua pretest, forum diskusi, post test, dan kuesioner sudah selesai.' })] : [])
    : [...Map.groupBy(pending, (f) => f.course)].map(([course, tasks]) =>
      el('div', { className: 'course' },
        el('div', { className: 'course-name', textContent: course }),
        ...tasks.map((f) => el('a', { className: 'forum', href: f.url },
          el('span', {}, el('span', { className: `tag ${f.type || 'FORUM_DISKUSI'}`, textContent: f.label || 'Forum diskusi' }), f.section || 'Pertemuan',
            ...(f.note ? [el('small', { className: 'note', textContent: f.note })] : [])),
          svg(ICON.chevron)))));

  const refresh = button('Cek sekarang', async () => {
    refresh.disabled = true;
    await chrome.runtime.sendMessage({ type: 'check' });
    renderInfo();
  });

  info.replaceChildren(
    el('div', { className: 'section' },
      el('div', { className: `alert ${level}` }, svg(ICON[level]),
        el('div', { className: 'msg' }, server ? `${server.text} Dicek ${new Date(server.at).toLocaleTimeString('id-ID')}.` : 'Status server belum dicek.'))),
    el('div', { className: 'section' },
      el('h3', {}, svg(ICON.forum), 'Belum selesai',
        ...(checked ? [el('span', { className: `pill${pending.length ? '' : ' zero'}`, textContent: pending.length })] : [])),
      el('div', { className: 'muted', style: 'margin:-4px 0 10px', textContent: 'Pretest, forum diskusi, post test, dan kuesioner per mata kuliah.' }),
      ...list,
      el('div', { className: error ? 'status err' : 'muted', textContent: error || (checkedAt ? `Terakhir dicek ${new Date(checkedAt).toLocaleString('id-ID')}` : 'Belum pernah dicek.') }),
      refresh),
    ...rosterSection(classes));
}

// ---------- Data mahasiswa sekelas (Nama + NIM), dari peserta mata kuliah ----------
// Disimpan di luar renderInfo supaya buka/tutup dan pilihan kelas tidak reset saat data diperbarui.
let rosterOpen = false;
let rosterClass = null;

function rosterSection(classes = {}) {
  // Kelas utama = kelas yang muncul di paling banyak mata kuliah.
  const codes = Object.keys(classes).sort((a, b) => classes[b].courses - classes[a].courses);
  if (!codes.length) return [];
  if (!codes.includes(rosterClass)) rosterClass = codes[0];
  const members = classes[rosterClass].members;

  const select = el('select', { onchange: () => { rosterClass = select.value; renderInfo(); } },
    ...codes.map((c) => el('option', { value: c, textContent: `${c} (${classes[c].members.length} mahasiswa)`, selected: c === rosterClass })));
  // State dicatat saat klik (sinkron), bukan di event toggle yang async dan bisa kalah cepat dari render ulang.
  const details = el('details', { className: 'section', open: rosterOpen },
    el('summary', { onclick: () => { rosterOpen = !details.open; } }, `Mahasiswa kelas ${rosterClass} (${members.length})`),
    ...(codes.length > 1 ? [el('label', {}, 'Kelas', select)] : []),
    el('table', { className: 'roster' },
      el('thead', {}, el('tr', {}, el('th', { textContent: 'No' }), el('th', { textContent: 'Nama' }), el('th', { textContent: 'NIM' }))),
      el('tbody', {}, ...members.map((m, i) => el('tr', {},
        el('td', { textContent: i + 1 }), el('td', { textContent: m.nama }), el('td', { textContent: m.nim }))))));
  return [details];
}

const renderKeyState = (node, has) => {
  if (node) node.textContent = has ? 'Gemini API key sudah tersimpan.' : 'Gemini API key belum diisi. Dibutuhkan untuk bantuan quiz dan forum.';
};

// API key diisi di halaman options extension, bukan di halaman Mentari: JS halaman tidak bisa membacanya.
function settingsSection() {
  const state = el('div', { className: 'muted key-state' });
  chrome.storage.local.get('hasApiKey').then(({ hasApiKey }) => renderKeyState(state, hasApiKey));
  return el('details', { className: 'section' },
    el('summary', {}, 'Pengaturan AI (Gemini API key)'),
    state,
    button('Atur API key', () => chrome.runtime.sendMessage({ type: 'openOptions' }), 'outlined'));
}

// ---------- Quiz: analisis AI cepat + pilih jawaban otomatis ----------
const BATCH = 3; // soal per request; batch kecil dikirim paralel supaya tiap request cepat selesai
const quizCache = new Map(); // quizId -> { title, questions, answers }; analisis ulang cukup soal yang belum terjawab
let quizUi = null;

function quizTool() {
  quizUi = {
    out: el('div'),
    status: el('div', { className: 'status' }),
    analyze: button('Analisis soal', analyzeQuiz),
    auto: button('Pilih jawaban otomatis', autoAnswer, 'outlined'),
  };
  quizUi.auto.hidden = true;
  return {
    icon: ICON.quiz,
    node: el('div', {},
      el('h3', {}, svg(ICON.quiz), 'Bantuan Quiz'),
      el('div', { className: 'muted', textContent: 'Klik setelah quiz dimulai. Setelah analisis, jawaban bisa dipilih otomatis. Tombol Selesai Quiz tetap kamu yang klik.' }),
      quizUi.analyze, quizUi.auto, quizUi.status, quizUi.out),
  };
}

const quizId = () => location.pathname.split('/').pop();
const choiceText = (q, a) => {
  const i = 'abcdefghij'.indexOf(a.jawaban);
  return a.jawaban.length === 1 && q.pilihan[i] ? q.pilihan[i] : a.jawaban;
};

function answerRow(q, a, failed) {
  return el('div', { className: 'item' },
    el('div', { className: 'q', textContent: `${q.no}. ${q.soal}` }),
    ...(a
      ? [el('div', {}, el('span', { className: 'chip', textContent: `Saran: ${choiceText(q, a)}` }),
        el('span', { className: `conf ${a.yakin}`, textContent: `Yakin ${a.yakin}` })),
        el('div', { className: 'muted', textContent: a.alasan })]
      : [el('div', { className: failed ? 'note' : 'muted', textContent: failed ? 'Gagal dianalisis, klik Analisis soal lagi.' : 'Menganalisis...' })]),
    ...(q.gambar ? [el('div', { className: 'note', textContent: 'Soal bergambar: AI hanya membaca teks, cek manual.' })] : []));
}

async function loadQuiz() {
  const r = await fetch(`/api/quiz/soal/${encodeURIComponent(quizId())}`, { headers: { Authorization: 'Bearer ' + readToken() } });
  if (!r.ok) throw new Error(`Soal belum bisa diambil (HTTP ${r.status}). Mulai quiz dulu, lalu coba lagi.`);
  const raw = await r.json();
  const questions = (raw.data || []).map((s, i) => {
    const soal = htmlToText(s.judul);
    const desc = htmlToText(s.deskripsi);
    return {
      no: i + 1,
      soal: desc && desc !== soal && !/^kerjakan soal/i.test(desc) ? `${soal}\n${desc}` : soal,
      pilihan: (s.list_jawaban || []).map((j) => htmlToText(j.jawaban)),
      gambar: /<img/i.test([s.judul, s.deskripsi, ...(s.list_jawaban || []).map((j) => j.jawaban)].join(' ')),
    };
  });
  if (!questions.length) throw new Error('Tidak ada soal ditemukan.');
  return { title: htmlToText(raw.judul), questions, answers: new Map() };
}

async function analyzeQuiz() {
  const ui = quizUi;
  ui.analyze.disabled = true;
  ui.auto.hidden = true;
  const progress = el('div', { className: 'progress' });
  ui.status.className = 'status';
  ui.status.textContent = 'Mengambil soal...';
  ui.status.before(progress);
  const t0 = Date.now();
  const errors = [];
  try {
    const quiz = quizCache.get(quizId()) || await loadQuiz();
    quizCache.set(quizId(), quiz);
    const rows = new Map(quiz.questions.map((q) => [q.no, answerRow(q, quiz.answers.get(q.no))]));
    ui.out.replaceChildren(...rows.values());

    const todo = quiz.questions.filter((q) => !quiz.answers.has(q.no));
    const batches = [];
    for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
    let done = quiz.answers.size;
    ui.status.textContent = `Menganalisis ${quiz.questions.length} soal...`;

    const models = new Set();
    await Promise.all(batches.map(async (batch) => {
      const res = await chrome.runtime.sendMessage({ type: 'askQuiz', questions: batch, title: quiz.title })
        .catch((e) => ({ error: e.message }));
      if (!res || res.error) return errors.push(res?.error || 'Tidak ada respons dari extension.');
      models.add(res.model);
      for (const a of res.result) {
        const q = batch.find((x) => x.no === a.no);
        if (!q) continue;
        quiz.answers.set(q.no, a);
        const row = answerRow(q, a);
        rows.get(q.no).replaceWith(row);
        rows.set(q.no, row);
        done++;
      }
      ui.status.textContent = `${done}/${quiz.questions.length} soal selesai dianalisis...`;
    }));

    quiz.questions.filter((q) => !quiz.answers.has(q.no)).forEach((q) => rows.get(q.no).replaceWith(answerRow(q, null, true)));
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const missing = quiz.questions.length - quiz.answers.size;
    ui.status.className = `status ${errors.length || missing ? 'err' : 'ok'}`;
    ui.status.textContent = errors.length
      ? `${quiz.answers.size}/${quiz.questions.length} soal terjawab. ${errors[0]}`
      : missing ? `${missing} soal tidak dijawab AI, klik Analisis soal lagi.`
        : `Selesai dalam ${secs} detik${models.size ? ` (${[...models].join(', ')})` : ''}.`;
    ui.auto.hidden = !quiz.answers.size;
  } catch (e) {
    ui.status.className = 'status err';
    ui.status.textContent = e.message;
  } finally {
    progress.remove();
    ui.analyze.disabled = false;
  }
}

// Teks pilihan dari label MUI (isi .ck-content kalau ada), tanpa huruf "A." di depannya.
const optionLabelText = (label) =>
  (label.querySelector('.ck-content')?.innerText ?? label.innerText).trim().replace(/^[a-j](?:[.)]\s*|\s*\n\s*)/i, '');

// Wadah satu soal: naik dari label pertama sampai mencakup semua pilihan, lalu 2 tingkat lagi untuk teks soal.
function questionBox(labels) {
  let box = labels[0];
  while (box && !labels.every((l) => box.contains(l))) box = box.parentElement;
  return box?.parentElement?.parentElement || box || document.body;
}

function nextButton() {
  return [...document.querySelectorAll('button')].find((b) => !b.disabled && b.offsetParent !== null &&
    !/selesai/i.test(b.innerText) &&
    (/selanjutnya|berikutnya|next/i.test(b.innerText) ||
      b.querySelector('[data-testid="KeyboardTabIcon"], [data-testid="NavigateNextIcon"], [data-testid="ArrowForwardIcon"]')));
}

const visibleGroups = () => radioGroups()
  .map((g) => g.map((r) => r.closest('label')).filter((l) => l && l.offsetParent !== null))
  .filter((labels) => labels.length);

// Penanda isi layar: teks soal + pilihan (soal Benar/Salah berturut-turut punya pilihan sama, jadi teks soal ikut dihitung).
const screenKey = (groups) => groups.map((labels) => questionBox(labels).innerText).join('|');

async function waitForNewQuestion(oldKey) {
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const groups = visibleGroups();
    if (groups.length && screenKey(groups) !== oldKey) return true;
  }
  return false;
}

// Isi jawaban di halaman: soal per soal, klik pilihan sesuai analisis lalu tombol berikutnya. Tidak pernah klik Selesai.
async function autoAnswer() {
  const ui = quizUi;
  const quiz = quizCache.get(quizId());
  if (!quiz) return;
  ui.auto.disabled = true;
  ui.analyze.disabled = true;
  const filled = new Set();
  const skipped = new Set();
  const notSaved = new Set();
  let perClick = null; // apakah Mentari menyimpan jawaban di setiap klik? diketahui dari klik pertama
  const waitMsg = (sv) => { ui.status.className = 'status err'; ui.status.textContent = `${sv.text} Pengisian dijeda sampai server normal...`; };
  try {
    if (!(await waitServerOk(waitMsg))) throw new Error('Server Mentari belum normal setelah 5 menit. Coba lagi nanti.');
    for (let step = 0; step < quiz.questions.length + 3; step++) {
      const groups = visibleGroups();
      if (!groups.length) break;
      for (const labels of groups) {
        const texts = labels.map(optionLabelText);
        const q = matchQuestion(texts, questionBox(labels).innerText, quiz.questions);
        const a = q && quiz.answers.get(q.no);
        const idx = a ? optionIndex(texts, choiceText(q, a)) : -1;
        if (idx < 0) { skipped.add(q?.no ?? '?'); continue; }
        const input = labels[idx].querySelector('input[type="radio"]') || labels[idx];
        const choose = async () => {
          // Klik ulang pilihan yang sudah terpilih tidak memicu simpan, jadi pindah sebentar ke pilihan lain dulu.
          if (input.checked && labels.length > 1) {
            const other = labels[idx === 0 ? 1 : 0].querySelector('input[type="radio"]');
            const w = waitWrite(perClick ? 15000 : 0);
            if (other) clickSafe(other);
            await w;
          }
          const saved = waitWrite(perClick === false ? 0 : perClick ? 15000 : 1500);
          clickSafe(input);
          return saved;
        };
        let rep = await choose();
        if (perClick === null) perClick = !!rep;
        for (let retry = 0; rep && !savedOk(rep) && retry < 2; retry++) { // gagal tersimpan: tunggu server normal, pilih ulang
          if (!(await waitServerOk(waitMsg))) break;
          rep = await choose();
        }
        if (rep && !savedOk(rep)) notSaved.add(q.no);
        filled.add(q.no);
      }
      ui.status.className = 'status';
      ui.status.textContent = `Mengisi... ${filled.size}/${quiz.questions.length}`;
      const next = nextButton();
      if (!next) break;
      if (serverLevel !== 'ok' && !(await waitServerOk(waitMsg))) throw new Error('Server Mentari belum normal setelah 5 menit. Lanjutkan manual.');
      const key = screenKey(groups);
      next.click();
      if (!(await waitForNewQuestion(key))) break;
    }
    const low = [...quiz.answers.values()].filter((a) => a.yakin === 'rendah' && filled.has(a.no)).map((a) => a.no);
    ui.status.className = `status ${skipped.size || notSaved.size ? 'err' : 'ok'}`;
    ui.status.textContent = `${filled.size} soal terisi otomatis.` +
      (notSaved.size ? ` Gagal tersimpan ke server: no ${[...notSaved].join(', ')}, pilih ulang manual.` : '') +
      (skipped.size ? ` Tidak bisa dicocokkan: no ${[...skipped].join(', ')}, isi manual.` : '') +
      (low.length ? ` Cek ulang no ${low.join(', ')} (AI kurang yakin).` : '') +
      ' Periksa lalu klik Selesai Quiz sendiri.';
  } catch (e) {
    ui.status.className = 'status err';
    ui.status.textContent = `${e.message} (${filled.size} soal sudah terisi.)`;
  } finally {
    ui.auto.disabled = false;
    ui.analyze.disabled = false;
  }
}

// ---------- Forum: bantu pahami pertanyaan dosen (poin kunci, bukan jawaban siap tempel) ----------
const forumCache = new Map(); // topicId -> { question, title, help, model }

function forumTool() {
  const ui = { out: el('div'), status: el('div', { className: 'status' }) };
  ui.btn = button('Bantu pahami soal', () => analyzeForum(ui));
  return {
    icon: ICON.forum,
    node: el('div', {},
      el('h3', {}, svg(ICON.forum), 'Bantu Pahami Soal Forum'),
      el('div', { className: 'muted', textContent: 'AI membaca pertanyaan dosen dan materi pertemuan (PowerPoint/PDF), lalu memberi ringkasan, penjelasan konsep, dan poin kunci. Susun jawabanmu sendiri dari poin ini.' }),
      ui.btn, ui.status, ui.out),
  };
}

// Pertanyaan dosen dari API topik forum; kalau bentuk API berbeda, ambil teks pertama di halaman.
async function loadForumQuestion(topicId) {
  try {
    const r = await fetch(`/api/forum/reply/${encodeURIComponent(topicId)}`, { headers: { Authorization: 'Bearer ' + readToken() } });
    if (r.ok) {
      const t = await r.json();
      const question = htmlToText(t.konten || t.deskripsi);
      if (question) return { question, title: htmlToText(t.judul) };
    }
  } catch { /* lanjut ke cadangan DOM */ }
  const question = document.querySelector('.ck-content')?.innerText.trim();
  if (!question) throw new Error('Pertanyaan dosen tidak ditemukan di halaman ini.');
  return { question, title: '' };
}

async function analyzeForum(ui) {
  const topicId = location.pathname.split('/').pop();
  ui.btn.disabled = true;
  const progress = el('div', { className: 'progress' });
  ui.status.className = 'status';
  ui.status.textContent = 'Membaca pertanyaan dosen...';
  ui.status.before(progress);
  const t0 = Date.now();
  try {
    let entry = forumCache.get(topicId);
    if (!entry) {
      const q = await loadForumQuestion(topicId);
      // URL: /u-courses/{kode}/forum/{forumId}/topics/{topicId}; materi diambil dari pertemuan yang sama.
      const [, kodeCourse, forumId] = location.pathname.match(/\/u-courses\/([^/]+)\/forum\/([^/]+)/) || [];
      ui.status.textContent = 'Membaca materi pertemuan dan menganalisis pertanyaan...';
      const res = await chrome.runtime.sendMessage({ type: 'askForum', ...q, kodeCourse, forumId }).catch((e) => ({ error: e.message }));
      if (!res || res.error) throw new Error(res?.error || 'Tidak ada respons dari extension.');
      entry = { ...q, help: res.result, model: res.model, materials: res.materials || [] };
      forumCache.set(topicId, entry);
    }
    const { help } = entry;
    ui.out.replaceChildren(
      el('div', { className: 'item' }, el('div', { className: 'label', textContent: 'Pertanyaan dosen' }), el('div', { className: 'q', textContent: entry.question })),
      ...(entry.materials.length ? [el('div', { className: 'item' }, el('div', { className: 'label', textContent: 'Materi pertemuan' }),
        ...entry.materials.map((m) => el('div', { className: m.ok ? 'mat ok' : 'mat err' }, svg(m.ok ? ICON.ok : ICON.busy, 18), `${m.judul}: ${m.status}`)))] : []),
      ...(help.ringkasan.length ? [el('div', { className: 'item' }, el('div', { className: 'label', textContent: 'Ringkasan materi' }),
        el('ul', { className: 'points' }, ...help.ringkasan.map((p) => el('li', { textContent: p }))))] : []),
      el('div', { className: 'item' }, el('div', { className: 'label', textContent: 'Konsep inti' }), el('div', { textContent: help.penjelasan })),
      el('div', { className: 'item' }, el('div', { className: 'label', textContent: 'Poin kunci yang perlu dibahas' }),
        el('ul', { className: 'points' }, ...help.poin.map((p) => el('li', { textContent: p })))),
      ...(help.contoh ? [el('div', { className: 'item' }, el('div', { className: 'label', textContent: 'Contoh' }), el('div', { textContent: help.contoh }))] : []));
    ui.status.className = 'status ok';
    ui.status.textContent = `Selesai dalam ${((Date.now() - t0) / 1000).toFixed(1)} detik (${entry.model}). Tulis jawabanmu sendiri berdasarkan poin di bawah.`;
  } catch (e) {
    ui.status.className = 'status err';
    ui.status.textContent = e.message;
  } finally {
    progress.remove();
    ui.btn.disabled = false;
  }
}

// ---------- Kuesioner Mentari: otomatis pilih "Ya" di semua pertanyaan lalu Submit ----------
function radioGroups() {
  const groups = new Map();
  document.querySelectorAll('input[type="radio"]').forEach((r) => {
    // Wadah radiogroup dulu: di beberapa form Mentari semua pertanyaan memakai name yang sama.
    const key = r.closest('[role="radiogroup"]') || r.name || r;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return [...groups.values()];
}

function kuesionerTool() {
  const out = el('div', {}, el('div', { className: 'status', textContent: 'Menunggu pertanyaan kuesioner dimuat...' }));
  return {
    icon: ICON.form,
    kuesioner: true,
    out,
    node: el('div', {},
      el('h3', {}, svg(ICON.form), 'Kuesioner otomatis'),
      el('div', { className: 'muted', textContent: 'Semua pertanyaan otomatis diisi "Ya" lalu disubmit saat halaman kuesioner dibuka.' }),
      out),
  };
}

let kuesDone = ''; // kuesioner yang sudah diproses (path + judul), supaya submit tidak terulang
let kuesLastCount = -1;
const KUES_SUBMIT = /\b(submit|kirim|simpan)\b/i;

// Penanda kuesioner: path + judul "Kuesioner Pertemuan N". Kuesioner bisa berupa popup di halaman mata kuliah,
// jadi beberapa kuesioner bisa dibuka bergantian di path yang sama.
const kuesKey = () => `${location.pathname}|${document.body.innerText.match(/kuesioner\s+pertemuan\s+\d+/i)?.[0] || ''}`;

// Form kuesioner di halaman mana pun (selain quiz): minimal 2 pertanyaan, masing-masing persis pilihan Ya/Tidak.
function kuesionerFormOpen() {
  if (/\/exam\//.test(location.pathname)) return false;
  const groups = radioGroups();
  if (groups.length < 2) return false;
  const yaTidak = groups.every((g) => g.map((r) => normText(r.closest('label')?.innerText)).sort().join('|') === 'tidak|ya');
  return yaTidak && /kuesioner/i.test(document.body.innerText);
}

// Pilihan "Ya" dikenali dari teks labelnya; kalau label kosong, dari value="1" (pola Mentari).
const yaIndex = (g) => g.findIndex((r) => {
  const t = normText(r.closest('label')?.innerText);
  return t ? t === 'ya' : r.value === '1';
});

const visibleButton = (re, root = document) =>
  [...root.querySelectorAll('button')].find((b) => !b.disabled && b.offsetParent !== null && re.test(b.innerText.trim()));

async function autoKuesioner(out) {
  const groups = radioGroups();
  const count = groups.length;
  const stable = count > 0 && count === kuesLastCount; // tunggu jumlah pertanyaan sama di dua tick, artinya selesai dimuat
  kuesLastCount = count;
  const key = kuesKey();
  if (!stable || kuesDone === key) return;
  kuesDone = key;
  const sudahTerisi = groups.every((g) => g.some((r) => r.checked));

  const tanpaYa = groups.filter((g) => yaIndex(g) < 0).length;
  if (tanpaYa) return setStatus(out, `${tanpaYa} pertanyaan tidak punya pilihan "Ya". Isi manual lalu klik Submit Kuesioner.`, 'err');
  groups.forEach((g) => g[yaIndex(g)].click());
  await new Promise((r) => setTimeout(r, 400));
  if (!groups.every((g) => g.some((r) => r.checked))) return setStatus(out, 'Ada pertanyaan yang belum terpilih. Cek lalu klik Submit Kuesioner manual.', 'err');

  if (!visibleButton(KUES_SUBMIT)) {
    return sudahTerisi
      ? setStatus(out, `Kuesioner ini sudah terisi (${count} pertanyaan).`, 'ok')
      : setStatus(out, `${count} pertanyaan terisi "Ya", tapi tombol Submit tidak ditemukan. Klik manual.`, 'err');
  }
  const wait = (sv) => setStatus(out, `Jawaban "Ya" sudah dipilih. ${sv.text} Submit ditunda sampai server normal...`, 'err');
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (!(await waitServerOk(wait))) return setStatus(out, 'Server belum normal setelah 5 menit. Jawaban sudah dipilih, klik Submit Kuesioner manual nanti.', 'err');
    const submit = visibleButton(KUES_SUBMIT);
    if (!submit) break;
    const saved = waitWrite(30000);
    clickSafe(submit);
    // Kalau Mentari menampilkan dialog konfirmasi, setujui.
    for (let i = 0; i < 20; i++) {
      await sleep(150);
      const dialog = document.querySelector('[role="dialog"]');
      const ok = dialog && visibleButton(/^(ya|ok|yakin|kirim|submit)\b/i, dialog);
      if (ok) { clickSafe(ok); break; }
    }
    const rep = await saved;
    if (!rep) return setStatus(out, 'Submit sudah diklik, tapi balasan server tidak terdeteksi. Cek apakah kuesioner sudah tercatat.', 'err');
    if (savedOk(rep)) return setStatus(out, `${count} pertanyaan diisi "Ya" dan tersimpan (HTTP ${rep.status}, ${(rep.ms / 1000).toFixed(1)} detik).`, 'ok');
    setStatus(out, `Submit gagal (HTTP ${rep.status || 'tanpa respons'}). Dicoba lagi saat server normal (${attempt}/3)...`, 'err');
  }
  setStatus(out, 'Submit kuesioner gagal. Klik Submit Kuesioner manual saat server normal.', 'err');
}

// ---------- Snackbar pengingat (sekali per sesi browser) ----------
function maybeShowReminder({ pending = [] }) {
  if (!pending.length || sessionStorage.getItem('mh-reminded') || document.getElementById('mh-panel')) return;
  sessionStorage.setItem('mh-reminded', '1');
  mount('mh-snack', el('div', { className: 'snack', role: 'status' },
    el('div', { className: 'msg', textContent: `${pending.length} tugas Mentari belum selesai` }),
    el('button', { className: 'act', textContent: 'Lihat', onclick: openPanel }),
    closeButton('mh-snack')));
  setTimeout(() => unmount('mh-snack'), 10000);
}

// ---------- Peringatan server penuh (gaya MUI Alert) ----------
function renderServerToast(server) {
  unmount('mh-server');
  if (!server || server.level === 'ok') return;
  mount('mh-server', el('div', { className: `alert toast ${server.level}`, role: 'alert' },
    svg(ICON[server.level]),
    el('div', { className: 'msg' },
      el('div', { className: 't', textContent: 'Peringatan server Mentari' }),
      el('div', { textContent: `${server.text} Salin jawabanmu ke tempat lain sebelum submit supaya tidak hilang.` })),
    closeButton('mh-server')));
}

// ---------- Validasi kirim data: tunggu server normal, deteksi data yang gagal tersimpan ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const savedOk = (d) => d && d.status >= 200 && d.status < 400;
let serverLevel = 'ok';
let guardBypass = false; // klik dari extension sendiri tidak dicegat
let lastDraft = '';
const netListeners = new Set();

// Laporan request kirim data dari netwatch.js (dunia halaman). Bentuknya divalidasi karena event bisa dipalsukan halaman.
window.addEventListener('mh-net', (e) => {
  let d;
  try { d = JSON.parse(e.detail); } catch { return; }
  if (!d || typeof d.status !== 'number' || typeof d.ms !== 'number') return;
  netListeners.forEach((fn) => fn(d));
  if (!savedOk(d)) return showSaveError(d);
  unmount('mh-neterr'); // kiriman berikutnya berhasil: peringatan gagal sebelumnya tidak berlaku lagi
  // Setelah mengerjakan sesuatu (forum, quiz, kuesioner), daftar "Belum selesai" diperbarui.
  if (IS_MENTARI) {
    clearTimeout(recheckTimer);
    recheckTimer = setTimeout(() => chrome.runtime.sendMessage({ type: 'check' }).catch(() => {}), 5000);
  }
});
let recheckTimer = 0;

// Laporan kirim data berikutnya, atau null kalau tidak ada dalam `ms`.
const waitWrite = (ms) => new Promise((resolve) => {
  const fn = (d) => { netListeners.delete(fn); clearTimeout(timer); resolve(d); };
  const timer = setTimeout(() => { netListeners.delete(fn); resolve(null); }, ms);
  netListeners.add(fn);
});

// Cek server sekarang; kalau lambat/penuh, cek ulang tiap 15 detik sampai normal (maks 5 menit).
async function waitServerOk(onWait, maxMs = 5 * 60e3) {
  const t0 = Date.now();
  for (;;) {
    await chrome.runtime.sendMessage({ type: 'ping', force: true }).catch(() => {});
    const { server } = await chrome.storage.local.get('server');
    if (!server || server.level === 'ok') return true;
    if (Date.now() - t0 > maxMs) return false;
    onWait?.(server);
    await sleep(15000);
  }
}

function clickSafe(node) {
  guardBypass = true;
  try { node.click(); } finally { guardBypass = false; }
}

// Teks jawaban terpanjang yang sedang ditulis (CKEditor / textarea), disimpan sebelum dikirim.
function captureDraft() {
  const texts = [...document.querySelectorAll('.ck-editor__editable, textarea')]
    .map((e) => (e.value ?? e.innerText ?? '').trim()).filter(Boolean);
  if (texts.length) lastDraft = texts.sort((a, b) => b.length - a.length)[0];
}

// Tombol kirim milik Mentari dicegat selama server lambat/penuh.
const SUBMIT_RE = /\b(submit|kirim|simpan|balas|posting|selesai)\b/i;
window.addEventListener('click', (e) => {
  const btn = e.target instanceof Element ? e.target.closest('button') : null;
  if (!btn || !SUBMIT_RE.test(btn.innerText)) return;
  captureDraft();
  if (!IS_MENTARI || guardBypass || serverLevel === 'ok') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  showSubmitGuard(btn);
}, true);

function showSubmitGuard(btn) {
  let waiting = false;
  const msg = el('div');
  const close = () => { waiting = false; unmount('mh-guard'); };
  const auto = button('Kirim otomatis saat normal', async () => {
    if (waiting) return;
    waiting = true;
    auto.disabled = true;
    setStatus(msg, 'Mengecek server...');
    const ok = await waitServerOk((sv) => waiting && setStatus(msg, `${sv.text} Dicek ulang tiap 15 detik, jangan tutup halaman ini.`));
    if (!waiting) return;
    if (!ok) { auto.disabled = false; waiting = false; return setStatus(msg, 'Server belum normal setelah 5 menit. Coba lagi nanti.', 'err'); }
    if (!btn.isConnected) { waiting = false; return setStatus(msg, 'Tombol kirim sudah tidak ada di halaman. Kirim ulang manual.', 'err'); }
    close();
    clickSafe(btn);
  });
  mount('mh-guard', el('div', { className: 'modal-bg' },
    el('div', { className: 'modal', role: 'alertdialog' },
      el('div', { className: 'title', textContent: serverLevel === 'busy' ? 'Server Mentari sedang penuh' : 'Server Mentari sedang lambat' }),
      el('div', { textContent: 'Data yang dikirim sekarang berisiko gagal tersimpan. Sebaiknya tunggu server normal, extension akan mengirimkannya otomatis.' }),
      msg,
      auto,
      button('Kirim sekarang', () => { close(); clickSafe(btn); }, 'outlined'),
      button('Batal', close, 'flat'))));
}

function showSaveError(d) {
  if (IS_MENTARI) chrome.runtime.sendMessage({ type: 'ping', force: true }).catch(() => {});
  const auth = d.status === 401 || d.status === 403;
  const copy = lastDraft && el('button', { className: 'act', textContent: 'Salin jawabanmu',
    onclick: async () => { await navigator.clipboard.writeText(lastDraft); copy.textContent = 'Tersalin'; } });
  mount('mh-neterr', el('div', { className: 'alert toast low busy', role: 'alert' },
    svg(ICON.busy),
    el('div', { className: 'msg' },
      el('div', { className: 't', textContent: `Data gagal tersimpan ke ${IS_MENTARI ? 'Mentari' : 'My Unpam'}` }),
      el('div', { textContent: auth ? 'Sesi login habis. Login ulang lalu kirim lagi.'
        : `Server membalas ${d.status ? 'HTTP ' + d.status : 'tanpa respons'}. Kirim ulang saat server normal.` }),
      ...(copy ? [copy] : [])),
    closeButton('mh-neterr')));
}

// ---------- Router ----------
let lastPath = '';

function onTick() {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    syncToken();
    chrome.runtime.sendMessage({ type: 'ping' }).catch(() => {});
    const wasOpen = !!document.getElementById('mh-panel');
    kuesLastCount = -1;
    tool = /\/u-courses\/[^/]+\/exam\/[^/]+$/.test(lastPath) ? quizTool()
      : /\/u-courses\/[^/]+\/kuesioner\//.test(lastPath) ? kuesionerTool()
        : /\/u-courses\/[^/]+\/forum\/[^/]+\/topics\/[^/]+$/.test(lastPath) ? forumTool()
          : null;
    if (tool || wasOpen) openPanel(); // halaman quiz/kuesioner langsung buka panel
  }
  // Kuesioner yang muncul sebagai popup di halaman lain juga diisi otomatis.
  if (!tool && kuesionerFormOpen()) {
    tool = kuesionerTool();
    kuesLastCount = -1;
    openPanel();
  }
  if (tool?.kuesioner) autoKuesioner(tool.out);
}

// ---------- Data dari background ----------
chrome.storage.local.get('uiTheme').then(({ uiTheme }) => { if (uiTheme) applyTheme(uiTheme); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.uiTheme) applyTheme(changes.uiTheme.newValue);
  if (changes.panelSize) { panelSize = changes.panelSize.newValue || null; applyPanelSize(); }
});

if (IS_MENTARI) {
  chrome.storage.local.get(['pending', 'error', 'server']).then((s) => {
    renderFab(s);
    serverLevel = s.server?.level || 'ok';
    renderServerToast(s.server);
    maybeShowReminder(s);
  });
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes.hasApiKey) renderKeyState(document.getElementById('mh-panel')?.shadowRoot.querySelector('.key-state'), changes.hasApiKey.newValue);
    if (changes.server) {
      serverLevel = changes.server.newValue?.level || 'ok';
      renderServerToast(changes.server.newValue);
    }
    if (changes.pending || changes.error) renderFab(await chrome.storage.local.get(['pending', 'error']));
    if (changes.pending || changes.error || changes.server || changes.checkedAt) renderInfo();
  });
  setInterval(onTick, 1000);
  onTick();
}
