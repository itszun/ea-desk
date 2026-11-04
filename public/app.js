import { html, render, useState, useEffect, useCallback } from './vendor/preact-htm.js';

// ---------- infra ----------
async function api(method, path, body) {
  const res = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
  return data;
}

let pushToast = () => {};
const toast = (msg, err = false) => pushToast({ msg, err });
const fail = (e) => toast(e.message, true);

function useRoute() {
  const get = () => (location.hash.slice(1) || '/').split('/').filter(Boolean);
  const [r, set] = useState(get());
  useEffect(() => { const on = () => { set(get()); window.scrollTo(0, 0); }; addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return r;
}
const go = (path) => { location.hash = path; };

function useLoad(fn, deps = []) {
  const [state, set] = useState({ data: null, error: null });
  const reload = useCallback(() => fn().then((data) => set({ data, error: null })).catch((error) => set({ data: null, error })), deps);
  useEffect(() => { reload(); }, [reload]);
  return [state.data, reload, state.error, (data) => set({ data, error: null })];
}

const toDate = (s) => (s ? new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z') : null);
const fmtDate = (s) => (s ? toDate(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (s) => (s ? toDate(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const stageById = (pb, id) => pb.stages.find((s) => s.id === id);
const modeById = (pb, id) => pb.modes.find((m) => m.id === Number(id));
const STATUS = { active: ['Aktif', 'accent'], on_hold: ['Ditunda', 'warn'], closed: ['Selesai', 'ok'], cancelled: ['Dibatalkan', 'danger'] };
const ADR_BADGE = { Proposed: 'warn', Accepted: 'ok', Rejected: 'danger', Superseded: '' };
const ART_BADGE = { Draft: 'warn', Disahkan: 'accent', 'Di-harvest': 'ok', Usang: '' };

// ---------- primitives ----------
const ModeBadge = ({ pb, mode }) => { const m = modeById(pb, mode); return html`<span class="badge m${m.id}">M${m.id} · ${m.name}</span>`; };
const StatusBadge = ({ s }) => html`<span class="badge ${STATUS[s][1]}">${STATUS[s][0]}</span>`;

function Modal({ title, onClose, children, footer }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  return html`<div class="modal-bg" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="modal" role="dialog" aria-label=${title}>
      <header><h2>${title}</h2><button class="ghost" onClick=${onClose} aria-label="Tutup">✕</button></header>
      <div class="body">${children}</div>
      ${footer && html`<footer>${footer}</footer>`}
    </div></div>`;
}

function Field({ label, hint, req, children }) {
  return html`<label class="f"><span class=${req ? 'req' : ''}>${label}</span>${children}${hint && html`<span class="hint">${hint}</span>`}</label>`;
}

// Controlled form state helper: [values, bind(name) -> props, set]
function useForm(initial) {
  const [v, setV] = useState(initial);
  const bind = (name) => ({ value: v[name] ?? '', onInput: (e) => setV((o) => ({ ...o, [name]: e.target.value })) });
  return [v, bind, setV];
}

// ---------- layout ----------
function Nav({ route, counts }) {
  const items = [['/', 'Meja Kerja'], ['/engagements', 'Engagement', counts?.active], ['/products', 'Katalog Produk EA'], ['/studio', 'Pembuatan Produk'], ['/decisions', 'Keputusan (ADR)', counts?.adr], ['/artifacts', 'Register Artefak'], ['/foundation', 'Backlog /foundation'], ['/playbook', 'Playbook']];
  const cur = '/' + (route[0] || '');
  return html`<nav class="nav">
    <div class="brand">${Logo()}<div>EA Desk<small>Manajemen kerja fungsi EA</small></div></div>
    ${items.map(([href, label, n]) => html`<a href=${'#' + href} class=${cur === href ? 'on' : ''}>${label}${n ? html`<span class="badge">${n}</span>` : ''}</a>`)}
    <div class="spacer"></div>
    <div class="foot"><div class="poc-flag">Versi POC · untuk review</div><a href="/_odoo">← Kembali ke EA Desk (Odoo)</a><div style="margin-top:8px">Planting Seed · TOGAF 10</div><a href="/api/export" download="ea-desk-backup.json">Ekspor backup JSON</a></div>
  </nav>`;
}
const Logo = () => html`<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--accent)"/><path d="M16 25V12m0 0c0-4 3-6 7-6 0 4-3 6-7 6zm0 3c0-3-2-5-6-5 0 3 2 5 6 5z" stroke="var(--accent-text)" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;

// ---------- dashboard ----------
function Dashboard({ pb }) {
  const [d] = useLoad(() => api('GET', '/dashboard'));
  if (!d) return html`<p class="muted">Memuat…</p>`;
  const active = d.active.filter((e) => e.status === 'active');
  const totalLoad = Object.values(d.load).reduce((a, b) => a + b, 0);
  return html`
    <div class="page-head"><div><h1>Meja Kerja</h1><p>Apa yang perlu dilakukan hari ini, dan bagaimana fungsi EA berjalan.</p></div>
      <button class="primary" onClick=${() => go('/engagements/new')}>+ Engagement baru</button></div>

    <div class="split">
      <div class="card"><h2>Perlu perhatian <span class="badge">${d.attention.length}</span></h2>
        ${d.attention.length ? d.attention.map((a) => html`<div class="attn"><span class="dot ${a.kind}"></span><div>
          <a href=${a.kind === 'adr' && !a.engagement_id ? '#/decisions' : `#/engagements/${a.engagement_id}`}><span class="mono">${a.code}</span> ${a.title}</a>
          <div class="small muted">${a.text}</div></div></div>`)
        : html`<div class="empty">Tidak ada yang menunggu. Semua engagement berjalan sesuai gerbangnya.</div>`}
      </div>

      <div class="card"><h2>Kapasitas EA <span class="small muted">beban ${totalLoad} / ${d.capacity_limit} poin</span></h2>
        <div class=${'bar' + (totalLoad > d.capacity_limit ? ' over' : '')}><i style=${`width:${Math.min(100, (totalLoad / d.capacity_limit) * 100)}%`}></i></div>
        <div class="grid g2" style="margin-top:14px">
          ${pb.modes.map((m) => html`<div class="row" style="justify-content:space-between"><span class="badge m${m.id}">M${m.id} · ${m.name}</span>
            <span class="small">${active.filter((e) => e.mode === m.id).length} eng · ${d.load[m.id] || 0} poin</span></div>`)}
        </div>
        ${totalLoad > d.capacity_limit && html`<p class="alert small" style="margin:12px 0 0">Kapasitas terlampaui. Pertimbangkan menurunkan mode (Co-Pilot → Advisor) atau menunda engagement tanpa sponsor aktif.</p>`}
        <p class="small muted" style="margin:12px 0 0">Bobot: Co-Pilot 3, Advisor 2, Gatekeeper 1, Curator 1. Batas diatur di <code>playbook.json</code>.</p>
      </div>
    </div>

    <h2 style="margin:24px 0 10px">Pipeline Planting Seed</h2>
    <${Board} pb=${pb} items=${d.active} />

    <div class="split" style="margin-top:24px">
      <div class="card"><h2>Jejak dampak <span class="small muted">90 hari terakhir</span></h2>
        <div class="grid g3">
          <div class="kpi"><b>${d.impact.adr_accepted}</b><span>Keputusan arsitektur disahkan</span></div>
          <div class="kpi"><b>${d.impact.harvested}</b><span>Engagement di-harvest</span></div>
          <div class="kpi"><b>${d.impact.gates}</b><span>Gerbang dilewati</span></div>
          <div class="kpi"><b>${d.impact.artifacts}</b><span>Artefak bertuan didaftarkan</span></div>
          <div class="kpi"><b>${d.impact.foundation_done}</b><span>Perbaikan /foundation</span></div>
        </div>
        <p class="small muted" style="margin:14px 0 0">Ini bukti kerja EA yang biasanya tak terlihat: setiap angka adalah keputusan atau aset yang tidak hilang.</p>
      </div>
      <div class="card"><h2>Aktivitas terbaru</h2>
        ${d.recent.length ? html`<ul class="timeline">${d.recent.map((ev) => html`<li><time>${fmtTime(ev.at)}</time><div>
          ${ev.code && html`<a class="mono" href=${'#/engagements/' + ev.engagement_id}>${ev.code}</a> `}${ev.text}</div></li>`)}</ul>`
        : html`<div class="empty">Belum ada aktivitas.</div>`}
      </div>
    </div>`;
}

function Board({ pb, items }) {
  return html`<div class="board">${pb.stages.map((s) => {
    const col = items.filter((e) => e.stage === s.id);
    return html`<div class="col"><div class="col-head"><b>${s.label}</b><span class="small muted">${col.length}</span></div>
      ${col.map((e) => html`<a class="tile" href=${'#/engagements/' + e.id}>
        <div class="row" style="justify-content:space-between"><span class="mono small muted">${e.code}</span><${ModeBadge} pb=${pb} mode=${e.mode} /></div>
        <div class="t">${e.title}</div>
        <div class="row small muted" style="justify-content:space-between;margin-bottom:6px"><span>${e.sponsor}</span>
          ${e.status === 'on_hold' ? html`<span class="badge warn">Ditunda</span>` : html`<span>${e.progress.done}/${e.progress.total}</span>`}</div>
        <div class="bar"><i style=${`width:${e.progress.total ? (e.progress.done / e.progress.total) * 100 : 0}%`}></i></div>
      </a>`)}
      ${!col.length && html`<div class="small muted" style="padding:4px">Kosong</div>`}
    </div>`;
  })}</div>`;
}

// ---------- engagements ----------
function Engagements({ pb }) {
  const [list] = useLoad(() => api('GET', '/engagements'));
  const [view, setView] = useState('board');
  const [show, setShow] = useState('open');
  if (!list) return html`<p class="muted">Memuat…</p>`;
  const rows = list.filter((e) => (show === 'open' ? ['active', 'on_hold'].includes(e.status) : show === 'all' || e.status === show));
  return html`
    <div class="page-head"><div><h1>Engagement</h1><p>Setiap permintaan layanan EA, dari /seed sampai /harvest.</p></div>
      <div class="row">
        <select value=${show} onChange=${(e) => setShow(e.target.value)} style="width:auto"><option value="open">Berjalan</option><option value="closed">Selesai</option><option value="cancelled">Dibatalkan</option><option value="all">Semua</option></select>
        <button onClick=${() => setView(view === 'board' ? 'list' : 'board')}>${view === 'board' ? 'Tampilan daftar' : 'Tampilan papan'}</button>
        <button class="primary" onClick=${() => go('/engagements/new')}>+ Engagement baru</button></div></div>
    ${view === 'board' && show === 'open' ? html`<${Board} pb=${pb} items=${rows} />` : html`
      <div class="card flat table-wrap"><table><thead><tr><th>Kode</th><th>Judul</th><th>Mode</th><th>Tahap</th><th>Sponsor</th><th>Status</th><th>Diperbarui</th></tr></thead>
        <tbody>${rows.map((e) => html`<tr class="link" onClick=${() => go('/engagements/' + e.id)}>
          <td class="mono">${e.code}</td><td><b>${e.title}</b></td><td><${ModeBadge} pb=${pb} mode=${e.mode} /></td>
          <td class="mono">${e.status === 'closed' ? '✓' : stageById(pb, e.stage).label}</td><td>${e.sponsor}</td><td><${StatusBadge} s=${e.status} /></td><td class="small muted">${fmtDate(e.updated_at)}</td></tr>`)}</tbody></table>
        ${!rows.length && html`<div class="empty">Belum ada engagement di kategori ini.</div>`}</div>`}`;
}

function suggestMode(ans) {
  if (ans.internal) return 4;
  if (ans.cross || ans.risk) return 1;
  if (ans.tactical) return 3;
  if (ans.mature) return 2;
  return null;
}

function EngagementForm({ pb, initial, onSubmit, submitLabel, lockMode }) {
  const [v, bind, setV] = useForm({ risk: 'Sedang', strategy_level: '', ...initial });
  const [ans, setAns] = useState({});
  const [busy, setBusy] = useState(false);
  const suggested = suggestMode(ans);
  const prod = pb.products.find((p) => p.id === v.product);
  const pickProduct = (id) => { const p = pb.products.find((x) => x.id === id); setV((o) => ({ ...o, product: id, ...(p && !o.mode && !lockMode ? { mode: p.default_mode } : {}) })); };
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(v); } catch (err) { fail(err); } setBusy(false); };
  return html`<form class="form" onSubmit=${submit}>
    <fieldset><legend>0 · Produk EA yang dipesan</legend>
      <p class="small muted" style="margin:0">Produk dari katalog membawa resep kerja dan template. Kosongkan bila belum ada produk yang cocok; engagement akan memakai resep umum.</p>
      <select onChange=${(e) => pickProduct(e.target.value)}>
        <option value="" selected=${!v.product}>— Tanpa produk (resep umum) —</option>
        ${pb.products.filter((p) => p.maturity !== 'Usang' || p.id === v.product).map((p) => html`<option value=${p.id} selected=${v.product === p.id}>${p.name}${p.sop_output ? ` · ${p.sop_output}` : ''} (${p.maturity} v${p.version})</option>`)}
      </select>
      ${prod && html`<p class="small" style="margin:0"><b>Deliverable:</b> ${prod.deliverable}<br/><b>Keputusan yang didukung:</b> ${prod.decision} · mode default M${prod.default_mode}</p>`}
    </fieldset>

    <fieldset><legend>1 · Pelanggan & keputusan</legend>
      <p class="small muted" style="margin:0">Know Your Customer & Decision First: siapa yang memutuskan, dan keputusan apa yang dibantu EA?</p>
      <${Field} label="Judul engagement" req><input ...${bind('title')} placeholder="mis. Konsolidasi aplikasi procurement" required /><//>
      <div class="grid g2">
        <${Field} label="Sponsor (Accountable)" req hint="Pengesah scope, blueprint L1–L2, dan ADR"><input ...${bind('sponsor')} required /><//>
        <${Field} label="Pemohon"><input ...${bind('requester')} /><//>
        <${Field} label="Domain Owner"><input ...${bind('domain_owner')} /><//>
        <${Field} label="Delivery Team"><input ...${bind('delivery_team')} /><//>
      </div>
      <${Field} label="Keputusan yang harus diambil Sponsor" req hint="Kalau ini kosong, belum ada alasan untuk membuat artefak."><textarea ...${bind('decision_needed')} required placeholder="mis. Memilih satu platform procurement sebagai System of Record"></textarea><//>
      <${Field} label="Business Problem Statement"><textarea ...${bind('problem')}></textarea><//>
      <div class="grid g3">
        <${Field} label="Level strategi"><select ...${bind('strategy_level')} onChange=${bind('strategy_level').onInput}><option value="">—</option>${pb.strategy_levels.map((s) => html`<option value=${s.id} selected=${v.strategy_level === s.id}>${s.name}</option>`)}</select><//>
        <${Field} label="Risiko arsitektur"><select ...${bind('risk')} onChange=${bind('risk').onInput}>${['Rendah', 'Sedang', 'Tinggi'].map((r) => html`<option value=${r} selected=${v.risk === r}>${r}</option>`)}</select><//>
        <${Field} label="Target selesai"><input type="date" ...${bind('target_date')} /><//>
      </div>
    </fieldset>

    <fieldset><legend>2 · Batas vertical slice (B-D-A-T)</legend>
      <div class="grid g2">
        <${Field} label="Business" hint="Capability L1/L2, proses yang tersentuh"><textarea ...${bind('slice_business')}></textarea><//>
        <${Field} label="Data" hint="Entitas informasi (M/R/T), sumber otoritatif"><textarea ...${bind('slice_data')}></textarea><//>
        <${Field} label="Application" hint="Aplikasi terdampak (SoRec/SoRef)"><textarea ...${bind('slice_application')}></textarea><//>
        <${Field} label="Technology" hint="Platform/standar teknologi terkait"><textarea ...${bind('slice_technology')}></textarea><//>
      </div>
    </fieldset>

    <fieldset><legend>3 · Mode Keterlibatan EA</legend>
      ${lockMode ? html`<p class="alert small" style="margin:0">Mode terkunci setelah /seed. Perubahan besar dicatat sebagai ADR atau engagement baru.</p>` : html`
        <div class="grid" style="gap:4px">${pb.triage.map((t) => html`<label class="check"><input type="checkbox" checked=${!!ans[t.id]} onChange=${(e) => setAns({ ...ans, [t.id]: e.target.checked })} /><span>${t.q}</span></label>`)}</div>
        ${suggested && html`<p class="alert info small" style="margin:0">Saran triase: <b>Mode ${suggested} · ${modeById(pb, suggested).name}</b>. ${Number(v.mode) !== suggested ? html`<button type="button" class="sm" onClick=${() => setV({ ...v, mode: suggested })}>Gunakan</button>` : ''}</p>`}
        <div class="mode-pick">${pb.modes.map((m) => html`<button type="button" class=${'mode-opt' + (Number(v.mode) === m.id ? ' on' : '')} onClick=${() => setV({ ...v, mode: m.id })}>
          <span class="badge m${m.id}">M${m.id} · ${m.name}</span> <span class="small muted">${m.touch}</span><p>${m.when}</p></button>`)}</div>`}
    </fieldset>
    <div class="row" style="justify-content:flex-end"><button type="button" onClick=${() => history.back()}>Batal</button><button class="primary" disabled=${busy || !v.mode}>${submitLabel}</button></div>
  </form>`;
}

function NewEngagement({ pb, product }) {
  return html`<div class="page-head"><div><h1>Engagement baru · /seed</h1><p>Menyaring permintaan: rumuskan keputusan, kunci batas slice, dan tetapkan mode.</p></div></div>
    <div class="card" style="max-width:860px"><${EngagementForm} pb=${pb} initial=${product ? { product, mode: pb.products.find((p) => p.id === product)?.default_mode } : {}} submitLabel="Buka engagement"
      onSubmit=${async (v) => { const e = await api('POST', '/engagements', v); toast(`${e.code} dibuka`); go('/engagements/' + e.id); }} /></div>`;
}

function EngagementDetail({ pb, id }) {
  const [e, reload, err, setE] = useLoad(() => api('GET', '/engagements/' + id), [id]);
  const [tab, setTab] = useState('adr');
  const [modal, setModal] = useState(null);
  const [tpl, setTpl] = useState(null);
  if (err) return html`<div class="empty">${err.message}</div>`;
  if (!e) return html`<p class="muted">Memuat…</p>`;
  const closed = e.status === 'closed' || e.status === 'cancelled';
  const stage = stageById(pb, e.stage);
  const mode = modeById(pb, e.mode);
  const gateFor = (s) => e.gates.find((g) => g.stage === s);
  const setStatus = async (status) => { try { setE(await api('PATCH', '/engagements/' + id, { status })); } catch (x) { fail(x); } };
  const toggle = async (item, done) => { try { setE(await api('POST', `/engagements/${id}/checks`, { stage: e.stage, item_id: item.id, done })); } catch (x) { fail(x); } };

  return html`
    <div class="page-head"><div>
        <div class="row small"><a href="#/engagements">← Engagement</a><span class="mono muted">${e.code}</span><${ModeBadge} pb=${pb} mode=${e.mode} /><${StatusBadge} s=${e.status} />
          ${e.product && html`<a class="badge accent" href=${'#/products/' + e.product}>Produk: ${pb.products.find((p) => p.id === e.product)?.name}</a>`}</div>
        <h1 style="margin-top:6px">${e.title}</h1>
        <p>Sponsor <b>${e.sponsor}</b>${e.domain_owner && html` · Domain Owner <b>${e.domain_owner}</b>`}${e.target_date && html` · Target ${fmtDate(e.target_date)}`}</p></div>
      ${!closed && html`<div class="row">
        <button onClick=${() => setModal('edit')}>Ubah scope</button>
        ${e.status === 'active' ? html`<button onClick=${() => setStatus('on_hold')}>Tunda</button>` : html`<button onClick=${() => setStatus('active')}>Lanjutkan</button>`}
        <button class="ghost danger" onClick=${() => confirm('Batalkan engagement ini? Riwayat tetap tersimpan.') && setStatus('cancelled')}>Batalkan</button></div>`}
    </div>

    <div class="stepper">${e.flow.map((s) => {
      const g = gateFor(s); const now = !closed && s === e.stage;
      return html`<div class=${'step' + (g ? ' done' : now ? ' now' : '')}><div class="lbl">${g ? '✓ ' : ''}${stageById(pb, s).label}</div>
        <div class="sub">${g ? `${fmtDate(g.passed_at)} · ${g.approved_by}` : now ? `Sedang berjalan · ${e.progress.done}/${e.progress.total}` : stageById(pb, s).name}</div></div>`;
    })}</div>

    <div class="split">
      <div class="card">
        ${closed ? html`<h2>${e.status === 'closed' ? 'Engagement selesai' : 'Engagement dibatalkan'}</h2>
          <p class="muted" style="margin:0">${e.status === 'closed' ? `Ditutup lewat gerbang /harvest pada ${fmtDate(e.closed_at)}. Artefak yang disahkan sudah masuk seedbank.` : 'Riwayat tetap tersimpan untuk pembelajaran.'}</p>
          ${e.foundation.length > 0 && html`<h3 style="margin-top:14px">Masukan ke /foundation</h3><ul>${e.foundation.map((f) => html`<li>${f.title} <span class="badge">${f.status}</span></li>`)}</ul>`}`
        : html`<h2><span><span class="mono">${stage.label}</span> · ${stage.name}</span><span class="badge">penyetuju: ${stage.approver}</span></h2>
          <p class="small muted" style="margin:-4px 0 10px">${stage.purpose}</p>
          <${Recipe} e=${e} onToggle=${toggle} onTemplate=${(tid) => setTpl(tplUrl(pb, e.product, tid))}
            onAdr=${(st) => setModal({ adr: { engagement_id: e.id, title: st.adr } })}
            onRegister=${(st) => setModal({ art: { engagement_id: e.id, name: st.artifact.name, type: st.artifact.type, status: 'Draft', step_ref: st.key, consumer: e.sponsor, purpose: `${st.output}, untuk keputusan: ${e.decision_needed}` } })} />
          <h3 class="gate-h">Kriteria gerbang <span class="small muted">· bukti selesai yang ditinjau ${stage.approver}</span></h3>
          ${e.checklists[e.stage].map((c) => html`<label class=${'check' + (c.done_at ? ' done' : '') + (e.status !== 'active' ? ' disabled' : '')}>
            <input type="checkbox" checked=${!!c.done_at} disabled=${e.status !== 'active'} onChange=${(ev) => toggle(c, ev.target.checked)} />
            <span>${c.text}${c.optional && html` <span class="badge">opsional</span>`}</span></label>`)}
          <div class="row" style="justify-content:space-between;margin-top:12px">
            <span class="small muted">${e.progress.ready ? 'Kriteria keluar terpenuhi.' : `${e.progress.total - e.progress.done} kriteria lagi sebelum gerbang.`}</span>
            <button class="primary" disabled=${!e.progress.ready || e.status !== 'active'} onClick=${() => setModal('gate')}>Lewati gerbang ${stage.label} →</button></div>
          <p class="small muted" style="margin:12px 0 0"><b>Peran EA di mode ${mode.name}:</b> ${mode.ea_role}</p>`}
      </div>

      <div class="card"><h2>Kanvas Architecture Scope</h2>
        <div class="canvas">
          <div class="cell"><h3>Keputusan Sponsor</h3><p>${e.decision_needed}</p>${e.problem && html`<h3 style="margin-top:8px">Masalah bisnis</h3><p>${e.problem}</p>`}</div>
          <div class="cell"><h3>Vertical slice</h3><div class="bdat">
            ${[['B', e.slice_business], ['D', e.slice_data], ['A', e.slice_application], ['T', e.slice_technology]].map(([k, val]) => html`<b>${k}</b><span class=${val ? '' : 'muted'}>${val || 'belum ditetapkan'}</span>`)}</div></div>
          <div class="cell"><h3>Risiko & level</h3><p>Risiko ${e.risk || '—'} · ${pb.strategy_levels.find((s) => s.id === e.strategy_level)?.name || 'level strategi belum diisi'}</p></div>
          <div class="cell"><h3>Mode EA & produk</h3><p>M${mode.id} · ${mode.name} (${mode.touch})</p><p class="muted">${pb.products.find((p) => p.id === e.product)?.name || 'Tanpa produk (resep umum)'}</p></div>
        </div></div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="tabs">${[['adr', `Keputusan (${e.decisions.length})`], ['art', `Artefak (${e.artifacts.length})`], ['log', 'Jurnal']].map(([k, l]) => html`<button class=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}</button>`)}</div>
      ${tab === 'adr' && html`<${DecisionList} pb=${pb} items=${e.decisions} engagement=${e} onChange=${reload} />`}
      ${tab === 'art' && html`<${ArtifactList} items=${e.artifacts} engagement=${e} onChange=${reload} />`}
      ${tab === 'log' && html`<${Journal} e=${e} onChange=${setE} />`}
    </div>

    ${modal === 'edit' && html`<${Modal} title="Ubah Architecture Scope" onClose=${() => setModal(null)}>
      <${EngagementForm} pb=${pb} initial=${e} lockMode=${e.stage !== 'seed'} submitLabel="Simpan"
        onSubmit=${async (v) => { const { title, requester, sponsor, domain_owner, delivery_team, problem, decision_needed, strategy_level, mode: md, risk, slice_business, slice_data, slice_application, slice_technology, target_date, product } = v;
          setE(await api('PATCH', '/engagements/' + id, { title, requester, sponsor, domain_owner, delivery_team, problem, decision_needed, strategy_level, risk, slice_business, slice_data, slice_application, slice_technology, target_date, product: product || null, ...(e.stage === 'seed' ? { mode: md } : {}) }));
          setModal(null); toast('Scope disimpan'); }} /><//>`}
    ${modal?.adr && html`<${DecisionEditor} pb=${pb} d=${modal.adr} lockEngagement onClose=${() => setModal(null)} onSaved=${() => { setModal(null); reload(); setTab('adr'); }} />`}
    ${modal?.art && html`<${ArtifactEditor} a=${modal.art} lockEngagement onClose=${() => setModal(null)} onSaved=${() => { setModal(null); reload(); }} />`}
    ${tpl && html`<${TemplateModal} url=${tpl} onClose=${() => setTpl(null)} />`}
    ${modal === 'gate' && html`<${GateDialog} pb=${pb} e=${e} onClose=${() => setModal(null)} onDone=${(x) => { setE(x); setModal(null); }} />`}`;
}

function GateDialog({ pb, e, onClose, onDone }) {
  const stage = stageById(pb, e.stage);
  const isLast = e.flow[e.flow.length - 1] === e.stage;
  const [v, bind] = useForm({ approved_by: stage.approver === 'Sponsor' ? e.sponsor : 'Enterprise Architect', note: '' });
  const [lessons, setLessons] = useState([{ title: '', kind: 'Proses Kerja EA' }]);
  const [busy, setBusy] = useState(false);
  const drafts = e.artifacts.filter((a) => a.status === 'Draft');
  const submit = async () => {
    setBusy(true);
    try { const x = await api('POST', `/engagements/${e.id}/advance`, { ...v, lessons: isLast ? lessons : [] }); toast(isLast ? 'Engagement di-harvest dan ditutup' : `Lulus ${stage.label}`); onDone(x); } catch (err) { fail(err); }
    setBusy(false);
  };
  const next = e.flow[e.flow.indexOf(e.stage) + 1];
  return html`<${Modal} title=${`Gerbang ${stage.label}`} onClose=${onClose}
    footer=${html`<button onClick=${onClose}>Batal</button><button class="primary" disabled=${busy} onClick=${submit}>${isLast ? 'Harvest & tutup engagement' : `Setujui → ${stageById(pb, next).label}`}</button>`}>
    <div class="form">
      <p class="muted" style="margin:0">Pencatatan persetujuan sesuai RACI. Penyetuju gerbang ini: <b>${stage.approver}</b>.</p>
      <${Field} label="Disetujui oleh" req><input ...${bind('approved_by')} /><//>
      <${Field} label="Catatan / bukti persetujuan" hint="mis. tautan notulen, email, atau nomor memo"><textarea ...${bind('note')}></textarea><//>
      ${isLast && html`
        ${e.product && html`<p class="alert info small" style="margin:0">Lessons learned masuk ke backlog <b>/foundation</b> dan menjadi bahan perbaikan resep <b>${pb.products.find((p) => p.id === e.product)?.name}</b>.</p>`}
        ${drafts.length > 0 && html`<p class="alert small" style="margin:0">${drafts.length} artefak masih Draft (${drafts.map((a) => a.name).join(', ')}). Sahkan atau tandai Usang dulu di tab Artefak.</p>`}
        <fieldset><legend>Lessons learned → backlog /foundation</legend>
          ${lessons.map((l, i) => html`<div class="grid" style="grid-template-columns:1fr 180px;gap:8px">
            <input placeholder="mis. Perlu template ADR untuk integrasi vendor" value=${l.title} onInput=${(ev) => setLessons(lessons.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))} />
            <select value=${l.kind} onChange=${(ev) => setLessons(lessons.map((x, j) => (j === i ? { ...x, kind: ev.target.value } : x)))}>${pb.foundation_kinds.map((k) => html`<option value=${k} selected=${l.kind === k}>${k}</option>`)}</select></div>`)}
          <button type="button" class="sm" style="justify-self:start" onClick=${() => setLessons([...lessons, { title: '', kind: 'Proses Kerja EA' }])}>+ Tambah</button>
        </fieldset>`}
    </div><//>`;
}

function Journal({ e, onChange }) {
  const [text, setText] = useState('');
  const add = async (ev) => { ev.preventDefault(); try { onChange(await api('POST', `/engagements/${e.id}/notes`, { text })); setText(''); } catch (x) { fail(x); } };
  return html`<form class="row" onSubmit=${add} style="margin-bottom:12px;align-items:stretch">
      <textarea style="flex:1;min-height:44px" value=${text} onInput=${(ev) => setText(ev.target.value)} placeholder="Catat hasil rapat, temuan, atau tindak lanjut…"></textarea>
      <button class="primary" disabled=${!text.trim()}>Catat</button></form>
    <ul class="timeline">${e.events.map((ev) => html`<li><time>${fmtTime(ev.at)}</time><div class=${ev.kind === 'note' ? 'note' : 'muted'}>${ev.text}</div></li>`)}</ul>`;
}

// ---------- resep kerja & produk ----------
function Recipe({ e, onToggle, onTemplate, onRegister, onAdr }) {
  const steps = e.recipe[e.stage] || [];
  if (!steps.length) return null;
  // Artifacts a previous stage's recipe asked for but that were never registered.
  const missed = e.flow.slice(0, e.flow.indexOf(e.stage)).flatMap((s) => (e.recipe[s] || []).filter((st) => st.artifact && !st.registered));
  const first = steps.find((st) => !st.done_at);
  const active = e.status === 'active';
  return html`<div class="recipe">
    <h3>Resep kerja ${steps[0].source === 'product' ? html`<span class="badge accent">dari produk</span>` : html`<span class="badge">resep umum</span>`}
      <span class="small muted"> · cara mengerjakan tahap ini</span></h3>
    ${missed.length > 0 && e.status === 'active' && html`<div class="alert small" style="margin-bottom:8px">Tertinggal dari tahap sebelumnya: ${missed.map((st) => html`<div class="row" style="margin-top:4px"><b>${st.title}</b>
      ${st.artifact.template && html`<button class="sm" onClick=${() => onTemplate(st.artifact.template)}>Lihat template</button>`}<button class="sm primary" onClick=${() => onRegister(st)}>Daftarkan</button></div>`)}</div>`}
    <ol>${steps.map((st) => html`<li class=${(st.done_at ? 'done' : '') + (st === first ? ' next' : '')}>
      <label class=${'check' + (st.done_at ? ' done' : '') + (active ? '' : ' disabled')}>
        <input type="checkbox" checked=${!!st.done_at} disabled=${!active} onChange=${(ev) => onToggle({ id: 'step.' + st.id }, ev.target.checked)} />
        <span><b>${st.title}</b> ${st.altitude && html`<span class="badge" title="Tangga ketinggian: L0 strategis, L1 konseptual">${st.altitude}</span>`} ${st === first && html`<span class="badge accent">Mulai di sini</span>`}</span></label>
      <div class="step-body">
        <div class="small">${st.how}</div>
        <div class="small muted">Hasil: ${st.output}${st.ref && html` · Rujukan: ${st.ref}`}</div>
        ${(st.artifact || st.adr !== undefined) && html`<div class="row" style="margin-top:6px">
          ${st.adr !== undefined && active && html`<button class="sm" onClick=${() => onAdr(st)}>+ Buat ADR</button>`}
          ${st.artifact?.template && html`<button class="sm" onClick=${() => onTemplate(st.artifact.template)}>Lihat template</button>`}
          ${st.artifact && (st.registered
            ? html`<span class="small">✓ Terdaftar: <b>${st.registered.name}</b> <span class="badge ${ART_BADGE[st.registered.status]}">${st.registered.status}</span>${st.registered.location && html` · <a href=${st.registered.location} target="_blank" rel="noopener">buka</a>`}</span>`
            : active && html`<button class="sm primary" onClick=${() => onRegister(st)}>Daftarkan artefak</button>`)}
        </div>`}
      </div></li>`)}</ol></div>`;
}

function TemplateModal({ url, onClose }) {
  const [text, setText] = useState(null);
  useEffect(() => { fetch(url).then((r) => r.text()).then(setText).catch(fail); }, [url]);
  const copy = () => navigator.clipboard.writeText(text).then(() => toast('Template disalin. Tempel ke Word/Docs.')).catch(() => toast('Gagal menyalin. Pakai tombol Unduh.', true));
  return html`<${Modal} title="Template dokumen" onClose=${onClose}
    footer=${html`<a class="btn" href=${url} download=${url.split('/').pop().replace(/(\.md)?$/, '.md')}>Unduh .md</a><button class="primary" disabled=${!text} onClick=${copy}>Salin</button>`}>
    <p class="small muted" style="margin:0 0 10px">Buat dokumennya di penyimpanan resmi (Word di SharePoint/OneDrive atau Google Docs), lalu daftarkan link-nya sebagai artefak. EA Desk hanya mencatat link, pemilik, dan status. Isinya tidak disimpan di sini.</p>
    <pre class="tpl">${text ?? 'Memuat…'}</pre><//>`;
}

const MATURITY = { Draft: 'warn', Teruji: 'accent', Baku: 'ok', Usang: '' };
// Product templates live in the DB; the generic Planting Seed steps use static files.
const tplUrl = (pb, pid, tid) => (pb.products.find((p) => p.id === pid)?.templates.some((t) => t.id === tid) ? `/api/products/${pid}/templates/${tid}` : `/templates/${tid}.md`);

function Products({ pb }) {
  const [items] = useLoad(() => api('GET', '/products'));
  if (!items) return html`<p class="muted">Memuat…</p>`;
  return html`<div class="page-head"><div><h1>Katalog Produk EA</h1>
      <p>Layanan EA yang terstandar (TOGAF: EA Services). Setiap produk punya deliverable dan resep kerja. Engagement memakai resep, lessons learned memperbaikinya, dan resep yang matang mempercepat engagement berikutnya.</p></div></div>
    <div class="grid g3">${items.map((p) => html`<a class="card tile-card" href=${'#/products/' + p.id}>
      <div class="row" style="justify-content:space-between"><span class="badge ${MATURITY[p.maturity] || ''}">${p.maturity} · v${p.version}</span><span class="mono small muted">${p.sop_output}</span></div>
      <h2 style="margin:8px 0 4px">${p.name}</h2>
      <p class="small muted" style="margin:0 0 8px">${p.decision}</p>
      <div class="small"><b>Deliverable:</b> ${p.deliverable}</div>
      <div class="row small muted" style="margin-top:10px"><span>${p.engagements.length} engagement</span><span>·</span><span>${p.improvements.length} masukan perbaikan</span></div></a>`)}</div>
    <p class="small muted" style="margin-top:16px">Produk dirancang dan diperbaiki di menu <a href="#/studio">Pembuatan Produk</a>.</p>`;
}

function ProductDetail({ pb, id }) {
  const [items] = useLoad(() => api('GET', '/products'));
  const [tpl, setTpl] = useState(null);
  if (!items) return html`<p class="muted">Memuat…</p>`;
  const p = items.find((x) => x.id === id);
  if (!p) return html`<div class="empty">Produk tidak ditemukan.</div>`;
  const own = pb.stages.filter((s) => p.steps.some((st) => st.stage === s.id));
  return html`<div class="page-head"><div>
      <div class="row small"><a href="#/products">← Katalog</a><span class="badge ${MATURITY[p.maturity] || ''}">${p.maturity} · v${p.version}</span><span class="mono muted">${p.sop_output}</span></div>
      <h1 style="margin-top:6px">${p.name}</h1><p>${p.when}</p></div>
      <div class="row"><button onClick=${() => go('/studio/' + p.id)}>Ubah resep</button><button class="primary" onClick=${() => go('/engagements/new/' + p.id)}>+ Engagement dengan produk ini</button></div></div>
    <div class="split">
      <div class="card"><h2>Resep kerja</h2>
        ${own.map((s) => html`<h3 style="margin:12px 0 6px"><span class="mono">${s.label}</span> · ${s.name}</h3>
          <ol class="small" style="margin:0;padding-left:20px">${p.steps.filter((st) => st.stage === s.id).map((st) => html`<li style="margin-bottom:6px"><b>${st.title}</b> ${st.altitude && html`<span class="badge">${st.altitude}</span>`}<div class="muted">${st.how}</div></li>`)}</ol>`)}
        <p class="small muted" style="margin:12px 0 0">Tahap yang tidak punya langkah metode mengikuti resep umum Planting Seed.</p></div>
      <div class="grid">
        <div class="card"><h2>Spesifikasi produk</h2>
          <div class="prose small"><h3>Layanan (TOGAF)</h3><p>${p.service}</p><h3>Pelanggan</h3><p>${p.customer}</p><h3>Keputusan yang didukung</h3><p>${p.decision}</p>
          <h3>Deliverable</h3><p>${p.deliverable}</p><h3>Mode default</h3><p>M${p.default_mode} · ${modeById(pb, p.default_mode).name}</p>${p.ref && html`<h3>Rujukan metode</h3><p>${p.ref}</p>`}</div></div>
        <div class="card"><h2>Tools & template</h2><ul class="small" style="margin:0;padding-left:18px">${p.tools.map((t) => html`<li style="margin-bottom:4px">${t.name}${t.ref && html` <span class="muted">· ${t.ref}</span>`} ${t.template && html`<button class="sm" onClick=${() => setTpl(tplUrl(pb, p.id, t.template))}>Lihat</button>`}</li>`)}</ul></div>
        <div class="card"><h2>Dipakai di <span class="badge">${p.engagements.length}</span></h2>
          ${p.engagements.length ? html`<ul class="small" style="margin:0;padding-left:18px">${p.engagements.map((e) => html`<li><a href=${'#/engagements/' + e.id}><span class="mono">${e.code}</span> ${e.title}</a> <${StatusBadge} s=${e.status} /></li>`)}</ul>` : html`<div class="empty small">Belum pernah dipakai.</div>`}</div>
        <div class="card"><h2>Backlog perbaikan resep <span class="badge">${p.improvements.length}</span></h2>
          ${p.improvements.length ? html`<ul class="small" style="margin:0;padding-left:18px">${p.improvements.map((f) => html`<li>${f.title} <span class="badge">${f.status}</span>${f.ecode && html` <span class="mono muted">${f.ecode}</span>`}</li>`)}</ul>` : html`<div class="empty small">Belum ada. Lessons learned dari /harvest akan muncul di sini.</div>`}</div>
      </div></div>
    ${tpl && html`<${TemplateModal} url=${tpl} onClose=${() => setTpl(null)} />`}`;
}

// ---------- pembuatan produk (EA Practice Development) ----------
const slugify = (x) => String(x).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40);

function Studio({ pb }) {
  const [items] = useLoad(() => api('GET', '/products'));
  if (!items) return html`<p class="muted">Memuat…</p>`;
  return html`<div class="page-head"><div><h1>Pembuatan Produk EA</h1>
      <p>Merancang dan memperbaiki metode setiap produk. Ini layanan internal EA (TOGAF: <i>EA Practice Development</i>), biasanya dikerjakan dalam Mode 4 Curator.</p></div>
      <button class="primary" onClick=${() => go('/studio/new')}>+ Produk baru</button></div>
    <div class="card" style="margin-bottom:16px"><h2>Dua sumbu yang berbeda</h2>
      <div class="grid g2 small">
        <div class="cell"><h3>Planting Seed = tata kelola</h3><p>Kapan EA terlibat, siapa yang menyetujui, kapan aset dipanen. Sama untuk semua produk. Diatur di <code>playbook.json</code>.</p></div>
        <div class="cell"><h3>Metode produk = cara memproduksi deliverable</h3><p>Langkah, level ketinggian, template, dan tools. Berbeda untuk tiap produk. Setiap langkah <b>dipetakan</b> ke tahap Planting Seed tempat ia dikerjakan.</p></div>
      </div></div>
    <div class="card flat table-wrap"><table><thead><tr><th>Produk</th><th>Kematangan</th><th>Metode</th><th>Dipakai</th><th>Masukan terbuka</th><th></th></tr></thead><tbody>
      ${items.map((p) => { const open = p.improvements.filter((f) => f.status !== 'Selesai').length; return html`<tr class="link" onClick=${() => go('/studio/' + p.id)}>
        <td><b>${p.name}</b><div class="small muted">${p.deliverable}</div></td>
        <td><span class="badge ${MATURITY[p.maturity]}">${p.maturity} · v${p.version}</span></td>
        <td class="small">${p.steps.length} langkah · ${p.templates.length} template</td>
        <td class="small">${p.engagements.length} engagement</td>
        <td>${open ? html`<span class="badge warn">${open}</span>` : html`<span class="small muted">—</span>`}</td>
        <td><button class="sm ghost" onClick=${(ev) => { ev.stopPropagation(); go('/studio/new/' + p.id); }}>Duplikat</button></td></tr>`; })}
    </tbody></table></div>`;
}

const BLANK_PRODUCT = { name: '', sop_output: '', service: '', customer: '', decision: '', when: '', deliverable: '', default_mode: 2, version: '0.1', maturity: 'Draft', ref: '', steps: [], templates: [], tools: [] };

function ProductEditor({ pb, id, from, onSaved }) {
  const [src] = useLoad(() => (id || from ? api('GET', '/products/' + (id || from)) : Promise.resolve(BLANK_PRODUCT)), [id, from]);
  if (!src) return html`<p class="muted">Memuat…</p>`;
  const init = from ? { ...src, id: undefined, name: `${src.name} (salinan)`, version: '0.1', maturity: 'Draft', improvements: [], engagements: [] } : src;
  return html`<${ProductForm} key=${id || 'new-' + (from || '')} pb=${pb} src=${init} isNew=${!id} onSaved=${onSaved} />`;
}

function ProductForm({ pb, src, isNew, onSaved }) {
  const [v, setV] = useState(() => ({ ...src, steps: src.steps.map((x) => ({ ...x })), templates: src.templates.map((x) => ({ ...x })), tools: src.tools.map((x) => ({ ...x })) }));
  const [improvements, setImprovements] = useState(src.improvements || []);
  const [busy, setBusy] = useState(false);
  const set = (k, val) => setV((o) => ({ ...o, [k]: val }));
  const field = (k) => ({ value: v[k] ?? '', onInput: (e) => set(k, e.target.value) });
  const upd = (list, i, patch) => setV((o) => ({ ...o, [list]: o[list].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const move = (list, i, d) => setV((o) => { const a = [...o[list]]; const j = i + d; if (j < 0 || j >= a.length) return o; [a[i], a[j]] = [a[j], a[i]]; return { ...o, [list]: a }; });
  const del = (list, i) => setV((o) => ({ ...o, [list]: o[list].filter((_, j) => j !== i) }));
  const add = (list, item) => setV((o) => ({ ...o, [list]: [...o[list], item] }));
  const save = async () => {
    setBusy(true);
    try {
      const out = isNew ? await api('POST', '/products', v) : await api('PUT', '/products/' + src.id, v);
      toast(`${out.name} disimpan (v${out.version})`); onSaved();
      if (isNew) go('/studio/' + out.id); else setV({ ...out, steps: out.steps, templates: out.templates, tools: out.tools });
    } catch (x) { fail(x); }
    setBusy(false);
  };
  const absorb = async (f) => { try { await api('PATCH', '/foundation/' + f.id, { status: 'Selesai' }); setImprovements(improvements.map((x) => (x.id === f.id ? { ...x, status: 'Selesai' } : x))); toast('Masukan ditandai sudah diserap ke resep'); } catch (x) { fail(x); } };
  const tplOptions = (cur) => html`<option value="" selected=${!cur}>— tanpa template —</option>${v.templates.map((t) => html`<option value=${t.id} selected=${cur === t.id}>${t.name || t.id}</option>`)}`;
  const stageName = (id) => pb.stages.find((x) => x.id === id);

  return html`<div class="page-head"><div>
      <div class="row small"><a href="#/studio">← Pembuatan Produk</a>${!isNew && html`<a href=${'#/products/' + src.id}>Lihat di katalog</a>`}</div>
      <h1 style="margin-top:6px">${isNew ? 'Produk EA baru' : v.name}</h1>
      <p>Rancang <b>apa</b> yang diserahkan (spesifikasi) dan <b>bagaimana</b> membuatnya (metode). Perubahan langsung berlaku untuk engagement yang sedang berjalan.</p></div>
      <div class="row"><button class="primary" disabled=${busy} onClick=${save}>${isNew ? 'Buat produk' : 'Simpan perubahan'}</button></div></div>

    <div class="studio">
      <div class="grid">
        <div class="card"><h2>1 · Spesifikasi produk</h2><div class="form">
          <div class="grid g2">
            <${Field} label="Nama produk" req><input ...${field('name')} placeholder="mis. Peta Kapabilitas Bisnis L1–L2" /><//>
            <${Field} label="Pelanggan"><input ...${field('customer')} placeholder="mis. Direksi, Kadiv Strategi" /><//>
          </div>
          <${Field} label="Keputusan yang didukung" req hint="Decision First: tanpa keputusan, produk ini tidak punya alasan untuk ada."><textarea ...${field('decision')}></textarea><//>
          <${Field} label="Deliverable" req hint="Apa yang diserahkan dan disahkan (TOGAF: deliverable berisi artefak)."><input ...${field('deliverable')} /><//>
          <${Field} label="Kapan produk ini dipakai"><textarea ...${field('when')}></textarea><//>
          <div class="grid g3">
            <${Field} label="Layanan EA (TOGAF)"><select onChange=${(e) => set('service', e.target.value)}><option value="" selected=${!v.service}>—</option>${pb.ea_services.map((x) => html`<option value=${x} selected=${v.service === x}>${x}</option>`)}${v.service && !pb.ea_services.includes(v.service) && html`<option value=${v.service} selected>${v.service}</option>`}</select><//>
            <${Field} label="Kode output SOP"><input ...${field('sop_output')} placeholder="O-S313-0x" /><//>
            <${Field} label="Mode default"><select onChange=${(e) => set('default_mode', Number(e.target.value))}>${pb.modes.map((m) => html`<option value=${m.id} selected=${Number(v.default_mode) === m.id}>M${m.id} · ${m.name}</option>`)}</select><//>
            <${Field} label="Versi"><input ...${field('version')} /><//>
            <${Field} label="Kematangan" hint="Draft → Teruji (≥1 engagement) → Baku"><select onChange=${(e) => set('maturity', e.target.value)}>${Object.keys(MATURITY).map((x) => html`<option value=${x} selected=${v.maturity === x}>${x}</option>`)}</select><//>
            <${Field} label="Rujukan metode"><input ...${field('ref')} placeholder="mis. TOGAF Phase B, modul belajar" /><//>
          </div></div></div>

        <div class="card"><h2>2 · Metode (resep kerja) <span class="small muted">${v.steps.length} langkah</span></h2>
          <div class="map-strip">${pb.stages.map((st) => { const n = v.steps.filter((x) => x.stage === st.id).length; return html`<div class=${'map-cell' + (n ? ' on' : '')}><b class="mono">${st.label}</b><span class="small">${n ? `${n} langkah metode` : 'resep umum'}</span></div>`; })}</div>
          ${v.steps.map((st, i) => html`<div class="step-card">
            <div class="row" style="align-items:flex-start">
              <span class="step-no">${i + 1}</span>
              <input style="flex:1;min-width:200px;font-weight:600" value=${st.title} placeholder="Judul langkah, mis. D2 · Business Object Discovery" onInput=${(e) => upd('steps', i, { title: e.target.value })} />
              <button class="sm ghost" title="Naik" onClick=${() => move('steps', i, -1)}>↑</button><button class="sm ghost" title="Turun" onClick=${() => move('steps', i, 1)}>↓</button><button class="sm ghost danger" title="Hapus" onClick=${() => confirm('Hapus langkah ini? Progres engagement yang sudah mencentangnya ikut tidak terlihat.') && del('steps', i)}>✕</button>
            </div>
            <div class="grid g2" style="margin-top:8px">
              <${Field} label="Dikerjakan di tahap" req><select onChange=${(e) => upd('steps', i, { stage: e.target.value })}>${pb.stages.map((x) => html`<option value=${x.id} selected=${st.stage === x.id}>${x.label} · ${x.name}</option>`)}</select><//>
              <${Field} label="Level ketinggian"><select onChange=${(e) => upd('steps', i, { altitude: e.target.value })}><option value="" selected=${!st.altitude}>—</option>${pb.altitudes.map((a) => html`<option value=${a.id} selected=${st.altitude === a.id}>${a.id} · ${a.name}</option>`)}</select><//>
            </div>
            <${Field} label="Cara mengerjakan"><textarea value=${st.how} onInput=${(e) => upd('steps', i, { how: e.target.value })} placeholder="Instruksi konkret: apa yang dilakukan, dengan siapa, pakai alat apa."></textarea><//>
            <div class="grid g2">
              <${Field} label="Hasil"><input value=${st.output} onInput=${(e) => upd('steps', i, { output: e.target.value })} placeholder="mis. Bab D2 di dokumen" /><//>
              <${Field} label="Rujukan"><input value=${st.ref} onInput=${(e) => upd('steps', i, { ref: e.target.value })} placeholder="mis. Modul 02" /><//>
            </div>
            <div class="grid g2" style="margin-top:8px">
              <div><label class="check"><input type="checkbox" checked=${!!st.artifact} onChange=${(e) => upd('steps', i, { artifact: e.target.checked ? { name: st.output || st.title, type: 'Deliverable', template: '' } : undefined })} /><span>Menghasilkan artefak terdaftar</span></label>
                ${st.artifact && html`<div class="form" style="padding-left:28px">
                  <input value=${st.artifact.name} placeholder="Nama artefak" onInput=${(e) => upd('steps', i, { artifact: { ...st.artifact, name: e.target.value } })} />
                  <div class="grid g2"><select onChange=${(e) => upd('steps', i, { artifact: { ...st.artifact, type: e.target.value } })}>${pb.artifact_types.map((t) => html`<option value=${t} selected=${st.artifact.type === t}>${t}</option>`)}</select>
                  <select onChange=${(e) => upd('steps', i, { artifact: { ...st.artifact, template: e.target.value } })}>${tplOptions(st.artifact.template)}</select></div></div>`}</div>
              <div><label class="check"><input type="checkbox" checked=${st.adr !== undefined} onChange=${(e) => upd('steps', i, { adr: e.target.checked ? '' : undefined })} /><span>Menghasilkan keputusan (ADR)</span></label>
                ${st.adr !== undefined && html`<div style="padding-left:28px"><input value=${st.adr} placeholder="Judul ADR bawaan (opsional)" onInput=${(e) => upd('steps', i, { adr: e.target.value })} /></div>`}</div>
            </div></div>`)}
          <button onClick=${() => add('steps', { title: '', stage: 'cultivate', altitude: 'L0', how: '', output: '', ref: '' })}>+ Tambah langkah</button>
        </div>

        <div class="card"><h2>3 · Template dokumen</h2>
          <p class="small muted" style="margin:-4px 0 10px">Kerangka bab dalam Markdown. Pengguna menyalinnya ke Word/Docs di penyimpanan resmi.</p>
          ${v.templates.map((t, i) => html`<div class="step-card">
            <div class="row"><input style="flex:1" value=${t.name} placeholder="Nama template" onInput=${(e) => upd('templates', i, { name: e.target.value, ...(t.fresh ? { id: slugify(e.target.value) } : {}) })} />
              <span class="mono small muted">${t.id}</span><button class="sm ghost danger" onClick=${() => del('templates', i)}>✕</button></div>
            <textarea class="mono" rows="12" style="margin-top:8px" value=${t.body} onInput=${(e) => upd('templates', i, { body: e.target.value })}></textarea></div>`)}
          <button onClick=${() => add('templates', { id: '', name: '', body: '# Judul deliverable\n\n## 1. …\n', fresh: true })}>+ Tambah template</button>
        </div>

        <div class="card"><h2>4 · Tools pendukung</h2>
          ${v.tools.map((t, i) => html`<div class="row" style="margin-bottom:8px">
            <input style="flex:2;min-width:180px" value=${t.name} placeholder="Nama tool/teknik, mis. CRUD Matrix" onInput=${(e) => upd('tools', i, { name: e.target.value })} />
            <input style="flex:1;min-width:120px" value=${t.ref} placeholder="Rujukan" onInput=${(e) => upd('tools', i, { ref: e.target.value })} />
            <select style="flex:1;min-width:140px" onChange=${(e) => upd('tools', i, { template: e.target.value })}>${tplOptions(t.template)}</select>
            <button class="sm ghost danger" onClick=${() => del('tools', i)}>✕</button></div>`)}
          <button onClick=${() => add('tools', { name: '', ref: '', template: '' })}>+ Tambah tool</button>
        </div>
        <div class="row" style="justify-content:flex-end"><button class="primary" disabled=${busy} onClick=${save}>${isNew ? 'Buat produk' : 'Simpan perubahan'}</button></div>
      </div>

      <aside class="grid side">
        <div class="card"><h2>Masukan perbaikan</h2>
          ${improvements.length ? improvements.map((f) => html`<div class="attn"><span class=${'dot ' + (f.status === 'Selesai' ? '' : 'stale')}></span><div style="flex:1">
            <div class="small"><b>${f.title}</b>${f.ecode && html` <span class="mono muted">${f.ecode}</span>`}</div>
            ${f.status === 'Selesai' ? html`<span class="small muted">Sudah diserap</span>` : html`<button class="sm" onClick=${() => absorb(f)}>Tandai sudah diserap</button>`}</div></div>`)
          : html`<div class="empty small">Lessons learned dari /harvest engagement yang memakai produk ini akan muncul di sini.</div>`}
        </div>
        <div class="card"><h2>Panduan merancang</h2><ol class="small" style="margin:0;padding-left:18px">
          <li><b>Keputusan dulu:</b> keputusan apa, oleh siapa? Kalau tidak jelas, ini belum produk.</li>
          <li><b>Deliverable:</b> apa yang disahkan? Artefak (catalog, matrix, diagram) mana yang ada di dalamnya?</li>
          <li><b>Metode:</b> urutkan langkah dari L0 ke L1. Parkir detail L2+ di catatan implementasi.</li>
          <li><b>Petakan</b> setiap langkah ke tahap Planting Seed. Kriteria yang perlu disetujui Sponsor sebaiknya selesai sebelum gerbang.</li>
          <li><b>Template</b> hanya untuk langkah yang menghasilkan dokumen. Jangan buat template yang belum pernah dipakai.</li>
          <li><b>Kematangan:</b> naik ke Teruji setelah dipakai ≥1 engagement, dan ke Baku setelah resep stabil.</li></ol></div>
      </aside>
    </div>`;
}

// ---------- decisions (ADR) ----------
function DecisionList({ pb, items, engagement, onChange, showEngagement }) {
  const [edit, setEdit] = useState(null);
  return html`<div class="row" style="justify-content:space-between;margin-bottom:10px">
      <span class="small muted">Context · Alternatives · Decision · Consequences. Deviasi dan trade-off wajib tercatat di sini.</span>
      <button class="primary sm" onClick=${() => setEdit({ engagement_id: engagement?.id || '' })}>+ ADR baru</button></div>
    ${items.length ? html`<div class="table-wrap"><table><thead><tr><th>Kode</th><th>Judul</th>${showEngagement && html`<th>Engagement</th>`}<th>Status</th><th>Diputuskan</th></tr></thead><tbody>
      ${items.map((d) => html`<tr class="link" onClick=${() => setEdit(d)}><td class="mono">${d.code}</td><td><b>${d.title}</b></td>
        ${showEngagement && html`<td class="small">${d.ecode ? html`<span class="mono">${d.ecode}</span> ${d.etitle}` : html`<span class="muted">Lintas engagement</span>`}</td>`}
        <td><span class="badge ${ADR_BADGE[d.status]}">${d.status}</span></td><td class="small muted">${d.decided_by ? `${d.decided_by}, ${fmtDate(d.decided_at)}` : `diusulkan ${fmtDate(d.created_at)}`}</td></tr>`)}
      </tbody></table></div>` : html`<div class="empty">Belum ada keputusan arsitektur.</div>`}
    ${edit && html`<${DecisionEditor} pb=${pb} d=${edit} lockEngagement=${!!engagement} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); onChange(); }} />`}`;
}

function DecisionEditor({ d, onClose, onSaved, lockEngagement }) {
  const isNew = !d.id;
  const [v, bind] = useForm({ ...d });
  const [engs] = useLoad(() => (lockEngagement ? Promise.resolve([]) : api('GET', '/engagements')));
  const [busy, setBusy] = useState(false);
  const save = async (status) => {
    setBusy(true);
    try {
      const body = { title: v.title, context: v.context, alternatives: v.alternatives, decision: v.decision, consequences: v.consequences, decided_by: v.decided_by, engagement_id: v.engagement_id ? Number(v.engagement_id) : null };
      if (isNew) await api('POST', '/decisions', body); else await api('PATCH', '/decisions/' + d.id, { ...body, ...(status ? { status } : {}) });
      toast(status ? `ADR ${status}` : 'ADR disimpan'); onSaved();
    } catch (x) { fail(x); }
    setBusy(false);
  };
  const final = d.status && d.status !== 'Proposed';
  return html`<${Modal} title=${isNew ? 'ADR baru' : `${d.code} · ${d.status}`} onClose=${onClose}
    footer=${html`<button onClick=${onClose}>Tutup</button>
      ${!isNew && d.status === 'Proposed' && html`<button class="danger" disabled=${busy} onClick=${() => save('Rejected')}>Tolak</button><button disabled=${busy} onClick=${() => save('Accepted')} class="primary">Sahkan (Accepted)</button>`}
      ${!isNew && d.status === 'Accepted' && html`<button disabled=${busy} onClick=${() => save('Superseded')}>Tandai Superseded</button>`}
      <button disabled=${busy} class=${isNew ? 'primary' : ''} onClick=${() => save()}>${isNew ? 'Usulkan (Proposed)' : 'Simpan'}</button>`}>
    <div class="form">
      ${final && html`<p class="alert info small" style="margin:0">Diputuskan oleh ${d.decided_by} pada ${fmtDate(d.decided_at)}.</p>`}
      <${Field} label="Judul keputusan" req><input ...${bind('title')} placeholder="mis. Ariba menjadi System of Record data vendor" /><//>
      ${!lockEngagement && html`<${Field} label="Engagement"><select ...${bind('engagement_id')} onChange=${bind('engagement_id').onInput}><option value="">— Lintas engagement / fondasi —</option>
        ${(engs || []).map((e) => html`<option value=${e.id} selected=${Number(v.engagement_id) === e.id}>${e.code} · ${e.title}</option>`)}</select><//>`}
      <${Field} label="Context" req hint="Masalah, batasan, dan pemicu keputusan"><textarea ...${bind('context')}></textarea><//>
      <${Field} label="Alternatives considered"><textarea ...${bind('alternatives')}></textarea><//>
      <${Field} label="Decision" hint="Wajib diisi sebelum disahkan"><textarea ...${bind('decision')}></textarea><//>
      <${Field} label="Consequences" hint="Dampak, risiko sisa, dan komitmen mitigasi"><textarea ...${bind('consequences')}></textarea><//>
      ${!isNew && html`<${Field} label="Diputuskan oleh" hint="Biasanya Sponsor (Accountable) untuk ADR yang menjadi mandat bisnis"><input ...${bind('decided_by')} /><//>`}
    </div><//>`;
}

function Decisions({ pb }) {
  const [items, reload] = useLoad(() => api('GET', '/decisions'));
  const [f, setF] = useState('');
  if (!items) return html`<p class="muted">Memuat…</p>`;
  const rows = f ? items.filter((d) => d.status === f) : items;
  return html`<div class="page-head"><div><h1>Keputusan Arsitektur (ADR)</h1><p>Log keputusan lintas engagement — bukti tata kelola (O-S313-04).</p></div>
      <select style="width:auto" value=${f} onChange=${(e) => setF(e.target.value)}><option value="">Semua status</option>${Object.keys(ADR_BADGE).map((s) => html`<option value=${s}>${s}</option>`)}</select></div>
    <div class="card flat"><${DecisionList} pb=${pb} items=${rows} onChange=${reload} showEngagement /></div>`;
}

// ---------- artifacts ----------
function ArtifactList({ items, engagement, onChange, showEngagement }) {
  const [edit, setEdit] = useState(null);
  return html`<div class="row" style="justify-content:space-between;margin-bottom:10px">
      <span class="small muted">No Orphan Architecture: setiap artefak punya Owner, Consumer, dan tujuan. Artefaknya sendiri tetap di tool asal.</span>
      <button class="primary sm" onClick=${() => setEdit({ engagement_id: engagement?.id || '', type: 'Deliverable', status: 'Draft' })}>+ Daftarkan artefak</button></div>
    ${items.length ? html`<div class="table-wrap"><table><thead><tr><th>Artefak</th>${showEngagement && html`<th>Engagement</th>`}<th>Owner</th><th>Consumer · tujuan</th><th>Status</th></tr></thead><tbody>
      ${items.map((a) => html`<tr class="link" onClick=${() => setEdit(a)}><td><b>${a.name}</b><div class="small muted">${a.type}${a.location && html` · <a href=${a.location} target="_blank" rel="noopener" onClick=${(e) => e.stopPropagation()}>buka</a>`}</div></td>
        ${showEngagement && html`<td class="small">${a.ecode ? html`<span class="mono">${a.ecode}</span>` : html`<span class="muted">Fondasi</span>`}</td>`}
        <td>${a.owner}</td><td class="small">${a.consumer}<div class="muted">${a.purpose}</div></td><td><span class="badge ${ART_BADGE[a.status]}">${a.status}</span></td></tr>`)}
      </tbody></table></div>` : html`<div class="empty">Belum ada artefak terdaftar.</div>`}
    ${edit && html`<${ArtifactEditor} a=${edit} lockEngagement=${!!engagement} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); onChange(); }} />`}`;
}

