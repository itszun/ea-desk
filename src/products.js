import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// EA products live in the DB as one JSON document each, so the product method
// can evolve freely in the UI. Planting Seed stays the governance frame:
// every method step is only *mapped* to the stage in which it is done.

export const MATURITIES = ['Draft', 'Teruji', 'Baku', 'Usang'];
const ALTITUDES = ['L0', 'L1', 'L0–L1', 'L2+'];

export const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'item';

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

export function normalizeProduct(input, { stages, modes }, fail) {
  const p = {};
  for (const f of ['name', 'sop_output', 'service', 'customer', 'decision', 'when', 'deliverable', 'version', 'maturity', 'ref']) p[f] = clean(input[f] ?? '') || '';
  if (!p.name) fail('Nama produk wajib diisi.');
  if (!p.decision) fail('Keputusan yang didukung wajib diisi (Decision First berlaku juga untuk produk).');
  if (!p.deliverable) fail('Deliverable wajib diisi: apa yang diserahkan ke pelanggan?');
  p.version ||= '0.1';
  if (!MATURITIES.includes(p.maturity)) p.maturity = 'Draft';
  p.default_mode = Number(input.default_mode) || 2;
  if (!modes.some((m) => m.id === p.default_mode)) fail('Mode default tidak valid.');

  const tplIds = new Set();
  p.templates = (input.templates || []).filter((t) => clean(t.name) || clean(t.body)).map((t) => {
    let id = clean(t.id) || slug(t.name);
    while (tplIds.has(id)) id += '-2';
    tplIds.add(id);
    if (!clean(t.name)) fail('Setiap template perlu nama.');
    return { id, name: clean(t.name), body: t.body || '' };
  });

  p.tools = (input.tools || []).filter((t) => clean(t.name)).map((t) => ({ name: clean(t.name), ref: clean(t.ref) || '', template: clean(t.template) || '' }));

  const stepIds = new Set();
  p.steps = (input.steps || []).filter((s) => clean(s.title) || clean(s.how)).map((s) => {
    if (!clean(s.title)) fail('Setiap langkah metode perlu judul.');
    if (!stages.some((st) => st.id === s.stage)) fail(`Langkah "${s.title}" belum dipetakan ke tahap Planting Seed.`);
    // Step ids are stable: engagements store progress and artifact links against them.
    let id = clean(s.id) || slug(s.title);
    while (stepIds.has(id)) id += '-2';
    stepIds.add(id);
    const step = { id, stage: s.stage, title: clean(s.title), altitude: ALTITUDES.includes(s.altitude) ? s.altitude : '', how: clean(s.how) || '', output: clean(s.output) || '', ref: clean(s.ref) || '' };
    if (s.artifact && clean(s.artifact.name)) step.artifact = { name: clean(s.artifact.name), type: clean(s.artifact.type) || 'Deliverable', template: clean(s.artifact.template) || '' };
    if (s.adr !== undefined && s.adr !== null && s.adr !== false) step.adr = clean(s.adr) || '';
    return step;
  });

  for (const ref of [...p.tools.map((t) => t.template), ...p.steps.map((s) => s.artifact?.template)].filter(Boolean)) {
    if (!tplIds.has(ref)) fail(`Template "${ref}" dirujuk tetapi tidak ada di produk ini.`);
  }
  return p;
}

// One-time seed from playbook.json (`seed_products`), converting stage-grouped
// recipes into a flat, ordered method and inlining template files.
export function seedProducts(db, playbook, publicDir) {
  if (db.prepare('SELECT COUNT(*) n FROM products').get().n) return;
  for (const raw of playbook.seed_products || []) {
    const steps = raw.steps || Object.entries(raw.stages || {}).flatMap(([stage, list]) => list.map((s) => ({ ...s, stage })));
    const templateIds = [...new Set([...(raw.tools || []).map((t) => t.template), ...steps.map((s) => s.artifact?.template)].filter(Boolean))];
    const templates = templateIds.map((id) => {
      const file = join(publicDir, 'templates', `${id}.md`);
      return { id, name: raw.tools?.find((t) => t.template === id)?.name || id, body: existsSync(file) ? readFileSync(file, 'utf8') : '' };
    });
    const p = normalizeProduct({ ...raw, steps, templates }, playbook, (m) => { throw new Error(`Seed ${raw.id}: ${m}`); });
    db.prepare('INSERT INTO products (id, data) VALUES (?, ?)').run(raw.id, JSON.stringify(p));
  }
}
