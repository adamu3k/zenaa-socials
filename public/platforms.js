// Supported platforms. `follow` builds the most direct "follow" link each platform allows.
// X, YouTube and Snapchat open a real follow/subscribe prompt; the others open the
// profile (in the app on phones) where the Follow button is one tap away.
window.PLATFORMS = {
  instagram: { label: 'Instagram', color: '#E4405F', icon: 'instagram', follow: (h) => `https://www.instagram.com/${h}/` },
  tiktok:    { label: 'TikTok',    color: '#000000', icon: 'tiktok',    follow: (h) => `https://www.tiktok.com/@${h}` },
  x:         { label: 'X',         color: '#000000', icon: 'x',         follow: (h) => `https://x.com/intent/follow?screen_name=${h}` },
  youtube:   { label: 'YouTube',   color: '#FF0000', icon: 'youtube',   follow: (h) => `https://www.youtube.com/@${h}?sub_confirmation=1`, verb: 'Subscribe' },
  facebook:  { label: 'Facebook',  color: '#0866FF', icon: 'facebook',  follow: (h) => `https://www.facebook.com/${h}` },
  linkedin:  { label: 'LinkedIn',  color: '#0A66C2', icon: null,        follow: (h) => `https://www.linkedin.com/in/${h}`, verb: 'Connect' },
  github:    { label: 'GitHub',    color: '#181717', icon: 'github',    follow: (h) => `https://github.com/${h}` },
  threads:   { label: 'Threads',   color: '#000000', icon: 'threads',   follow: (h) => `https://www.threads.net/@${h}` },
  snapchat:  { label: 'Snapchat',  color: '#FFFC00', icon: 'snapchat',  follow: (h) => `https://www.snapchat.com/add/${h}`, verb: 'Add', dark: true },
  telegram:  { label: 'Telegram',  color: '#26A5E4', icon: 'telegram',  follow: (h) => `https://t.me/${h}`, verb: 'Join' },
  whatsapp:  { label: 'WhatsApp',  color: '#25D366', icon: 'whatsapp',  follow: (h) => `https://wa.me/${h.replace(/\D/g, '')}`, verb: 'Chat' },
  twitch:    { label: 'Twitch',    color: '#9146FF', icon: 'twitch',    follow: (h) => `https://www.twitch.tv/${h}` },
  discord:   { label: 'Discord',   color: '#5865F2', icon: 'discord',   follow: (h) => `https://discord.gg/${h}`, verb: 'Join' },
  pinterest: { label: 'Pinterest', color: '#BD081C', icon: 'pinterest', follow: (h) => `https://www.pinterest.com/${h}/` },
  spotify:   { label: 'Spotify',   color: '#1DB954', icon: 'spotify',   follow: (h) => `https://open.spotify.com/artist/${h}` },
  website:   { label: 'Website',   color: '#334155', icon: null,        follow: (h) => (/^https?:\/\//.test(h) ? h : `https://${h}`), verb: 'Visit' },
};

// Returns { label, color, url, verb, iconUrl, dark } for a social entry.
window.resolveSocial = function (s) {
  const p = window.PLATFORMS[s.platform] || { label: s.platform || 'Link', color: '#334155', icon: null, follow: (h) => h };
  const handle = String(s.handle || '').trim().replace(/^@/, '');
  return {
    label: s.label || p.label,
    color: p.color,
    dark: !!p.dark,
    verb: p.verb || 'Follow',
    handle,
    url: s.url && s.url.trim() ? s.url.trim() : p.follow(s.platform === 'website' ? handle : encodeURIComponent(handle)),
    iconUrl: p.icon ? `https://cdn.simpleicons.org/${p.icon}/${p.dark ? '000000' : 'ffffff'}` : null,
  };
};

window.safeUrl = function (u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (u.startsWith('/')) return u;
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : 'https://' + u;
};
