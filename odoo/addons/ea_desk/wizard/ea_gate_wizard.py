from odoo import fields, models

from ..models.ea_config import FOUNDATION_KINDS


class EaGateWizard(models.TransientModel):
    _name = 'ea.gate.wizard'
    _description = 'Lewati Gerbang'

    engagement_id = fields.Many2one('ea.engagement', required=True)
    stage_id = fields.Many2one(related='engagement_id.stage_id')
    stage_approver = fields.Selection(related='engagement_id.stage_id.approver', string='Penyetuju sesuai RACI')
    product_id = fields.Many2one(related='engagement_id.product_id')
    approved_by = fields.Char('Disetujui oleh', required=True)
    note = fields.Text('Catatan / bukti persetujuan', help='mis. tautan notulen, email, atau nomor memo')
    is_last = fields.Boolean(compute='_compute_is_last')
    draft_artifacts = fields.Text(compute='_compute_is_last')
    lesson_ids = fields.One2many('ea.gate.wizard.lesson', 'wizard_id', 'Lessons learned → backlog /foundation')

    def _compute_is_last(self):
        for w in self:
            e = w.engagement_id
            w.is_last = e.stage_id == e.mode_id.flow()[-1:]
            drafts = e.artifact_ids.filtered(lambda a: a.state == 'draft')
            w.draft_artifacts = ', '.join(drafts.mapped('name')) if w.is_last and drafts else False

    def action_confirm(self):
        self.ensure_one()
        lessons = [{'name': l.name, 'kind': l.kind} for l in self.lesson_ids] if self.is_last else []
        self.engagement_id.pass_gate(self.approved_by, self.note, lessons)
        return {'type': 'ir.actions.act_window_close'}


class EaGateWizardLesson(models.TransientModel):
    _name = 'ea.gate.wizard.lesson'
    _description = 'Lesson learned'

    wizard_id = fields.Many2one('ea.gate.wizard', required=True, ondelete='cascade')
    name = fields.Char('Pelajaran', required=True)
    kind = fields.Selection(FOUNDATION_KINDS, 'Jenis', default='process', required=True)
