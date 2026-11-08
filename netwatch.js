// Jalan di dunia halaman (MAIN world) karena hanya di sini request milik Mentari bisa dilihat.
// Setiap request kirim data (POST/PUT/PATCH/DELETE) ke /api/ dilaporkan ke content.js:
// status HTTP (0 = gagal terhubung) dan lamanya, supaya kegagalan simpan bisa langsung ketahuan.
(() => {
  const report = (detail) => window.dispatchEvent(new CustomEvent('mh-net', { detail: JSON.stringify(detail) }));
  const watched = (method, url) => /^(POST|PUT|PATCH|DELETE)$/i.test(method || 'GET') && String(url).includes('/api/');

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const method = init?.method || input?.method || 'GET';
    const url = String(input?.url || input);
    const t0 = performance.now();
    try {
      const r = await origFetch.apply(this, arguments);
      if (watched(method, url)) report({ method, url, status: r.status, ms: performance.now() - t0 });
      return r;
    } catch (e) {
      if (watched(method, url)) report({ method, url, status: 0, ms: performance.now() - t0 });
      throw e;
    }
  };

  const { open, send } = XMLHttpRequest.prototype;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.mhInfo = { method, url: String(url) };
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    const info = this.mhInfo;
    if (info && watched(info.method, info.url)) {
      const t0 = performance.now();
      this.addEventListener('loadend', () => report({ ...info, status: this.status, ms: performance.now() - t0 }));
    }
    return send.apply(this, arguments);
  };
})();
