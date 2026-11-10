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
      if (raw) { const d = JSON.parse(raw); if (d && d.version === 1 && d.listens && typeof d.listens === 'object') { if (!d.progress || typeof d.progress !== 'object') d.progress = {}; if (!d.custom || typeof d.custom !== 'object') d.custom = {}; if (!d.deleted || typeof d.deleted !== 'object') d.deleted = {}; if (!d.progressUpdated || typeof d.progressUpdated !== 'object') d.progressUpdated = {}; return d; } }
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
    if (raw.deleted && typeof raw.deleted === 'object') Object.entries(raw.deleted).forEach(([k, ts]) => { if (/^[lc]:[\w-]{1,40}$/.test(k) && Number.isFinite(Number(ts))) out.deleted[k] = Number(ts); });
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
    out.duels = a.duels || [];
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
          ${signup ? '<p class="full small muted">Choisis un mot de passe que tu n’utilises nulle part ailleurs. Il ne peut pas être réinitialisé automatiquement : si tu l’oublies, tu devras demander de l’aide à Nicolas.</p>' : ''}
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
          if (!data.session) { msg('Compte créé, mais une confirmation par e-mail est exigée par le service : demande de l’aide à Nicolas.'); return; }
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

  /* ---------- vues ---------- */
  function viewHome() {
    const picks = pickVerified(A.sets).filter((s) => s.niveau === 'entree').slice(0, 4);
    const nVer = pickVerified(A.sets).length;
    return `<section class="hero">
      <div class="eyebrow">Guide pour débuter</div>
      <h1>Comprendre la techno,<br><span>de ses origines à aujourd’hui.</span></h1>
      <p class="lead">D’où vient ce son, qui a influencé qui, et par quels sets commencer pour savoir ce que tu aimes vraiment. Un guide pensé pour celles et ceux qui n’y connaissent rien — et qui veulent y entrer sans se perdre.</p>
      <div class="row"><a class="btn primary" href="#/histoire">Commencer par l’histoire</a><a class="btn" href="#/sets">Aller directement aux sets</a></div>
      <div class="stats"><div><b>${A.timeline.length}</b><span class="muted small">repères historiques</span></div><div><b>${A.styles.length}</b><span class="muted small">styles</span></div><div><b>${nVer}</b><span class="muted small">sets vérifiés</span></div></div>
    </section>
    <div class="sectionHead"><div class="eyebrow">Par où commencer</div><h2>Trois étapes</h2></div>
    <div class="steps">
      <div class="panel step"><span class="n">1</span><h3>Comprendre</h3><p class="small muted">La frise des origines (Détroit, Chicago, Berlin, les raves…) puis la carte des styles : qui descend de qui.</p><a class="btn sm" href="#/histoire">Ouvrir la frise</a> <a class="btn sm" href="#/styles">Voir les styles</a></div>
      <div class="panel step"><span class="n">2</span><h3>Écouter</h3><p class="small muted">Des sets emblématiques, classés « porte d’entrée » ou « pour aller plus loin », avec des repères pour savoir quoi écouter.</p><a class="btn sm" href="#/sets">Ouvrir la bibliothèque</a></div>
      <div class="panel step"><span class="n">3</span><h3>Se situer</h3><p class="small muted">Note ce que tu écoutes sur trois axes (plaisir, soirée, immersion) et vois apparaître tes affinités, sans surinterprétation.</p><a class="btn sm" href="#/mes-gouts">Mon journal</a></div>
    </div>
    ${PATHS.length ? `<div class="sectionHead"><div class="eyebrow">Parcours guidés</div><h2>Pas envie de chercher ? Suis un chemin</h2></div><div class="grid">${PATHS.map(parcoursCard).join('')}</div>` : ''}
    ${picks.length ? `<div class="sectionHead"><div class="eyebrow">Pour un premier contact</div><h2>Sets « porte d’entrée »</h2></div><div class="grid">${picks.map(setCard).join('')}</div>` : ''}`;
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
        ${st.texte ? `<p>${esc(st.texte)}</p>` : ''}${stepBody(st)}
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
        <p>${esc(e.resume)}</p>
        ${e.compte ? `<p class="compte">Pourquoi c’est important : ${esc(e.compte)}</p>` : ''}
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
          <p style="margin-top:10px">${esc(sel.def)}</p>
          ${(sel.carac || []).length ? `<p class="small"><b>Ce qu’on y entend :</b></p><ul class="small">${sel.carac.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
          ${sel.bpm ? `<p class="small"><b>BPM typique :</b> ${esc(sel.bpm)}</p>` : ''}
          <p class="small"><b>Influences :</b> ${[...parents].map(styleChip).join(' ') || '<span class="muted">aucune renseignée</span>'}</p>
          <p class="small"><b>Dérivés :</b> ${[...children].map(styleChip).join(' ') || '<span class="muted">aucun renseigné</span>'}</p>
          ${(sel.artistes || []).length ? `<p class="small"><b>Artistes clés :</b> ${sel.artistes.map(esc).join(', ')}</p>` : ''}
          ${starter ? `<p class="small"><b>Pour commencer :</b> <a href="#/set/${encodeURIComponent(starter.id)}">${esc(setName(starter))}</a></p>` : ''}
          <a class="btn sm primary" href="#/style/${encodeURIComponent(sel.id)}">Ouvrir la fiche complète</a></aside>`
      : `<aside class="panel gdetail"><span class="kind">Style</span><h3 style="margin-top:6px">Choisis un style</h3><p class="small muted">Touche un style dans l’arbre : sa définition, ses influences et ses dérivés s’affichent ici.</p></aside>`;
    return `<div class="sectionHead"><div class="eyebrow">Styles</div><h1 style="font-size:clamp(28px,5vw,44px)">Qui descend de qui</h1>
      <p>Les styles sont rangés par période d’apparition. Touche un style pour lire sa définition et voir ses influences et ses dérivés.</p></div>
      <div class="legend"><span><i style="background:var(--lime)"></i>Style choisi</span><span><i style="background:var(--cyan)"></i>Ses influences</span><span><i style="background:var(--pink)"></i>Ses dérivés</span></div>
      <div class="genwrap"><div class="gen">${Object.keys(cols).map((k) => `<div class="gcol"><h3>${esc(k)}</h3>${cols[k].map((s) => {
        const cls = !sel ? '' : s.id === sel.id ? 'sel' : parents.has(s.id) ? 'parent' : children.has(s.id) ? 'child' : 'dim';
        return `<button class="gnode ${cls}" data-st="${esc(s.id)}" aria-pressed="${sel && s.id === sel.id ? 'true' : 'false'}">${esc(s.nom)}<small>${esc(s.lieu || '')}</small></button>`;
      }).join('')}</div>`).join('')}</div>${detail}</div>`;
  }
  function afterStyles() {
    const open = (id) => {
      selStyle = id; render(true);
      if (id && window.matchMedia('(max-width:900px)').matches) { const d = document.getElementById('sdetail'); if (d) d.scrollIntoView({ block: 'start', behavior: 'instant' }); }
    };
    main.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => open(selStyle === b.dataset.st ? null : b.dataset.st)));
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
        <div class="panel"><p class="lead" style="margin:0">${esc(s.def)}</p></div>
        ${(s.carac || []).length ? `<div class="sectionHead"><h2>Ce qu’on y entend</h2></div><ul>${s.carac.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${s.bpm ? `<p class="small"><b>BPM typique :</b> ${esc(s.bpm)} <span class="muted">(selon les sources citées ; un repère, pas une règle)</span></p>` : '<p class="small muted">BPM non renseigné (aucune source fiable retenue).</p>'}
        ${s.notes ? `<p class="small muted"><b>Points discutés :</b> ${esc(s.notes)}</p>` : ''}
        ${evs.length ? `<div class="sectionHead"><h2>Dans l’histoire</h2></div><ul>${evs.map((e) => `<li><a href="#/histoire/${encodeURIComponent(e.id)}">${esc(e.annee)} — ${esc(e.titre)}</a></li>`).join('')}</ul>` : ''}
        ${sourcesBlock(s.sources)}
      </div><div>
        ${starter ? `<div class="panel" style="margin-bottom:14px"><h3>Pour commencer</h3><p class="small muted">Un set accessible pour entendre ce style.</p><a class="btn sm primary" href="#/set/${encodeURIComponent(starter.id)}">${esc(setName(starter))}</a></div>` : ''}
        ${inPaths.length ? `<div class="panel" style="margin-bottom:14px"><h3>Dans les parcours</h3><p class="small">${inPaths.map((p) => `<a href="#/parcours/${encodeURIComponent(p.id)}">${esc(p.titre)}</a>`).join('<br>')}</p></div>` : ''}
        <div class="panel"><h3>Dans l’arbre</h3>
          <p class="small"><b>Influences :</b><br>${[...par].map(styleChip).join(' ') || '<span class="muted">non renseigné</span>'}</p>
          <p class="small"><b>Dérivés :</b><br>${[...chi].map(styleChip).join(' ') || '<span class="muted">non renseigné</span>'}</p>
          ${(s.artistes || []).length ? `<p class="small"><b>Artistes clés :</b> ${s.artistes.map(esc).join(', ')}</p>` : ''}
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
        <div class="sectionHead"><h2>Pourquoi il est emblématique</h2></div><p>${esc(s.pourquoi)}</p>
        ${s.contexte ? `<p class="muted">${esc(s.contexte)}</p>` : ''}
        ${(s.ecouter || []).length ? `<div class="sectionHead"><h2>Quoi écouter</h2></div><ul>${s.ecouter.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
        ${s.notes ? `<p class="small muted">Note de vérification : ${esc(s.notes)}</p>` : ''}
        ${sourcesBlock(s.sources)}
      </div><div>
        <div class="panel"><h3>Fiche</h3><dl class="dl" style="margin-top:10px">
          <dt>Artiste(s)</dt><dd>${esc(s.artistes.join(', '))}</dd>
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
        const add = []; let same = 0, conflict = 0, unknown = 0;
        Object.entries(d.listens).forEach(([id, x]) => {
          if (!setById[id] && !db.custom[id] && !incoming.has(id)) { unknown++; return; }
          const c = cleanListen(x); if (!c) { unknown++; return; }
          if (!db.listens[id]) add.push([id, c]);
          else if (JSON.stringify(db.listens[id]) === JSON.stringify(c)) same++; else conflict++;
        });
        const nTotal = add.length + addC.length;
        out.innerHTML = `<div class="panel" style="margin-top:10px"><p><b>Aperçu de l’import</b></p><ul class="small"><li>${addC.length} nouveau(x) son(s) personnel(s) à ajouter (${customKnown} déjà présent(s))</li><li>${add.length} nouvelle(s) écoute(s) à ajouter</li><li>${same} identique(s)</li><li>${conflict} en conflit : ta version locale est conservée</li><li>${unknown} ignorée(s) (set inconnu ou données invalides)</li></ul>
          <button class="btn primary" id="okImp" ${nTotal ? '' : 'disabled'}>Ajouter ces ${nTotal} élément(s)</button></div>`;
        const ok = document.getElementById('okImp');
        if (ok) ok.addEventListener('click', () => {
          addC.forEach((c) => { db.custom[c.id] = c; });
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
      case '': html = viewHome(); break;
      case 'parcours': if (arg) { html = viewParcours(arg); after = () => afterParcours(arg); } else html = viewParcoursList(); break;
      case 'histoire': html = viewHistoire(arg); after = afterHistoire; break;
      case 'styles': html = viewStyles(); after = afterStyles; break;
      case 'style': html = viewStyle(arg); nav = 'styles'; break;
      case 'sets': html = viewSets(); after = afterSets; break;
      case 'set': html = viewSet(arg); after = () => afterSet(arg); nav = 'sets'; break;
      case 'glossaire': html = viewGlossaire(); after = afterGlossaire; break;
      case 'mes-gouts': html = viewGouts(); after = afterGouts; break;
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
  // accès pour les tests manuels, uniquement en local
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__atlas = { mergeDb, normalizeDb, getDb: () => db };
})();
