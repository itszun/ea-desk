from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError

from .ea_config import ALTITUDES, ARTIFACT_TYPES

STATES = [('active', 'Aktif'), ('on_hold', 'Ditunda'), ('closed', 'Selesai'), ('cancelled', 'Dibatalkan')]


class EaEngagement(models.Model):
    """One request for EA services: an order of an EA product, run through the
    Planting Seed governance stages that its EA mode prescribes."""
    _name = 'ea.engagement'
    _description = 'Engagement EA'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'id desc'
    _rec_names_search = ['name', 'code']

    code = fields.Char('Kode', readonly=True, copy=False, default=lambda self: _('Baru'))
    name = fields.Char('Judul', required=True, tracking=True)
    product_id = fields.Many2one('ea.product', 'Produk EA', tracking=True, domain=[('maturity', '!=', 'obsolete')],
                                 help='Produk membawa resep kerja (metode), template, dan tools.')
    requester = fields.Char('Pemohon')
    sponsor_id = fields.Many2one('res.partner', 'Sponsor (Accountable)', required=True, tracking=True,
                                 help='Pengesah scope, blueprint L1–L2, dan ADR.')
    domain_owner_id = fields.Many2one('res.partner', 'Domain Owner', tracking=True)
    delivery_team = fields.Char('Delivery Team')
    decision_needed = fields.Text('Keputusan yang harus diambil Sponsor', required=True,
                                  help='Decision First: kalau ini kosong, belum ada alasan untuk membuat artefak.')
    problem = fields.Text('Business Problem Statement')
    strategy_level = fields.Selection([('corporate', 'Korporat'), ('business', 'Bisnis'), ('functional', 'Fungsional')], 'Level strategi')
    risk = fields.Selection([('low', 'Rendah'), ('medium', 'Sedang'), ('high', 'Tinggi')], 'Risiko arsitektur', default='medium')
    slice_business = fields.Text('Business', help='Capability L1/L2, proses yang tersentuh')
    slice_data = fields.Text('Data', help='Entitas informasi (M/R/T), sumber otoritatif')
    slice_application = fields.Text('Application', help='Aplikasi terdampak (SoRec/SoRef)')
    slice_technology = fields.Text('Technology', help='Platform/standar teknologi terkait')
    mode_id = fields.Many2one('ea.mode', 'Mode EA', required=True, tracking=True)
    out_of_scope = fields.Text('Di luar lingkup')
    classification_override_id = fields.Many2one('ea.info.classification', 'Klasifikasi (override)', tracking=True,
                                                 help='Kosongkan untuk memakai klasifikasi bawaan produk.')
    classification_id = fields.Many2one('ea.info.classification', 'Klasifikasi informasi', compute='_compute_classification')
    issue_ids = fields.One2many('ea.issue', 'engagement_id', 'Isu & asumsi', copy=False)
    issue_open_count = fields.Integer('Isu terbuka', compute='_compute_counts')
    mode_color = fields.Integer(related='mode_id.color')
    mode_load = fields.Integer('Beban kapasitas', related='mode_id.load', store=True)
    mode_role = fields.Text(related='mode_id.ea_role', string='Peran EA')
    stage_id = fields.Many2one('ea.stage', 'Tahap', tracking=True, group_expand='_group_expand_stages', copy=False,
                               domain="[('id', 'in', flow_stage_ids)]")
    flow_stage_ids = fields.Many2many(related='mode_id.stage_ids', string='Alur tahap')
    stage_purpose = fields.Text(related='stage_id.purpose')
    stage_approver = fields.Selection(related='stage_id.approver')
    state = fields.Selection(STATES, 'Status', default='active', required=True, tracking=True, copy=False)
    target_date = fields.Date('Target selesai')
    closed_date = fields.Datetime('Ditutup', readonly=True, copy=False)

    line_ids = fields.One2many('ea.engagement.line', 'engagement_id', copy=False)
    step_line_ids = fields.One2many('ea.engagement.line', 'engagement_id', 'Resep kerja',
                                    domain=[('kind', '=', 'step'), ('is_current', '=', True)])
    criterion_line_ids = fields.One2many('ea.engagement.line', 'engagement_id', 'Kriteria gerbang',
                                         domain=[('kind', '=', 'criterion'), ('is_current', '=', True)])
    gate_ids = fields.One2many('ea.gate.pass', 'engagement_id', 'Riwayat gerbang', copy=False)
    decision_ids = fields.One2many('ea.decision', 'engagement_id', 'Keputusan (ADR)', copy=False)
    artifact_ids = fields.One2many('ea.artifact', 'engagement_id', 'Artefak', copy=False)
    foundation_ids = fields.One2many('ea.foundation.item', 'engagement_id', 'Masukan /foundation', copy=False)

    gate_done = fields.Integer(compute='_compute_progress', store=True)
    gate_total = fields.Integer(compute='_compute_progress', store=True)
    gate_progress = fields.Float('Progres gerbang', compute='_compute_progress', store=True)
    gate_ready = fields.Boolean('Siap gerbang', compute='_compute_progress', store=True)
    missed_artifacts = fields.Text('Artefak tertinggal', compute='_compute_missed')
    template_ids = fields.Many2many('ea.product.template', string='Template dokumen', compute='_compute_template_ids',
                                    help='Template produk ditambah template umum; tersedia di semua tahap.')
    decision_count = fields.Integer(compute='_compute_counts')
    artifact_count = fields.Integer(compute='_compute_counts')

    @api.model
    def _group_expand_stages(self, stages, domain):
        return stages.search([])

    @api.depends('line_ids.done', 'line_ids.is_current', 'line_ids.optional', 'state')
    def _compute_progress(self):
        for e in self:
            required = e.line_ids.filtered(lambda l: l.kind == 'criterion' and l.is_current and not l.optional)
            e.gate_total = len(required)
            e.gate_done = len(required.filtered('done'))
            e.gate_progress = 100.0 * e.gate_done / e.gate_total if e.gate_total else 0.0
            e.gate_ready = e.state == 'active' and e.gate_total > 0 and e.gate_done == e.gate_total

    @api.depends('line_ids.artifact_id', 'stage_id')
    def _compute_missed(self):
        for e in self:
            flow = e.mode_id.flow() if e.mode_id else self.env['ea.stage']
            earlier = flow.filtered(lambda s: e.stage_id and s.sequence < e.stage_id.sequence)
            missed = e.line_ids.filtered(lambda l: l.kind == 'step' and l.stage_id in earlier and l.step_id.artifact_name and not l.artifact_id)
            e.missed_artifacts = '\n'.join(f'• {l.name} ({l.stage_id.name})' for l in missed) if e.state == 'active' else False

    @api.depends('product_id.template_ids')
    def _compute_template_ids(self):
        generic = self.env['ea.product.template'].search([('product_id', '=', False)])
        for e in self:
            e.template_ids = e.product_id.template_ids | generic

    @api.depends('classification_override_id', 'product_id.classification_id')
    def _compute_classification(self):
        for e in self:
            e.classification_id = e.classification_override_id or e.product_id.classification_id

    def _compute_counts(self):
        for e in self:
            e.decision_count = len(e.decision_ids)
            e.artifact_count = len(e.artifact_ids)
            e.issue_open_count = len(e.issue_ids.filtered(lambda i: i.state == 'open'))

    # ------------------------------------------------------------------ lifecycle
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('code', _('Baru')) == _('Baru'):
                vals['code'] = self.env['ir.sequence'].next_by_code('ea.engagement') or _('Baru')
            if not vals.get('stage_id') and vals.get('mode_id'):
                vals['stage_id'] = self.env['ea.mode'].browse(vals['mode_id']).flow()[:1].id
        records = super().create(vals_list)
        for e in records:
            e._generate_lines()
            e.message_post(body=_('Engagement dibuka — %s', e.mode_id.display_name))
        return records

    def write(self, vals):
        if 'state' in vals and vals['state'] == 'closed' and not self.env.context.get('ea_gate_closing'):
            raise UserError(_('Engagement hanya bisa ditutup lewat gerbang /harvest.'))
        if 'mode_id' in vals:
            for e in self:
                if e.mode_id.id != vals['mode_id'] and e.stage_id != e.mode_id.flow()[:1]:
                    raise UserError(_('Mode hanya bisa diubah selama tahap pertama. Untuk perubahan besar, catat ADR dan buka engagement baru.'))
        if self.filtered(lambda e: e.state == 'closed') and not self.env.context.get('ea_gate_closing') and set(vals) - {'message_main_attachment_id'}:
            raise UserError(_('Engagement sudah ditutup.'))
        res = super().write(vals)
        if {'mode_id', 'product_id'} & set(vals):
            for e in self:
                e._generate_lines(reset=True)
        return res

    def _steps_for(self, stage):
        """Resep kerja: the product's steps for a stage, else the generic Planting Seed steps."""
        Step = self.env['ea.product.step']
        own = Step.search([('product_id', '=', self.product_id.id), ('stage_id', '=', stage.id)]) if self.product_id else Step
        return own or Step.search([('product_id', '=', False), ('stage_id', '=', stage.id)])

    def _generate_lines(self, reset=False):
        """Create checklist lines for the current stage. With reset, drop the
        current stage's unticked lines first (mode or product changed)."""
        Line = self.env['ea.engagement.line']
        for e in self.filtered('stage_id'):
            current = e.line_ids.filtered(lambda l: l.stage_id == e.stage_id)
            if reset:
                current.filtered(lambda l: not l.done).unlink()
                current = current.exists()
            vals = []
            for c in e.stage_id.criterion_ids.applies_to(e.mode_id):
                if c not in current.criterion_id:
                    vals.append({'engagement_id': e.id, 'stage_id': e.stage_id.id, 'kind': 'criterion', 'criterion_id': c.id,
                                 'name': c.name, 'optional': c.optional, 'sequence': c.sequence})
            for st in e._steps_for(e.stage_id):
                if st not in current.step_id:
                    vals.append({'engagement_id': e.id, 'stage_id': e.stage_id.id, 'kind': 'step', 'step_id': st.id,
                                 'name': st.name, 'sequence': st.sequence})
            Line.create(vals)

    # ------------------------------------------------------------------ actions
    def action_open_gate(self):
        self.ensure_one()
        if self.state != 'active':
            raise UserError(_('Hanya engagement aktif yang bisa melewati gerbang.'))
        if not self.gate_ready:
            raise UserError(_('Kriteria keluar %(stage)s belum lengkap (%(done)s/%(total)s).', stage=self.stage_id.name, done=self.gate_done, total=self.gate_total))
        approver = self.sponsor_id.name if self.stage_id.approver == 'sponsor' else 'Enterprise Architect'
        return {
            'type': 'ir.actions.act_window', 'name': _('Gerbang %s', self.stage_id.name), 'res_model': 'ea.gate.wizard',
            'view_mode': 'form', 'target': 'new',
            'context': {'default_engagement_id': self.id, 'default_approved_by': approver},
        }

    def pass_gate(self, approved_by, note=False, lessons=()):
        self.ensure_one()
        if self.state != 'active':
            raise UserError(_('Hanya engagement aktif yang bisa melewati gerbang.'))
        if not (approved_by or '').strip():
            raise UserError(_('Nama penyetuju gerbang wajib diisi.'))
        if not self.gate_ready:
            raise UserError(_('Kriteria keluar %(stage)s belum lengkap (%(done)s/%(total)s).', stage=self.stage_id.name, done=self.gate_done, total=self.gate_total))
        flow = self.mode_id.flow()
        is_last = self.stage_id == flow[-1:]
        if is_last:
            drafts = self.artifact_ids.filtered(lambda a: a.state == 'draft')
            if drafts:
                raise UserError(_('Masih ada %s artefak berstatus Draft. Sahkan, harvest, atau tandai usang sebelum menutup engagement.', len(drafts)))
        stage = self.stage_id
        gate = self.env['ea.gate.pass'].create({'engagement_id': self.id, 'stage_id': stage.id, 'approved_by': approved_by.strip(), 'note': note})
        for lesson in lessons:
            if (lesson.get('name') or '').strip():
                self.env['ea.foundation.item'].create({
                    'name': lesson['name'].strip(), 'kind': lesson.get('kind') or 'process',
                    'engagement_id': self.id, 'product_id': self.product_id.id,
                })
        self.env['ea.document.renderer'].snapshot(self, gate)
        if is_last:
            self.artifact_ids.filtered(lambda a: a.state == 'approved').write({'state': 'harvested'})
            self.with_context(ea_gate_closing=True).write({'state': 'closed', 'closed_date': fields.Datetime.now()})
            self.message_post(body=_('Lulus gerbang %(stage)s (disetujui %(by)s) — engagement ditutup, artefak disahkan masuk seedbank.', stage=stage.name, by=approved_by))
        else:
            nxt = flow[list(flow).index(stage) + 1]
            self.write({'stage_id': nxt.id})
            self._generate_lines()
            self.message_post(body=_('Lulus gerbang %(stage)s (disetujui %(by)s) → masuk %(next)s', stage=stage.name, by=approved_by, next=nxt.name))
        return True

    def action_hold(self):
        self.write({'state': 'on_hold'})

    def action_resume(self):
        self.write({'state': 'active'})

    def action_cancel(self):
        self.write({'state': 'cancelled'})

    def action_generate_document(self):
        self.ensure_one()
        return {'type': 'ir.actions.act_window', 'name': _('Buat dokumen deliverable'), 'res_model': 'ea.document.wizard',
                'view_mode': 'form', 'target': 'new', 'context': {'default_engagement_id': self.id}}

    def action_view_decisions(self):
        return self._related_action('ea.decision', _('Keputusan (ADR)'))

    def action_view_artifacts(self):
        return self._related_action('ea.artifact', _('Artefak'))

    def _related_action(self, model, name):
        self.ensure_one()
        return {'type': 'ir.actions.act_window', 'name': name, 'res_model': model, 'view_mode': 'list,form',
                'domain': [('engagement_id', '=', self.id)], 'context': {'default_engagement_id': self.id}}