function ArtifactEditor({ a, onClose, onSaved, lockEngagement }) {
  const [pb] = useLoad(() => api('GET', '/playbook'));
  const [engs] = useLoad(() => (lockEngagement ? Promise.resolve([]) : api('GET', '/engagements')));
  const [v, bind] = useForm({ ...a });
  const isNew = !a.id;
  const save = async () => {
    try {
      const body = { name: v.name, type: v.type, owner: v.owner, consumer: v.consumer, purpose: v.purpose, location: v.location, status: v.status, step_ref: v.step_ref || null, engagement_id: v.engagement_id ? Number(v.engagement_id) : null };
      await (isNew ? api('POST', '/artifacts', body) : api('PATCH', '/artifacts/' + a.id, body));
      toast('Artefak disimpan'); onSaved();
    } catch (x) { fail(x); }
  };
  return html`<${Modal} title=${isNew ? 'Daftarkan artefak' : a.name} onClose=${onClose} footer=${html`<button onClick=${onClose}>Batal</button><button class="primary" onClick=${save}>Simpan</button>`}>
    <div class="form">
      <div class="grid g2">
        <${Field} label="Nama artefak" req><input ...${bind('name')} placeholder="mis. Capability Map L2 Procurement" /><//>
        <${Field} label="Jenis" req><select ...${bind('type')} onChange=${bind('type').onInput}>${(pb?.artifact_types || []).map((t) => html`<option value=${t} selected=${v.type === t}>${t}</option>`)}</select><//>
        <${Field} label="Owner pemeliharaan" req hint="Siapa yang merawat setelah proyek selesai"><input ...${bind('owner')} /><//>
        <${Field} label="Consumer" req hint="Siapa yang memakai artefak ini"><input ...${bind('consumer')} /><//>
      </div>
      <${Field} label="Tujuan penggunaan" req hint="Keputusan atau pekerjaan apa yang dibantu artefak ini"><textarea ...${bind('purpose')}></textarea><//>
      <div class="grid g2">
        <${Field} label="Lokasi (tautan)" hint="Repository, SharePoint, Archi, Git…"><input ...${bind('location')} placeholder="https://…" /><//>
        <${Field} label="Status"><select ...${bind('status')} onChange=${bind('status').onInput}>${Object.keys(ART_BADGE).map((s) => html`<option value=${s} selected=${v.status === s}>${s}</option>`)}</select><//>
      </div>
      ${!lockEngagement && html`<${Field} label="Engagement"><select ...${bind('engagement_id')} onChange=${bind('engagement_id').onInput}><option value="">— Aset fondasi (tanpa engagement) —</option>
        ${(engs || []).map((e) => html`<option value=${e.id} selected=${Number(v.engagement_id) === e.id}>${e.code} · ${e.title}</option>`)}</select><//>`}
    </div><//>`;
}

