import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { normalizeProduct, seedProducts, slug } from './products.js';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => { throw new HttpError(400, msg); };
const notFound = () => { throw new HttpError(404, 'Tidak ditemukan'); };

const MIME = { '.md': 'text/markdown; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

const ENG_FIELDS = ['title', 'requester', 'sponsor', 'domain_owner', 'delivery_team', 'problem', 'decision_needed', 'strategy_level', 'mode', 'risk', 'slice_business', 'slice_data', 'slice_application', 'slice_technology', 'target_date', 'status', 'product'];
const ADR_FIELDS = ['title', 'status', 'context', 'alternatives', 'decision', 'consequences', 'decided_by', 'engagement_id'];
const ART_FIELDS = ['name', 'type', 'owner', 'consumer', 'purpose', 'location', 'status', 'engagement_id', 'step_ref'];
const FND_FIELDS = ['title', 'kind', 'description', 'status', 'source_engagement_id', 'product'];
const ADR_STATUSES = ['Proposed', 'Accepted', 'Rejected', 'Superseded'];

const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const pick = (obj, fields) => Object.fromEntries(fields.filter((f) => f in obj).map((f) => [f, obj[f] === '' ? null : obj[f]]));

export function createApp(config) {
  const { db, publicDir } = config;
  let playbook = config.playbook;
  const modeOf = (id) => playbook.modes.find((m) => m.id === Number(id));
  const stageOf = (id) => playbook.stages.find((s) => s.id === id);
  seedProducts(db, playbook, publicDir);
  const productOf = (id) => {
    const row = id && db.prepare('SELECT id, data, updated_at FROM products WHERE id = ?').get(id);
    return row ? { ...JSON.parse(row.data), id: row.id, updated_at: row.updated_at } : null;
  };
  const allProducts = () => db.prepare('SELECT id FROM products ORDER BY created_at, id').all().map((r) => productOf(r.id));
  const productUsage = (p) => ({
    ...p,
    engagements: db.prepare('SELECT id, code, title, status, stage FROM engagements WHERE product = ? ORDER BY id DESC').all(p.id),
    improvements: db.prepare('SELECT f.*, e.code ecode FROM foundation_items f LEFT JOIN engagements e ON e.id = f.source_engagement_id WHERE f.product = ? ORDER BY f.id DESC').all(p.id),
  });

  // Resep kerja: the product's steps for a stage, falling back to the generic Planting Seed steps.
  function recipe(e, artifacts = [], checks = []) {
    const product = productOf(e.product);
    return Object.fromEntries(modeOf(e.mode).stages.map((stage) => {
      const own = product?.steps.filter((st) => st.stage === stage);
      const steps = (own?.length ? own : playbook.default_steps[stage] || []).map((st) => {
        const ref = `${stage}.${st.id}`;
        const done = checks.find((k) => k.stage === stage && k.item_id === `step.${st.id}`);
        return { ...st, key: ref, source: own?.length ? 'product' : 'default', done_at: done?.done_at || null, registered: artifacts.find((a) => a.step_ref === ref) || null };
      });
      return [stage, steps];
    }));
  }

  const checklistFor = (stage, mode) =>
    (playbook.checklists[stage] || []).filter((c) => !c.modes || c.modes.includes(Number(mode)));

  const log = (engagementId, kind, text) =>
    db.prepare('INSERT INTO events (engagement_id, kind, text) VALUES (?, ?, ?)').run(engagementId, kind, text);

  const touch = (id) => db.prepare("UPDATE engagements SET updated_at = datetime('now') WHERE id = ?").run(id);

  function nextCode(table, prefix, yearly) {
    const like = yearly ? `${prefix}-${new Date().getFullYear()}-%` : `${prefix}-%`;
    const row = db.prepare(`SELECT code FROM ${table} WHERE code LIKE ? ORDER BY id DESC LIMIT 1`).get(like);
    const n = row ? Number(row.code.split('-').pop()) + 1 : 1;
    return like.replace('%', String(n).padStart(3, '0'));
  }

  function update(table, id, data) {
    const keys = Object.keys(data);
    if (!keys.length) return;
    const hasUpdatedAt = ['engagements', 'decisions', 'artifacts'].includes(table);
    const sets = keys.map((k) => `${k} = ?`).concat(hasUpdatedAt ? ["updated_at = datetime('now')"] : []);
    db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...keys.map((k) => data[k]), id);
  }

  function getEngagement(id) {
    const e = db.prepare('SELECT * FROM engagements WHERE id = ?').get(id);
    if (!e) notFound();
    return e;
  }

  // Progress of the current stage's exit criteria (optional items don't block the gate).
  function gateProgress(e) {
    const items = checklistFor(e.stage, e.mode);
    const done = new Set(db.prepare('SELECT item_id FROM checks WHERE engagement_id = ? AND stage = ?').all(e.id, e.stage).map((r) => r.item_id));
    const required = items.filter((i) => !i.optional);
    return { total: required.length, done: required.filter((i) => done.has(i.id)).length, ready: required.every((i) => done.has(i.id)) };
  }

  function withProgress(e) {
    return { ...e, progress: e.status === 'closed' ? null : gateProgress(e), flow: modeOf(e.mode)?.stages || [] };
  }

  function engagementDetail(id) {
    const e = getEngagement(id);
    const checks = db.prepare('SELECT stage, item_id, done_at FROM checks WHERE engagement_id = ?').all(id);
    const checklists = Object.fromEntries(modeOf(e.mode).stages.map((s) => [s, checklistFor(s, e.mode).map((c) => {
      const hit = checks.find((k) => k.stage === s && k.item_id === c.id);
      return { ...c, done_at: hit?.done_at || null };
    })]));
    const artifacts = db.prepare('SELECT * FROM artifacts WHERE engagement_id = ? ORDER BY id DESC').all(id);
    return {
      ...withProgress(e),
      checklists,
      recipe: recipe(e, artifacts, checks),
      artifacts,
      gates: db.prepare('SELECT * FROM gates WHERE engagement_id = ? ORDER BY id').all(id),
      decisions: db.prepare('SELECT * FROM decisions WHERE engagement_id = ? ORDER BY id DESC').all(id),
      foundation: db.prepare('SELECT * FROM foundation_items WHERE source_engagement_id = ? ORDER BY id DESC').all(id),
      events: db.prepare('SELECT * FROM events WHERE engagement_id = ? ORDER BY id DESC').all(id),
    };
  }

  function validateEngagement(data, creating) {
    for (const f of ['title', 'sponsor', 'decision_needed']) {
      if ((creating || f in data) && blank(data[f])) bad({ title: 'Judul', sponsor: 'Sponsor', decision_needed: 'Keputusan yang harus diambil' }[f] + ' wajib diisi (Decision First / Riding Sponsor Strategy).');
    }
    if ((creating || 'mode' in data) && !modeOf(data.mode)) bad('Mode Keterlibatan EA (1–4) wajib dipilih.');
    if (!blank(data.product) && !productOf(data.product)) bad('Produk EA tidak dikenal.');
    if ('status' in data && !['active', 'on_hold', 'cancelled'].includes(data.status)) bad('Status tidak valid. Engagement hanya bisa ditutup lewat gerbang /harvest.');
  }

  function validateArtifact(data, creating) {
    for (const [f, label] of [['name', 'Nama'], ['type', 'Jenis'], ['owner', 'Owner pemeliharaan'], ['consumer', 'Consumer'], ['purpose', 'Tujuan penggunaan']]) {
      if ((creating || f in data) && blank(data[f])) bad(`${label} wajib diisi — No Orphan Architecture.`);
    }
  }

  function dashboard() {
    const active = db.prepare("SELECT * FROM engagements WHERE status IN ('active','on_hold') ORDER BY updated_at DESC").all().map(withProgress);
    const attention = [];
    for (const e of active) {
      if (e.status === 'on_hold') continue;
      if (e.progress.ready) attention.push({ kind: 'gate', engagement_id: e.id, code: e.code, text: `Siap lewat gerbang ${stageOf(e.stage).label} — minta persetujuan ${stageOf(e.stage).approver}`, title: e.title });
      if (e.target_date && e.target_date < today()) attention.push({ kind: 'late', engagement_id: e.id, code: e.code, text: `Melewati target ${e.target_date}`, title: e.title });
      const last = db.prepare('SELECT MAX(at) at FROM events WHERE engagement_id = ?').get(e.id).at || e.updated_at;
      if (daysSince(last) >= 14) attention.push({ kind: 'stale', engagement_id: e.id, code: e.code, text: `Tidak ada aktivitas ${daysSince(last)} hari`, title: e.title });
    }
    for (const d of db.prepare("SELECT d.*, e.code ecode FROM decisions d LEFT JOIN engagements e ON e.id = d.engagement_id WHERE d.status = 'Proposed'").all()) {
      if (daysSince(d.created_at) >= 7) attention.push({ kind: 'adr', decision_id: d.id, engagement_id: d.engagement_id, code: d.code, text: `ADR menunggu keputusan ${daysSince(d.created_at)} hari`, title: d.title });
    }

    const load = active.filter((e) => e.status === 'active').reduce((acc, e) => {
      acc[e.mode] = (acc[e.mode] || 0) + modeOf(e.mode).load;
      return acc;
    }, {});

    const since = "datetime('now', '-90 days')";
    const count = (sql) => db.prepare(sql).get().n;
    const impact = {
      adr_accepted: count(`SELECT COUNT(*) n FROM decisions WHERE status = 'Accepted' AND decided_at >= ${since}`),
      harvested: count(`SELECT COUNT(*) n FROM engagements WHERE status = 'closed' AND closed_at >= ${since}`),
      gates: count(`SELECT COUNT(*) n FROM gates WHERE passed_at >= ${since}`),
      artifacts: count(`SELECT COUNT(*) n FROM artifacts WHERE created_at >= ${since}`),
      foundation_done: count(`SELECT COUNT(*) n FROM foundation_items WHERE status = 'Selesai' AND done_at >= ${since}`),
    };

    const recent = db.prepare('SELECT ev.*, e.code, e.title FROM events ev LEFT JOIN engagements e ON e.id = ev.engagement_id ORDER BY ev.id DESC LIMIT 12').all();
    return { active, attention, load, capacity_limit: playbook.capacity_limit, impact, recent };
  }

  function advance(id, body) {
    const e = getEngagement(id);
    if (e.status !== 'active') bad('Hanya engagement aktif yang bisa melewati gerbang.');
    if (blank(body.approved_by)) bad('Nama penyetuju gerbang wajib diisi.');
    const p = gateProgress(e);
    if (!p.ready) bad(`Kriteria keluar ${stageOf(e.stage).label} belum lengkap (${p.done}/${p.total}).`);
    const flow = modeOf(e.mode).stages;

    if (e.stage === 'harvest') {
      const orphans = db.prepare("SELECT COUNT(*) n FROM artifacts WHERE engagement_id = ? AND status = 'Draft'").get(id).n;
      if (orphans) bad(`Masih ada ${orphans} artefak berstatus Draft. Sahkan, harvest, atau tandai usang sebelum menutup engagement.`);
    }

    db.prepare('INSERT INTO gates (engagement_id, stage, approved_by, note) VALUES (?, ?, ?, ?)').run(id, e.stage, body.approved_by.trim(), body.note || null);
    const next = flow[flow.indexOf(e.stage) + 1];
    if (next) {
      update('engagements', id, { stage: next });
      log(id, 'gate', `Lulus gerbang ${stageOf(e.stage).label} (disetujui ${body.approved_by.trim()}) → masuk ${stageOf(next).label}`);
    } else {
      db.prepare("UPDATE engagements SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
      db.prepare("UPDATE artifacts SET status = 'Di-harvest', updated_at = datetime('now') WHERE engagement_id = ? AND status = 'Disahkan'").run(id);
      log(id, 'gate', `Lulus gerbang /harvest (disetujui ${body.approved_by.trim()}) — engagement ditutup, artefak disahkan masuk seedbank`);
    }
    for (const lesson of (body.lessons || []).filter((l) => !blank(l?.title))) {
      const product = lesson.product === undefined ? e.product : lesson.product || null;
      db.prepare('INSERT INTO foundation_items (title, kind, description, source_engagement_id, product) VALUES (?, ?, ?, ?, ?)').run(lesson.title.trim(), lesson.kind || 'Proses Kerja EA', lesson.description || null, id, product);
      log(id, 'foundation', `Lessons learned → backlog /foundation: ${lesson.title.trim()}`);
    }
    return engagementDetail(id);
  }

  const routes = [
    ['GET', '/api/playbook', () => ({ ...playbook, seed_products: undefined, products: allProducts() })],
    ['GET', '/api/dashboard', () => dashboard()],
    ['GET', '/api/products', () => allProducts().map(productUsage)],
    ['GET', '/api/products/:pslug', ({ pslug }) => productUsage(productOf(pslug) || notFound())],
    ['POST', '/api/products', (_, body) => {
      const p = normalizeProduct(body, playbook, bad);
      let id = slug(body.id || p.name);
      while (productOf(id)) id += '-2';
      db.prepare('INSERT INTO products (id, data) VALUES (?, ?)').run(id, JSON.stringify(p));
      log(null, 'product', `Produk EA baru: ${p.name} (v${p.version} ${p.maturity})`);
      return productUsage(productOf(id));
    }],
    ['PUT', '/api/products/:pslug', ({ pslug }, body) => {
      const old = productOf(pslug) || notFound();
      const p = normalizeProduct(body, playbook, bad);
      db.prepare("UPDATE products SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(p), pslug);
      const changed = old.version !== p.version || old.maturity !== p.maturity;
      log(null, 'product', `Resep ${p.name} diperbarui${changed ? ` → v${p.version} ${p.maturity}` : ''}`);
      return productUsage(productOf(pslug));
    }],
    ['GET', '/api/products/:pslug/templates/:tslug', ({ pslug, tslug }) => {
      const t = (productOf(pslug) || notFound()).templates.find((x) => x.id === tslug) || notFound();
      return { raw: t.body, type: MIME['.md'] };
    }],

    ['GET', '/api/engagements', () => db.prepare('SELECT * FROM engagements ORDER BY id DESC').all().map(withProgress)],
    ['POST', '/api/engagements', (_, body) => {
      const data = pick(body, ENG_FIELDS);
      validateEngagement(data, true);
      delete data.status;
      data.code = nextCode('engagements', 'ENG', true);
      const keys = Object.keys(data);
      const { lastInsertRowid: id } = db.prepare(`INSERT INTO engagements (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
      log(id, 'created', `Engagement dibuka — Mode ${data.mode} ${modeOf(data.mode).name}`);
      return engagementDetail(id);
    }],
    ['GET', '/api/engagements/:id', ({ id }) => engagementDetail(id)],
    ['PATCH', '/api/engagements/:id', ({ id }, body) => {
      const e = getEngagement(id);
      if (e.status === 'closed') bad('Engagement sudah ditutup.');
      const data = pick(body, ENG_FIELDS);
      validateEngagement(data, false);
      if ('mode' in data && Number(data.mode) !== e.mode) {
        if (e.stage !== 'seed') bad('Mode hanya bisa diubah selama /seed. Untuk perubahan besar, catat ADR dan buka engagement baru.');
        log(id, 'mode', `Mode diubah: ${modeOf(e.mode).name} → ${modeOf(data.mode).name}`);
      }
      if ('status' in data && data.status !== e.status) log(id, 'status', { active: 'Dilanjutkan', on_hold: 'Ditunda (on hold)', cancelled: 'Dibatalkan' }[data.status]);
      update('engagements', id, data);
      return engagementDetail(id);
    }],
    ['POST', '/api/engagements/:id/checks', ({ id }, body) => {
      const e = getEngagement(id);
      const isStep = String(body.item_id).startsWith('step.') && (recipe(e)[body.stage] || []).some((st) => `step.${st.id}` === body.item_id);
      if (!isStep && !checklistFor(body.stage, e.mode).some((c) => c.id === body.item_id)) bad('Item checklist tidak dikenal.');
      if (body.stage !== e.stage) bad('Hanya checklist tahap aktif yang bisa diubah.');
      if (body.done) db.prepare('INSERT OR IGNORE INTO checks (engagement_id, stage, item_id) VALUES (?, ?, ?)').run(id, body.stage, body.item_id);
      else db.prepare('DELETE FROM checks WHERE engagement_id = ? AND stage = ? AND item_id = ?').run(id, body.stage, body.item_id);
      touch(id);
      return engagementDetail(id);
    }],
    ['POST', '/api/engagements/:id/advance', ({ id }, body) => advance(id, body)],
    ['POST', '/api/engagements/:id/notes', ({ id }, body) => {
      getEngagement(id);
      if (blank(body.text)) bad('Catatan kosong.');
      log(id, 'note', body.text.trim());
      touch(id);
      return engagementDetail(id);
    }],

    ['GET', '/api/decisions', () => db.prepare('SELECT d.*, e.code ecode, e.title etitle FROM decisions d LEFT JOIN engagements e ON e.id = d.engagement_id ORDER BY d.id DESC').all()],
    ['POST', '/api/decisions', (_, body) => {
      const data = pick(body, ADR_FIELDS);
      if (blank(data.title)) bad('Judul ADR wajib diisi.');
      if (blank(data.context)) bad('Context (masalah & batasan) wajib diisi.');
      data.status = 'Proposed';
      data.code = nextCode('decisions', 'ADR', false);
      const keys = Object.keys(data);
      const { lastInsertRowid: id } = db.prepare(`INSERT INTO decisions (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
      if (data.engagement_id) { log(data.engagement_id, 'adr', `${data.code} diusulkan: ${data.title}`); touch(data.engagement_id); }
      return db.prepare('SELECT * FROM decisions WHERE id = ?').get(id);
    }],
    ['PATCH', '/api/decisions/:id', ({ id }, body) => {
      const d = db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) || notFound();
      const data = pick(body, ADR_FIELDS);
      if ('status' in data && !ADR_STATUSES.includes(data.status)) bad('Status ADR tidak valid.');
      if (data.status && data.status !== d.status && data.status !== 'Proposed') {
        const by = data.decided_by ?? d.decided_by;
        if (blank(by)) bad('Isi "Diputuskan oleh" sebelum mengubah status ADR.');
        if (data.status === 'Accepted' && blank(data.decision ?? d.decision)) bad('Isi bagian Decision sebelum ADR disahkan.');
        data.decided_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        if (d.engagement_id) log(d.engagement_id, 'adr', `${d.code} ${data.status} oleh ${by}`);
      }
      update('decisions', id, data);
      if (d.engagement_id) touch(d.engagement_id);
      return db.prepare('SELECT * FROM decisions WHERE id = ?').get(id);
    }],

    ['GET', '/api/artifacts', () => db.prepare('SELECT a.*, e.code ecode, e.title etitle FROM artifacts a LEFT JOIN engagements e ON e.id = a.engagement_id ORDER BY a.id DESC').all()],
    ['POST', '/api/artifacts', (_, body) => {
      const data = pick(body, ART_FIELDS);
      validateArtifact(data, true);
      const keys = Object.keys(data);
      const { lastInsertRowid: id } = db.prepare(`INSERT INTO artifacts (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
      if (data.engagement_id) { log(data.engagement_id, 'artifact', `Artefak didaftarkan: ${data.name} (owner ${data.owner})`); touch(data.engagement_id); }
      return db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id);
    }],
    ['PATCH', '/api/artifacts/:id', ({ id }, body) => {
      const a = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) || notFound();
      const data = pick(body, ART_FIELDS);
      validateArtifact(data, false);
      update('artifacts', id, data);
      if (a.engagement_id && data.status && data.status !== a.status) log(a.engagement_id, 'artifact', `Artefak ${a.name}: ${a.status} → ${data.status}`);
      return db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id);
    }],

    ['GET', '/api/foundation', () => db.prepare('SELECT f.*, e.code ecode FROM foundation_items f LEFT JOIN engagements e ON e.id = f.source_engagement_id ORDER BY f.id DESC').all()],
    ['POST', '/api/foundation', (_, body) => {
      const data = pick(body, FND_FIELDS);
      if (blank(data.title) || blank(data.kind)) bad('Judul dan jenis wajib diisi.');
      data.status = 'Backlog';
      const keys = Object.keys(data);
      const { lastInsertRowid: id } = db.prepare(`INSERT INTO foundation_items (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
      log(null, 'foundation', `Backlog /foundation: ${data.title}`);
      return db.prepare('SELECT * FROM foundation_items WHERE id = ?').get(id);
    }],
    ['PATCH', '/api/foundation/:id', ({ id }, body) => {
      const f = db.prepare('SELECT * FROM foundation_items WHERE id = ?').get(id) || notFound();
      const data = pick(body, FND_FIELDS);
      if (data.status === 'Selesai' && f.status !== 'Selesai') { data.done_at = new Date().toISOString().replace('T', ' ').slice(0, 19); log(null, 'foundation', `/foundation diperbarui: ${f.title}`); }
      if (data.status && data.status !== 'Selesai') data.done_at = null;
      update('foundation_items', id, data);
      return db.prepare('SELECT * FROM foundation_items WHERE id = ?').get(id);
    }],

    ['GET', '/api/export', () => Object.fromEntries(['engagements', 'checks', 'gates', 'decisions', 'artifacts', 'foundation_items', 'events'].map((t) => [t, db.prepare(`SELECT * FROM ${t}`).all()]))],
  ].map(([method, path, fn]) => ({ method, fn, keys: [...path.matchAll(/:(\w+)/g)].map((m) => m[1]), re: new RegExp('^' + path.replace(/:\w*slug/g, '([\\w-]+)').replace(/:\w+/g, '(\\d+)') + '$') }));

  function serveStatic(res, urlPath) {
    const rel = normalize(decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath)).replace(/^(\.\.[/\\])+/, '');
    const file = join(publicDir, rel);
    if (!file.startsWith(publicDir) || !existsSync(file)) return send(res, 404, { error: 'Tidak ditemukan' });
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(readFileSync(file));
  }

  return async function handle(req, res) {
    playbook = config.playbook;
    const url = new URL(req.url, 'http://local');
    if (!url.pathname.startsWith('/api/')) return serveStatic(res, url.pathname);
    const route = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
    if (!route) return send(res, 404, { error: 'Endpoint tidak ditemukan' });
    try {
      const params = Object.fromEntries(route.keys.map((k, i) => { const v = url.pathname.match(route.re)[i + 1]; return [k, k.endsWith('slug') ? v : Number(v)]; }));
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readJson(req) : {};
      db.exec('BEGIN');
      let out;
      try { out = route.fn(params, body); db.exec('COMMIT'); } catch (err) { db.exec('ROLLBACK'); throw err; }
      if (out?.raw !== undefined) { res.writeHead(200, { 'Content-Type': out.type }); return res.end(out.raw); }
      send(res, 200, out);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error(err);
      send(res, 500, { error: 'Kesalahan server' });
    }
  };
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1e6) throw new HttpError(413, 'Payload terlalu besar');
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'JSON tidak valid'); }
}

const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (sqlDate) => Math.floor((Date.now() - Date.parse(sqlDate.replace(' ', 'T') + (sqlDate.includes('Z') ? '' : 'Z'))) / 864e5);
