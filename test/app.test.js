import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

const playbook = JSON.parse(readFileSync(new URL('../playbook.json', import.meta.url)));
let server, base;

before(async () => {
  const app = createApp({ db: openDb(':memory:'), playbook, publicDir: new URL('../public', import.meta.url).pathname });
  server = createServer(app).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(method, path, body) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

const newEngagement = (over = {}) => call('POST', '/api/engagements', {
  title: 'Konsolidasi aplikasi procurement', sponsor: 'Dir. Keuangan', decision_needed: 'Pilih platform procurement tunggal', mode: 2, ...over,
});

async function completeStage(e) {
  for (const item of e.checklists[e.stage].filter((i) => !i.optional)) {
    ({ body: e } = await call('POST', `/api/engagements/${e.id}/checks`, { stage: e.stage, item_id: item.id, done: true }));
  }
  return e;
}

test('engagement requires a decision and a sponsor (Decision First)', async () => {
  assert.equal((await newEngagement({ decision_needed: '' })).status, 400);
  assert.equal((await newEngagement({ sponsor: ' ' })).status, 400);
  assert.equal((await newEngagement({ mode: 9 })).status, 400);
  const { status, body } = await newEngagement();
  assert.equal(status, 200);
  assert.match(body.code, /^ENG-\d{4}-\d{3}$/);
  assert.equal(body.stage, 'seed');
});

test('gate is blocked until exit criteria are met', async () => {
  let { body: e } = await newEngagement();
  assert.equal((await call('POST', `/api/engagements/${e.id}/advance`, { approved_by: 'Sponsor' })).status, 400);
  e = await completeStage(e);
  assert.equal(e.progress.ready, true);
  assert.equal((await call('POST', `/api/engagements/${e.id}/advance`, {})).status, 400, 'approver required');
  ({ body: e } = await call('POST', `/api/engagements/${e.id}/advance`, { approved_by: 'Dir. Keuangan' }));
  assert.equal(e.stage, 'sprout');
});

test('Gatekeeper mode skips /sprout and uses the compliance checklist', async () => {
  let { body: e } = await newEngagement({ mode: 3 });
  assert.deepEqual(e.flow, ['seed', 'cultivate', 'harvest']);
  assert.ok(e.checklists.cultivate.some((i) => i.id === 'checklist'));
  assert.ok(!e.checklists.cultivate.some((i) => i.id === 'review'));
  e = await completeStage(e);
  ({ body: e } = await call('POST', `/api/engagements/${e.id}/advance`, { approved_by: 'Sponsor' }));
  assert.equal(e.stage, 'cultivate');
});

test('mode is locked after /seed', async () => {
  let { body: e } = await newEngagement();
  assert.equal((await call('PATCH', `/api/engagements/${e.id}`, { mode: 1 })).status, 200);
  e = await completeStage((await call('GET', `/api/engagements/${e.id}`)).body);
  await call('POST', `/api/engagements/${e.id}/advance`, { approved_by: 'Sponsor' });
  assert.equal((await call('PATCH', `/api/engagements/${e.id}`, { mode: 3 })).status, 400);
});

test('artifacts must have owner, consumer and purpose (No Orphan)', async () => {
  const { body: e } = await newEngagement();
  const art = { engagement_id: e.id, name: 'Capability Map L2', type: 'Diagram', owner: 'Kadiv SCM', consumer: 'Tim Procurement', purpose: 'Batas slice' };
  assert.equal((await call('POST', '/api/artifacts', { ...art, owner: '' })).status, 400);
  assert.equal((await call('POST', '/api/artifacts', { ...art, purpose: '' })).status, 400);
  assert.equal((await call('POST', '/api/artifacts', art)).status, 200);
});

test('ADR needs a decider and decision text before acceptance', async () => {
  const { body: e } = await newEngagement();
  assert.equal((await call('POST', '/api/decisions', { engagement_id: e.id, title: 'Pakai SAP Ariba' })).status, 400, 'context required');
  const { body: d } = await call('POST', '/api/decisions', { engagement_id: e.id, title: 'Pakai SAP Ariba', context: 'Dua aplikasi duplikat' });
  assert.equal(d.status, 'Proposed');
  assert.equal((await call('PATCH', `/api/decisions/${d.id}`, { status: 'Accepted' })).status, 400);
  assert.equal((await call('PATCH', `/api/decisions/${d.id}`, { status: 'Accepted', decided_by: 'Dir. Keuangan' })).status, 400);
  const ok = await call('PATCH', `/api/decisions/${d.id}`, { status: 'Accepted', decided_by: 'Dir. Keuangan', decision: 'Ariba jadi SoRec' });
  assert.equal(ok.body.status, 'Accepted');
  assert.ok(ok.body.decided_at);
});

test('full cycle closes at /harvest, harvests artifacts and feeds /foundation', async () => {
  let { body: e } = await newEngagement({ mode: 1 });
  const { body: art } = await call('POST', '/api/artifacts', { engagement_id: e.id, name: 'ADD', type: 'Deliverable', owner: 'EA', consumer: 'Sponsor', purpose: 'Sign-off' });
  for (const _ of ['seed', 'sprout', 'cultivate']) {
    e = await completeStage(e);
    ({ body: e } = await call('POST', `/api/engagements/${e.id}/advance`, { approved_by: 'Sponsor' }));
  }
  assert.equal(e.stage, 'harvest');
  e = await completeStage(e);
  const blocked = await call('POST', `/api/engagements/${e.id}/advance`, { approved_by: 'EA' });
  assert.equal(blocked.status, 400, 'draft artifacts block closure');
  await call('PATCH', `/api/artifacts/${art.id}`, { status: 'Disahkan' });
  ({ body: e } = await call('POST', `/api/engagements/${e.id}/advance`, { approved_by: 'EA', lessons: [{ title: 'Tambah pola integrasi event', kind: 'Standar Teknologi' }] }));
  assert.equal(e.status, 'closed');
  assert.equal(e.artifacts[0].status, 'Di-harvest');
  assert.equal(e.foundation.length, 1);
  assert.equal(e.gates.length, 4);
  assert.equal((await call('PATCH', `/api/engagements/${e.id}`, { status: 'active' })).status, 400);

  const { body: dash } = await call('GET', '/api/dashboard');
  assert.ok(dash.impact.harvested >= 1);
  assert.ok(dash.impact.gates >= 4);
});

test('dashboard flags engagements ready for a gate', async () => {
  const e = await completeStage((await newEngagement({ title: 'Siap gerbang' })).body);
  const { body } = await call('GET', '/api/dashboard');
  assert.ok(body.attention.some((a) => a.kind === 'gate' && a.engagement_id === e.id));
  assert.ok(body.load[2] > 0);
});

test('engagement follows its product recipe and falls back to default steps', async () => {
  assert.equal((await newEngagement({ product: 'nope' })).status, 400);
  let { body: e } = await newEngagement({ mode: 4, product: 'domain-data' });
  assert.equal(e.recipe.cultivate[0].id, 'd1');
  assert.equal(e.recipe.cultivate[0].source, 'product');
  assert.equal(e.recipe.seed[1].artifact.template, 'rekomendasi-domain-data');
  const { body: plain } = await newEngagement({ mode: 2 });
  assert.equal(plain.recipe.sprout[0].source, 'default');

  await call('POST', '/api/artifacts', { engagement_id: e.id, name: 'Rekomendasi Domain', type: 'Deliverable', owner: 'EA', consumer: 'Sponsor', purpose: 'Keputusan domain', step_ref: 'seed.workdoc' });
  ({ body: e } = await call('GET', `/api/engagements/${e.id}`));
  assert.equal(e.recipe.seed[1].key, "seed.workdoc");
  assert.equal(e.recipe.seed[1].registered.name, 'Rekomendasi Domain');
});

test('lessons learned improve the product recipe', async () => {
  let { body: e } = await newEngagement({ mode: 4, product: 'domain-data' });
  await call('POST', '/api/artifacts', { engagement_id: e.id, name: 'Map', type: 'Diagram', owner: 'EA', consumer: 'DGO', purpose: 'Domain', status: 'Disahkan' });
  for (const _ of e.flow) {
    e = await completeStage(e);
    const lessons = e.stage === 'harvest' ? [{ title: 'Tambah langkah validasi homonim' }] : [];
    ({ body: e } = await call('POST', `/api/engagements/${e.id}/advance`, { approved_by: 'Sponsor', lessons }));
  }
  assert.equal(e.status, 'closed');
  const { body: products } = await call('GET', '/api/products');
  const dd = products.find((p) => p.id === 'domain-data');
  assert.ok(dd.engagements.some((x) => x.id === e.id));
  assert.ok(dd.improvements.some((f) => f.title === 'Tambah langkah validasi homonim'));
});

test('templates are served as markdown', async () => {
  const res = await fetch(base + '/templates/rekomendasi-domain-data.md');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /D1/);
});

test('recipe steps can be ticked without counting toward the gate', async () => {
  let { body: e } = await newEngagement({ mode: 4, product: 'domain-data' });
  ({ body: e } = await call('POST', `/api/engagements/${e.id}/checks`, { stage: 'seed', item_id: 'step.decision', done: true }));
  assert.ok(e.recipe.seed[0].done_at);
  assert.equal(e.progress.done, 0);
  assert.equal((await call('POST', `/api/engagements/${e.id}/checks`, { stage: 'seed', item_id: 'step.bogus', done: true })).status, 400);
});

test('products can be created and edited; method steps map to Planting Seed stages', async () => {
  assert.equal((await call('POST', '/api/products', { name: 'Peta Kapabilitas' })).status, 400, 'decision & deliverable required');
  const draft = {
    name: 'Peta Kapabilitas Bisnis', decision: 'Menetapkan capability L1–L2 sebagai jangkar', deliverable: 'Business Capability Map L1–L2', default_mode: 4,
    templates: [{ name: 'Kerangka Capability Map', body: '# Capability Map\n' }],
    steps: [
      { title: 'Kumpulkan strategi & probis', stage: 'cultivate', altitude: 'L0' },
      { title: 'Susun L1', stage: 'cultivate', artifact: { name: 'Capability Map', type: 'Diagram', template: 'kerangka-capability-map' } },
      { title: 'Validasi dengan Domain Owner', stage: 'harvest', adr: '' },
    ],
  };
  assert.equal((await call('POST', '/api/products', { ...draft, steps: [{ title: 'x', stage: 'nope' }] })).status, 400, 'stage must be mapped');
  assert.equal((await call('POST', '/api/products', { ...draft, steps: [{ title: 'x', stage: 'cultivate', artifact: { name: 'a', template: 'missing' } }] })).status, 400, 'template must exist');
  const { status, body: p } = await call('POST', '/api/products', draft);
  assert.equal(status, 200);
  assert.equal(p.id, 'peta-kapabilitas-bisnis');
  assert.equal(p.steps[1].id, 'susun-l1');

  const tpl = await fetch(`${base}/api/products/${p.id}/templates/kerangka-capability-map`);
  assert.equal(await tpl.text(), '# Capability Map\n');

  let { body: e } = await newEngagement({ mode: 4, product: p.id });
  assert.deepEqual(e.recipe.cultivate.map((s) => s.id), ['kumpulkan-strategi-probis', 'susun-l1']);
  assert.equal(e.recipe.seed[0].source, 'default', 'unmapped stage falls back to generic steps');
  ({ body: e } = await call('POST', `/api/engagements/${e.id}/checks`, { stage: 'seed', item_id: `step.${e.recipe.seed[0].id}`, done: true }));

  // Renaming a step keeps its id, so in-flight engagements keep their progress.
  const edited = { ...p, version: '0.2', steps: p.steps.map((s, i) => (i === 1 ? { ...s, title: 'Susun capability L1 & L2' } : s)) };
  const { body: p2 } = await call('PUT', `/api/products/${p.id}`, edited);
  assert.equal(p2.steps[1].id, 'susun-l1');
  assert.equal(p2.version, '0.2');
  assert.equal(p2.engagements.length, 1);
});
