(function () {
  const $ = (id) => document.getElementById(id);
  let pw = sessionStorage.getItem('adminpw') || '';
  let site = null;
  let dirty = false;

  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    kids.forEach((c) => c && n.appendChild(c));
    return n;
  };

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2000);
  }
  const markDirty = () => { dirty = true; $('save').textContent = 'Save *'; };

  // ---------- auth ----------
  async function tryLogin(password) {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'X-Admin-Password': password } });
    if (r.ok) return true;
    const j = await r.json().catch(() => ({}));
    $('login-err').textContent = j.error || 'Login failed';
    return false;
  }

  $('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = $('pw').value;
    if (await tryLogin(p)) { pw = p; sessionStorage.setItem('adminpw', p); start(); }
  });

  async function start() {
    site = await (await fetch('/api/site', { cache: 'no-store' })).json();
    site.profile ||= {}; site.socials ||= []; site.sections ||= [];
    $('login').hidden = true; $('editor').hidden = false;
    bindProfile(); renderSocials(); renderSections(); setupQr();
  }

  // ---------- generic field ----------
  function field(label, obj, key, opts = {}) {
    const input = el(opts.textarea ? 'textarea' : 'input', { placeholder: opts.placeholder || '', rows: opts.rows || 2 });
    input.value = obj[key] || '';
    input.addEventListener('input', () => { obj[key] = input.value; markDirty(); opts.onChange && opts.onChange(); });
    const wrap = el('label', {}, [document.createTextNode(label)]);
    if (opts.upload) {
      const btn = el('button', { class: 'btn', type: 'button', text: 'Upload', onclick: () => upload((url) => { input.value = url; obj[key] = url; markDirty(); opts.onChange && opts.onChange(); }) });
      wrap.appendChild(el('div', { class: 'row' }, [input, btn]));
    } else wrap.appendChild(input);
    return wrap;
  }

  function moveButtons(arr, i, rerender) {
    const mv = (d) => () => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; markDirty(); rerender(); };
    return el('div', { class: 'item-actions' }, [
      el('button', { class: 'btn small', type: 'button', text: '↑', title: 'Move up', onclick: mv(-1) }),
      el('button', { class: 'btn small', type: 'button', text: '↓', title: 'Move down', onclick: mv(1) }),
      el('button', { class: 'btn small danger', type: 'button', text: 'Remove', onclick: () => { arr.splice(i, 1); markDirty(); rerender(); } }),
    ]);
  }

  // ---------- profile ----------
  function bindProfile() {
    document.querySelectorAll('[data-bind]').forEach((input) => {
      const key = input.dataset.bind.split('.')[1];
      input.value = site.profile[key] || '';
      input.addEventListener('input', () => { site.profile[key] = input.value; markDirty(); });
    });
    document.querySelectorAll('[data-upload]').forEach((btn) => {
      const key = btn.dataset.upload.split('.')[1];
      btn.addEventListener('click', () => upload((url) => {
        site.profile[key] = url; document.querySelector(`[data-bind="profile.${key}"]`).value = url; markDirty();
      }));
    });
  }

  // ---------- socials ----------
  function renderSocials() {
    const list = $('socials-list'); list.innerHTML = '';
    site.socials.forEach((s, i) => {
      const preview = el('div', { class: 'preview-link' });
      const update = () => { preview.textContent = 'Follow button opens: ' + resolveSocial(s).url; };
      const select = el('select');
      Object.entries(PLATFORMS).forEach(([k, p]) => select.appendChild(el('option', { value: k, text: p.label })));
      if (!PLATFORMS[s.platform]) s.platform = 'website';
      select.value = s.platform;
      select.addEventListener('change', () => { s.platform = select.value; markDirty(); update(); });
      list.appendChild(el('div', { class: 'item' }, [
        el('div', { class: 'grid2' }, [
          el('label', {}, [document.createTextNode('Platform'), select]),
          field('Username / handle', s, 'handle', { placeholder: 'yourname', onChange: update }),
        ]),
        field('Custom link (optional)', s, 'url', { placeholder: 'https://…', onChange: update }),
        preview,
        moveButtons(site.socials, i, renderSocials),
      ]));
      update();
    });
  }
  $('add-social').addEventListener('click', () => { site.socials.push({ platform: 'instagram', handle: '' }); markDirty(); renderSocials(); });

  // ---------- sections ----------
  function renderSections() {
    const list = $('sections-list'); list.innerHTML = '';
    site.sections.forEach((sec, si) => {
      sec.items ||= [];
      const items = el('div');
      sec.items.forEach((it, ii) => {
        items.appendChild(el('div', { class: 'item' }, [
          el('div', { class: 'grid2' }, [
            field('Title', it, 'title', { placeholder: 'My new video' }),
            field('Link or file', it, 'url', { placeholder: 'https://… or upload', upload: true }),
          ]),
          field('Description (optional)', it, 'description'),
          el('div', { class: 'grid2' }, [
            field('Code / text to copy (optional)', it, 'code', { textarea: true, placeholder: 'Promo code, snippet, command…' }),
            field('Thumbnail image (optional)', it, 'image', { placeholder: 'https://…', upload: true }),
          ]),
          moveButtons(sec.items, ii, renderSections),
        ]));
      });
      list.appendChild(el('div', { class: 'panel' }, [
        el('div', { class: 'section-head' }, [field('Section title', sec, 'title', { placeholder: 'Latest Posts' })]),
        items,
        el('div', { class: 'row' }, [
          el('button', { class: 'btn', type: 'button', text: '+ Add link', onclick: () => { sec.items.push({ title: '', url: '' }); markDirty(); renderSections(); } }),
          el('span', { style: 'flex:1' }),
          moveButtons(site.sections, si, renderSections),
        ]),
      ]));
    });
  }
  $('add-section').addEventListener('click', () => { site.sections.push({ title: 'New section', items: [] }); markDirty(); renderSections(); });

  // ---------- upload ----------
  let onUploaded = null;
  function upload(cb) { onUploaded = cb; $('file').value = ''; $('file').click(); }
  $('file').addEventListener('change', async () => {
    const f = $('file').files[0]; if (!f) return;
    toast('Uploading…');
    const r = await fetch('/api/upload?name=' + encodeURIComponent(f.name), {
      method: 'POST', headers: { 'X-Admin-Password': pw, 'Content-Type': 'application/octet-stream' }, body: f,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || 'Upload failed');
    onUploaded && onUploaded(j.url); toast('Uploaded — remember to Save');
  });

  // ---------- save ----------
  $('save').addEventListener('click', async () => {
    const r = await fetch('/api/site', {
      method: 'PUT', headers: { 'X-Admin-Password': pw, 'Content-Type': 'application/json' }, body: JSON.stringify(site),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { dirty = false; $('save').textContent = 'Save'; toast('Saved!'); }
    else toast(j.error || 'Save failed');
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- QR ----------
  function setupQr() {
    $('qr-img').src = '/qr.svg';
    fetch('/api/qr-target').then((r) => r.json()).then((j) => { $('qr-url').textContent = j.url; });
  }

  if (pw) tryLogin(pw).then((ok) => (ok ? start() : sessionStorage.removeItem('adminpw')));
})();
