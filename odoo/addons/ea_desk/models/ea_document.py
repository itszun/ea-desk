import re

from markupsafe import Markup, escape

from odoo import _, api, fields, models
from odoo.exceptions import UserError

TOKEN_RE = re.compile(r'\{\{\s*([\w.:\-]+)\s*\}\}')
STATE_ADR = {'proposed': 'Proposed', 'accepted': 'Accepted', 'rejected': 'Rejected', 'superseded': 'Superseded'}
STATE_ENG = {'active': 'Aktif', 'on_hold': 'Ditunda', 'closed': 'Selesai', 'cancelled': 'Dibatalkan'}


def cell(value):
    """Make a value safe inside a Markdown table cell."""
    return str(value or '—').replace('|', '\\|').replace('\r', '').replace('\n', '<br>')


def table(headers, rows):
    lines = ['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join(':--' for _ in headers) + ' |']
    lines += ['| ' + ' | '.join(cell(v) for v in row) + ' |' for row in rows]
    return '\n'.join(lines)


class EaDocumentRenderer(models.AbstractModel):
    """Builds deliverable documents from the Standar Struktur Deliverable EA.

    Governance data (identity, scope, decisions, issues, maintenance) always
    comes from EA Desk; product structure (method, chapters, standard content)
    from the EA product catalog; the analysis itself is left for the architect.
    See docs/adr/ADR-003 and ADR-004."""
    _name = 'ea.document.renderer'
    _description = 'Penyusun Dokumen Deliverable'

    # ------------------------------------------------------------------ validation
    @api.model
    def check(self, engagement, artifact=None):
        """Source completeness findings: level is 'block' or 'warn'."""
        e, p = engagement, engagement.product_id
        out = []

        def add(level, text, where):
            out.append({'level': level, 'text': text, 'where': where})

        if not p:
            add('block', _('Engagement belum memesan Produk EA, jadi tidak ada spesifikasi deliverable.'), _('Engagement → Produk EA'))
        else:
            if not p.service:
                add('block', _('Layanan EA (TOGAF) produk "%s" kosong.', p.name), _('Pembuatan Produk'))
            if not (p.document_scheme_id or self.env['ea.document.scheme'].default_scheme()):
                add('block', _('Tidak ada Skema Kode Dokumen untuk produk ini.'), _('Konfigurasi → Skema Kode Dokumen'))
            if not (p.doc_template_id or self.env.ref('ea_desk.template_standard_deliverable', raise_if_not_found=False)):
                add('block', _('Standar Struktur Deliverable tidak ditemukan.'), _('Konfigurasi'))
        if not e.classification_id:
            add('block', _('Klasifikasi informasi belum ditetapkan (produk maupun override engagement).'), _('Pembuatan Produk / Engagement'))

        for g in e.gate_ids:
            note = (g.note or '').strip().lower()
            if not note or 'lisan' in note:
                add('warn', _('Bukti persetujuan gerbang %(stage)s lemah ("%(note)s").', stage=g.stage_id.name, note=g.note or _('kosong')),
                    _('Catatan gerbang: tautkan notulen/email'))
        if artifact and not artifact.attachment_ids and not re.match(r'^https?://', artifact.location or ''):
            add('warn', _('Lokasi dokumen "%s" bukan tautan yang bisa dibuka konsumen.', artifact.location or _('kosong')), _('Register Artefak'))
        if p:
            reached = e.mode_id.flow().filtered(lambda s: s.sequence <= e.stage_id.sequence)
            for st in p.step_ids.filtered(lambda s: s.makes_adr and s.stage_id in reached):
                exists = e.decision_ids.filtered(lambda d: st.adr_title and st.adr_title.lower() in (d.name or '').lower()) if st.adr_title else e.decision_ids
                if not exists:
                    add('warn', _('Langkah "%s" seharusnya menghasilkan ADR, tetapi belum ada.', st.name), _('Tahap aktif → Buat ADR'))
            if p.default_mode_id and e.mode_id != p.default_mode_id:
                add('warn', _('Mode engagement (%(mode)s) berbeda dari mode bawaan produk (%(default)s).', mode=e.mode_id.display_name, default=p.default_mode_id.display_name),
                    _('Informasi'))
        return out

    # ------------------------------------------------------------------ rendering
    def _stamp(self, source, ctx):
        return f'> *⟳ Otomatis dari EA Desk · {source} · {ctx["ts"]}. Ubah di EA Desk, bukan di dokumen ini.*'

    @staticmethod
    def _manual(text):
        return f'> ✎ *Diisi manual:* {text}'

    @api.model
    def render(self, engagement, artifact):
        e, p = engagement, engagement.product_id
        template = p.doc_template_id or self.env.ref('ea_desk.template_standard_deliverable')
        now = fields.Datetime.context_timestamp(self, fields.Datetime.now())
        ctx = {'e': e, 'p': p, 'a': artifact, 'ts': now.strftime('%d-%m-%Y %H:%M'),
               'src': f'Produk "{p.name}" v{p.version} · {e.code}'}
        values = {
            'dokumen.judul': e.name, 'dokumen.kode': artifact.document_code or '', 'dokumen.versi': artifact.doc_version or '',
            'produk.nama': p.name, 'produk.versi': p.version, 'engagement.kode': e.code, 'engagement.sponsor': e.sponsor_id.name,
        }

        def replace(match):
            token = match.group(1)
            if token.startswith('blok:'):
                method = getattr(self, f'_block_{token[5:]}', None)
                return method(ctx) if method else f'⚠️ blok tidak dikenal: {token}'
            if token.startswith('konten:'):
                content = p.content_ids.filtered(lambda c: c.code == token[7:])[:1]
                return self._content(content, ctx) if content else f'⚠️ konten baku tidak ditemukan: {token[7:]}'
            return str(values[token]) if token in values else f'⚠️ token tidak dikenal: {token}'

        body = TOKEN_RE.sub(replace, template.body or '')
        # Number chapters marked "##§" in order, starting at 0 (Ringkasan Eksekutif).
        counter = iter(range(0, 999))
        return re.sub(r'(?m)^##§ ', lambda m: f'## {next(counter)}. ', body)

    def _content(self, content, ctx):
        return f'> *⟳ Konten baku produk "{ctx["p"].name}" v{ctx["p"].version}: {content.name}.*\n\n{content.body or ""}'

    def _block_lembar_kendali(self, ctx):
        e, p, a = ctx['e'], ctx['p'], ctx['a']
        service = dict(p._fields['service'].selection).get(p.service, '—')
        classification = e.classification_id.name + (' (override engagement)' if e.classification_override_id else ' (bawaan produk)')
        location = a.location or ', '.join(a.attachment_ids.mapped('name')) or '—'
        rows = [
            ('Judul', e.name), ('Kode dokumen', a.document_code), ('Versi', a.doc_version),
            ('Produk EA', f'{p.name} · v{p.version} · {dict(p._fields["maturity"].selection)[p.maturity]}'),
            ('Layanan EA (TOGAF)', service), ('Kode output SOP', p.sop_output), ('Klasifikasi informasi', classification),
            ('Engagement', f'{e.code} · {e.mode_id.display_name} · tahap {e.stage_id.name} · {STATE_ENG[e.state]}'
                           + (f' · target {e.target_date.strftime("%d-%m-%Y")}' if e.target_date else '')),
            ('Sponsor (pengesah)', e.sponsor_id.name), ('Domain Owner', e.domain_owner_id.name),
            ('Pemilik pemeliharaan', a.owner), ('Konsumen', a.consumer),
            ('Status dokumen', dict(a._fields['state'].selection)[a.state]), ('Lokasi resmi', location),
        ]
        return '\n'.join(['## Lembar Kendali Dokumen', self._stamp(ctx['src'], ctx), '', table(['Atribut', 'Nilai'], rows)])

    def _block_riwayat_versi(self, ctx):
        e, a = ctx['e'], ctx['a']
        rows = []
        for g in e.gate_ids:
            snap = a.attachment_ids.filtered(lambda att, g=g: att.name.endswith(f'_{g.stage_id.code}.md'))[:1]
            rows.append((g.stage_id.name, g.approved_by, fields.Datetime.context_timestamp(self, g.passed_date).strftime('%d-%m-%Y %H:%M'),
                         g.note, snap.name if snap else '—'))
        body = table(['Gerbang', 'Disetujui oleh', 'Tanggal', 'Bukti', 'Snapshot'], rows) if rows else '*Belum ada gerbang yang dilewati.*'
        return '\n'.join(['## Riwayat Versi & Persetujuan', self._stamp(f'riwayat gerbang {e.code}', ctx), '', body])

    def _block_ringkasan(self, ctx):
        e = ctx['e']
        counts = {k: len(e.decision_ids.filtered(lambda d, k=k: d.state == k)) for k in STATE_ADR}
        status = ', '.join(f'{n} {STATE_ADR[k]}' for k, n in counts.items() if n) or 'belum ada ADR'
        return '\n'.join([self._stamp(e.code, ctx), '',
                          f'- **Keputusan yang diminta:** {e.decision_needed}', f'- **Status keputusan:** {status}.', '',
                          self._manual('Situasi · Komplikasi · Rekomendasi · Keputusan yang dibutuhkan (SCQA), maksimal satu halaman. Diisi terakhir.')])

    def _block_tujuan(self, ctx):
        e, p = ctx['e'], ctx['p']
        lines = [self._stamp(ctx['src'], ctx), '',
                 f'Dokumen ini adalah deliverable produk EA **{p.name}**.' + (f' {p.when_to_use}' if p.when_to_use else ''), '',
                 f'- **Keputusan yang didukung produk:** {p.decision}',
                 f'- **Keputusan yang diminta Sponsor pada engagement ini:** {e.decision_needed}']
        if p.customer:
            lines.append(f'- **Pelanggan:** {p.customer}')
        lines.append(f'- **Bentuk deliverable:** {p.deliverable}')
        return '\n'.join(lines)

    def _block_ruang_lingkup(self, ctx):
        e = ctx['e']
        level = dict(e._fields['strategy_level'].selection).get(e.strategy_level, '—')
        risk = dict(e._fields['risk'].selection).get(e.risk, '—')
        rows = [('Business', e.slice_business), ('Data', e.slice_data), ('Application', e.slice_application), ('Technology', e.slice_technology)]
        return '\n'.join([self._stamp(f'Kanvas Scope {e.code}', ctx), '', f'**Masalah bisnis.** {e.problem or "—"}', '',
                          table(['Layer', 'Dalam lingkup'], rows), '',
                          f'Level strategi: {level} · Risiko arsitektur: {risk}', '', f'**Di luar lingkup:** {e.out_of_scope or "—"}'])

    def _method_steps(self, p):
        return p.step_ids.filtered(lambda s: s.step_type != 'governance').sorted(lambda s: (s.stage_id.sequence, s.sequence, s.id))

    def _block_metode(self, ctx):
        p = ctx['p']
        alt = dict(self.env['ea.product.step']._fields['altitude'].selection)
        rows = [(i, s.name, (alt.get(s.altitude) or '—').split(' ')[0], s.stage_id.name, s.output, s.ref)
                for i, s in enumerate(self._method_steps(p), start=1)]
        tools = ' · '.join(t.name for t in p.tool_ids)
        lines = [self._stamp(f'resep kerja produk "{p.name}" v{p.version}', ctx), '',
                 table(['#', 'Langkah', 'Ketinggian', 'Dikerjakan di', 'Hasil', 'Rujukan'], rows)]
        if tools:
            lines += ['', f'**Tools & teknik:** {tools}.']
        return '\n'.join(lines)

    def _block_bab_isi(self, ctx):
        e, p = ctx['e'], ctx['p']
        chapters = []
        for s in self._method_steps(p).filtered('doc_section'):
            parts = [f'##§ {s.section_title or s.name}']
            if s.content_id:
                parts += [self._content(s.content_id, ctx)]
            if s.makes_adr and s.adr_title:
                adr = e.decision_ids.filtered(lambda d, t=s.adr_title.lower(): t in (d.name or '').lower())[:1]
                status = f'{adr.code} · {STATE_ADR[adr.state]}' if adr else 'belum ada ADR'
                parts += [f'> *⟳ Status keputusan langkah ini: {status}.*']
            guide = s.how + (f' Hasil: {s.output}.' if s.output else '') if s.how else (s.output or '')
            parts += [self._manual(guide or 'isi analisis bab ini.')]
            chapters.append('\n\n'.join(parts))
        return '\n\n'.join(chapters)

    def _block_keputusan(self, ctx):
        e = ctx['e']
        rows = [(d.code, d.name,
                 f'Superseded → {d.superseded_by_id.code}' if d.state == 'superseded' and d.superseded_by_id else STATE_ADR[d.state],
                 d.decided_by,
                 fields.Datetime.context_timestamp(self, d.decided_date).strftime('%d-%m-%Y') if d.decided_date else '—')
                for d in e.decision_ids.sorted('code')]
        body = table(['ADR', 'Keputusan', 'Status', 'Diputuskan oleh', 'Tanggal'], rows) if rows else '*Belum ada keputusan arsitektur.*'
        return '\n'.join([self._stamp(f'ADR {e.code}; status terkini selalu di EA Desk', ctx), '', body, '',
                          '*Isi lengkap (Context · Alternatives · Decision · Consequences) tersedia di EA Desk.*'])

    def _block_isu_terbuka(self, ctx):
        e = ctx['e']
        issues = e.issue_ids.filtered(lambda i: i.state == 'open')
        proposed = e.decision_ids.filtered(lambda d: d.state == 'proposed')
        found = e.foundation_ids.filtered(lambda f: f.state != 'done')
        lines = [self._stamp(f'Isu & Asumsi, ADR Proposed, backlog /foundation {e.code}', ctx), '']
        if issues:
            kinds = dict(issues._fields['kind'].selection)
            lines += [table(['Kode', 'Isu / asumsi', 'Jenis', 'Penanggung jawab', 'Target', 'Tindak lanjut'],
                            [(i.code, i.name, kinds[i.kind], i.owner, i.due_date.strftime('%d-%m-%Y') if i.due_date else '', i.follow_up)
                             for i in issues]), '']
        else:
            lines += ['*Tidak ada isu atau asumsi terbuka.*', '']
        lines.append(f'- ADR menunggu keputusan: {", ".join(proposed.mapped("code")) if proposed else "tidak ada"}.')
        lines.append(f'- Backlog /foundation dari engagement ini: {", ".join(found.mapped("name")) if found else "tidak ada"}.')
        return '\n'.join(lines)

    def _block_pemeliharaan(self, ctx):
        e, a = ctx['e'], ctx['a']
        return '\n'.join([
            self._stamp('Register Artefak + Playbook', ctx), '',
            f'- **Pemilik pemeliharaan:** {a.owner}. **Konsumen:** {a.consumer}.',
            '- **Mekanisme perubahan:** perubahan isi diajukan sebagai ADR baru yang men-*supersede* ADR lama. '
            'Setelah engagement lulus gerbang /harvest, hasil yang disahkan masuk ke /foundation dan menjadi baseline. '
            'Revisi berikutnya dilakukan lewat engagement baru dengan produk yang sama.',
            f'- **Snapshot:** setiap kali gerbang dilewati, EA Desk menyimpan snapshot dokumen ini pada artefak {a.document_code}.',
        ])

    def _block_referensi(self, ctx):
        e, p, a = ctx['e'], ctx['p'], ctx['a']
        refs = [f'- Rujukan metode produk: {p.ref}.'] if p.ref else []
        refs += [f'- {t.name}: {t.ref}.' for t in p.tool_ids if t.ref]
        refs += [f'- Artefak masukan: {x.name} ({x.owner}), status {dict(x._fields["state"].selection)[x.state]}.'
                 for x in e.artifact_ids if x != a]
        return '\n'.join([self._stamp(ctx['src'], ctx), ''] + (refs or ['*—*']) + ['', self._manual('rujukan tambahan (standar, regulasi, literatur).')])

    # ------------------------------------------------------------------ generate & snapshot
    @api.model
    def generate(self, engagement, artifact, version=None):
        blockers = [f for f in self.check(engagement, artifact) if f['level'] == 'block']
        if blockers:
            raise UserError(_('Dokumen belum bisa dibuat:\n%s', '\n'.join(f'• {b["text"]}' for b in blockers)))
        vals = {}
        if not artifact.document_code:
            scheme = engagement.product_id.document_scheme_id or self.env['ea.document.scheme'].default_scheme()
            vals['document_code'] = scheme.next_code(engagement)
        if version:
            vals['doc_version'] = version
        if vals:
            artifact.write(vals)
        artifact.write({'doc_body': self.render(engagement, artifact), 'doc_generated_at': fields.Datetime.now()})
        return artifact

    @api.model
    def snapshot(self, engagement, gate):
        """Freeze every generated deliverable of the engagement when a gate is passed."""
        for artifact in engagement.artifact_ids.filtered('document_code'):
            if any(f['level'] == 'block' for f in self.check(engagement, artifact)):
                continue
            body = self.render(engagement, artifact)
            name = f'{artifact.document_code.replace("/", "-")}_v{artifact.doc_version}_{gate.stage_id.code}.md'
            att = self.env['ir.attachment'].create({'name': name, 'raw': body.encode(), 'mimetype': 'text/markdown',
                                                   'res_model': 'ea.artifact', 'res_id': artifact.id})
            artifact.write({'attachment_ids': [(4, att.id)], 'doc_body': body, 'doc_generated_at': fields.Datetime.now()})
            engagement.message_post(body=_('Snapshot %(name)s disimpan saat lulus gerbang %(stage)s.', name=name, stage=gate.stage_id.name))


class EaDocumentWizard(models.TransientModel):
    _name = 'ea.document.wizard'
    _description = 'Buat Dokumen Deliverable'

    engagement_id = fields.Many2one('ea.engagement', required=True)
    artifact_id = fields.Many2one('ea.artifact', 'Dokumen (artefak)', domain="[('engagement_id', '=', engagement_id), ('type', '=', 'deliverable')]",
                                  help='Kosong = artefak deliverable baru didaftarkan.')
    new_name = fields.Char('Nama artefak baru')
    owner = fields.Char('Pemilik pemeliharaan', default=lambda self: f'Enterprise Architect ({self.env.user.name})')
    version = fields.Char('Versi')
    findings_html = fields.Html('Validasi sumber', compute='_compute_findings', sanitize=False)
    blocked = fields.Boolean(compute='_compute_findings')

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        e = self.env['ea.engagement'].browse(res.get('engagement_id'))
        if e:
            arts = e.artifact_ids.filtered(lambda a: a.type == 'deliverable')
            art = arts.filtered('document_code')[:1] or arts.filtered(lambda a: a.step_id.product_id == e.product_id)[:1]
            res.update(artifact_id=art.id, version=art.doc_version or '0.1',
                       new_name=f'{e.product_id.deliverable or e.product_id.name or "Deliverable"} · {e.code}')
        return res

    @api.depends('engagement_id', 'artifact_id')
    def _compute_findings(self):
        icon = {'block': ('text-bg-danger', 'Memblokir'), 'warn': ('text-bg-warning', 'Peringatan')}
        for w in self:
            findings = self.env['ea.document.renderer'].check(w.engagement_id, w.artifact_id) if w.engagement_id else []
            w.blocked = any(f['level'] == 'block' for f in findings)
            if not findings:
                w.findings_html = Markup('<p class="text-success mb-0"><i class="fa fa-check"/> Semua sumber lengkap.</p>')
                continue
            rows = Markup('').join(
                Markup('<tr><td><span class="badge %s">%s</span></td><td>%s</td><td class="text-muted">%s</td></tr>')
                % (icon[f['level']][0], icon[f['level']][1], escape(f['text']), escape(f['where'])) for f in findings)
            w.findings_html = Markup('<table class="table table-sm mb-0"><thead><tr><th>Tingkat</th><th>Temuan</th>'
                                     '<th>Diperbaiki di</th></tr></thead><tbody>%s</tbody></table>') % rows

    def action_generate(self):
        self.ensure_one()
        e = self.engagement_id
        artifact = self.artifact_id
        if not artifact:
            workdoc = e.product_id.step_ids.filtered(lambda s: s.artifact_name and s.step_type == 'governance')[:1]
            artifact = self.env['ea.artifact'].create({
                'name': self.new_name or e.name, 'type': 'deliverable', 'engagement_id': e.id, 'step_id': workdoc.id,
                'owner': self.owner, 'consumer': e.sponsor_id.name, 'purpose': e.decision_needed,
            })
        self.env['ea.document.renderer'].generate(e, artifact, self.version)
        e.message_post(body=_('Dokumen %(code)s v%(ver)s dibuat dari Standar Struktur Deliverable.', code=artifact.document_code, ver=artifact.doc_version))
        return self.env['ea.template.preview'].open_document(artifact)
