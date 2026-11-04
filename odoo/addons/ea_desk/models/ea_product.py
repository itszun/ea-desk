import re
import unicodedata

from odoo import api, fields, models
from odoo.exceptions import ValidationError

from .ea_config import ALTITUDES, ARTIFACT_TYPES

EA_SERVICES = [
    ('svc1', 'Enterprise Support (C-level)'),
    ('svc2', 'Design Support (program)'),
    ('svc3', 'Development Support (proyek)'),
    ('svc4', 'Requirements Elicitation & Understanding'),
    ('svc5', 'Architecture Planning (internal)'),
    ('svc6', 'EA Practice Development (internal)'),
]
MATURITIES = [('draft', 'Draft'), ('tested', 'Teruji'), ('standard', 'Baku'), ('obsolete', 'Usang')]


def slugify(text):
    text = unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:40] or 'item'


class EaProduct(models.Model):
    """An EA product: a standardised EA service (TOGAF EA Services) with its own
    production method. Planting Seed governs *when*; the product's steps say *how*."""
    _name = 'ea.product'
    _description = 'Produk EA'
    _inherit = ['mail.thread']
    _order = 'name'

    name = fields.Char('Nama produk', required=True, tracking=True)
    code = fields.Char('Kode', copy=False)
    active = fields.Boolean(default=True)
    sop_output = fields.Char('Kode output SOP')
    service = fields.Selection(EA_SERVICES, 'Layanan EA (TOGAF)')
    customer = fields.Char('Pelanggan')
    decision = fields.Text('Keputusan yang didukung', required=True,
                           help='Decision First: tanpa keputusan, produk ini tidak punya alasan untuk ada.')
    when_to_use = fields.Text('Kapan dipakai')
    deliverable = fields.Char('Deliverable', required=True)
    default_mode_id = fields.Many2one('ea.mode', 'Mode default')
    version = fields.Char('Versi', default='0.1', tracking=True)
    maturity = fields.Selection(MATURITIES, 'Kematangan', default='draft', required=True, tracking=True)
    ref = fields.Char('Rujukan metode')
    classification_id = fields.Many2one('ea.info.classification', 'Klasifikasi informasi',
                                        help='Klasifikasi bawaan deliverable produk ini. Bisa di-override per engagement.')
    document_scheme_id = fields.Many2one('ea.document.scheme', 'Skema kode dokumen', help='Kosong = skema bawaan.')
    doc_template_id = fields.Many2one('ea.product.template', 'Template dokumen utama',
                                      domain="['|', ('product_id', '=', id), ('product_id', '=', False)]",
                                      help='Kosong = Standar Struktur Deliverable EA.')
    content_ids = fields.One2many('ea.product.content', 'product_id', 'Konten baku')
    step_ids = fields.One2many('ea.product.step', 'product_id', 'Metode (resep kerja)', copy=True)
    template_ids = fields.One2many('ea.product.template', 'product_id', 'Template', copy=True)
    tool_ids = fields.One2many('ea.product.tool', 'product_id', 'Tools', copy=True)
    engagement_ids = fields.One2many('ea.engagement', 'product_id', 'Engagement')
    engagement_count = fields.Integer(compute='_compute_counts')
    improvement_ids = fields.One2many('ea.foundation.item', 'product_id', 'Masukan perbaikan')
    improvement_open_count = fields.Integer('Masukan terbuka', compute='_compute_counts')
    stage_map = fields.Char('Pemetaan ke Planting Seed', compute='_compute_stage_map')

    _sql_constraints = [('code_uniq', 'unique(code)', 'Kode produk harus unik.')]

    @api.depends('engagement_ids', 'improvement_ids.state')
    def _compute_counts(self):
        for p in self:
            p.engagement_count = len(p.engagement_ids)
            p.improvement_open_count = len(p.improvement_ids.filtered(lambda f: f.state != 'done'))

    @api.depends('step_ids.stage_id')
    def _compute_stage_map(self):
        stages = self.env['ea.stage'].search([])
        for p in self:
            parts = []
            for s in stages:
                n = len(p.step_ids.filtered(lambda st: st.stage_id == s))
                parts.append(f"{s.name}: {n} langkah" if n else f"{s.name}: resep umum")
            p.stage_map = ' · '.join(parts)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('code'):
                base = code = slugify(vals.get('name'))
                n = 2
                while self.search_count([('code', '=', code)], limit=1):
                    code, n = f'{base}-{n}', n + 1
                vals['code'] = code
        return super().create(vals_list)

    def copy(self, default=None):
        # Copy the method by hand so steps and tools point at the copy's own templates.
        default = dict(default or {}, step_ids=[], template_ids=[], tool_ids=[], content_ids=[])
        new = super().copy(default)
        for src, dst in zip(self, new):
            tmap = {t.id: t.copy({'product_id': dst.id}).id for t in src.template_ids}
            cmap = {c.id: c.copy({'product_id': dst.id}).id for c in src.content_ids}
            if src.doc_template_id.id in tmap:
                dst.doc_template_id = tmap[src.doc_template_id.id]
            for st in src.step_ids:
                st.copy({'product_id': dst.id, 'template_id': tmap.get(st.template_id.id, st.template_id.id),
                         'content_id': cmap.get(st.content_id.id, False)})
            for tool in src.tool_ids:
                tool.copy({'product_id': dst.id, 'template_id': tmap.get(tool.template_id.id, False)})
        return new

    def copy_data(self, default=None):
        default = dict(default or {})
        vals_list = super().copy_data(default)
        for product, vals in zip(self, vals_list):
            vals.update(name=default.get('name', f'{product.name} (salinan)'), version='0.1', maturity='draft')
        return vals_list

    @api.model
    def _ea_apply_doc_defaults(self):
        """Fill the document-related product attributes introduced in 18.0.1.3.0.
        Only empty values are filled, so edits made in Pembuatan Produk survive."""
        internal = self.env.ref('ea_desk.classification_internal', raise_if_not_found=False)
        services = {'domain-data': 'svc1', 'alignment-review': 'svc3', 'tech-assessment': 'svc1'}
        governance = {'domain-data': {'decision', 'workdoc', 'curate'}}
        chapters = {
            'domain-data': {'d1': 'Prinsip & Kriteria Domain (D1)', 'd2': 'Business Object Catalog (D2)', 'd3': 'CRUD Matrix (D3)',
                            'd4': 'Domain Map & Definition Sheet (D4–D5)', 'd6': 'Fit-Gap & Uji Stabilitas (D6–D7)'},
            'alignment-review': {'check': 'Hasil Pemeriksaan Kepatuhan'},
            'tech-assessment': {'abb': 'Kebutuhan Logis (ABB)', 'options': 'Perbandingan Opsi'},
        }
        for p in self.with_context(active_test=False).search([]):
            if not p.classification_id and internal:
                p.classification_id = internal
            if not p.service and p.code in services:
                p.service = services[p.code]
            for st in p.step_ids.filtered(lambda s: not s.step_type):
                title = chapters.get(p.code, {}).get(st.code)
                st.write({'step_type': 'governance' if st.code in governance.get(p.code, ()) else 'method',
                          'doc_section': bool(title), 'section_title': title or False})
        domain_data = self.search([('code', '=', 'domain-data')], limit=1)
        if domain_data and not domain_data.content_ids:
            content = self.env['ea.product.content'].create({
                'product_id': domain_data.id, 'code': 'kriteria-domain', 'name': 'Kriteria uji domain',
                'body': '| ID | Kriteria | Cara menguji |\n| :-- | :-- | :-- |\n'
                        '| K1 | Domain = batas tanggung jawab (ada satu pemilik yang akuntabel) | Bisa sebut satu jabatan pemilik? |\n'
                        '| K2 | Nama merujuk ke benda yang dikelola, bukan unit organisasi | Tes reorganisasi: tetap benar bila divisi digabung? |\n'
                        '| K3 | Tidak bergantung pada aplikasi | Tes ganti aplikasi: tetap benar bila sistem diganti? |\n'
                        '| K4 | Relevan bagi pengambil keputusan | Tes "so what": direktur peduli? |\n',
            })
            domain_data.step_ids.filtered(lambda s: s.code == 'd1').write({'content_id': content.id})
        # Generic (product-less) steps are Planting Seed governance steps.
        self.env['ea.product.step'].search([('product_id', '=', False), ('step_type', '=', False)]).write({'step_type': 'governance'})

    def action_view_engagements(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window', 'name': f'Engagement · {self.name}', 'res_model': 'ea.engagement',
            'view_mode': 'list,kanban,form', 'domain': [('product_id', '=', self.id)],
            'context': {'default_product_id': self.id},
        }

    def action_new_engagement(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window', 'name': 'Engagement baru', 'res_model': 'ea.engagement', 'view_mode': 'form',
            'context': {'default_product_id': self.id, 'default_mode_id': self.default_mode_id.id},
        }


