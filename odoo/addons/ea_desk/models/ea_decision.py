from odoo import _, api, fields, models
from odoo.exceptions import UserError

ADR_STATES = [('proposed', 'Proposed'), ('accepted', 'Accepted'), ('rejected', 'Rejected'), ('superseded', 'Superseded')]


class EaDecision(models.Model):
    """Architecture Decision Record: Context · Alternatives · Decision · Consequences."""
    _name = 'ea.decision'
    _description = 'Keputusan Arsitektur (ADR)'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'code, id'
    _rec_names_search = ['name', 'code']

    code = fields.Char('Kode', readonly=True, copy=False, default=lambda self: _('Baru'))
    name = fields.Char('Judul keputusan', required=True, tracking=True)
    engagement_id = fields.Many2one('ea.engagement', 'Engagement', index=True, help='Kosong = keputusan lintas engagement / fondasi.')
    state = fields.Selection(ADR_STATES, 'Status', default='proposed', required=True, tracking=True, copy=False)
    context = fields.Text('Context', required=True, help='Masalah, batasan, dan pemicu keputusan')
    alternatives = fields.Text('Alternatives considered')
    decision = fields.Text('Decision', help='Wajib diisi sebelum disahkan')
    consequences = fields.Text('Consequences', help='Dampak, risiko sisa, dan komitmen mitigasi')
    decided_by = fields.Char('Diputuskan oleh', tracking=True, help='Biasanya Sponsor (Accountable)')
    decided_date = fields.Datetime('Tanggal keputusan', readonly=True, copy=False)
    superseded_date = fields.Datetime('Tanggal supersede', readonly=True, copy=False)
    superseded_by_id = fields.Many2one('ea.decision', 'Digantikan oleh', copy=False, tracking=True, domain="[('id', '!=', id)]")
    supersedes_ids = fields.One2many('ea.decision', 'superseded_by_id', 'Menggantikan')

    def _compute_display_name(self):
        for d in self:
            d.display_name = f'{d.code} · {d.name}'

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('code', _('Baru')) == _('Baru'):
                vals['code'] = self.env['ir.sequence'].next_by_code('ea.decision') or _('Baru')
        records = super().create(vals_list)
        for d in records.filtered('engagement_id'):
            d.engagement_id.message_post(body=_('%(code)s diusulkan: %(name)s', code=d.code, name=d.name))
        return records

    def _decide(self, state):
        for d in self:
            if d.state != 'proposed' and state != 'superseded':
                raise UserError(_('Hanya ADR berstatus Proposed yang bisa diputuskan.'))
            if not (d.decided_by or '').strip():
                raise UserError(_('Isi "Diputuskan oleh" sebelum mengubah status ADR.'))
            if state == 'accepted' and not (d.decision or '').strip():
                raise UserError(_('Isi bagian Decision sebelum ADR disahkan.'))
            vals = {'state': state}
            if state == 'superseded':
                vals['superseded_date'] = fields.Datetime.now()
            else:
                vals['decided_date'] = fields.Datetime.now()
            d.write(vals)
            if state == 'superseded':
                msg = _('%(code)s digantikan oleh %(replacement)s', code=d.code, replacement=d.superseded_by_id.code)
                d.message_post(body=msg)
                if d.engagement_id:
                    d.engagement_id.message_post(body=msg)
            elif d.engagement_id:
                d.engagement_id.message_post(body=_('%(code)s %(state)s oleh %(by)s', code=d.code, state=dict(ADR_STATES)[state], by=d.decided_by))

    def action_accept(self):
        self._decide('accepted')

    def action_reject(self):
        self._decide('rejected')

    def action_supersede(self):
        if self.filtered(lambda d: d.state != 'accepted'):
            raise UserError(_('Hanya ADR Accepted yang bisa di-supersede.'))
        for d in self:
            if not d.superseded_by_id:
                raise UserError(_('Pilih ADR pengganti sebelum menandai Superseded.'))
            if d.superseded_by_id == d:
                raise UserError(_('ADR tidak bisa menggantikan dirinya sendiri.'))
        self._decide('superseded')
