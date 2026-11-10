/* Techno Atlas — maquette navigable (vanilla JS, sans dépendance).
   Données : window.ATLAS (généré par tools/build_data.py) + window.ATLAS_GLOSSARY. */
(function () {
  'use strict';

  const A = window.ATLAS || { timeline: [], styles: [], sets: [], generated: '' };
  const G = window.ATLAS_GLOSSARY || [];
  const main = document.getElementById('main');

  /* ---------- utilitaires ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => { try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : '#'; } catch (e) { return '#'; } };
  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const styleById = byId(A.styles);
  const setById = byId(A.sets);
  const evById = byId(A.timeline);
  const PATHS = A.parcours || [];
  const pathById = byId(PATHS);
  const CONF = { haute: 'Confiance haute', moyenne: 'Confiance moyenne', a_verifier: 'À vérifier' };
  const NIV = { entree: 'Porte d’entrée', intermediaire: 'Intermédiaire', avance: 'Pour aller plus loin' };
  const BRANCH = { canon: 'Techno', hard: 'Hard music' };
  const MARKERS = ['reprise pop', 'couplets chantés', 'samples vocaux courts', 'mélodies instrumentales épiques'];
  const decade = (y) => (Math.floor(y / 10) * 10) + 's';
  const confBadge = (c) => `<span class="badge ${esc(c || 'a_verifier')}">${esc(CONF[c] || CONF.a_verifier)}</span>`;
  const styleLabel = (id) => (styleById[id] ? styleById[id].nom : id);
  const styleChip = (id) => styleById[id]
    ? `<a class="chip" href="#/style/${encodeURIComponent(id)}">${esc(styleById[id].nom)}</a>`
    : `<span class="chip">${esc(id)}</span>`;
  const sourcesBlock = (src) => (src && src.length)
    ? `<details><summary>Sources (${src.length})</summary><ul>${src.map((u) => `<li><a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(u)}</a></li>`).join('')}</ul></details>`
    : '<p class="small muted">Aucune source citée.</p>';
  const mixPath = (u) => { const m = /^https:\/\/www\.mixcloud\.com(\/[^?#]+)/.exec(u || ''); return m ? m[1] : null; };
  const kindLabel = (s) => (s.type === 'documentaire' ? 'Documentaire' : 'Set');
  const setName = (s) => `${(s.artistes || []).length ? s.artistes.join(' & ') + ' — ' : ''}${s.titre}`;
  const platformOf = (u) => { try { const h = new URL(u).hostname.replace(/^www\./, ''); if (/youtube\.com|youtu\.be/.test(h)) return 'YouTube'; if (h.includes('soundcloud.com')) return 'SoundCloud'; if (h.includes('mixcloud.com')) return 'Mixcloud'; if (h.includes('bandcamp.com')) return 'Bandcamp'; if (h.includes('spotify.com')) return 'Spotify'; if (h.includes('music.apple.com')) return 'Apple Music'; if (h.includes('instagram.com')) return 'Instagram'; return h; } catch (e) { return ''; } };
  const scUrl = (u) => (/^https:\/\/(www\.)?soundcloud\.com\/[^/]+\/[^/?#]+/.test(u || '') ? u : null);
  const CUSTOM_TYPES = { set: 'Set', morceau: 'Morceau', live: 'Live', autre: 'Autre' };
  const rid = () => 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ytId = (u) => { const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/.exec(u || ''); return m ? m[1] : null; };
  const pickVerified = (arr) => arr.filter((s) => s.verifie);

  /* ---------- stockage « Mes goûts » (clé technoatlas_v1, séparée de hardlab_v1) ---------- */
  const KEY = 'technoatlas_v1';
  let storageOk = true;
  function loadDb() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); if (d && d.version === 1 && d.listens && typeof d.listens === 'object') { if (!d.progress || typeof d.progress !== 'object') d.progress = {}; if (!d.custom || typeof d.custom !== 'object') d.custom = {}; if (!d.deleted || typeof d.deleted !== 'object') d.deleted = {}; if (!Array.isArray(d.duels)) d.duels = []; if (!d.progressUpdated || typeof d.progressUpdated !== 'object') d.progressUpdated = {}; return d; } }
    } catch (e) { storageOk = false; }
    return { version: 1, listens: {}, duels: [], progress: {}, custom: {}, deleted: {}, progressUpdated: {} };
  }
  function saveDb(d, noSync) { let ok = true; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { storageOk = false; ok = false; } if (!noSync) scheduleSync(); return ok; }
  let db = loadDb();

  const clampRating = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
  function cleanListen(x) {
    if (!x || typeof x !== 'object') return null;
    return {
      status: ['a_ecouter', 'ecoute'].includes(x.status) ? x.status : 'ecoute',
      plaisir: clampRating(x.plaisir), soiree: clampRating(x.soiree), immersion: clampRating(x.immersion),
      note: typeof x.note === 'string' ? x.note.slice(0, 2000) : '',
      markers: Array.isArray(x.markers) ? x.markers.filter((m) => MARKERS.includes(m)) : [],
      date: typeof x.date === 'string' ? x.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      provenance: 'utilisateur',
      updated: Number.isFinite(x.updated) ? Math.floor(x.updated) : 0
    };
  }

  const cleanList = (v, n, len) => (Array.isArray(v) ? v : []).filter((x) => typeof x === 'string').map((x) => x.trim().slice(0, len)).filter(Boolean).slice(0, n);
  function cleanCustom(x, forceId) {
    if (!x || typeof x !== 'object') return null;
    const id = forceId || x.id;
    if (typeof id !== 'string' || !/^u-[a-z0-9]{4,24}$/.test(id)) return null;
    const url = typeof x.url === 'string' ? safeUrl(x.url.trim().slice(0, 500)) : '#';
    const titre = typeof x.titre === 'string' ? x.titre.trim().slice(0, 150) : '';
    if (url === '#' || !titre) return null;
    return {
      id, url, titre, artistes: cleanList(x.artistes, 5, 80),
      type: CUSTOM_TYPES[x.type] ? x.type : 'set',
      styles: cleanList(x.styles, 12, 60).filter((st) => styleById[st]),
      tags: cleanList(x.tags, 10, 30),
      added: typeof x.added === 'string' ? x.added.slice(0, 10) : new Date().toISOString().slice(0, 10),
      updated: Number.isFinite(x.updated) ? Math.floor(x.updated) : 0
    };
  }
  const customItem = (c) => ({ id: c.id, artistes: c.artistes, titre: c.titre, url: c.url, plateforme: platformOf(c.url), styles: c.styles, tags: c.tags, type: c.type, added: c.added, custom: true });
  const itemById = (id) => setById[id] || (db.custom[id] ? customItem(db.custom[id]) : null);
  const itemHref = (it) => (it.custom ? '#/mon-son/' : '#/set/') + encodeURIComponent(it.id);
  const sameUrl = (a, b) => { const ya = ytId(a), yb = ytId(b); if (ya && yb) return ya === yb; try { const x = new URL(a), y = new URL(b); const k = (u) => u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, ''); return k(x) === k(y); } catch (e) { return false; } };

  /* ---------- composants ---------- */
  function setCard(s) {
    const l = db.listens[s.id];
    return `<article class="card">
      <div class="tags"><span class="badge niv">${esc(NIV[s.niveau] || 'Niveau ?')}</span>${s.type === 'documentaire' ? '<span class="chip on">Documentaire</span>' : ''}${s.annee ? `<span class="chip">${esc(s.annee)}</span>` : ''}<span class="chip">${esc(BRANCH[s.branche] || '')}</span>${l ? '<span class="chip on">Dans mon journal</span>' : ''}</div>
      <h3><a href="#/set/${encodeURIComponent(s.id)}">${esc(setName(s))}</a></h3>
      <p class="small muted">${esc([s.evenement, s.lieu].filter(Boolean).join(' · ')) || ' '}</p>
      <p class="small">${esc((s.pourquoi || '').slice(0, 170))}${(s.pourquoi || '').length > 170 ? '…' : ''}</p>
      <div class="tags">${(s.styles || []).slice(0, 3).map(styleChip).join('')}</div>
    </article>`;
  }

  /* ---------- fusion et synchronisation (comptes personnels, Supabase) ---------- */
  const SB_LIB = { url: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js', sri: 'sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK' };
  const CFG = window.ATLAS_CONFIG || {};
  const syncEnabled = !!(CFG.supabaseUrl && CFG.supabaseKey);
  /* À quel compte appartient le journal stocké dans ce navigateur ? (aucun = journal « invité »)
     Sert à ne JAMAIS verser le journal d'une personne dans le compte d'une autre. */
  const OWNER_KEY = 'technoatlas_owner';
  const getOwner = () => { try { return localStorage.getItem(OWNER_KEY); } catch (e) { return null; } };
  const setOwner = (v) => { try { if (v) localStorage.setItem(OWNER_KEY, v); else localStorage.removeItem(OWNER_KEY); } catch (e) { /* stockage indisponible */ } };
  const emptyDb = () => ({ version: 1, listens: {}, duels: [], progress: {}, custom: {}, deleted: {}, progressUpdated: {} });

  /* Nettoie un journal reçu de l'extérieur (fichier importé ou compte) : rien n'est cru sur parole. */
  function normalizeDb(raw) {
    const out = emptyDb();
    if (!raw || typeof raw !== 'object') return out;
    if (raw.custom && typeof raw.custom === 'object') Object.entries(raw.custom).forEach(([id, x]) => { const c = cleanCustom(x, id); if (c) out.custom[id] = c; });
    if (raw.listens && typeof raw.listens === 'object') Object.entries(raw.listens).forEach(([id, x]) => { if (!setById[id] && !out.custom[id]) return; const l = cleanListen(x); if (l) out.listens[id] = l; });
    if (raw.progress && typeof raw.progress === 'object') Object.entries(raw.progress).forEach(([pid, arr]) => {
      if (!pathById[pid] || !Array.isArray(arr)) return;
      out.progress[pid] = [...new Set(arr.filter((i) => Number.isInteger(i) && i >= 0 && i < pathById[pid].etapes.length))].sort((a, b) => a - b);
      const u = raw.progressUpdated && Number(raw.progressUpdated[pid]); out.progressUpdated[pid] = Number.isFinite(u) ? u : 0;
    });
    if (raw.deleted && typeof raw.deleted === 'object') Object.entries(raw.deleted).forEach(([k, ts]) => { if (/^[lcd]:[\w-]{1,40}$/.test(k) && Number.isFinite(Number(ts))) out.deleted[k] = Number(ts); });
    if (Array.isArray(raw.duels)) raw.duels.forEach((x) => { const du = cleanDuel(x, new Set([...Object.keys(out.custom)])); if (du && !out.duels.some((y) => y.id === du.id)) out.duels.push(du); });
    return out;
  }

  /* Fusion de deux journaux : la version la plus récente de chaque élément gagne (égalité : celle de a, locale).
     Une suppression (pierre tombale) l'emporte sur toute version plus ancienne qu'elle. Rien d'autre n'est effacé. */
  function mergeDb(a, b) {
    const out = emptyDb();
    [a, b].forEach((d) => Object.entries(d.deleted || {}).forEach(([k, ts]) => { out.deleted[k] = Math.max(out.deleted[k] || 0, ts); }));
    const mergeKind = (kind, prefix) => {
      const ids = new Set([...Object.keys(a[kind] || {}), ...Object.keys(b[kind] || {})]);
      ids.forEach((id) => {
        const x = (a[kind] || {})[id], y = (b[kind] || {})[id];
        const w = !x ? y : !y ? x : ((y.updated || 0) > (x.updated || 0) ? y : x);
        if (w && (w.updated || 0) > (out.deleted[prefix + id] || 0)) out[kind][id] = w;
      });
    };
    mergeKind('custom', 'c:'); mergeKind('listens', 'l:');
    // une écoute ne survit pas à la suppression du son personnel auquel elle se rattache
    Object.keys(out.listens).forEach((id) => { if (id.startsWith('u-') && !out.custom[id]) delete out.listens[id]; });
    const pids = new Set([...Object.keys(a.progress || {}), ...Object.keys(b.progress || {})]);
    pids.forEach((pid) => {
      const ua = (a.progressUpdated || {})[pid] || 0, ub = (b.progressUpdated || {})[pid] || 0;
      const useB = b.progress && b.progress[pid] && (!a.progress || !a.progress[pid] || ub > ua);
      out.progress[pid] = (useB ? b.progress[pid] : a.progress[pid]).slice();
      out.progressUpdated[pid] = Math.max(ua, ub);
    });
    const dm = new Map();
    [...(a.duels || []), ...(b.duels || [])].forEach((d) => { const x = dm.get(d.id); if (!x || (d.updated || 0) > (x.updated || 0)) dm.set(d.id, d); });
    out.duels = [...dm.values()].filter((d) => (d.updated || 0) > (out.deleted['d:' + d.id] || 0));
    return out;
  }

  let sb = null, session = null, syncTimer = null;
  const syncState = { status: '', last: null, busy: false, mode: 'login' };
  function loadSupabaseLib() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();
      const s = document.createElement('script');
      s.src = SB_LIB.url; s.integrity = SB_LIB.sri; s.crossOrigin = 'anonymous';
      s.onload = resolve; s.onerror = () => reject(new Error('lib'));
      document.head.appendChild(s);
    });
  }
  async function initSync() {
    if (!syncEnabled) return;
    try {
      await loadSupabaseLib();
      sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
      const { data } = await sb.auth.getSession(); session = data.session;
      sb.auth.onAuthStateChange((ev, s) => { session = s; if (ev === 'SIGNED_IN' && s) { syncNow(); } refreshAccountBox(); });
      if (session) syncNow(); else refreshAccountBox();
    } catch (e) { syncState.status = 'Le service de comptes est indisponible pour le moment. Ton journal reste dans ce navigateur.'; refreshAccountBox(); }
  }
  function scheduleSync() {
    if (!syncEnabled || !sb || !session) return;
    clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 2500);
  }
  async function syncNow() {
    if (!sb || !session || syncState.busy) return;
    syncState.busy = true; syncState.status = 'Synchronisation…'; refreshAccountBox();
    try {
      const { data, error } = await sb.from('journals').select('data').eq('user_id', session.user.id).maybeSingle();
      if (error) throw error;
      const uid = session.user.id; const owner = getOwner(); const remote = data && data.data ? normalizeDb(data.data) : null;
      const nLocal = Object.keys(db.listens || {}).length + Object.keys(db.custom || {}).length;
      if (owner && owner !== uid) {
        // le journal local appartient à un autre compte : aucune fusion, on repart du compte connecté
        db = remote || emptyDb();
      } else if (!owner && nLocal > 0) {
        // journal « invité » : ajouté au compte seulement si la personne le confirme
        if (confirm('Ce navigateur contient un journal qui n’est lié à aucun compte (' + nLocal + ' élément(s)).\n\nOK : l’ajouter à ton compte.\nAnnuler : l’ignorer (il sera effacé de ce navigateur).')) db = remote ? mergeDb(normalizeDb(db), remote) : normalizeDb(db);
        else db = remote || emptyDb();
      } else {
        db = remote ? mergeDb(normalizeDb(db), remote) : normalizeDb(db);
      }
      setOwner(uid);
      saveDb(db, true);
      const { error: e2 } = await sb.from('journals').upsert({ user_id: session.user.id, data: db, schema_version: 1, updated_at: new Date().toISOString() });
      if (e2) throw e2;
      syncState.last = new Date(); syncState.status = 'Synchronisé.';
    } catch (e) { syncState.status = 'Échec de la synchronisation : tes données restent sur cet appareil.'; }
    syncState.busy = false; refreshAccountBox();
    if (location.hash.startsWith('#/mes-gouts') || location.hash.startsWith('#/mon-son') || location.hash.startsWith('#/parcours')) render(true);
  }

  /* ---------- panneau « Mon compte » ---------- */
  function accountInner() {
    if (!syncEnabled) return '';
    if (!sb && !syncState.status) return '<p class="small muted">Chargement du service de comptes…</p>';
    if (!sb) return `<p class="small">${esc(syncState.status)}</p>`;
    if (!session) {
      const signup = syncState.mode === 'signup';
      return `<p class="small muted">Sans compte, ton journal reste dans ce navigateur. Avec un compte, il est sauvegardé et retrouvé sur tous tes appareils. Personne d’autre ne peut le lire.</p>
        <div class="row" role="group" aria-label="Choix"><button class="chip ${signup ? '' : 'on'}" data-mode="login" aria-pressed="${!signup}">J’ai déjà un compte</button><button class="chip ${signup ? 'on' : ''}" data-mode="signup" aria-pressed="${signup}">Créer un compte</button></div>
        <form id="authForm" class="formgrid" style="margin-top:12px" novalidate>
          <div class="full"><label for="ac-mail">Ton e-mail</label><input id="ac-mail" type="email" autocomplete="email" required placeholder="prenom@exemple.fr"></div>
          <div class="full"><label for="ac-pass">Mot de passe (8 caractères minimum)</label><input id="ac-pass" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required></div>
          <div class="full row"><button class="btn primary" type="submit">${signup ? 'Créer mon compte' : 'Me connecter'}</button></div>
          ${signup ? '<p class="full small muted">Choisis un mot de passe que tu n’utilises nulle part ailleurs. Il ne peut pas être réinitialisé automatiquement : si tu l’oublies, tu devras demander de l’aide à la personne qui t’a invité.</p>' : ''}
          <p class="full small" id="acMsg" aria-live="polite">${esc(syncState.status)}</p>
        </form>`;
    }
    return `<p class="small">Connecté : <b>${esc(session.user.email || '')}</b></p>
      <p class="small muted" aria-live="polite">${esc(syncState.status)}${syncState.last ? ' Dernière synchronisation : ' + syncState.last.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '.' : ''}</p>
      <div class="row"><button class="btn" id="syncBtn">Synchroniser maintenant</button><button class="btn" id="outBtn">Se déconnecter</button><button class="btn danger sm" id="delAcct">Supprimer mon compte</button></div>`;
  }
  function accountPanel() {
    if (!syncEnabled) return '';
    return `<div class="panel" style="margin-top:14px" id="acct"><h2>Mon compte</h2><div id="acctBody">${accountInner()}</div></div>`;
  }
  function refreshAccountBox() {
    const body = document.getElementById('acctBody'); if (!body) return;
    body.innerHTML = accountInner(); bindAccount();
  }
  const authError = (err) => {
    const m = String((err && err.message) || '').toLowerCase();
    if (m.includes('invalid login')) return 'E-mail ou mot de passe incorrect.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet e-mail : choisis « J’ai déjà un compte ».';
    if (m.includes('password') && (m.includes('short') || m.includes('least') || m.includes('weak'))) return 'Mot de passe trop faible : 8 caractères minimum.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives : réessaie dans quelques minutes.';
    if (m.includes('email') && m.includes('invalid')) return 'Adresse e-mail invalide.';
    return 'Opération impossible : ' + ((err && err.message) || 'erreur inconnue') + '.';
  };
  function bindAccount() {
    document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { syncState.mode = b.dataset.mode; syncState.status = ''; refreshAccountBox(); }));
    const f = document.getElementById('authForm');
    if (f) {
      const msg = (t) => { const m = document.getElementById('acMsg'); if (m) m.textContent = t; };
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('ac-mail').value.trim(); const password = document.getElementById('ac-pass').value;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg('Indique une adresse e-mail valide.'); return; }
        if (password.length < 8) { msg('Le mot de passe doit faire 8 caractères minimum.'); return; }
        msg('Un instant…');
        if (syncState.mode === 'signup') {
          const { data, error } = await sb.auth.signUp({ email, password });
          if (error) { msg(authError(error)); return; }
          if (!data.session) { msg('Compte créé, mais une confirmation par e-mail est exigée par le service : demande de l’aide à la personne qui t’a invité.'); return; }
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) { msg(authError(error)); return; }
        }
        // la session est reçue par onAuthStateChange, qui lance la synchronisation
      });
    }
    const s = document.getElementById('syncBtn'); if (s) s.addEventListener('click', syncNow);
    const o = document.getElementById('outBtn'); if (o) o.addEventListener('click', async () => {
      if (!confirm('Te déconnecter ? Ton journal sera effacé de ce navigateur : il reste dans ton compte et revient à ta prochaine connexion.')) return;
      clearTimeout(syncTimer); await syncNow();
      if (/Échec/.test(syncState.status) && !confirm('La dernière synchronisation a échoué : des changements récents pourraient être perdus. Te déconnecter quand même ?')) return;
      await sb.auth.signOut(); session = null; db = emptyDb(); saveDb(db, true); setOwner(null);
      syncState.status = 'Déconnecté. Le journal de ce navigateur a été effacé ; il reste dans ton compte.'; syncState.last = null; render(true);
    });
    const d = document.getElementById('delAcct');
    if (d) d.addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement ton compte et ton journal en ligne ? Ton journal restera dans ce navigateur. Cette action est irréversible.')) return;
      const { error } = await sb.rpc('delete_my_account');
      if (error) { syncState.status = 'Suppression impossible : ' + error.message; refreshAccountBox(); return; }
      await sb.auth.signOut(); session = null; setOwner(null); syncState.status = 'Compte supprimé. Ton journal reste dans ce navigateur.'; refreshAccountBox();
    });
  }

  /* ---------- duels A/B ---------- */
  const CRITERIA = { plaisir: 'Plaisir musical', soiree: 'Potentiel soirée / danse', immersion: 'Immersion / transe', melodie: 'Mélodie', kicks: 'Puissance des kicks', originalite: 'Originalité' };
  const RESULTS = { a: 'A l’emporte', b: 'B l’emporte', tie: 'Égalité', none: 'Aucun des deux' };
  const rdid = () => 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function cleanDuel(x, known) {
    if (!x || typeof x !== 'object') return null;
    if (typeof x.id !== 'string' || !/^d-[a-z0-9]{4,24}$/.test(x.id)) return null;
    const ok = (id) => typeof id === 'string' && (setById[id] || (db.custom && db.custom[id]) || (known && known.has(id)));
    if (!ok(x.a) || !ok(x.b) || x.a === x.b) return null;
    if (!RESULTS[x.result] || !CRITERIA[x.crit]) return null;
    return { id: x.id, a: x.a, b: x.b, result: x.result, crit: x.crit, date: typeof x.date === 'string' ? x.date.slice(0, 10) : new Date().toISOString().slice(0, 10), updated: Number.isFinite(x.updated) ? Math.floor(x.updated) : 0 };
  }
  // borne basse de l'intervalle de Wilson (95 %) : classe prudemment quand il y a peu de duels
  const wilsonLow = (score, n) => { if (!n) return 0; const z = 1.96, p = score; return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n); };
  function duelRanking(crit) {
    const t = {};
    db.duels.filter((d) => d.crit === crit && d.result !== 'none').forEach((d) => {
      [d.a, d.b].forEach((id) => { t[id] = t[id] || { id, n: 0, pts: 0, w: 0, t: 0, l: 0 }; t[id].n++; });
      if (d.result === 'tie') { t[d.a].pts += 0.5; t[d.b].pts += 0.5; t[d.a].t++; t[d.b].t++; }
      else { const win = d.result === 'a' ? d.a : d.b, lose = d.result === 'a' ? d.b : d.a; t[win].pts += 1; t[win].w++; t[lose].l++; }
    });
    return Object.values(t).map((r) => Object.assign(r, { score: r.pts / r.n, low: wilsonLow(r.pts / r.n, r.n) })).filter((r) => itemById(r.id)).sort((a, b) => b.low - a.low || b.n - a.n);
  }
  let duelCrit = 'plaisir', duelPair = null, duelLast = '';
  function listenedIds() { return Object.entries(db.listens).filter(([id, l]) => l.status === 'ecoute' && itemById(id)).map(([id]) => id); }
  function pickPair(crit) {
    const ids = listenedIds(); if (ids.length < 2) return null;
    const seen = new Set(db.duels.filter((d) => d.crit === crit).map((d) => [d.a, d.b].sort().join('|')));
    const count = (id) => db.duels.filter((d) => d.crit === crit && (d.a === id || d.b === id)).length;
    const pairs = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = [ids[i], ids[j]].sort().join('|'); if (!seen.has(k)) pairs.push([ids[i], ids[j], count(ids[i]) + count(ids[j])]); }
    if (!pairs.length) return null;
    const min = Math.min(...pairs.map((p) => p[2])); const pool = pairs.filter((p) => p[2] === min);
    const p = pool[Math.floor(Math.random() * pool.length)]; return Math.random() < 0.5 ? [p[0], p[1]] : [p[1], p[0]];
  }
  function duelCard(id, label) {
    const it = itemById(id); const l = db.listens[id] || {};
    const r = (k) => (l[k] ? l[k] + '/5' : '—');
    return `<article class="card"><div class="kind">${label}</div><h3><a href="${itemHref(it)}" target="_blank" rel="noopener">${esc(setName(it))}</a></h3>
      <div class="tags">${(it.styles || []).slice(0, 3).map(styleChip).join('')}</div>
      <p class="small muted">Tes notes : plaisir ${r('plaisir')} · soirée ${r('soiree')} · immersion ${r('immersion')}</p>
      <p><a class="btn sm" href="${itemHref(it)}" target="_blank" rel="noopener">Réécouter (nouvel onglet)</a></p></article>`;
  }
  function rankingTable(crit) {
    const r = duelRanking(crit);
    if (!r.length) return '<p class="muted">Aucun duel pour ce critère.</p>';
    return `<div class="tablewrap"><table><thead><tr><th>#</th><th>Son</th><th>Duels</th><th>Victoires</th><th>Égalités</th><th>Défaites</th><th></th></tr></thead><tbody>${r.map((x, i) => `<tr><td>${i + 1}</td><td><a href="${itemHref(itemById(x.id))}">${esc(setName(itemById(x.id)))}</a></td><td>${x.n}</td><td>${x.w}</td><td>${x.t}</td><td>${x.l}</td><td class="small">${x.n < 3 ? '<span class="muted">Trop peu de duels</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function viewDuel() {
    const ids = listenedIds();
    if (ids.length < 2) {
      return `<p class="crumbs"><a href="#/mes-gouts">← Mes goûts</a></p><div class="sectionHead"><div class="eyebrow">Duel A/B</div><h1 style="font-size:clamp(28px,5vw,44px)">Comparer deux sons</h1></div>
        <div class="notice">Un duel compare deux sons que tu as déjà écoutés. Note d’abord au moins deux sets (<a href="#/sets">Bibliothèque</a>), puis reviens ici.</div>`;
    }
    if (!duelPair || !itemById(duelPair[0]) || !itemById(duelPair[1])) duelPair = pickPair(duelCrit);
    const hist = db.duels.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 12);
    return `<p class="crumbs"><a href="#/mes-gouts">← Mes goûts</a></p><div class="sectionHead"><div class="eyebrow">Duel A/B</div><h1 style="font-size:clamp(28px,5vw,44px)">Lequel te parle le plus ?</h1>
      <p>Choisis un critère, puis départage deux sons que tu as écoutés. Un duel n’efface jamais une note : les deux informations sont conservées.</p></div>
      <div class="filters" role="group" aria-label="Critère du duel">${Object.keys(CRITERIA).map((k) => `<button class="chip ${duelCrit === k ? 'on' : ''}" data-crit="${k}" aria-pressed="${duelCrit === k}">${esc(CRITERIA[k])}</button>`).join('')}</div>
      ${duelPair ? `<div class="grid" style="margin-top:14px">${duelCard(duelPair[0], 'A')}${duelCard(duelPair[1], 'B')}</div>
        <div class="row" style="margin-top:14px" role="group" aria-label="Résultat du duel">${Object.keys(RESULTS).map((k) => `<button class="btn ${k === 'tie' || k === 'none' ? '' : 'primary'}" data-res="${k}">${esc(RESULTS[k])}</button>`).join('')}<button class="btn sm" id="newPair">Changer de paire</button></div>
        <p class="small muted" id="duelMsg" aria-live="polite">${esc(duelLast)}</p>`
        : '<div class="notice" style="margin-top:14px">Tu as déjà comparé toutes les paires possibles pour ce critère avec tes sons écoutés. Écoute et note d’autres sets pour continuer.</div>'}
      <div class="panel" style="margin-top:18px"><h2>Classement par duels : ${esc(CRITERIA[duelCrit])}</h2><p class="small muted">Classement prudent : un son avec peu de duels descend, même s’il les a tous gagnés.</p>${rankingTable(duelCrit)}</div>
      ${hist.length ? `<div class="panel" style="margin-top:14px"><h2>Derniers duels</h2><ul class="small">${hist.map((d) => { const a = itemById(d.a), b = itemById(d.b); if (!a || !b) return ''; return `<li>${esc(CRITERIA[d.crit])} : <b>${esc(setName(a))}</b> contre <b>${esc(setName(b))}</b> → ${esc(RESULTS[d.result])} <button class="btn sm danger" data-undo="${esc(d.id)}">Annuler</button></li>`; }).join('')}</ul></div>` : ''}`;
  }
  function afterDuel() {
    main.querySelectorAll('[data-crit]').forEach((b) => b.addEventListener('click', () => { duelCrit = b.dataset.crit; duelPair = null; duelLast = ''; render(true); }));
    const np = document.getElementById('newPair'); if (np) np.addEventListener('click', () => { const prev = duelPair; let p = pickPair(duelCrit), t = 0; while (p && prev && p.slice().sort().join() === prev.slice().sort().join() && t++ < 6) p = pickPair(duelCrit); duelPair = p; render(true); });
    main.querySelectorAll('[data-res]').forEach((b) => b.addEventListener('click', () => {
      if (!duelPair) return; const [a, c] = duelPair; const result = b.dataset.res;
      const du = cleanDuel({ id: rdid(), a, b: c, result, crit: duelCrit, updated: Date.now() });
      if (!du) return; db.duels.push(du); saveDb(db);
      const la = db.listens[a] || {}, lc = db.listens[c] || {}; const key = { plaisir: 'plaisir', soiree: 'soiree', immersion: 'immersion' }[duelCrit];
      duelLast = 'Duel enregistré.';
      if (key && la[key] && lc[key] && ((result === 'a' && la[key] < lc[key]) || (result === 'b' && lc[key] < la[key]))) duelLast += ' Ce duel va à l’inverse de tes notes : ce n’est pas un problème, les deux sont conservés.';
      duelPair = pickPair(duelCrit); render(true);
    }));
    main.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', () => { const id = b.dataset.undo; db.duels = db.duels.filter((d) => d.id !== id); db.deleted['d:' + id] = Date.now(); saveDb(db); render(true); }));
  }

  /* ---------- point de départ (quiz éditorial) ---------- */
  const QUIZ = A.quiz || {};
  let quizAns = {};
  function quizResults() {
    const score = {}, why = {};
    (QUIZ.questions || []).forEach((q) => {
      const r = (q.reponses || []).find((x) => x.id === quizAns[q.id]); if (!r) return;
      Object.entries(r.poids || {}).forEach(([st, w]) => { if (!styleById[st]) return; score[st] = (score[st] || 0) + w; (why[st] = why[st] || []).push(r.texte); });
    });
    return Object.keys(score).sort((a, b) => score[b] - score[a] || a.localeCompare(b)).slice(0, 3).map((st) => ({ st, score: score[st], why: why[st] }));
  }
  function startSetFor(st) {
    const l = pickVerified(A.sets).filter((s) => (s.styles || []).includes(st));
    return l.find((s) => s.niveau === 'entree') || l.find((s) => s.niveau === 'intermediaire') || l[0] || null;
  }
  function viewDepart() {
    const qs = QUIZ.questions || [];
    const answered = Object.keys(quizAns).length;
    const res = answered >= 2 ? quizResults() : [];
    return `<p class="crumbs"><a href="#/">← Accueil</a></p><div class="sectionHead"><div class="eyebrow">Pour débuter</div><h1 style="font-size:clamp(28px,5vw,44px)">${esc(QUIZ.titre || 'Trouve ton point de départ')}</h1><p>${esc(QUIZ.intro || '')}</p></div>
      <form id="quizForm">${qs.map((q) => `<fieldset class="panel" style="margin-bottom:12px;border:1px solid var(--line)"><legend class="kind" style="padding:0 6px">${esc(q.texte)}</legend>
        <div class="pick" style="flex-direction:column;gap:8px">${q.reponses.map((r) => `<label class="chip ${quizAns[q.id] === r.id ? 'on' : ''}" style="cursor:pointer;display:block;padding:10px 12px"><input type="radio" name="${esc(q.id)}" value="${esc(r.id)}" ${quizAns[q.id] === r.id ? 'checked' : ''} style="margin-right:8px">${esc(r.texte)}</label>`).join('')}</div></fieldset>`).join('')}
        <div class="row"><button class="btn sm" type="button" id="quizReset">Recommencer</button><span class="small muted">${answered < 2 ? 'Réponds à au moins deux questions pour voir des suggestions.' : answered + ' réponse(s) sur ' + qs.length}</span></div></form>
      ${res.length ? `<div class="sectionHead"><h2>Tes pistes de départ</h2><p>Suggestions éditoriales d’après tes réponses (pas une mesure de tes goûts). Écoute, note, et le site affinera avec <a href="#/pour-toi">Pour toi</a>.</p></div>
        <div class="grid">${res.map((r) => { const s = styleById[r.st]; const ss = startSetFor(r.st); const pc = PATHS.filter((p) => p.etapes.some((e) => e.type === 'style' && e.ref === r.st))[0];
          return `<article class="card"><div class="kind">${r.score >= 4 ? 'Forte affinité' : 'Piste'}</div><h3><a href="#/style/${encodeURIComponent(s.id)}">${esc(s.nom)}</a></h3><p class="small">${esc((s.def || '').slice(0, 190))}${(s.def || '').length > 190 ? '…' : ''}</p>
            <p class="small muted">Parce que tu as choisi : ${[...new Set(r.why)].map((t) => '« ' + esc(t) + ' »').join(', ')}.</p>
            <div class="row">${ss ? `<a class="btn sm primary" href="#/set/${encodeURIComponent(ss.id)}">Écouter : ${esc(setName(ss))}</a>` : '<span class="small muted">Pas encore de set vérifié pour ce style.</span>'}${pc ? `<a class="btn sm" href="#/parcours/${encodeURIComponent(pc.id)}">Parcours : ${esc(pc.titre)}</a>` : ''}</div></article>`; }).join('')}</div>` : ''}`;
  }
  function afterDepart() {
    main.querySelectorAll('#quizForm input[type=radio]').forEach((i) => i.addEventListener('change', () => { quizAns[i.name] = i.value; render(true); }));
    const r = document.getElementById('quizReset'); if (r) r.addEventListener('click', () => { quizAns = {}; render(true); });
  }

  /* ---------- « Pour toi » : profils et recommandations expliquées ---------- */
  const AXES = { plaisir: ['plaisir', 'Me faire plaisir'], soiree: ['soiree', 'Danser, faire la fête'], immersion: ['immersion', 'M’immerger'] };
  let pfAxis = 'plaisir';
  function styleStats(axis) {
    const per = {};
    Object.entries(db.listens).forEach(([id, l]) => {
      if (l.status !== 'ecoute' || !l[axis]) return; const it = itemById(id); if (!it) return;
      (it.styles || []).forEach((st) => { if (styleById[st]) (per[st] = per[st] || []).push({ id, v: l[axis] }); });
    });
    const stat = {};
    Object.entries(per).forEach(([st, a]) => { stat[st] = { n: a.length, mean: a.reduce((s, x) => s + x.v, 0) / a.length, items: a.map((x) => x.id) }; });
    return stat;
  }
  const neighborsOf = (st) => { const set = new Set([...(styleById[st].influences || []), ...(styleById[st].derives || [])]); A.styles.forEach((x) => { if ((x.derives || []).includes(st) || (x.influences || []).includes(st)) set.add(x.id); }); return set; };
  function recommend(axis) {
    const stat = styleStats(axis);
    const liked = Object.keys(stat).filter((st) => stat[st].mean >= 4);
    const disliked = Object.keys(stat).filter((st) => stat[st].mean <= 2);
    const likedNb = {}; liked.forEach((st) => neighborsOf(st).forEach((nb) => { (likedNb[nb] = likedNb[nb] || []).push(st); }));
    const out = [];
    pickVerified(A.sets).filter((s) => !(db.listens[s.id] && db.listens[s.id].status === 'ecoute')).forEach((s) => {
      let score = 0, blocked = false; const why = [];
      (s.styles || []).forEach((st) => {
        if (!stat[st]) return;
        if (stat[st].mean <= 2) { blocked = true; return; }
        const d = (stat[st].mean - 3) * Math.min(stat[st].n, 3) / 3;
        if (d > 0) { score += d; why.push({ type: 'style', st, n: stat[st].n, mean: stat[st].mean, ex: stat[st].items[0] }); }
      });
      (s.styles || []).forEach((st) => { if (stat[st] || !likedNb[st] || !styleById[st]) return; score += 0.4; why.push({ type: 'voisin', st, from: likedNb[st][0] }); });
      if (!blocked && score > 0) out.push({ s, score, why });
    });
    out.sort((a, b) => b.score - a.score || (a.s.niveau === 'entree' ? -1 : 1));
    return { stat, liked, disliked, recs: out.slice(0, 6) };
  }
  function reasonText(w) {
    if (w.type === 'style') { const it = itemById(w.ex); return `Tu as noté en moyenne ${w.mean.toFixed(1).replace('.', ',')}/5 le style « ${esc(styleLabel(w.st))} » (${w.n} écoute${w.n > 1 ? 's' : ''}), par exemple « ${esc(it ? setName(it) : '')} ».`; }
    return `« ${esc(styleLabel(w.st))} » est voisin dans l’arbre des styles de « ${esc(styleLabel(w.from))} », que tu as aimé.`;
  }
  function profileCards() {
    return Object.keys(AXES).map((ax) => {
      const stat = styleStats(AXES[ax][0]); const rows = Object.keys(stat).sort((a, b) => stat[b].mean - stat[a].mean || stat[b].n - stat[a].n).slice(0, 3);
      const total = Object.values(stat).reduce((s, x) => s + x.n, 0);
      return `<article class="card"><div class="kind">${esc(AXES[ax][1])}</div>${rows.length ? `<ul class="small" style="padding-left:18px;margin:6px 0">${rows.map((st) => `<li>${esc(styleLabel(st))} : ${stat[st].mean.toFixed(1).replace('.', ',')}/5 <span class="muted">(${stat[st].n})</span></li>`).join('')}</ul>${total < 3 ? '<p class="small muted">Peu de notes : un début, pas un profil.</p>' : ''}` : '<p class="small muted">Pas encore de notes sur cet axe.</p>'}</article>`;
    }).join('');
  }
  function viewPourToi() {
    const nRated = Object.values(db.listens).filter((l) => l.status === 'ecoute' && (l.plaisir || l.soiree || l.immersion)).length;
    const axis = AXES[pfAxis][0]; const r = recommend(axis);
    return `<div class="sectionHead"><div class="eyebrow">Pour toi</div><h1 style="font-size:clamp(28px,5vw,44px)">Ce que tes notes disent de toi</h1>
      <p>Des suggestions tirées uniquement de <b>tes</b> notes et de l’arbre des styles. Chaque suggestion dit pourquoi. Avec peu de notes, ce sont des pistes, pas des certitudes.</p></div>
      ${nRated < 2 ? `<div class="notice">Tu as noté ${nRated} son${nRated > 1 ? 's' : ''}. Il en faut au moins deux pour des suggestions. Pas d’idée ? <a href="#/depart">Trouve ton point de départ</a> ou ouvre un <a href="#/parcours">parcours</a>.</div>` : ''}
      <div class="filters" role="group" aria-label="Pour quoi ?">${Object.keys(AXES).map((k) => `<button class="chip ${pfAxis === k ? 'on' : ''}" data-axis="${k}" aria-pressed="${pfAxis === k}">${esc(AXES[k][1])}</button>`).join('')}</div>
      <div class="sectionHead"><h2>Tes profils d’écoute</h2></div><div class="grid">${profileCards()}</div>
      ${r.disliked.length ? `<p class="small muted" style="margin-top:10px">Styles que tu as moins aimés sur cet axe (écartés des suggestions) : ${r.disliked.map((st) => esc(styleLabel(st))).join(', ')}.</p>` : ''}
      <div class="sectionHead"><h2>À écouter ensuite — ${esc(AXES[pfAxis][1].toLowerCase())}</h2></div>
      ${r.recs.length ? `<div class="grid">${r.recs.map(({ s, why }) => { const nmax = Math.max(0, ...why.filter((w) => w.type === 'style').map((w) => w.n)); const conf = nmax >= 3 ? 'Piste solide' : nmax === 2 ? 'Piste probable' : 'Début de piste';
        return `<article class="card"><div class="kind">${conf}</div><h3><a href="#/set/${encodeURIComponent(s.id)}">${esc(setName(s))}</a></h3><div class="tags"><span class="badge niv">${esc(NIV[s.niveau] || '')}</span>${(s.styles || []).slice(0, 3).map(styleChip).join('')}</div>
          <ul class="small" style="padding-left:18px;margin:4px 0">${why.slice(0, 2).map((w) => `<li>${reasonText(w)}</li>`).join('')}</ul></article>`; }).join('')}</div>`
        : '<p class="muted">Pas de suggestion pour l’instant : note quelques sons sur cet axe (au moins deux, avec au moins un que tu as vraiment aimé).</p>'}
      <p class="small muted" style="margin-top:14px">Ces suggestions ne remplacent pas ton jugement : un style aimé ne veut pas dire que tous ses sets te plairont. <a href="#/duel">Les duels A/B</a> permettent d’affiner.</p>`;
  }
  function afterPourToi() {
    main.querySelectorAll('[data-axis]').forEach((b) => b.addEventListener('click', () => { pfAxis = b.dataset.axis; render(true); }));
  }

  /* ---------- termes du glossaire cliquables dans les textes ---------- */
  const GLOSS_LINKS = [
    ['BPM', ['BPM']], ['Kick saturé', ['kick saturé', 'kicks saturés']], ['Kick', ['kick', 'kicks']],
    ['4/4 (four on the floor)', ['4/4', 'four on the floor']], ['Hi-hat', ['hi-hat', 'hi-hats']], ['Groove', ['groove']],
    ['Bassline', ['bassline']], ['Rumble', ['rumble']], ['Bounce', ['bounce']], ['Acid', ['acid']], ['Hypnotique', ['hypnotique']],
    ['Build-up', ['build-up']], ['Breakdown', ['breakdown']], ['Drop', ['drop']], ['Sample', ['sample', 'samples']],
    ['B2B (back to back)', ['B2B', 'back to back']], ['Warm-up / peak time / closing', ['warm-up', 'peak time', 'closing']],
    ['Tracklist', ['tracklist']], ['Rave', ['rave', 'raves']], ['Free party / teknival / sound system', ['free party', 'free parties', 'teknival', 'teknivals', 'sound system', 'sound systems']],
    ['Edit / remix', ['remix', 'edit']], ['Synthétiseur', ['synthétiseur', 'synthétiseurs']], ['Boîte à rythmes', ['boîte à rythmes', 'boîtes à rythmes']],
    ['Roland TB-303', ['TB-303']], ['Tekno / hardtek', ['hardtek', 'tekno']], ['Belleville Three', ['Belleville Three']], ['EBM (electronic body music)', ['EBM']],
    ['Basse inversée (reverse bass)', ['basse inversée', 'reverse bass']], ['Teufeur / teuf', ['teufeur', 'teufeurs']],
    ['Platine', ['platine', 'platines']], ['Ableton Live', ['Ableton Live']], ['Final Scratch', ['Final Scratch']], ['Kaoss pad', ['Kaoss pad']],
    ['Raw / rawstyle, euphoric', ['rawstyle', 'euphoric']], ['Hardgroove', ['hardgroove']], ['Tribal techno', ['tribal techno']], ['Microhouse', ['microhouse']],
    ['Black metal', ['black metal']], ['Speedcore / terrorcore', ['speedcore', 'terrorcore']], ['Vocodeur / talkbox', ['vocodeur', 'talkbox']],
    ['Sous-label', ['sous-label']], ['Live house', ['live house']], ['5x5', ['5x5']]
  ];
  const glossIdx = {}; const glossAlt = [];
  GLOSS_LINKS.forEach(([name, alts]) => { const i = G.findIndex((g) => g.terme === name); if (i < 0) return; alts.forEach((a) => { glossIdx[a.toLowerCase()] = i; glossAlt.push(a); }); });
  const glossRe = glossAlt.length ? new RegExp('(?<![\\p{L}\\p{N}_-])(' + glossAlt.sort((x, y) => y.length - x.length).map((a) => a.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')).join('|') + ')(?![\\p{L}\\p{N}_-])', 'giu') : null;
  /* Échappe le texte puis entoure la première occurrence de chaque terme du glossaire. */
  function rich(text) {
    const safe = esc(text);
    if (!glossRe) return safe;
    const seen = new Set();
    return safe.replace(glossRe, (m) => { const i = glossIdx[m.toLowerCase()]; if (i == null || seen.has(i)) return m; seen.add(i); return `<span class="gl" tabindex="0" role="button" data-gl="${i}" aria-label="Définition de ${esc(G[i].terme)}">${m}</span>`; });
  }
  function initGlossTips() {
    const tip = document.createElement('div'); tip.className = 'gltip'; tip.id = 'glTip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
    let cur = null;
    const close = () => { tip.hidden = true; cur = null; };
    const open = (el) => {
      if (cur === el) { close(); return; }
      const g = G[Number(el.dataset.gl)]; if (!g) return; cur = el;
      tip.innerHTML = `<b>${esc(g.terme)}</b><br>${esc(g.def)}<br><a href="#/glossaire" id="glMore">Voir le glossaire</a>`;
      tip.hidden = false;
      const r = el.getBoundingClientRect(); const w = tip.offsetWidth;
      tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
      const below = r.bottom + 8 + tip.offsetHeight < window.innerHeight; tip.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - tip.offsetHeight - 8)) + 'px';
    };
    document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('.gl'); if (el) { open(el); e.stopPropagation(); } else if (!e.target.closest('#glTip') || e.target.id === 'glMore') close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); else if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('gl')) { e.preventDefault(); open(e.target); } });
    window.addEventListener('hashchange', close); window.addEventListener('scroll', close, { passive: true });
  }

  /* ---------- échelle des tempos (plages BPM sourcées, sans arbitrage) ---------- */
  const tempoColor = (src) => (/Wikip.dia EN/.test(src) ? '#65e3dc' : /Wikip.dia FR/.test(src) ? '#d8ff63' : /Wikip.dia DE/.test(src) ? '#ff83c1' : '#ffc66b');
  function tempoRows() {
    return A.styles.filter((s) => (s.tempos || []).length).map((s) => ({ s, pl: s.tempos.filter((p) => Number.isFinite(p.min)) })).filter((r) => r.pl.length)
      .sort((a, b) => Math.min(...a.pl.map((p) => p.min)) - Math.min(...b.pl.map((p) => p.min)) || a.s.nom.localeCompare(b.s.nom, 'fr'));
  }
  const bpmTxt = (p) => (p.max && p.max !== p.min ? p.min + '–' + p.max : String(p.min)) + ' BPM';
  function viewTempos() {
    const rows = tempoRows();
    if (!rows.length) return '<div class="sectionHead"><div class="eyebrow">Tempos</div><h1 style="font-size:clamp(28px,5vw,44px)">Échelle des tempos</h1></div><p class="muted">Les données de tempo ne sont pas encore disponibles.</p>';
    const all = rows.flatMap((r) => r.pl); const lo = Math.max(40, Math.floor(Math.min(...all.map((p) => p.min)) / 20) * 20); const hi = Math.min(300, Math.ceil(Math.max(...all.map((p) => p.max || p.min)) / 20) * 20 + 20);
    const pct = (v) => ((v - lo) / (hi - lo)) * 100;
    const ticks = []; for (let v = lo; v <= hi; v += 20) ticks.push(v);
    const reperes = (A.tempo_reperes || []);
    return `<div class="sectionHead"><div class="eyebrow">Tempos</div><h1 style="font-size:clamp(28px,5vw,44px)">À quelle vitesse tourne chaque style ?</h1>
      <p>Le tempo se mesure en BPM (battements par minute). Chaque barre est une fourchette <b>citée par une source</b> ; quand deux sources diffèrent, les deux barres sont affichées. Ce sont des ordres de grandeur, pas des règles : beaucoup de styles se jouent à des vitesses variées.</p></div>
      ${reperes.length ? `<div class="panel"><h3>Repères</h3><ul class="small">${reperes.map((x) => `<li>${rich(x.texte || x)}${x.commentaire ? ` <span class="muted">${esc(x.commentaire)}</span>` : ''}${x.url ? ` <a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener noreferrer">source</a>` : ''}</li>`).join('')}</ul></div>` : ''}
      <div class="legend" style="margin-top:14px"><span><i style="background:#65e3dc"></i>Wikipédia EN</span><span><i style="background:#d8ff63"></i>Wikipédia FR</span><span><i style="background:#ff83c1"></i>Wikipédia DE</span><span><i style="background:#ffc66b"></i>Autres sources (presse, éditeurs de logiciels, médias)</span></div>
      <div class="tempo" role="group" aria-label="Échelle des tempos par style">
        <div class="tempo-axis">${ticks.map((v) => `<span style="left:${pct(v)}%">${v}</span>`).join('')}</div>
        ${rows.map((r) => `<div class="tempo-row"><div class="tempo-name"><a href="#/style/${encodeURIComponent(r.s.id)}">${esc(r.s.nom)}</a>${r.s.tempo_confiance === 'a_verifier' ? ' <span class="badge a_verifier" title="Tempo peu ou mal sourcé : voir le détail plus bas">à vérifier</span>' : ''}</div>
          <div class="tempo-track">${ticks.map((v) => `<i class="tick" style="left:${pct(v)}%"></i>`).join('')}${r.pl.map((p, i) => { const l = pct(p.min), w = Math.max(1.2, p.max && p.max !== p.min ? pct(p.max) - pct(p.min) : 1.2);
            return `<span class="tempo-bar" title="${esc(p.source + ' : ' + bpmTxt(p) + (p.note ? ' (' + p.note + ')' : ''))}" style="left:${l}%;width:${w}%;top:${6 + (i % 3) * 9}px;background:${tempoColor(p.source)}"></span>`; }).join('')}</div></div>`).join('')}
      </div>
      <div class="sectionHead"><h2>Le détail, source par source</h2></div>
      <div class="tablewrap"><table><thead><tr><th>Style</th><th>Fourchette</th><th>Source</th><th>Précision</th></tr></thead><tbody>
        ${rows.map((r) => r.pl.map((p, i) => `<tr><td>${i === 0 ? `<a href="#/style/${encodeURIComponent(r.s.id)}">${esc(r.s.nom)}</a>${r.s.tempo_commentaire ? `<div class="small muted">${esc(r.s.tempo_commentaire)}</div>` : ''}` : ''}</td><td>${esc(bpmTxt(p))}</td><td class="small">${p.url ? `<a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.source)}</a>` : esc(p.source)}</td><td class="small muted">${esc(p.note || '')}</td></tr>`).join('')).join('')}
      </tbody></table></div>
      <p class="small muted" style="margin-top:14px">Les styles absents de ce tableau n’ont pas de fourchette trouvée dans une source consultée. Le tempo ne dit pas tout : un set lent peut être très lourd, un set rapide très léger.</p>`;
  }

  /* ---------- répertoire : artistes, labels, lieux ---------- */
  const ARTISTS = A.artistes || [], LABELS = A.labels || [], PLACES = A.lieux || [];
  const artistById = byId(ARTISTS), labelById = byId(LABELS), placeById = byId(PLACES);
  const nk = (x) => String(x == null ? '' : x).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const artistByName = {};
  ARTISTS.forEach((a) => [a.nom, ...(a.alias || [])].forEach((n) => { if (!artistByName[nk(n)]) artistByName[nk(n)] = a.id; }));
  const artistNameLink = (n) => (artistByName[nk(n)] ? `<a href="#/artiste/${encodeURIComponent(artistByName[nk(n)])}">${esc(n)}</a>` : esc(n));
  const setsOfArtist = (id) => pickVerified(A.sets).filter((s) => (s.artistes_liens || []).some((x) => x.id === id));
  const confNote = (e) => (e.confiance && e.confiance !== 'haute' ? confBadge(e.confiance) : '');
  const placeKind = { club: 'Club', festival: 'Festival', media: 'Média', ville: 'Ville-scène' };
  const entCard = (kind, e, sub, body) => `<article class="card"><div class="kind">${esc(kind)}</div><h3><a href="#/${kind === 'Artiste' ? 'artiste' : kind === 'Label' ? 'label' : 'lieu'}/${encodeURIComponent(e.id)}">${esc(e.nom)}</a></h3>${sub ? `<p class="small muted">${esc(sub)}</p>` : ''}<p class="small">${esc((body || '').slice(0, 170))}${(body || '').length > 170 ? '…' : ''}</p></article>`;
  let repTab = 'artistes', repQ = '';
  function repList() {
    const q = nk(repQ);
    const f = (arr, extra) => arr.filter((e) => !q || nk(e.nom + ' ' + (e.alias || []).join(' ') + ' ' + (extra ? extra(e) : '')).includes(q)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    let html = '';
    if (repTab === 'artistes') html = f(ARTISTS, (e) => (e.pays || '') + ' ' + (e.roles || []).join(' ')).map((e) => entCard('Artiste', e, [(e.roles || []).join(', '), e.pays].filter(Boolean).join(' · '), e.description_fr)).join('');
    else if (repTab === 'labels') html = f(LABELS, (e) => (e.pays || '') + ' ' + (e.ville || '')).map((e) => entCard('Label', e, [e.ville, e.pays, e.annee_creation].filter(Boolean).join(' · '), e.description_fr)).join('');
    else html = f(PLACES, (e) => (e.pays || '') + ' ' + (e.ville || '')).map((e) => entCard(placeKind[e.type] || 'Lieu', Object.assign({}, e), [e.ville, e.pays].filter(Boolean).join(' · '), e.description_fr).replace('#/lieu/', '#/lieu/')).join('');
    return html ? `<div class="grid">${html}</div>` : '<p class="muted">Aucun résultat.</p>';
  }
  function viewRepertoire(tab) {
    if (['artistes', 'labels', 'lieux'].includes(tab)) repTab = tab;
    const T = { artistes: ['Artistes', ARTISTS.length], labels: ['Labels', LABELS.length], lieux: ['Lieux et événements', PLACES.length] };
    return `<div class="sectionHead"><div class="eyebrow">Répertoire</div><h1 style="font-size:clamp(28px,5vw,44px)">Qui, quoi, où</h1><p>Les artistes, labels, clubs et festivals cités sur le site, avec des fiches courtes et sourcées.</p></div>
      <div class="toolbar"><div class="f"><label for="rep-q">Chercher</label><input id="rep-q" type="search" value="${esc(repQ)}" placeholder="nom, pays, rôle…"></div>
        <div class="f" role="group" aria-label="Catégorie"><label>Afficher</label><div class="row">${Object.keys(T).map((k) => `<button class="chip ${repTab === k ? 'on' : ''}" data-rtab="${k}" aria-pressed="${repTab === k}">${esc(T[k][0])} (${T[k][1]})</button>`).join('')}</div></div></div>
      <div id="repRes">${repList()}</div>`;
  }
  function afterRepertoire() {
    document.getElementById('rep-q').addEventListener('input', (e) => { repQ = e.target.value; document.getElementById('repRes').innerHTML = repList(); });
    main.querySelectorAll('[data-rtab]').forEach((b) => b.addEventListener('click', () => { repTab = b.dataset.rtab; location.hash = '#/repertoire/' + repTab; }));
  }
  const srcBlock = (e) => sourcesBlock(e.sources);
  function viewArtiste(id) {
    const a = artistById[id]; if (!a) return notFound();
    const sets = setsOfArtist(id); const evs = A.timeline.filter((e) => (e.personnes_liens || []).some((x) => x.id === id));
    const labs = (a.labels || []).map((l) => labelById[l]).filter(Boolean);
    return `<p class="crumbs"><a href="#/repertoire/artistes">← Répertoire</a></p><div class="eyebrow">${esc((a.roles || []).join(' · ') || 'Artiste')}</div><h1 style="font-size:clamp(28px,5vw,44px)">${esc(a.nom)}</h1>
      <p class="muted">${esc([a.ville, a.pays, a.annees_actives].filter(Boolean).join(' · '))}</p><div class="tags">${confNote(a)}${(a.liens_styles || []).map(styleChip).join('')}</div>
      <div class="two" style="margin-top:18px"><div><div class="panel"><p class="lead" style="margin:0">${rich(a.description_fr)}</p></div>
        ${sets.length ? `<div class="sectionHead"><h2>À écouter sur le site</h2></div><div class="grid">${sets.map(setCard).join('')}</div>` : '<p class="muted" style="margin-top:14px">Pas encore de set vérifié pour cet artiste.</p>'}
        ${evs.length ? `<div class="sectionHead"><h2>Dans l’histoire</h2></div><ul>${evs.map((e) => `<li><a href="#/histoire/${encodeURIComponent(e.id)}">${esc(e.annee)} — ${esc(e.titre)}</a></li>`).join('')}</ul>` : ''}</div>
        <div><div class="panel"><h3>Repères</h3>${labs.length ? `<p class="small"><b>Labels :</b> ${labs.map((l) => `<a href="#/label/${encodeURIComponent(l.id)}">${esc(l.nom)}</a>`).join(', ')}</p>` : ''}${srcBlock(a)}</div></div></div>`;
  }
  function viewLabel(id) {
    const l = labelById[id]; if (!l) return notFound();
    const artists = ARTISTS.filter((a) => (a.labels || []).includes(id));
    const fond = (l.fondateurs || []).map((f) => (artistById[f] ? `<a href="#/artiste/${encodeURIComponent(f)}">${esc(artistById[f].nom)}</a>` : esc(f)));
    return `<p class="crumbs"><a href="#/repertoire/labels">← Répertoire</a></p><div class="eyebrow">Label</div><h1 style="font-size:clamp(28px,5vw,44px)">${esc(l.nom)}</h1>
      <p class="muted">${esc([l.ville, l.pays, l.annee_creation ? 'depuis ' + l.annee_creation : ''].filter(Boolean).join(' · '))}</p><div class="tags">${confNote(l)}${(l.liens_styles || []).map(styleChip).join('')}</div>
      <div class="two" style="margin-top:18px"><div><div class="panel"><p class="lead" style="margin:0">${rich(l.description_fr)}</p></div></div>
        <div><div class="panel"><h3>Repères</h3>${fond.length ? `<p class="small"><b>Fondateur(s) :</b> ${fond.join(', ')}</p>` : ''}${artists.length ? `<p class="small"><b>Artistes liés :</b> ${artists.map((a) => `<a href="#/artiste/${encodeURIComponent(a.id)}">${esc(a.nom)}</a>`).join(', ')}</p>` : ''}${srcBlock(l)}</div></div></div>`;
  }
  function viewLieu(id) {
    const p = placeById[id]; if (!p) return notFound();
    const c = p.coordonnees && Number.isFinite(p.coordonnees.lat) && Number.isFinite(p.coordonnees.lon) ? p.coordonnees : null;
    const evs = A.timeline.filter((e) => nk(e.titre + ' ' + (e.lieu || '')).includes(nk(p.nom)) || nk(e.resume || '').includes(nk(p.nom))).slice(0, 8);
    return `<p class="crumbs"><a href="#/repertoire/lieux">← Répertoire</a></p><div class="eyebrow">${esc(placeKind[p.type] || 'Lieu')}</div><h1 style="font-size:clamp(28px,5vw,44px)">${esc(p.nom)}</h1>
      <p class="muted">${esc([p.ville, p.pays, p.periode].filter(Boolean).join(' · '))}</p><div class="tags">${confNote(p)}${(p.liens_styles || []).map(styleChip).join('')}</div>
      <div class="two" style="margin-top:18px"><div><div class="panel"><p class="lead" style="margin:0">${rich(p.description_fr)}</p></div>
        ${evs.length ? `<div class="sectionHead"><h2>Dans l’histoire</h2></div><ul>${evs.map((e) => `<li><a href="#/histoire/${encodeURIComponent(e.id)}">${esc(e.annee)} — ${esc(e.titre)}</a></li>`).join('')}</ul>` : ''}</div>
        <div><div class="panel"><h3>Repères</h3>${c ? `<p class="small">Ville : <a href="https://www.openstreetmap.org/?mlat=${c.lat}&amp;mlon=${c.lon}#map=9/${c.lat}/${c.lon}" target="_blank" rel="noopener noreferrer">voir sur la carte (OpenStreetMap)</a></p>` : ''}${srcBlock(p)}</div></div></div>`;
  }

  /* ---------- vues ---------- */
  const LVL_KEY = 'technoatlas_level';
  const getLevel = () => { try { return localStorage.getItem(LVL_KEY) === 'habitue' ? 'habitue' : 'debutant'; } catch (e) { return 'debutant'; } };
  const setLevel = (v) => { try { localStorage.setItem(LVL_KEY, v); } catch (e) { /* stockage indisponible */ } };
  function viewHome() {
    const lvl = getLevel();
    const picks = pickVerified(A.sets).filter((s) => s.niveau === 'entree').slice(0, 4);
    const nVer = pickVerified(A.sets).length;
    const entries = Object.entries(db.listens).map(([id, l]) => ({ id, l, it: itemById(id) })).filter((x) => x.it);
    const nDone = entries.filter((x) => x.l.status === 'ecoute').length;
    const todo = entries.filter((x) => x.l.status === 'a_ecouter').slice(0, 5);
    const inProg = PATHS.filter((p) => { const d = [...doneSteps(p.id)].filter((i) => i < p.etapes.length).length; return d > 0 && d < p.etapes.length; });
    const more = pickVerified(A.sets).filter((s) => s.niveau !== 'entree' && !db.listens[s.id]).slice(0, 4);
    const beginner = `<div class="sectionHead"><div class="eyebrow">Par où commencer</div><h2>Trois étapes</h2></div>
      <div class="steps">
        <div class="panel step"><span class="n">1</span><h3>Comprendre</h3><p class="small muted">La frise des origines (Détroit, Chicago, Berlin, les raves…) puis la carte des styles : qui descend de qui.</p><a class="btn sm" href="#/histoire">Ouvrir la frise</a> <a class="btn sm" href="#/styles">Voir les styles</a></div>
        <div class="panel step"><span class="n">2</span><h3>Écouter</h3><p class="small muted">Des sets emblématiques, classés « porte d’entrée » ou « pour aller plus loin », avec des repères pour savoir quoi écouter.</p><a class="btn sm" href="#/guide/ecouter-un-set">Comment écouter un set</a> <a class="btn sm" href="#/sets">La bibliothèque</a></div>
        <div class="panel step"><span class="n">3</span><h3>Se situer</h3><p class="small muted">Note ce que tu écoutes sur trois axes (plaisir, soirée, immersion) et vois apparaître tes affinités, sans surinterprétation.</p><a class="btn sm" href="#/mes-gouts">Mon journal</a></div>
      </div>
      ${PATHS.length ? `<div class="sectionHead"><div class="eyebrow">Parcours guidés</div><h2>Pas envie de chercher ? Suis un chemin</h2></div><div class="grid">${PATHS.slice(0, 4).map(parcoursCard).join('')}</div><p><a href="#/parcours">Tous les parcours</a></p>` : ''}
      ${picks.length ? `<div class="sectionHead"><div class="eyebrow">Pour un premier contact</div><h2>Sets « porte d’entrée »</h2></div><div class="grid">${picks.map(setCard).join('')}</div>` : ''}`;
    const habitue = `<div class="sectionHead"><div class="eyebrow">Content de te revoir</div><h2>Reprendre là où tu t’es arrêté</h2></div>
      <div class="grid">
        <article class="card"><div class="kind">Mon journal</div><p>${nDone} écoute${nDone > 1 ? 's' : ''} notée${nDone > 1 ? 's' : ''}, ${todo.length ? 'liste « À écouter » en cours' : 'liste « À écouter » vide'}.</p><div class="row"><a class="btn sm primary" href="#/pour-toi">Pour toi</a><a class="btn sm" href="#/duel">Un duel A/B</a><a class="btn sm" href="#/mes-gouts">Mon journal</a></div></article>
        ${todo.length ? `<article class="card"><div class="kind">À écouter</div><ul class="small" style="padding-left:18px;margin:6px 0">${todo.map((x) => `<li><a href="${itemHref(x.it)}">${esc(setName(x.it))}</a></li>`).join('')}</ul></article>` : ''}
        ${inProg.map(parcoursCard).join('')}
      </div>
      ${more.length ? `<div class="sectionHead"><h2>Pour aller plus loin</h2></div><div class="grid">${more.map(setCard).join('')}</div>` : ''}
      <div class="sectionHead"><h2>Explorer</h2></div><div class="row"><a class="btn" href="#/parcours">Les parcours</a><a class="btn" href="#/styles">L’arbre des styles</a><a class="btn" href="#/guides">Les guides</a><a class="btn" href="#/depart">Refaire le quiz de départ</a></div>`;
    return `<section class="hero">
      <div class="eyebrow">Guide pour débuter</div>
      <h1>Comprendre la techno,<br><span>de ses origines à aujourd’hui.</span></h1>
      <p class="lead">D’où vient ce son, qui a influencé qui, et par quels sets commencer pour savoir ce que tu aimes vraiment. Un guide pensé pour celles et ceux qui n’y connaissent rien — et qui veulent y entrer sans se perdre.</p>
      <div class="row" role="group" aria-label="Ton niveau"><button class="chip ${lvl === 'debutant' ? 'on' : ''}" data-lvl="debutant" aria-pressed="${lvl === 'debutant'}">Je débute</button><button class="chip ${lvl === 'habitue' ? 'on' : ''}" data-lvl="habitue" aria-pressed="${lvl === 'habitue'}">J’écoute déjà un peu</button></div>
      <div class="row" style="margin-top:14px"><a class="btn primary" href="#/depart">Je ne sais pas par où commencer</a><a class="btn" href="#/histoire">L’histoire</a><a class="btn" href="#/sets">Les sets</a></div>
      <div class="stats"><div><b>${A.timeline.length}</b><span class="muted small">repères historiques</span></div><div><b>${A.styles.length}</b><span class="muted small">styles</span></div><div><b>${nVer}</b><span class="muted small">sets vérifiés</span></div></div>
    </section>${lvl === 'debutant' ? beginner : habitue}`;
  }
  function afterHome() {
    main.querySelectorAll('[data-lvl]').forEach((b) => b.addEventListener('click', () => { setLevel(b.dataset.lvl); render(true); }));
  }

  /* ---------- guides ---------- */
  const GUIDES = A.guides || [];
  const guideById = byId(GUIDES);
  function guideLink(l) {
    if (l.type === 'page') return `<a class="btn sm" href="#/${esc(l.ref)}">${esc(l.texte || l.ref)}</a>`;
    if (l.type === 'style' && styleById[l.ref]) return `<a class="btn sm" href="#/style/${encodeURIComponent(l.ref)}">${esc(styleById[l.ref].nom)}</a>`;
    if (l.type === 'parcours' && pathById[l.ref]) return `<a class="btn sm primary" href="#/parcours/${encodeURIComponent(l.ref)}">${esc(l.texte || 'Parcours : ' + pathById[l.ref].titre)}</a>`;
    if (l.type === 'set' && setById[l.ref]) return `<a class="btn sm" href="#/set/${encodeURIComponent(l.ref)}">${esc(setName(setById[l.ref]))}</a>`;
    return '';
  }
  function viewGuides() {
    return `<div class="sectionHead"><div class="eyebrow">Guides</div><h1 style="font-size:clamp(28px,5vw,44px)">Pour s’y retrouver</h1><p>Des mini-guides courts pour apprendre à écouter, choisir un style et lire les fiches du site.</p></div>
      <div class="grid">${GUIDES.map((g) => `<article class="card"><h3><a href="#/guide/${encodeURIComponent(g.id)}">${esc(g.titre)}</a></h3><p class="small muted">${esc(g.intro)}</p></article>`).join('')}</div>`;
  }
  function viewGuide(id) {
    const g = guideById[id]; if (!g) return notFound();
    return `<p class="crumbs"><a href="#/guides">← Tous les guides</a></p><div class="eyebrow">Guide</div><h1 style="font-size:clamp(26px,4.5vw,40px)">${esc(g.titre)}</h1><p class="lead">${esc(g.intro)}</p>
      ${g.sections.map((s) => `<section class="panel" style="margin-top:14px"><h2>${esc(s.titre)}</h2><p>${rich(s.texte)}</p>${(s.liens || []).length ? `<div class="row">${s.liens.map(guideLink).join('')}</div>` : ''}</section>`).join('')}`;
  }

  /* ---------- parcours guidés ---------- */
  const doneSteps = (pid) => new Set((db.progress && db.progress[pid]) || []);
  function viewParcoursList() {
    return `<div class="sectionHead"><div class="eyebrow">Parcours</div><h1 style="font-size:clamp(28px,5vw,44px)">Des chemins guidés</h1>
      <p>Une suite courte d’étapes (un repère d’histoire, un style, un set) pour entrer dans un univers sans se perdre. Coche chaque étape quand tu l’as faite : ta progression reste dans ton navigateur.</p></div>
      <div class="grid">${PATHS.map(parcoursCard).join('') || '<p class="muted">Aucun parcours pour l’instant.</p>'}</div>`;
  }
  function parcoursCard(p) {
    const n = p.etapes.length; const d = [...doneSteps(p.id)].filter((i) => i < n).length;
    return `<article class="card"><div class="tags"><span class="chip">${n} étapes</span>${d ? `<span class="chip on">${d}/${n} faites</span>` : ''}</div>
      <h3><a href="#/parcours/${encodeURIComponent(p.id)}">${esc(p.titre)}</a></h3>
      <p class="small muted">${esc(p.pour_qui || '')}</p><p class="small">${esc(p.intro || '')}</p></article>`;
  }
  function stepBody(st) {
    if (st.type === 'set') {
      const s = setById[st.ref]; if (!s) return '';
      return `<p><a class="btn sm primary" href="#/set/${encodeURIComponent(s.id)}">Écouter : ${esc(setName(s))}</a></p><p class="small muted">${esc([s.evenement, s.lieu, s.annee].filter(Boolean).join(' · '))}</p>`;
    }
    if (st.type === 'style') {
      const s = styleById[st.ref]; if (!s) return '';
      return `<p><a class="btn sm" href="#/style/${encodeURIComponent(s.id)}">Fiche : ${esc(s.nom)}</a></p><p class="small muted">${esc(s.def)}</p>`;
    }
    const e = evById[st.ref]; if (!e) return '';
    return `<p class="small"><b>${esc(e.annee)} — ${esc(e.titre)}</b><br><span class="muted">${esc(e.resume)}</span></p><p><a class="small" href="#/histoire/${encodeURIComponent(e.id)}">Voir dans la frise</a></p>`;
  }
  function viewParcours(id) {
    const p = pathById[id]; if (!p) return notFound();
    const done = doneSteps(id);
    return `<p class="crumbs"><a href="#/parcours">← Tous les parcours</a></p><div class="eyebrow">Parcours</div><h1 style="font-size:clamp(26px,4.5vw,40px)">${esc(p.titre)}</h1>
      <p class="lead">${esc(p.intro || '')}</p>${p.pour_qui ? `<p class="small muted">${esc(p.pour_qui)}</p>` : ''}
      <ol class="tl" style="margin-top:22px">${p.etapes.map((st, i) => `<li><div class="yr">Étape ${i + 1} · ${st.type === 'set' ? 'À écouter' : st.type === 'style' ? 'À comprendre' : 'À lire'}</div>
        ${st.texte ? `<p>${rich(st.texte)}</p>` : ''}${stepBody(st)}
        <button class="chip ${done.has(i) ? 'on' : ''}" data-step="${i}" aria-pressed="${done.has(i)}">${done.has(i) ? 'Faite' : 'Marquer comme faite'}</button></li>`).join('')}</ol>`;
  }
  function afterParcours(id) {
    main.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.step); const cur = new Set((db.progress[id] || [])); if (cur.has(i)) cur.delete(i); else cur.add(i);
      db.progress[id] = [...cur].sort((a, c) => a - c); db.progressUpdated[id] = Date.now(); saveDb(db); render(true);
    }));
  }

  let tlDecade = 'all';
  let focusEv = null;
  function viewHistoire(arg) {
    if (arg && evById[arg]) { tlDecade = 'all'; focusEv = arg; }
    const evs = A.timeline.slice().sort((a, b) => a.annee - b.annee);
    const decs = [...new Set(evs.map((e) => decade(e.annee)))];
    const shown = tlDecade === 'all' ? evs : evs.filter((e) => decade(e.annee) === tlDecade);
    const groups = {};
    shown.forEach((e) => { (groups[decade(e.annee)] = groups[decade(e.annee)] || []).push(e); });
    return `<div class="sectionHead"><div class="eyebrow">Histoire</div><h1 style="font-size:clamp(28px,5vw,44px)">Les origines, décennie par décennie</h1>
      <p>${evs.length} repères sourcés. Les points encore discutés sont marqués « À vérifier » plutôt que tranchés.</p></div>
      <div class="filters" role="group" aria-label="Filtrer par décennie">
        <button class="chip ${tlDecade === 'all' ? 'on' : ''}" data-dec="all" aria-pressed="${tlDecade === 'all'}">Tout</button>
        ${decs.map((d) => `<button class="chip ${tlDecade === d ? 'on' : ''}" data-dec="${d}" aria-pressed="${tlDecade === d}">${d}</button>`).join('')}
      </div>
      ${Object.keys(groups).map((d) => `<section class="decade"><h2>${d}</h2><ol class="tl">${groups[d].map((e) => `<li id="ev-${esc(e.id)}">
        <div class="yr">${esc(e.annee)}${e.annee_fin ? '–' + esc(e.annee_fin) : ''}${e.lieu ? ' · ' + esc(e.lieu) : ''}</div>
        <h3>${esc(e.titre)}</h3>
        <p>${rich(e.resume)}</p>
        ${e.compte ? `<p class="compte">Pourquoi c’est important : ${rich(e.compte)}</p>` : ''}
        <div class="tags">${confBadge(e.confiance)}${(e.styles || []).map(styleChip).join('')}</div>
        ${e.notes ? `<p class="small muted">Réserve : ${esc(e.notes)}</p>` : ''}
        ${sourcesBlock(e.sources)}
      </li>`).join('')}</ol></section>`).join('')}`;
  }
  function afterHistoire() {
    main.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => { tlDecade = b.dataset.dec; if (location.hash.startsWith('#/histoire/')) history.replaceState(null, '', '#/histoire'); render(true); }));
    if (focusEv) {
      const el = document.getElementById('ev-' + focusEv); focusEv = null;
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.style.outline = '2px solid var(--lime)'; el.style.outlineOffset = '6px'; el.style.borderRadius = '8px'; }
    }
  }

  let selStyle = null;
  let styleViewMode = 'arbre';
  /* Arbre des styles : colonnes par décennie, liens tracés d'une influence vers ses dérivés. */
  function treeLayout() {
    const NW = 176, NH = 50, GX = 70, GY = 14, PX = 14, PY = 36;
    const cols = {};
    A.styles.slice().sort((a, b) => (a.annee || 9999) - (b.annee || 9999) || a.nom.localeCompare(b.nom, 'fr')).forEach((s) => { const k = s.annee ? decade(s.annee) : 'Période non précisée'; (cols[k] = cols[k] || []).push(s); });
    const keys = Object.keys(cols).sort((a, b) => (parseInt(a, 10) || 9999) - (parseInt(b, 10) || 9999));
    const edges = new Set();
    A.styles.forEach((s) => { (s.influences || []).forEach((p) => { if (styleById[p]) edges.add(p + '>' + s.id); }); (s.derives || []).forEach((c) => { if (styleById[c]) edges.add(s.id + '>' + c); }); });
    const parentsOf = (id) => [...edges].filter((e) => e.endsWith('>' + id)).map((e) => e.split('>')[0]);
    const pos = {};
    keys.forEach((k, ci) => {
      const list = cols[k].map((s, i) => {
        const ps = parentsOf(s.id).filter((p) => pos[p] && pos[p].col < ci);
        return { s, i, b: ps.length ? ps.reduce((a, p) => a + pos[p].y, 0) / ps.length : null };
      });
      list.sort((x, y) => (x.b == null ? PY + x.i * (NH + GY) : x.b) - (y.b == null ? PY + y.i * (NH + GY) : y.b));
      let y = PY; list.forEach(({ s }) => { pos[s.id] = { x: PX + ci * (NW + GX), y, col: ci }; y += NH + GY; });
    });
    const H = Math.max(...Object.values(pos).map((p) => p.y + NH)) + PY / 2;
    const W = PX * 2 + keys.length * (NW + GX) - GX;
    return { NW, NH, keys, cols, pos, edges: [...edges].map((e) => e.split('>')), W, H, PX, GX };
  }
  const wrapName = (t) => { const w = t.split(' '); const l = ['']; w.forEach((x) => { if ((l[l.length - 1] + ' ' + x).trim().length <= 22) l[l.length - 1] = (l[l.length - 1] + ' ' + x).trim(); else l.push(x); }); const out = l.slice(0, 2); if (l.length > 2) out[1] = out[1].slice(0, 20) + '…'; return out; };
  function treeSvg(sel, parents, children) {
    const L = treeLayout(); const { NW, NH, pos } = L;
    const edgePath = ([p, c]) => {
      const a = pos[p], b = pos[c]; if (!a || !b) return '';
      let x1, x2; const y1 = a.y + NH / 2, y2 = b.y + NH / 2;
      if (a.col < b.col) { x1 = a.x + NW; x2 = b.x; const dx = (x2 - x1) / 2; return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`; }
      if (a.col > b.col) { x1 = a.x; x2 = b.x + NW; const dx = (x1 - x2) / 2; return `M${x1} ${y1} C${x1 - dx} ${y1} ${x2 + dx} ${y2} ${x2} ${y2}`; }
      x1 = a.x + NW; x2 = b.x + NW; return `M${x1} ${y1} C${x1 + 46} ${y1} ${x2 + 46} ${y2} ${x2} ${y2}`;
    };
    const edgeCls = ([p, c]) => (!sel ? 'e' : c === sel.id ? 'e par' : p === sel.id ? 'e chi' : 'e dim');
    const heads = L.keys.map((k, ci) => `<text class="gh" x="${L.PX + ci * (NW + L.GX)}" y="20">${esc(k)}</text>`).join('');
    const nodes = A.styles.map((s) => {
      const p = pos[s.id]; if (!p) return '';
      const cls = !sel ? '' : s.id === sel.id ? 'sel' : parents.has(s.id) ? 'parent' : children.has(s.id) ? 'child' : 'dim';
      const lines = wrapName(s.nom);
      return `<g class="gn ${cls}" data-st="${esc(s.id)}" tabindex="0" role="button" aria-pressed="${sel && s.id === sel.id ? 'true' : 'false'}" aria-label="${esc(s.nom)}" transform="translate(${p.x},${p.y})"><title>${esc(s.nom)}</title><rect width="${NW}" height="${NH}" rx="10"/>${lines.map((t, i) => `<text x="10" y="${lines.length === 1 ? 29 : 21 + i * 15}">${esc(t)}</text>`).join('')}</g>`;
    }).join('');
    return `<svg class="tree" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}" role="group" aria-label="Arbre des styles : chaque style est relié à ses influences et à ses dérivés"><defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="context-stroke"/></marker></defs>${heads}
      <g fill="none">${L.edges.map((e) => `<path class="${edgeCls(e)}" d="${edgePath(e)}" marker-end="url(#arr)"/>`).join('')}</g>${nodes}</svg>`;
  }
  function viewStyles() {
    const cols = {};
    A.styles.slice().sort((a, b) => (a.annee || 9999) - (b.annee || 9999) || a.nom.localeCompare(b.nom, 'fr')).forEach((s) => {
      const k = s.annee ? decade(s.annee) : 'Période non précisée';
      (cols[k] = cols[k] || []).push(s);
    });
    const sel = selStyle && styleById[selStyle];
    const parents = new Set(sel ? sel.influences : []);
    const children = new Set(sel ? sel.derives : []);
    // une relation déclarée d'un seul côté est affichée des deux côtés
    if (sel) A.styles.forEach((s) => { if ((s.derives || []).includes(sel.id)) parents.add(s.id); if ((s.influences || []).includes(sel.id)) children.add(s.id); });
    const starter = sel ? A.sets.filter((x) => (x.styles || []).includes(sel.id) && x.verifie && x.niveau === 'entree')[0] : null;
    const detail = sel
      ? `<aside class="panel gdetail" id="sdetail" aria-live="polite"><div class="row" style="justify-content:space-between"><span class="kind">Style</span><button class="btn sm" id="closeSt">Fermer</button></div>
          <h2 style="margin:6px 0 4px">${esc(sel.nom)}</h2><p class="small muted">${esc([sel.periode, sel.lieu].filter(Boolean).join(' · '))}</p><div class="tags">${confBadge(sel.confiance)}</div>
          <p style="margin-top:10px">${rich(sel.def)}</p>
          ${(sel.carac || []).length ? `<p class="small"><b>Ce qu’on y entend :</b></p><ul class="small">${sel.carac.map((c) => `<li>${rich(c)}</li>`).join('')}</ul>` : ''}
          ${sel.bpm ? `<p class="small"><b>BPM typique :</b> ${esc(sel.bpm)}</p>` : ''}
          <p class="small"><b>Influences :</b> ${[...parents].map(styleChip).join(' ') || '<span class="muted">aucune renseignée</span>'}</p>
          <p class="small"><b>Dérivés :</b> ${[...children].map(styleChip).join(' ') || '<span class="muted">aucun renseigné</span>'}</p>
          ${(sel.artistes || []).length ? `<p class="small"><b>Artistes clés :</b> ${sel.artistes.map(artistNameLink).join(', ')}</p>` : ''}
          ${starter ? `<p class="small"><b>Pour commencer :</b> <a href="#/set/${encodeURIComponent(starter.id)}">${esc(setName(starter))}</a></p>` : ''}
          <a class="btn sm primary" href="#/style/${encodeURIComponent(sel.id)}">Ouvrir la fiche complète</a></aside>`
      : `<aside class="panel gdetail"><span class="kind">Style</span><h3 style="margin-top:6px">Choisis un style</h3><p class="small muted">Touche un style dans l’arbre : sa définition, ses influences et ses dérivés s’affichent ici.</p></aside>`;
    const liste = `<div class="gen">${Object.keys(cols).map((k) => `<div class="gcol"><h3>${esc(k)}</h3>${cols[k].map((s) => {
      const cls = !sel ? '' : s.id === sel.id ? 'sel' : parents.has(s.id) ? 'parent' : children.has(s.id) ? 'child' : 'dim';
      return `<button class="gnode ${cls}" data-st="${esc(s.id)}" aria-pressed="${sel && s.id === sel.id ? 'true' : 'false'}">${esc(s.nom)}<small>${esc(s.lieu || '')}</small></button>`;
    }).join('')}</div>`).join('')}</div>`;
    return `<div class="sectionHead"><div class="eyebrow">Styles</div><h1 style="font-size:clamp(28px,5vw,44px)">Qui descend de qui</h1>
      <p>Les styles sont rangés par période d’apparition ; chaque flèche va d’une influence vers son dérivé. Touche un style pour lire sa définition et voir ses liens.</p></div>
      <div class="row" role="group" aria-label="Affichage"><button class="chip ${styleViewMode === 'arbre' ? 'on' : ''}" data-view="arbre" aria-pressed="${styleViewMode === 'arbre'}">Arbre</button><button class="chip ${styleViewMode === 'liste' ? 'on' : ''}" data-view="liste" aria-pressed="${styleViewMode === 'liste'}">Liste par période</button></div>
      <div class="legend"><span><i style="background:var(--lime)"></i>Style choisi</span><span><i style="background:var(--cyan)"></i>Ses influences</span><span><i style="background:var(--pink)"></i>Ses dérivés</span></div>
      <div class="genwrap"><div class="gen">${styleViewMode === 'arbre' ? treeSvg(sel, parents, children) : liste.replace('<div class="gen">', '<div class="gen2">').replace(/<\/div>$/, '</div>')}</div>${detail}</div>`;
  }
  function afterStyles() {
    const open = (id) => {
      selStyle = id; render(true);
      if (id && window.matchMedia('(max-width:900px)').matches) { const d = document.getElementById('sdetail'); if (d) d.scrollIntoView({ block: 'start', behavior: 'instant' }); }
    };
    main.querySelectorAll('[data-st]').forEach((b) => {
      b.addEventListener('click', () => open(selStyle === b.dataset.st ? null : b.dataset.st));
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(selStyle === b.dataset.st ? null : b.dataset.st); } });
    });
    main.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { styleViewMode = b.dataset.view; render(true); }));
    const c = document.getElementById('closeSt'); if (c) c.addEventListener('click', () => open(null));
  }

  function viewStyle(id) {
    const s = styleById[id];
    if (!s) return notFound();
    const par = new Set(s.influences || []); const chi = new Set(s.derives || []);
    A.styles.forEach((x) => { if ((x.derives || []).includes(id)) par.add(x.id); if ((x.influences || []).includes(id)) chi.add(x.id); });
    const sets = A.sets.filter((x) => (x.styles || []).includes(id) && x.verifie);
    const evs = A.timeline.filter((e) => (e.styles || []).includes(id));
    const inPaths = PATHS.filter((p) => p.etapes.some((st) => st.type === 'style' && st.ref === id));
    const starter = sets.filter((x) => x.niveau === 'entree')[0];
    return `<p class="crumbs"><a href="#/styles">← Tous les styles</a></p>
      <div class="eyebrow">Style</div><h1>${esc(s.nom)}</h1>
      <p class="muted">${esc([s.periode, s.lieu].filter(Boolean).join(' · '))}</p><div class="tags">${confBadge(s.confiance)}</div>
      <div class="two" style="margin-top:20px"><div>
        <div class="panel"><p class="lead" style="margin:0">${rich(s.def)}</p></div>
        ${(s.carac || []).length ? `<div class="sectionHead"><h2>Ce qu’on y entend</h2></div><ul>${s.carac.map((c) => `<li>${rich(c)}</li>`).join('')}</ul>` : ''}
        ${(s.tempos || []).length ? `<p class="small"><b>Tempo selon les sources :</b> ${s.tempos.filter((p) => Number.isFinite(p.min)).map((p) => esc(bpmTxt(p) + ' (' + p.source + ')')).join(' ; ')} — <a href="#/tempos">échelle des tempos</a></p>` : s.bpm ? `<p class="small"><b>BPM typique :</b> ${esc(s.bpm)} <span class="muted">(selon les sources citées ; un repère, pas une règle)</span></p>` : '<p class="small muted">BPM non renseigné (aucune source fiable retenue).</p>'}
        ${s.notes ? `<p class="small muted"><b>Points discutés :</b> ${esc(s.notes)}</p>` : ''}
        ${evs.length ? `<div class="sectionHead"><h2>Dans l’histoire</h2></div><ul>${evs.map((e) => `<li><a href="#/histoire/${encodeURIComponent(e.id)}">${esc(e.annee)} — ${esc(e.titre)}</a></li>`).join('')}</ul>` : ''}
        ${sourcesBlock(s.sources)}
      </div><div>
        ${starter ? `<div class="panel" style="margin-bottom:14px"><h3>Pour commencer</h3><p class="small muted">Un set accessible pour entendre ce style.</p><a class="btn sm primary" href="#/set/${encodeURIComponent(starter.id)}">${esc(setName(starter))}</a></div>` : ''}
        ${inPaths.length ? `<div class="panel" style="margin-bottom:14px"><h3>Dans les parcours</h3><p class="small">${inPaths.map((p) => `<a href="#/parcours/${encodeURIComponent(p.id)}">${esc(p.titre)}</a>`).join('<br>')}</p></div>` : ''}
        <div class="panel"><h3>Dans l’arbre</h3>
          <p class="small"><b>Influences :</b><br>${[...par].map(styleChip).join(' ') || '<span class="muted">non renseigné</span>'}</p>
          <p class="small"><b>Dérivés :</b><br>${[...chi].map(styleChip).join(' ') || '<span class="muted">non renseigné</span>'}</p>
          ${(s.artistes || []).length ? `<p class="small"><b>Artistes clés :</b> ${s.artistes.map(artistNameLink).join(', ')}</p>` : ''}
          ${(s.labels || []).length ? `<p class="small"><b>Labels clés :</b> ${s.labels.map(esc).join(', ')}</p>` : ''}
        </div></div></div>
      ${sets.length ? `<div class="sectionHead"><h2>Sets pour l’écouter</h2></div><div class="grid">${sets.map(setCard).join('')}</div>` : '<p class="muted" style="margin-top:20px">Pas encore de set vérifié rattaché à ce style.</p>'}`;
  }

  const sf = { q: '', niveau: '', style: '', branche: '' };
  function filteredSets() {
    const q = sf.q.trim().toLowerCase();
    return pickVerified(A.sets).filter((s) =>
      (!sf.niveau || s.niveau === sf.niveau) && (!sf.branche || (s.branches || [s.branche]).includes(sf.branche)) && (!sf.style || (s.styles || []).includes(sf.style)) &&
      (!q || (setName(s) + ' ' + (s.evenement || '') + ' ' + (s.lieu || '')).toLowerCase().includes(q)))
      .sort((a, b) => (a.annee || 0) - (b.annee || 0));
  }
  function setsResults() {
    const r = filteredSets();
    return `<p class="small muted" aria-live="polite">${r.length} set${r.length > 1 ? 's' : ''}</p>${r.length ? `<div class="grid">${r.map(setCard).join('')}</div>` : '<p class="muted">Aucun set ne correspond à ces filtres.</p>'}`;
  }
  function viewSets() {
    const ids = [...new Set(pickVerified(A.sets).flatMap((s) => s.styles || []))].filter((i) => styleById[i]).sort((a, b) => styleLabel(a).localeCompare(styleLabel(b), 'fr'));
    const opt = (v, cur, lab) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(lab)}</option>`;
    const hidden = A.sets.length - pickVerified(A.sets).length;
    return `<div class="sectionHead"><div class="eyebrow">Bibliothèque</div><h1 style="font-size:clamp(28px,5vw,44px)">Sets emblématiques</h1>
      <p>Chaque set renvoie vers sa plateforme d’origine. Titre et auteur du lien ont été contrôlés. Commence par les « portes d’entrée ».</p></div>
      <div class="toolbar">
        <div class="f"><label for="f-q">Recherche</label><input id="f-q" type="search" value="${esc(sf.q)}" placeholder="Artiste, événement, ville"></div>
        <div class="f"><label for="f-niv">Niveau</label><select id="f-niv">${opt('', sf.niveau, 'Tous')}${Object.keys(NIV).map((k) => opt(k, sf.niveau, NIV[k])).join('')}</select></div>
        <div class="f"><label for="f-br">Univers</label><select id="f-br">${opt('', sf.branche, 'Tous')}${Object.keys(BRANCH).map((k) => opt(k, sf.branche, BRANCH[k])).join('')}</select></div>
        <div class="f"><label for="f-st">Style</label><select id="f-st">${opt('', sf.style, 'Tous')}${ids.map((i) => opt(i, sf.style, styleLabel(i))).join('')}</select></div>
      </div>
      <div id="setsRes">${setsResults()}</div>
      ${hidden ? `<p class="small muted" style="margin-top:20px">${hidden} set(s) en cours de vérification ne sont pas affichés.</p>` : ''}`;
  }
  function afterSets() {
    const upd = () => { document.getElementById('setsRes').innerHTML = setsResults(); };
    document.getElementById('f-q').addEventListener('input', (e) => { sf.q = e.target.value; upd(); });
    [['f-niv', 'niveau'], ['f-br', 'branche'], ['f-st', 'style']].forEach(([id, k]) => document.getElementById(id).addEventListener('change', (e) => { sf[k] = e.target.value; upd(); }));
  }

  function rateRow(axis, val) {
    return `<div class="rate" role="group" aria-label="${esc(axis)}" data-axis="${esc(axis)}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${val === n ? 'on' : ''}" data-v="${n}" aria-pressed="${val === n}">${n}</button>`).join('')}<span class="small muted">&nbsp;facultatif</span></div>`;
  }
  function playerBlock(s) {
    const yt = ytId(s.url);
    const inner = yt
      ? `<button class="btn primary" id="loadPlayer" data-yt="${esc(yt)}">Charger le lecteur YouTube</button>`
      : mixPath(s.url) ? `<button class="btn primary" id="loadPlayer" data-mix="${esc(mixPath(s.url))}">Charger le lecteur Mixcloud</button>`
      : scUrl(s.url) ? `<button class="btn primary" id="loadPlayer" data-sc="${esc(s.url)}">Charger le lecteur SoundCloud</button>`
      : `<a class="btn primary" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">Écouter sur ${esc(s.plateforme || 'la plateforme')}</a>`;
    return `<div class="playerBox" id="player">${inner}</div>
      <p class="small muted">Le lecteur n’est chargé qu’au clic. Si une vidéo refuse l’intégration, <a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">ouvre-la sur la plateforme</a>.</p>`;
  }
  function viewSet(id) {
    const s = setById[id];
    if (!s) return notFound();
    const l = db.listens[id] || {};
    return `<p class="crumbs"><a href="#/sets">← Bibliothèque</a></p>
      <div class="eyebrow">${esc(kindLabel(s))} · ${esc(BRANCH[s.branche] || '')}</div><h1 style="font-size:clamp(26px,4.5vw,40px)">${esc(setName(s))}</h1>
      <div class="tags" style="margin-top:10px"><span class="badge niv">${esc(NIV[s.niveau] || '')}</span>${confBadge(s.confiance)}${s.verifie ? '<span class="badge ok">Lien contrôlé</span>' : '<span class="badge ko">Lien non contrôlé</span>'}${(s.styles || []).map(styleChip).join('')}</div>
      <div class="two" style="margin-top:20px"><div>
        ${playerBlock(s)}
        <div class="sectionHead"><h2>Pourquoi il est emblématique</h2></div><p>${rich(s.pourquoi)}</p>
        ${s.contexte ? `<p class="muted">${rich(s.contexte)}</p>` : ''}
        ${(s.ecouter || []).length ? `<div class="sectionHead"><h2>Quoi écouter</h2></div><ul>${s.ecouter.map((e) => `<li>${rich(e)}</li>`).join('')}</ul>` : ''}
        ${s.notes ? `<p class="small muted">Note de vérification : ${esc(s.notes)}</p>` : ''}
        ${sourcesBlock(s.sources)}
      </div><div>
        <div class="panel"><h3>Fiche</h3><dl class="dl" style="margin-top:10px">
          <dt>Artiste(s)</dt><dd>${(s.artistes_liens || s.artistes.map((n) => ({ nom: n }))).map((x) => x.id ? `<a href="#/artiste/${encodeURIComponent(x.id)}">${esc(x.nom)}</a>` : esc(x.nom)).join(', ')}</dd>
          <dt>Événement</dt><dd>${esc(s.evenement || 'non renseigné')}</dd>
          <dt>Lieu</dt><dd>${esc(s.lieu || 'non renseigné')}</dd>
          <dt>Année / date</dt><dd>${s.date ? esc(s.date) : s.annee ? esc(s.annee) + ' <span class="muted small">(année de référence : mise en ligne ou tournage selon les cas, voir la note de vérification)</span>' : 'non renseigné'}</dd>
          <dt>Durée</dt><dd>${s.duree_min ? esc(s.duree_min) + ' min' : 'non renseignée'}</dd>
          <dt>Plateforme</dt><dd>${esc(s.plateforme || '')}${s.uploader ? ' — ' + esc(s.uploader) : ''}</dd>
          <dt>Contrôle du lien</dt><dd>${s.verif && s.verif.titre ? `« ${esc(s.verif.titre)} » (${esc(s.verif.auteur || '')}), le ${esc(s.verif.date || '')}` : 'non contrôlé'}</dd>
        </dl></div>
        <div class="panel" style="margin-top:14px" id="listenBox"><h3>Mon écoute</h3>${listenForm(l)}</div>
      </div></div>`;
  }
  function listenForm(l) {
    return `<p class="small muted">Trois axes indépendants : aimer un set, le trouver bon pour danser, et se laisser absorber ne sont pas la même chose.</p>
      <div class="axis"><label>Plaisir musical</label>${rateRow('plaisir', l.plaisir)}</div>
      <div class="axis"><label>Potentiel soirée / danse</label>${rateRow('soiree', l.soiree)}</div>
      <div class="axis"><label>Immersion / transe</label>${rateRow('immersion', l.immersion)}</div>
      <div class="axis"><label>Ce que j’ai remarqué</label><div class="tags">${MARKERS.map((m) => `<button type="button" class="chip ${(l.markers || []).includes(m) ? 'on' : ''}" data-mk="${esc(m)}" aria-pressed="${(l.markers || []).includes(m)}">${esc(m)}</button>`).join('')}</div></div>
      <div class="axis"><label for="ln">Note libre</label><textarea id="ln" maxlength="2000" placeholder="Ce que j’ai aimé, un moment précis, le contexte d’écoute…">${esc(l.note || '')}</textarea></div>
      <div class="row"><button class="btn primary" id="saveL">Enregistrer</button><button class="btn" id="todoL">${l.status === 'a_ecouter' ? 'Retirer de « À écouter »' : 'Mettre dans « À écouter »'}</button>${l.date ? '<button class="btn danger sm" id="delL">Supprimer</button>' : ''}</div>
      <p class="small muted" id="lmsg" aria-live="polite">${l.date ? 'Dernier enregistrement : ' + esc(l.date) : ''}${storageOk ? '' : ' Stockage navigateur indisponible : pense à exporter.'}</p>`;
  }
  function afterSet(id) {
    const btn = document.getElementById('loadPlayer');
    if (btn) btn.addEventListener('click', () => {
      const box = document.getElementById('player');
      const ttl = esc(setName(itemById(id) || { titre: '' }));
      if (btn.dataset.mix) {
        box.innerHTML = `<iframe src="https://www.mixcloud.com/widget/iframe/?hide_cover=1&feed=${encodeURIComponent(btn.dataset.mix)}" title="Lecteur — ${ttl}" allow="encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
        return;
      }
      if (btn.dataset.sc) {
        box.innerHTML = `<iframe src="https://w.soundcloud.com/player/?url=${encodeURIComponent(btn.dataset.sc)}&auto_play=false" title="Lecteur — ${ttl}" allow="autoplay" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
        return;
      }
      box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(btn.dataset.yt)}" title="Lecteur — ${ttl}" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    });
    let draft = Object.assign({ markers: [] }, db.listens[id] || {});
    const box = document.getElementById('listenBox');
    const msg = (t) => { const m = document.getElementById('lmsg'); if (m) m.textContent = t; };
    box.querySelectorAll('.rate').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      const ax = g.dataset.axis; const v = Number(b.dataset.v);
      draft[ax] = draft[ax] === v ? null : v;
      g.querySelectorAll('button').forEach((x) => { const on = Number(x.dataset.v) === draft[ax]; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    }));
    box.querySelectorAll('[data-mk]').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.mk; const i = draft.markers.indexOf(m);
      if (i >= 0) draft.markers.splice(i, 1); else draft.markers.push(m);
      b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', i < 0);
    }));
    document.getElementById('saveL').addEventListener('click', () => {
      draft.note = document.getElementById('ln').value;
      draft.status = 'ecoute'; draft.date = new Date().toISOString().slice(0, 10); draft.updated = Date.now();
      db.listens[id] = cleanListen(draft);
      msg(saveDb(db) ? 'Enregistré dans ce navigateur.' : 'Échec de l’enregistrement : exporte ton journal.');
    });
    document.getElementById('todoL').addEventListener('click', () => {
      const cur = db.listens[id];
      if (cur && cur.status === 'a_ecouter') { delete db.listens[id]; db.deleted['l:' + id] = Date.now(); }
      else db.listens[id] = cleanListen(Object.assign({}, draft, { status: 'a_ecouter', note: document.getElementById('ln').value, updated: Date.now() }));
      saveDb(db); render(true);
    });
    const del = document.getElementById('delL');
    if (del) del.addEventListener('click', () => { if (confirm('Supprimer ton écoute de ce set ?')) { delete db.listens[id]; db.deleted['l:' + id] = Date.now(); saveDb(db); render(true); } });
  }

  function viewGlossaire() {
    const items = G.map((g) => ({ terme: g.terme, def: g.def, kind: 'terme' }))
      .concat(A.styles.map((s) => ({ terme: s.nom, def: s.def, kind: 'style', id: s.id })))
      .sort((a, b) => a.terme.localeCompare(b.terme, 'fr'));
    return `<div class="sectionHead"><div class="eyebrow">Glossaire</div><h1 style="font-size:clamp(28px,5vw,44px)">Les mots de la techno</h1><p>Le vocabulaire utile pour lire les fiches, et la définition de chaque style. Cherche un mot ou filtre par type.</p></div>
      <div class="toolbar"><div class="f"><label for="g-q">Chercher un terme ou un style</label><input id="g-q" type="search" placeholder="kick, acid, B2B, frenchcore…"></div>
        <div class="f" role="group" aria-label="Type d’entrée"><label>Afficher</label><div class="row"><button class="chip on" data-gk="" aria-pressed="true">Tout</button><button class="chip" data-gk="terme" aria-pressed="false">Vocabulaire</button><button class="chip" data-gk="style" aria-pressed="false">Styles</button></div></div></div>
      <p class="small muted" id="gcount" aria-live="polite">${items.length} entrées</p>
      <div id="gl" class="grid">${items.map((g) => `<article class="card" data-k="${g.kind}" data-t="${esc((g.terme + ' ' + g.def).toLowerCase())}">
        <div class="kind">${g.kind === 'style' ? 'Style' : 'Vocabulaire'}</div><h3>${esc(g.terme)}</h3><p class="small">${esc(g.def)}</p>${g.id ? `<p><a class="btn sm" href="#/style/${encodeURIComponent(g.id)}">Fiche du style</a></p>` : ''}</article>`).join('')}</div>`;
  }
  function afterGlossaire() {
    let kind = '';
    const apply = () => {
      const q = document.getElementById('g-q').value.trim().toLowerCase(); let n = 0;
      document.querySelectorAll('#gl [data-t]').forEach((c) => { const show = (!kind || c.dataset.k === kind) && (!q || c.dataset.t.includes(q)); c.hidden = !show; if (show) n++; });
      document.getElementById('gcount').textContent = n + (n > 1 ? ' entrées' : ' entrée');
    };
    document.getElementById('g-q').addEventListener('input', apply);
    document.querySelectorAll('[data-gk]').forEach((b) => b.addEventListener('click', () => {
      kind = b.dataset.gk;
      document.querySelectorAll('[data-gk]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      apply();
    }));
  }

  /* ---------- sélecteur de styles (formulaires « Mes sons ») ---------- */
  function stylePicker(sel, name) {
    return `<div class="pick" data-pick="${name}">${A.styles.slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((s) => `<button type="button" class="chip ${sel.includes(s.id) ? 'on' : ''}" data-sid="${esc(s.id)}" aria-pressed="${sel.includes(s.id)}">${esc(s.nom)}</button>`).join('')}</div>`;
  }
  const readPicker = (root, name) => [...root.querySelectorAll(`[data-pick="${name}"] .chip.on`)].map((b) => b.dataset.sid);
  function bindPicker(root) {
    root.querySelectorAll('[data-pick] .chip').forEach((b) => b.addEventListener('click', () => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }));
  }
  const splitList = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  const typeOptions = (cur) => Object.keys(CUSTOM_TYPES).map((k) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${CUSTOM_TYPES[k]}</option>`).join('');

  function viewGouts() {
    const entries = Object.entries(db.listens).map(([id, l]) => ({ id, l, s: itemById(id) })).filter((x) => x.s);
    const done = entries.filter((x) => x.l.status === 'ecoute');
    const todo = entries.filter((x) => x.l.status === 'a_ecouter');
    const customs = Object.values(db.custom).map(customItem).sort((a, b) => (b.added || '').localeCompare(a.added || ''));
    const perStyle = {};
    done.forEach((x) => (x.s.styles || []).forEach((st) => { (perStyle[st] = perStyle[st] || []).push(x.l); }));
    const avg = (arr, k) => { const v = arr.map((l) => l[k]).filter((n) => n != null); return v.length ? { m: (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1).replace('.', ','), n: v.length } : null; };
    const rows = Object.keys(perStyle).sort((a, b) => perStyle[b].length - perStyle[a].length).map((st) => {
      const arr = perStyle[st]; const p = avg(arr, 'plaisir'); const so = avg(arr, 'soiree'); const im = avg(arr, 'immersion');
      const f = (x) => (x ? `${x.m} <span class="muted small">(${x.n})</span>` : '—');
      return `<tr><td>${esc(styleLabel(st))}</td><td>${arr.length}</td><td>${f(p)}</td><td>${f(so)}</td><td>${f(im)}</td><td class="small">${arr.length < 3 ? '<span class="muted">Trop peu d’écoutes pour parler de tendance</span>' : ''}</td></tr>`;
    }).join('');
    const state = (id) => { const l = db.listens[id]; return !l ? 'Pas encore noté' : l.status === 'a_ecouter' ? 'À écouter' : 'Noté'; };
    const link = (x) => `<a href="${itemHref(x.s)}">${esc(setName(x.s))}</a>${x.s.custom ? ' <span class="chip">perso</span>' : ''}`;
    return `<div class="sectionHead"><div class="eyebrow">Mes goûts</div><h1 style="font-size:clamp(28px,5vw,44px)">Mon journal d’écoute</h1>
      <p>Tout est stocké dans <b>ce navigateur</b>, sur cet appareil. Exporte régulièrement ton journal pour ne rien perdre ou pour changer d’appareil.</p></div>
      ${storageOk ? '' : '<div class="notice">Le stockage du navigateur est indisponible (navigation privée ?). Tes notes ne seront pas conservées : exporte-les.</div>'}
      ${accountPanel()}
      <div class="panel" style="margin-top:14px"><h2>Ajouter un son</h2>
        <p class="small muted">Colle le lien d’un set ou d’un morceau trouvé ailleurs (YouTube, SoundCloud, Mixcloud, Bandcamp…), puis note-le comme les autres. Le titre n’est pas détecté tout seul : indique-le toi-même.</p>
        <form id="addForm" class="formgrid" novalidate>
          <div class="full"><label for="a-url">Lien</label><input id="a-url" type="url" required placeholder="https://…" autocomplete="off"></div>
          <div><label for="a-titre">Titre</label><input id="a-titre" type="text" maxlength="150" required></div>
          <div><label for="a-art">Artiste(s), séparés par une virgule</label><input id="a-art" type="text" maxlength="200"></div>
          <div><label for="a-type">Type</label><select id="a-type">${typeOptions('set')}</select></div>
          <div><label for="a-tags">Mes étiquettes, séparées par une virgule</label><input id="a-tags" type="text" maxlength="200" placeholder="ex. voiture, sport, nuit"></div>
          <div class="full"><label>Styles (facultatif)</label>${stylePicker([], 'add')}</div>
          <div class="full row"><button class="btn primary" type="submit">Ajouter à ma base</button><span class="small" id="addMsg" aria-live="polite"></span></div>
        </form></div>
      <div class="panel" style="margin-top:14px"><h2>Duels A/B</h2><p class="small muted">Départage deux sons que tu as écoutés selon un critère (plaisir, soirée, immersion, mélodie, kicks, originalité). ${db.duels.length ? db.duels.length + ' duel(s) enregistré(s).' : 'Aucun duel pour l’instant.'}</p><a class="btn primary" href="#/duel">Lancer un duel</a></div>
      <div class="panel" style="margin-top:14px"><h2>Affinités par style</h2>
        <p class="small muted">Moyennes sur les notes que tu as données (le nombre entre parenthèses est le nombre de notes). Avec moins de 3 écoutes, ce n’est pas une préférence, c’est un début.</p>
        ${rows ? `<div class="tablewrap"><table><thead><tr><th>Style</th><th>Écoutes</th><th>Plaisir</th><th>Soirée</th><th>Immersion</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Rien encore. Ouvre un set, écoute-le, puis note-le.</p>'}
      </div>
      <div class="panel" style="margin-top:14px"><h2>Mes sons ajoutés (${customs.length})</h2>${customs.length ? `<div class="tablewrap"><table><thead><tr><th>Son</th><th>Type</th><th>Plateforme</th><th>État</th></tr></thead><tbody>${customs.map((c) => `<tr><td><a href="${itemHref(c)}">${esc(setName(c))}</a></td><td>${esc(CUSTOM_TYPES[c.type])}</td><td>${esc(c.plateforme)}</td><td>${state(c.id)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun son ajouté. Utilise le formulaire ci-dessus.</p>'}</div>
      <div class="panel" style="margin-top:14px"><h2>Écoutes (${done.length})</h2>${done.length ? `<div class="tablewrap"><table><thead><tr><th>Son</th><th>Plaisir</th><th>Soirée</th><th>Immersion</th><th>Date</th></tr></thead><tbody>${done.map((x) => `<tr><td>${link(x)}</td><td>${x.l.plaisir || '—'}</td><td>${x.l.soiree || '—'}</td><td>${x.l.immersion || '—'}</td><td>${esc(x.l.date)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucune écoute enregistrée.</p>'}</div>
      <div class="panel" style="margin-top:14px"><h2>À écouter (${todo.length})</h2>${todo.length ? `<ul>${todo.map((x) => `<li>${link(x)}</li>`).join('')}</ul>` : '<p class="muted">Ta liste est vide.</p>'}</div>
      <div class="panel" style="margin-top:14px"><h2>Sauvegarde</h2>
        <div class="row"><button class="btn primary" id="exp">Exporter (JSON)</button><label class="btn" for="imp">Importer un fichier…</label><input type="file" id="imp" accept="application/json,.json" hidden>${session ? '' : '<button class="btn danger sm" id="wipeLocal">Effacer le journal de ce navigateur</button>'}</div>
        <p class="small muted">L’import fusionne : les écoutes et sons déjà présents chez toi ne sont jamais écrasés, seuls les nouveaux sont ajoutés.</p>
        <div id="impMsg" aria-live="polite"></div></div>`;
  }
  function afterGouts() {
    bindAccount();
    const form = document.getElementById('addForm'); bindPicker(form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = document.getElementById('addMsg'); const url = document.getElementById('a-url').value.trim(); const titre = document.getElementById('a-titre').value.trim();
      if (!/^https?:\/\//i.test(url) || safeUrl(url) === '#') { msg.textContent = 'Le lien doit commencer par http:// ou https://.'; return; }
      if (!titre) { msg.textContent = 'Indique un titre.'; return; }
      const lib = A.sets.find((x) => x.url && sameUrl(x.url, url));
      if (lib) { msg.innerHTML = `Ce set est déjà dans la bibliothèque : <a href="#/set/${encodeURIComponent(lib.id)}">${esc(setName(lib))}</a>.`; return; }
      const dup = Object.values(db.custom).find((c) => sameUrl(c.url, url));
      if (dup) { msg.innerHTML = `Tu l’as déjà ajouté : <a href="#/mon-son/${encodeURIComponent(dup.id)}">${esc(dup.titre)}</a>.`; return; }
      const id = rid();
      const c = cleanCustom({ url, titre, artistes: splitList(document.getElementById('a-art').value), type: document.getElementById('a-type').value, styles: readPicker(form, 'add'), tags: splitList(document.getElementById('a-tags').value), updated: Date.now() }, id);
      if (!c) { msg.textContent = 'Données invalides.'; return; }
      db.custom[id] = c;
      if (!saveDb(db)) { msg.textContent = 'Enregistrement impossible dans ce navigateur : exporte ton journal.'; return; }
      location.hash = '#/mon-son/' + encodeURIComponent(id);
    });
    const wipe = document.getElementById('wipeLocal');
    if (wipe) wipe.addEventListener('click', () => {
      if (!confirm('Effacer tout le journal de ce navigateur (écoutes, sons ajoutés, progression des parcours) ? Si tu n’as pas de compte ni d’export, c’est définitif.')) return;
      db = emptyDb(); setOwner(null); saveDb(db, true); render(true);
    });
    document.getElementById('exp').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ app: 'technoatlas', version: 1, exported: new Date().toISOString(), listens: db.listens, custom: db.custom, duels: db.duels, progress: db.progress }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'technoatlas-journal-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    document.getElementById('imp').addEventListener('change', (e) => {
      const f = e.target.files[0]; const out = document.getElementById('impMsg'); if (!f) return;
      if (f.size > 2e6) { out.innerHTML = '<p class="small">Fichier trop volumineux.</p>'; return; }
      f.text().then((t) => {
        let d; try { d = JSON.parse(t); } catch (err) { out.innerHTML = '<div class="notice">Ce fichier n’est pas un JSON valide. Rien n’a été modifié.</div>'; return; }
        if (!d || d.version !== 1 || !d.listens || typeof d.listens !== 'object') { out.innerHTML = '<div class="notice">Format non reconnu (journal Techno Atlas v1 attendu). Rien n’a été modifié.</div>'; return; }
        const addC = []; let customKnown = 0;
        if (d.custom && typeof d.custom === 'object') Object.entries(d.custom).forEach(([id, x]) => {
          const c = cleanCustom(x, id); if (!c) return;
          if (db.custom[id] || Object.values(db.custom).some((y) => sameUrl(y.url, c.url))) customKnown++; else addC.push(c);
        });
        const incoming = new Set(addC.map((c) => c.id));
        const addD = []; if (Array.isArray(d.duels)) d.duels.forEach((x) => { const du = cleanDuel(x, incoming); if (du && !db.duels.some((y) => y.id === du.id)) addD.push(du); });
        const add = []; let same = 0, conflict = 0, unknown = 0;
        Object.entries(d.listens).forEach(([id, x]) => {
          if (!setById[id] && !db.custom[id] && !incoming.has(id)) { unknown++; return; }
          const c = cleanListen(x); if (!c) { unknown++; return; }
          if (!db.listens[id]) add.push([id, c]);
          else if (JSON.stringify(db.listens[id]) === JSON.stringify(c)) same++; else conflict++;
        });
        const nTotal = add.length + addC.length + addD.length;
        out.innerHTML = `<div class="panel" style="margin-top:10px"><p><b>Aperçu de l’import</b></p><ul class="small"><li>${addC.length} nouveau(x) son(s) personnel(s) à ajouter (${customKnown} déjà présent(s))</li><li>${add.length} nouvelle(s) écoute(s) à ajouter</li><li>${addD.length} nouveau(x) duel(s) à ajouter</li><li>${same} identique(s)</li><li>${conflict} en conflit : ta version locale est conservée</li><li>${unknown} ignorée(s) (set inconnu ou données invalides)</li></ul>
          <button class="btn primary" id="okImp" ${nTotal ? '' : 'disabled'}>Ajouter ces ${nTotal} élément(s)</button></div>`;
        const ok = document.getElementById('okImp');
        if (ok) ok.addEventListener('click', () => {
          addC.forEach((c) => { db.custom[c.id] = c; });
          addD.forEach((du) => { db.duels.push(du); });
          add.forEach(([id, c]) => { db.listens[id] = c; });
          // progression des parcours : union des étapes cochées (aucune suppression)
          if (d.progress && typeof d.progress === 'object') Object.entries(d.progress).forEach(([pid, arr]) => {
            if (!pathById[pid] || !Array.isArray(arr)) return;
            const cur = new Set(db.progress[pid] || []); arr.forEach((i) => { if (Number.isInteger(i) && i >= 0 && i < pathById[pid].etapes.length) cur.add(i); });
            db.progress[pid] = [...cur].sort((a, b) => a - b);
          });
          saveDb(db); render(true);
        });
      });
      e.target.value = '';
    });
  }

  /* ---------- fiche d'un son personnel ---------- */
  function viewMonSon(id) {
    const c = db.custom[id]; if (!c) return notFound();
    const s = customItem(c); const l = db.listens[id] || {};
    return `<p class="crumbs"><a href="#/mes-gouts">← Mes goûts</a></p>
      <div class="eyebrow">Mon son · ${esc(CUSTOM_TYPES[c.type])}</div><h1 style="font-size:clamp(26px,4.5vw,40px)">${esc(setName(s))}</h1>
      <div class="tags" style="margin-top:10px">${s.styles.map(styleChip).join('')}${s.tags.map((t) => `<span class="chip">#${esc(t)}</span>`).join('')}</div>
      <div class="two" style="margin-top:20px"><div>
        ${playerBlock(s)}
        <details style="margin-top:18px"><summary>Modifier la fiche</summary>
          <form id="editForm" class="formgrid" style="margin-top:12px" novalidate>
            <div class="full"><label for="e-url">Lien</label><input id="e-url" type="url" value="${esc(c.url)}"></div>
            <div><label for="e-titre">Titre</label><input id="e-titre" type="text" maxlength="150" value="${esc(c.titre)}"></div>
            <div><label for="e-art">Artiste(s), séparés par une virgule</label><input id="e-art" type="text" maxlength="200" value="${esc(c.artistes.join(', '))}"></div>
            <div><label for="e-type">Type</label><select id="e-type">${typeOptions(c.type)}</select></div>
            <div><label for="e-tags">Mes étiquettes</label><input id="e-tags" type="text" maxlength="200" value="${esc(c.tags.join(', '))}"></div>
            <div class="full"><label>Styles</label>${stylePicker(c.styles, 'edit')}</div>
            <div class="full row"><button class="btn primary" type="submit">Enregistrer la fiche</button><span class="small" id="editMsg" aria-live="polite"></span></div>
          </form></details>
      </div><div>
        <div class="panel"><h3>Fiche</h3><dl class="dl" style="margin-top:10px">
          <dt>Lien</dt><dd><a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">${esc(c.url)}</a></dd>
          <dt>Plateforme</dt><dd>${esc(s.plateforme || 'non reconnue')}</dd>
          <dt>Ajouté le</dt><dd>${esc(c.added)}</dd>
        </dl><p class="small muted">Ce son vient de toi : le site n’a vérifié ni le lien ni le titre.</p></div>
        <div class="panel" style="margin-top:14px" id="listenBox"><h3>Mon écoute</h3>${listenForm(l)}</div>
        <p style="margin-top:14px"><button class="btn danger sm" id="delSon">Supprimer ce son de ma base</button></p>
      </div></div>`;
  }
  function afterMonSon(id) {
    if (!db.custom[id]) return;
    afterSet(id);
    const form = document.getElementById('editForm'); bindPicker(form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = document.getElementById('editMsg'); const url = document.getElementById('e-url').value.trim();
      if (!/^https?:\/\//i.test(url)) { msg.textContent = 'Le lien doit commencer par http:// ou https://.'; return; }
      const c = cleanCustom({ url, titre: document.getElementById('e-titre').value, artistes: splitList(document.getElementById('e-art').value), type: document.getElementById('e-type').value, styles: readPicker(form, 'edit'), tags: splitList(document.getElementById('e-tags').value), added: db.custom[id].added, updated: Date.now() }, id);
      if (!c) { msg.textContent = 'Titre et lien valides requis.'; return; }
      db.custom[id] = c; saveDb(db); render(true);
    });
    document.getElementById('delSon').addEventListener('click', () => {
      if (!confirm('Supprimer ce son et ton écoute associée ? Cette action est définitive.')) return;
      delete db.custom[id]; delete db.listens[id]; db.deleted['c:' + id] = Date.now(); db.deleted['l:' + id] = Date.now(); saveDb(db); location.hash = '#/mes-gouts';
    });
  }

  function viewMethode() {
    return `<div class="sectionHead"><div class="eyebrow">Méthode</div><h1 style="font-size:clamp(28px,5vw,44px)">Comment ce site est construit</h1></div>
      <div class="two"><div>
        <h2>Ce qu’on peut croire</h2>
        <p>Chaque événement, style ou set cite les pages réellement consultées. Ce qui est discuté ou mal sourcé est signalé, pas masqué.</p>
        <p><span class="badge haute">Confiance haute</span> fait étayé par plusieurs sources.<br><span class="badge moyenne">Confiance moyenne</span> source unique, ou avis éditorial.<br><span class="badge a_verifier">À vérifier</span> point incertain ou disputé.</p>
        <h2 style="margin-top:24px">Ce qu’on n’invente jamais</h2>
        <ul><li>Les tracklists, horodatages et BPM : absents tant qu’aucune source ne les donne.</li><li>Les liens : un set n’est listé que si le titre et l’auteur du lien ont été contrôlés auprès de la plateforme.</li><li>Les goûts : ce site ne te dit pas ce que tu aimes ; il enregistre ce que tu notes.</li></ul>
        <h2 style="margin-top:24px">Écouter légalement</h2>
        <p>Les sets pointent vers des chaînes officielles (festivals, labels, artistes, médias). Rien n’est téléchargé ni ré-hébergé.</p>
        ${(A.litiges || []).length ? `<h2 style="margin-top:24px">Points débattus entre sources</h2><p class="small muted">Là où les sources se contredisent, on le dit. Résolu = recoupé par des sources de référence ; sinon laissé ouvert.</p>
        ${A.litiges.map((l) => `<div class="panel" style="margin-bottom:10px"><p><b>${esc(l.sujet)}</b></p><p class="small muted">${esc(l.question || '')}</p><p class="small">${l.resolution_fr ? esc(l.resolution_fr) : '<i>Non tranché.</i>'}</p>${!l.resolution_fr && l.resolution_provisoire_fr ? `<p class="small"><b>Formulation prudente retenue :</b> ${esc(l.resolution_provisoire_fr)}</p>` : ''}${l.etat_des_sources ? `<details><summary>Position de chaque source</summary><p class="small">${esc(l.etat_des_sources)}</p></details>` : ''}<div class="tags">${confBadge(l.confiance)}</div>${sourcesBlock(l.sources)}</div>`).join('')}` : ''}
      </div><div class="panel"><h3>État des données</h3>
        <p class="small muted">Généré le ${esc(A.generated || 'inconnu')}.</p>
        <p class="small">${A.timeline.length} repères · ${A.styles.length} styles · ${A.sets.length} sets (dont ${pickVerified(A.sets).length} au lien contrôlé).</p>
        <p class="small muted">Cette maquette est une première version : textes et sélection à relire avant tout partage.</p></div></div>`;
  }

  function viewMentions() {
    return `<div class="sectionHead"><div class="eyebrow">Mentions</div><h1 style="font-size:clamp(28px,5vw,44px)">Données personnelles et mentions</h1></div>
      <div class="two"><div>
        <h2>Qui est derrière ce site</h2>
        <p>Techno Atlas est un projet personnel, non commercial, sans publicité et sans suivi statistique. Il est partagé entre amis. Pour toute question ou demande, contacte la personne qui t’a invité.</p>
        <h2 style="margin-top:24px">Ce qui est stocké, et où</h2>
        <ul>
          <li><b>Sans compte :</b> ton journal (notes, sons ajoutés, progression) reste dans la mémoire de ton navigateur, sur ton appareil. Rien n’est envoyé.</li>
          <li><b>Avec un compte :</b> ton adresse e-mail, ton mot de passe (conservé sous forme chiffrée par le service) et ton journal sont stockés chez Supabase, dans une base située en Europe (région eu-west-1). Seul ton compte peut lire et modifier ton journal ; personne d’autre n’y a accès depuis le site.</li>
          <li><b>Cookies :</b> aucun cookie publicitaire ou de mesure d’audience. Le navigateur garde ton journal et ta session de connexion dans son stockage local.</li>
        </ul>
        <h2 style="margin-top:24px">Services tiers</h2>
        <ul>
          <li>Les lecteurs YouTube (version « sans cookies »), Mixcloud et SoundCloud ne se chargent que si tu cliques sur « Charger le lecteur ». Ces services appliquent leurs propres règles.</li>
          <li>Pour les comptes, le site charge la bibliothèque Supabase depuis le réseau de diffusion jsDelivr.</li>
        </ul>
        <h2 style="margin-top:24px">Tes droits</h2>
        <ul>
          <li><b>Voir et sauvegarder tes données :</b> « Exporter » dans Mes goûts.</li>
          <li><b>Tout effacer :</b> « Supprimer mon compte » (dans Mes goûts, une fois connecté) supprime ton compte et ton journal en ligne. « Effacer le journal de ce navigateur » vide la copie locale.</li>
          <li>Mot de passe oublié : il n’y a pas de réinitialisation automatique ; demande de l’aide à la personne qui t’a invité.</li>
        </ul>
        <h2 style="margin-top:24px">Contenu et droits</h2>
        <p>Le site ne contient aucun son : il renvoie vers les plateformes officielles (festivals, labels, artistes, médias) où les sets sont publiés. Les textes sont une synthèse d’origine personnelle, sourcée ; les marques et noms d’artistes appartiennent à leurs propriétaires. Signale-nous tout lien mort ou toute erreur.</p>
      </div><div class="panel"><h3>En deux phrases</h3><p class="small">Tes notes t’appartiennent. Sans compte elles restent chez toi ; avec un compte elles sont chez Supabase, lisibles par toi seul, et tu peux tout supprimer quand tu veux.</p></div></div>`;
  }

  function notFound() { return '<h1>Page introuvable</h1><p><a href="#/">Retour à l’accueil</a></p>'; }

  /* ---------- routeur ---------- */
  function render(keepScroll) {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/'); const name = parts[0] || ''; let arg = '';
    try { arg = decodeURIComponent(parts.slice(1).join('/')); } catch (e) { arg = ''; }
    const y = window.scrollY;
    let html, after = () => {}, nav = name;
    switch (name) {
      case '': html = viewHome(); after = afterHome; break;
      case 'repertoire': html = viewRepertoire(arg); after = afterRepertoire; break;
      case 'artiste': html = viewArtiste(arg); nav = 'repertoire'; break;
      case 'label': html = viewLabel(arg); nav = 'repertoire'; break;
      case 'lieu': html = viewLieu(arg); nav = 'repertoire'; break;
      case 'tempos': html = viewTempos(); break;
      case 'guides': html = viewGuides(); break;
      case 'guide': html = viewGuide(arg); nav = 'guides'; break;
      case 'parcours': if (arg) { html = viewParcours(arg); after = () => afterParcours(arg); } else html = viewParcoursList(); break;
      case 'histoire': html = viewHistoire(arg); after = afterHistoire; break;
      case 'styles': html = viewStyles(); after = afterStyles; break;
      case 'style': html = viewStyle(arg); nav = 'styles'; break;
      case 'sets': html = viewSets(); after = afterSets; break;
      case 'set': html = viewSet(arg); after = () => afterSet(arg); nav = 'sets'; break;
      case 'glossaire': html = viewGlossaire(); after = afterGlossaire; break;
      case 'mes-gouts': html = viewGouts(); after = afterGouts; break;
      case 'depart': html = viewDepart(); after = afterDepart; nav = 'pour-toi'; break;
      case 'pour-toi': html = viewPourToi(); after = afterPourToi; break;
      case 'duel': html = viewDuel(); after = afterDuel; nav = 'mes-gouts'; break;
      case 'mon-son': html = viewMonSon(arg); after = () => afterMonSon(arg); nav = 'mes-gouts'; break;
      case 'methode': html = viewMethode(); break;
      case 'mentions': html = viewMentions(); nav = ''; break;
      default: html = notFound();
    }
    main.innerHTML = html;
    after();
    document.querySelectorAll('#nav a').forEach((a) => { if (a.dataset.r === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (keepScroll === true) window.scrollTo(0, y); else if (name !== 'histoire' || !arg) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
    document.title = 'Techno Atlas — ' + (nav || name || 'accueil');
  }
  window.addEventListener('hashchange', () => render(false));
  render(false);
  initSync();
  initGlossTips();
  // accès pour les tests manuels, uniquement en local
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__atlas = { mergeDb, normalizeDb, getDb: () => db };
})();
