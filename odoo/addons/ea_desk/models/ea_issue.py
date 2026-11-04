from odoo import _, api, fields, models
from odoo.exceptions import UserError


class EaIssue(models.Model):
    """Open issue or assumption that is not (yet) a decision. When the options
    are clear enough, it is converted into an ADR."""
    _name = 'ea.issue'
    _description = 'Isu & Asumsi'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'code, id'
    _rec_names_search = ['name', 'code']

    code = fields.Char('Kode', readonly=True, copy=False, default=lambda self: _('Baru'))
    name = fields.Char('Isu / asumsi', required=True, tracking=True)
    kind = fields.Selection([('issue', 'Isu'), ('assumption', 'Asumsi')], 'Jenis', default='issue', required=True)
    description = fields.Text('Uraian', help='Kenapa ini belum bisa diputuskan: fakta apa yang belum diketahui?')
    follow_up = fields.Text('Tindak lanjut')
    owner = fields.Char('Penanggung jawab tindak lanjut')
    due_date = fields.Date('Target')
    engagement_id = fields.Many2one('ea.engagement', 'Engagement', index=True)
    state = fields.Selection([('open', 'Terbuka'), ('resolved', 'Selesai'), ('to_adr', 'Menjadi ADR')], 'Status',
                             default='open', required=True, tracking=True)
    resolution = fields.Text('Penyelesaian')
    decision_id = fields.Many2one('ea.decision', 'ADR', readonly=True, copy=False)

    def _compute_display_name(self):
        for i in self:
            i.display_name = f'{i.code} · {i.name}'

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('code', _('Baru')) == _('Baru'):
                vals['code'] = self.env['ir.sequence'].next_by_code('ea.issue') or _('Baru')
        return super().create(vals_list)

    def action_resolve(self):
        for i in self:
            if not (i.resolution or '').strip():
                raise UserError(_('Isi Penyelesaian sebelum menutup %s.', i.code))
        self.write({'state': 'resolved'})

    def action_reopen(self):
        self.write({'state': 'open'})

    def action_convert_to_adr(self):
        self.ensure_one()
        if self.state != 'open':
            raise UserError(_('Hanya isu terbuka yang bisa dijadikan ADR.'))
        decision = self.env['ea.decision'].create({
            'name': self.name, 'engagement_id': self.engagement_id.id,
            'context': (self.description or self.name) + _('\n\n(Berasal dari %s)', self.code),
        })
        self.write({'state': 'to_adr', 'decision_id': decision.id})
        return {'type': 'ir.actions.act_window', 'res_model': 'ea.decision', 'res_id': decision.id, 'view_mode': 'form'}