class EaProductStep(models.Model):
    """One step of a product method, mapped to the Planting Seed stage it is done in.
    Steps without a product are the generic Planting Seed recipe."""
    _name = 'ea.product.step'
    _description = 'Langkah Metode Produk'
    _order = 'product_id, stage_sequence, sequence, id'

    product_id = fields.Many2one('ea.product', 'Produk', ondelete='cascade', index=True,
                                 help='Kosong = langkah resep umum Planting Seed.')
    sequence = fields.Integer(default=10)
    stage_id = fields.Many2one('ea.stage', 'Dikerjakan di tahap', required=True)
    stage_sequence = fields.Integer('Urutan tahap', related='stage_id.sequence', store=True)
    code = fields.Char('Kode langkah', copy=False)
    name = fields.Char('Langkah', required=True)
    altitude = fields.Selection(ALTITUDES, 'Ketinggian')
    how = fields.Text('Cara mengerjakan')
    output = fields.Char('Hasil')
    ref = fields.Char('Rujukan')
    artifact_name = fields.Char('Artefak yang dihasilkan', help='Isi bila langkah ini menghasilkan artefak yang didaftarkan.')
    artifact_type = fields.Selection(ARTIFACT_TYPES, 'Jenis artefak', default='deliverable')
    template_id = fields.Many2one('ea.product.template', 'Template', domain="[('product_id', '=', product_id)]")
    makes_adr = fields.Boolean('Menghasilkan ADR')
    adr_title = fields.Char('Judul ADR bawaan')
    step_type = fields.Selection([('method', 'Metode'), ('governance', 'Tata kelola')], 'Jenis langkah',
                                 help='Metode = cara menyusun isi deliverable (masuk bab Metode). '
                                      'Tata kelola = mengelola engagement (tidak masuk dokumen).')
    doc_section = fields.Boolean('Jadi bab dokumen', help='Langkah ini menghasilkan satu bab isi pada dokumen deliverable.')
    section_title = fields.Char('Judul bab', help='Kosong = memakai nama langkah.')
    content_id = fields.Many2one('ea.product.content', 'Konten baku di bab ini', domain="[('product_id', '=', product_id)]")


