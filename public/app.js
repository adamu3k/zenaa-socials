(function () {
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = el('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast('Copied!');
  }

  function icon(r) {
    const box = el('span', 'icon');
    if (r.iconUrl) {
      const img = el('img');
      img.src = r.iconUrl; img.alt = ''; img.width = 22; img.height = 22;
      img.onerror = () => { img.remove(); box.textContent = r.label[0]; };
      box.appendChild(img);
    } else box.textContent = r.label[0];
    return box;
  }

  function renderSocial(s) {
    const r = resolveSocial(s);
    const a = el('a', 'social' + (r.dark ? ' dark' : ''));
    a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
    a.style.setProperty('--brand', r.color);
    a.appendChild(icon(r));
    const txt = el('span', 'social-text');
    txt.appendChild(el('span', 'social-name', r.label));
    if (r.handle && s.platform !== 'website') txt.appendChild(el('span', 'social-handle', '@' + r.handle));
    a.appendChild(txt);
    a.appendChild(el('span', 'follow-pill', r.verb));
    return a;
  }

  function renderItem(it) {
    const hasUrl = !!(it.url && it.url.trim());
    const card = el(hasUrl ? 'a' : 'div', 'card');
    if (hasUrl) { card.href = safeUrl(it.url); card.target = '_blank'; card.rel = 'noopener'; }
    if (it.image) {
      const img = el('img', 'thumb'); img.src = safeUrl(it.image); img.alt = ''; img.loading = 'lazy';
      card.appendChild(img);
    }
    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', it.title || it.url || ''));
    if (it.description) body.appendChild(el('div', 'card-desc', it.description));
    if (it.code) {
      const row = el('div', 'code-row');
      row.appendChild(el('code', 'code', it.code));
      const b = el('button', 'copy', 'Copy'); b.type = 'button';
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); copy(it.code); });
      row.appendChild(b);
      body.appendChild(row);
    }
    card.appendChild(body);
    if (hasUrl) card.appendChild(el('span', 'arrow', '↗'));
    return card;
  }

  function render(site) {
    const p = site.profile || {};
    document.title = p.name ? `${p.name} | Links` : 'Links';
    $('name').textContent = p.name || '';
    $('bio').textContent = p.bio || '';
    const av = $('avatar');
    if (p.avatar) { const i = el('img'); i.src = safeUrl(p.avatar); i.alt = p.name || ''; av.appendChild(i); }
    else av.textContent = (p.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

    const socials = $('socials');
    (site.socials || []).filter((s) => s.handle || s.url).forEach((s) => socials.appendChild(renderSocial(s)));
    if (!socials.children.length) socials.parentElement.hidden = true;

    const wrap = $('sections');
    (site.sections || []).forEach((sec) => {
      const items = (sec.items || []).filter((i) => i.title || i.url || i.code);
      if (!items.length) return;
      const s = el('section');
      s.appendChild(el('h2', 'section-title', sec.title || ''));
      const list = el('div', 'cards');
      items.forEach((i) => list.appendChild(renderItem(i)));
      s.appendChild(list);
      wrap.appendChild(s);
    });
  }

  $('share').addEventListener('click', async () => {
    const data = { title: document.title, url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch {} }
    else copy(location.href);
  });
  $('qr-toggle').addEventListener('click', () => {
    const q = $('qr'); q.hidden = !q.hidden;
    $('qr-toggle').textContent = q.hidden ? 'Show QR code' : 'Hide QR code';
  });

  fetch('/api/site').then((r) => r.json()).then(render).catch(() => toast('Could not load page'));
})();