function Artifacts() {
  const [items, reload] = useLoad(() => api('GET', '/artifacts'));
  if (!items) return html`<p class="muted">Memuat…</p>`;
  return html`<div class="page-head"><div><h1>Register Artefak</h1><p>Indeks artefak bertuan. Bukan repository: artefaknya sendiri tetap tinggal di tool asalnya.</p></div></div>
    <div class="card flat"><${ArtifactList} items=${items} onChange=${reload} showEngagement /></div>`;
}

// ---------- foundation ----------
function Foundation({ pb }) {
  const [items, reload] = useLoad(() => api('GET', '/foundation'));
  const [v, bind, setV] = useForm({ title: '', kind: pb.foundation_kinds[0], description: '', product: '' });
  if (!items) return html`<p class="muted">Memuat…</p>`;
  const add = async (e) => { e.preventDefault(); try { await api('POST', '/foundation', v); setV({ ...v, title: '', description: '' }); reload(); } catch (x) { fail(x); } };
  const move = async (f, status) => { try { await api('PATCH', '/foundation/' + f.id, { status }); reload(); } catch (x) { fail(x); } };
  const cols = ['Backlog', 'Dikerjakan', 'Selesai'];
  return html`<div class="page-head"><div><h1>Backlog /foundation</h1><p>Perbaikan prinsip, metamodel, notasi, dan template. Diisi dari lessons learned /harvest atau pekerjaan Mode 4 Curator.</p></div></div>
    <form class="card row" onSubmit=${add} style="margin-bottom:16px;align-items:flex-end">
      <div style="flex:2;min-width:220px"><${Field} label="Item baru"><input ...${bind('title')} placeholder="mis. Standar penamaan entitas data MRT" /><//></div>
      <div style="flex:1;min-width:160px"><${Field} label="Jenis"><select ...${bind('kind')} onChange=${bind('kind').onInput}>${pb.foundation_kinds.map((k) => html`<option value=${k} selected=${v.kind === k}>${k}</option>`)}</select><//></div>
      <div style="flex:1;min-width:180px"><${Field} label="Resep produk"><select ...${bind('product')} onChange=${bind('product').onInput}><option value="" selected=${!v.product}>— Fondasi umum —</option>${pb.products.map((p) => html`<option value=${p.id} selected=${v.product === p.id}>${p.name}</option>`)}</select><//></div>
      <button class="primary" disabled=${!v.title.trim()}>Tambah</button></form>
    <div class="board" style="grid-template-columns:repeat(3,minmax(0,1fr))">${cols.map((c, ci) => html`<div class="col">
      <div class="col-head"><b>${c}</b><span class="small muted">${items.filter((f) => f.status === c).length}</span></div>
      ${items.filter((f) => f.status === c).map((f) => html`<div class="tile"><div class="row" style="justify-content:space-between"><span class="badge">${f.kind}</span>
          ${f.ecode && html`<a class="mono small" href=${'#/engagements/' + f.source_engagement_id}>${f.ecode}</a>`}</div>
        <div class="t">${f.title}</div>${f.product && html`<a class="badge accent" href=${'#/products/' + f.product}>${pb.products.find((p) => p.id === f.product)?.name || f.product}</a>`}${f.description && html`<div class="small muted">${f.description}</div>`}
        <div class="row" style="justify-content:flex-end;margin-top:6px">
          ${ci > 0 && html`<button class="ghost sm" onClick=${() => move(f, cols[ci - 1])}>← ${cols[ci - 1]}</button>`}
          ${ci < 2 && html`<button class="sm" onClick=${() => move(f, cols[ci + 1])}>${cols[ci + 1]} →</button>`}</div></div>`)}
    </div>`)}</div>`;
}