class EaEngagementLine(models.Model):
    """A gate criterion or a recipe step of one engagement stage."""
    _name = 'ea.engagement.line'
    _description = 'Checklist Engagement'
    _order = 'stage_sequence, kind, sequence, id'

    engagement_id = fields.Many2one('ea.engagement', required=True, ondelete='cascade', index=True)
    stage_id = fields.Many2one('ea.stage', required=True)
    stage_sequence = fields.Integer('Urutan tahap', related='stage_id.sequence', store=True)
    kind = fields.Selection([('criterion', 'Kriteria gerbang'), ('step', 'Langkah resep')], required=True)
    criterion_id = fields.Many2one('ea.gate.criterion', ondelete='set null')
    step_id = fields.Many2one('ea.product.step', ondelete='set null')
    name = fields.Text(required=True)
    sequence = fields.Integer(default=10)
    optional = fields.Boolean()
    done = fields.Boolean('Selesai')
    done_date = fields.Datetime(readonly=True)
    done_by = fields.Many2one('res.users', readonly=True)
    is_current = fields.Boolean(compute='_compute_is_current', store=True)
    is_next = fields.Boolean('Mulai di sini', compute='_compute_is_next')
    hint = fields.Char('Penanda', compute='_compute_is_next')
    how = fields.Text(related='step_id.how', string='Cara mengerjakan')
    output = fields.Char(related='step_id.output', string='Hasil')
    altitude = fields.Selection(related='step_id.altitude')
    ref = fields.Char(related='step_id.ref', string='Rujukan')
    template_id = fields.Many2one(related='step_id.template_id')
    artifact_name = fields.Char(related='step_id.artifact_name')
    makes_adr = fields.Boolean(related='step_id.makes_adr')
    artifact_id = fields.Many2one('ea.artifact', compute='_compute_artifact', string='Artefak terdaftar')

    @api.depends('stage_id', 'engagement_id.stage_id')
    def _compute_is_current(self):
        for line in self:
            line.is_current = line.stage_id == line.engagement_id.stage_id

    @api.depends('done', 'is_current')
    def _compute_is_next(self):
        for line in self:
            siblings = line.engagement_id.line_ids.filtered(lambda l: l.kind == 'step' and l.is_current and not l.done)
            line.is_next = line.kind == 'step' and bool(siblings) and siblings.sorted(lambda l: (l.sequence, l.id))[0] == line
            line.hint = 'Mulai di sini' if line.is_next else False

    def _compute_artifact(self):
        Artifact = self.env['ea.artifact']
        for line in self:
            line.artifact_id = Artifact.search([('engagement_id', '=', line.engagement_id.id), ('step_id', '=', line.step_id.id)], limit=1) if line.step_id else False

    def write(self, vals):
        if 'done' in vals:
            for line in self:
                if line.engagement_id.state != 'active' or not line.is_current:
                    raise UserError(_('Hanya checklist tahap aktif pada engagement aktif yang bisa diubah.'))
            vals.update(done_date=fields.Datetime.now() if vals['done'] else False, done_by=self.env.uid if vals['done'] else False)
        return super().write(vals)

    def action_view_template(self):
        self.ensure_one()
        return self.template_id.action_open_preview()

    def action_register_artifact(self):
        self.ensure_one()
        e = self.engagement_id
        return {'type': 'ir.actions.act_window', 'name': _('Daftarkan artefak'), 'res_model': 'ea.artifact', 'view_mode': 'form', 'target': 'new',
                'context': {'default_engagement_id': e.id, 'default_step_id': self.step_id.id, 'default_name': self.step_id.artifact_name,
                            'default_type': self.step_id.artifact_type or 'deliverable', 'default_consumer': e.sponsor_id.name,
                            'default_purpose': _('%(out)s, untuk keputusan: %(dec)s', out=self.step_id.output or self.name, dec=e.decision_needed)}}

    def action_new_adr(self):
        self.ensure_one()
        return {'type': 'ir.actions.act_window', 'name': _('ADR baru'), 'res_model': 'ea.decision', 'view_mode': 'form', 'target': 'new',
                'context': {'default_engagement_id': self.engagement_id.id, 'default_name': self.step_id.adr_title or ''}}


class EaGatePass(models.Model):
    _name = 'ea.gate.pass'
    _description = 'Catatan Lulus Gerbang'
    _order = 'passed_date, id'

    engagement_id = fields.Many2one('ea.engagement', required=True, ondelete='cascade', index=True)
    stage_id = fields.Many2one('ea.stage', 'Gerbang', required=True)
    approved_by = fields.Char('Disetujui oleh', required=True)
    note = fields.Text('Catatan / bukti persetujuan')
    passed_date = fields.Datetime('Tanggal', default=fields.Datetime.now, required=True)

    @api.constrains('approved_by')
    def _check_approver(self):
        if any(not (g.approved_by or '').strip() for g in self):
            raise ValidationError(_('Nama penyetuju gerbang wajib diisi.'))