class EaProductTemplate(models.Model):
    _name = 'ea.product.template'
    _description = 'Template Dokumen Produk'
    _order = 'product_id, name'

    product_id = fields.Many2one('ea.product', 'Produk', ondelete='cascade', index=True,
                                 help='Kosong = template umum Planting Seed.')
    code = fields.Char()
    name = fields.Char('Nama template', required=True)
    body = fields.Text('Isi (Markdown)', help='Kerangka bab. Pengguna menyalinnya ke Word/Docs di penyimpanan resmi.')

    def action_open_preview(self):
        """Open the template as an editable textarea copy; edits are never saved back."""
        self.ensure_one()
        preview = self.env['ea.template.preview'].create({'template_id': self.id, 'body': self.body})
        return {'type': 'ir.actions.act_window', 'name': self.name, 'res_model': 'ea.template.preview',
                'res_id': preview.id, 'view_mode': 'form', 'target': 'new'}


class EaTemplatePreview(models.TransientModel):
    _name = 'ea.template.preview'
    _description = 'Pratinjau Template'

    template_id = fields.Many2one('ea.product.template', ondelete='cascade')
    artifact_id = fields.Many2one('ea.artifact', ondelete='cascade')
    product_id = fields.Many2one(related='template_id.product_id')
    body = fields.Text('Isi template')

    @api.model
    def open_document(self, artifact):
        preview = self.create({'artifact_id': artifact.id, 'body': artifact.doc_body})
        return {'type': 'ir.actions.act_window', 'name': f'{artifact.document_code} · v{artifact.doc_version}',
                'res_model': self._name, 'res_id': preview.id, 'view_mode': 'form', 'target': 'new'}

    def action_download(self):
        self.ensure_one()
        url = (f'/ea_desk/document/{self.artifact_id.id}/download' if self.artifact_id
               else f'/ea_desk/template/{self.template_id.id}/download')
        return {'type': 'ir.actions.act_url', 'url': url, 'target': 'self'}


class EaProductContent(models.Model):
    """Standard content of a product reused in every engagement (e.g. the D1
    domain criteria table). Changes with the product version, not per engagement."""
    _name = 'ea.product.content'
    _description = 'Konten Baku Produk'
    _order = 'sequence, id'

    product_id = fields.Many2one('ea.product', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    code = fields.Char('Kode', required=True, help='Dipakai sebagai token {{konten:kode}} di template.')
    name = fields.Char('Nama', required=True)
    body = fields.Text('Isi (Markdown)')

    _sql_constraints = [('code_product_uniq', 'unique(product_id, code)', 'Kode konten baku harus unik per produk.')]


class EaProductTool(models.Model):
    _name = 'ea.product.tool'
    _description = 'Tool Pendukung Produk'
    _order = 'sequence, id'

    product_id = fields.Many2one('ea.product', ondelete='cascade', required=True)
    sequence = fields.Integer(default=10)
    name = fields.Char('Tool / teknik', required=True)
    ref = fields.Char('Rujukan')
    template_id = fields.Many2one('ea.product.template', 'Template', domain="[('product_id', '=', product_id)]")

    @api.constrains('template_id', 'product_id')
    def _check_template(self):
        for t in self:
            if t.template_id and t.template_id.product_id != t.product_id:
                raise ValidationError('Template tool harus milik produk yang sama.')