// ---------- playbook ----------
function Playbook({ pb }) {
  return html`<div class="page-head"><div><h1>Playbook EA</h1><p>Cara kerja yang dijalankan aplikasi ini. Sumber: ${pb.source}. Versi <code>${pb.version}</code>. Ubah lewat <code>playbook.json</code>.</p></div></div>
    <h2 style="margin-bottom:10px">6 prinsip fit-for-purpose</h2>
    <div class="grid g3">${pb.principles.map((p, i) => html`<div class="card"><h3>${i + 1}. ${p.name}</h3><p class="small muted" style="margin:6px 0 0">${p.text}</p></div>`)}</div>
    <h2 style="margin:24px 0 10px">4 Mode Keterlibatan EA</h2>
    <div class="grid g2">${pb.modes.map((m) => html`<div class="card"><div class="row" style="justify-content:space-between"><span class="badge m${m.id}">Mode ${m.id} · ${m.name}</span><span class="small muted">${m.touch} · bobot ${m.load}</span></div>
      <p class="small" style="margin:8px 0 4px"><b>Kapan:</b> ${m.when}</p><p class="small" style="margin:0 0 6px"><b>Peran EA:</b> ${m.ea_role}</p>
      <div class="row small">${m.stages.map((s) => html`<code>${stageById(pb, s).label}</code>`)}</div></div>`)}</div>
    <h2 style="margin:24px 0 10px">Gerbang & kriteria keluar</h2>
    <div class="grid g2">${pb.stages.map((s) => html`<div class="card"><h3><span class="mono">${s.label}</span> · ${s.name} <span class="badge">penyetuju: ${s.approver}</span></h3>
      <p class="small muted">${s.purpose}</p><ul class="small" style="margin:0;padding-left:18px">${pb.checklists[s.id].map((c) => html`<li>${c.text}${c.modes && html` <span class="muted">(Mode ${c.modes.join(', ')})</span>`}${c.optional && html` <span class="muted">(opsional)</span>`}</li>`)}</ul></div>`)}</div>
    <h2 style="margin:24px 0 10px">RACI</h2>
    <div class="card flat table-wrap"><table><thead><tr><th>Area keputusan</th>${pb.raci.roles.map((r) => html`<th>${r}</th>`)}</tr></thead>
      <tbody>${pb.raci.rows.map((r) => html`<tr><td>${r.area}</td>${r.values.map((x) => html`<td><span class=${'badge' + (x.includes('A') ? ' accent' : '')}>${x}</span></td>`)}</tr>`)}</tbody></table></div>`;
}

