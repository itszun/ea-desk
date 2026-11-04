from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

from .ea_config import ARTIFACT_TYPES

ARTIFACT_STATES = [('draft', 'Draft'), ('approved', 'Disahkan'), ('harvested', 'Di-harvest'), ('obsolete', 'Usang')]


class EaArtifact(models.Model):
    """Register entry for an architecture artifact. The artifact itself stays in
    its source tool; EA Desk records who owns it, who uses it and why."""
    _name = 'ea.artifact'
    _description = 'Register Artefak'
    _inherit = ['mail.thread']
    _order = 'id desc'

    name = fields.Char('Nama artefak', required=True, tracking=True)
    type = fields.Selection(ARTIFACT_TYPES, 'Jenis', required=True, default='deliverable')
    owner = fields.Char('Owner pemeliharaan', required=True, tracking=True, help='Siapa yang merawat setelah proyek selesai')
    consumer = fields.Char('Consumer', required=True, help='Siapa yang memakai artefak ini')
    purpose = fields.Text('Tujuan penggunaan', required=True, help='Keputusan atau pekerjaan apa yang dibantu artefak ini')
    location = fields.Char('Tautan dokumen', help='SharePoint, Google Docs, Archi, Git…')
    attachment_ids = fields.Many2many('ir.attachment', 'ea_artifact_attachment_rel', 'artifact_id', 'attachment_id',
                                      string='Unggahan dokumen', help='Unggah file bila dokumen tidak punya tautan.')
    attachment_count = fields.Integer('Unggahan', compute='_compute_attachment_count')
    state = fields.Selection(ARTIFACT_STATES, 'Status', default='draft', required=True, tracking=True)
    engagement_id = fields.Many2one('ea.engagement', 'Engagement', index=True, help='Kosong = aset fondasi.')
    step_id = fields.Many2one('ea.product.step', 'Dari langkah resep', ondelete='set null')
    document_code = fields.Char('Kode dokumen', readonly=True, copy=False, index=True,
                                help='Ditetapkan sekali saat dokumen pertama dibuat (Skema Kode Dokumen).')
    doc_version = fields.Char('Versi dokumen', default='0.1')
    doc_body = fields.Text('Isi dokumen terakhir', readonly=True, copy=False)
    doc_generated_at = fields.Datetime('Dibuat pada', readonly=True, copy=False)

    _sql_constraints = [('document_code_uniq', 'unique(document_code)', 'Kode dokumen sudah dipakai.')]

    def action_preview_document(self):
        self.ensure_one()
        return self.env['ea.template.preview'].open_document(self)

    @api.depends('attachment_ids')
    def _compute_attachment_count(self):
        for a in self:
            a.attachment_count = len(a.attachment_ids)

    @api.constrains('owner', 'consumer', 'purpose')
    def _check_no_orphan(self):
        for a in self:
            if not all((v or '').strip() for v in (a.owner, a.consumer, a.purpose)):
                raise ValidationError(_('Owner, Consumer, dan Tujuan wajib diisi — No Orphan Architecture.'))

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for a in records.filtered('engagement_id'):
            a.engagement_id.message_post(body=_('Artefak didaftarkan: %(name)s (owner %(owner)s)', name=a.name, owner=a.owner))
        return records

    def write(self, vals):
        before = {a.id: a.state for a in self}
        res = super().write(vals)
        if 'state' in vals:
            labels = dict(ARTIFACT_STATES)
            for a in self.filtered(lambda x: x.engagement_id and before[x.id] != x.state):
                a.engagement_id.message_post(body=_('Artefak %(name)s: %(old)s → %(new)s', name=a.name, old=labels[before[a.id]], new=labels[a.state]))
        return res