// ---------- root ----------
function App() {
  const route = useRoute();
  const [pb, reloadPb] = useLoad(() => api('GET', '/playbook'));
  const [t, setT] = useState(null);
  useEffect(() => { pushToast = (x) => { setT(x); setTimeout(() => setT(null), 3500); }; }, []);
  if (!pb) return html`<p style="padding:24px" class="muted">Memuat EA Desk…</p>`;
  const [a, b] = route;
  let page;
  if (!a) page = html`<${Dashboard} pb=${pb} />`;
  else if (a === 'engagements' && b === 'new') page = html`<${NewEngagement} pb=${pb} product=${route[2]} />`;
  else if (a === 'products' && b) page = html`<${ProductDetail} pb=${pb} id=${b} />`;
  else if (a === 'products') page = html`<${Products} pb=${pb} />`;
  else if (a === 'studio' && b === 'new') page = html`<${ProductEditor} pb=${pb} from=${route[2]} onSaved=${reloadPb} />`;
  else if (a === 'studio' && b) page = html`<${ProductEditor} pb=${pb} id=${b} onSaved=${reloadPb} />`;
  else if (a === 'studio') page = html`<${Studio} pb=${pb} />`;
  else if (a === 'engagements' && b) page = html`<${EngagementDetail} pb=${pb} id=${b} key=${b} />`;
  else if (a === 'engagements') page = html`<${Engagements} pb=${pb} />`;
  else if (a === 'decisions') page = html`<${Decisions} pb=${pb} />`;
  else if (a === 'artifacts') page = html`<${Artifacts} />`;
  else if (a === 'foundation') page = html`<${Foundation} pb=${pb} />`;
  else if (a === 'playbook') page = html`<${Playbook} pb=${pb} />`;
  else page = html`<div class="empty">Halaman tidak ditemukan.</div>`;
  return html`<div class="shell"><${Nav} route=${route} /><main key=${route.join('/')}>${page}</main>
    ${t && html`<div class=${'toast' + (t.err ? ' err' : '')} role="status">${t.msg}</div>`}</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
