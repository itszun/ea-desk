from odoo import api, fields, models

from .ea_config import FOUNDATION_KINDS


class EaFoundationItem(models.Model):
    """Improvement to the EA foundation (principles, metamodel, templates) or to a
    product's recipe — fed by lessons learned at /harvest or by Mode 4 work."""
    _name = 'ea.foundation.item'
    _description = 'Backlog /foundation'
    _inherit = ['mail.thread']
    _order = 'id desc'

    name = fields.Char('Item', required=True, tracking=True)
    kind = fields.Selection(FOUNDATION_KINDS, 'Jenis', required=True, default='process')
    description = fields.Text()
    state = fields.Selection([('backlog', 'Backlog'), ('doing', 'Dikerjakan'), ('done', 'Selesai')], 'Status',
                             default='backlog', required=True, tracking=True, group_expand='_group_expand_state')
    engagement_id = fields.Many2one('ea.engagement', 'Asal engagement', index=True)
    product_id = fields.Many2one('ea.product', 'Resep produk', index=True, help='Kosong = fondasi umum.')
    done_date = fields.Datetime('Selesai pada', readonly=True)

    @api.model
    def _group_expand_state(self, states, domain):
        return [key for key, _label in self._fields['state'].selection]

    def write(self, vals):
        if 'state' in vals:
            vals['done_date'] = fields.Datetime.now() if vals['state'] == 'done' else False
        return super().write(vals)

    def action_mark_absorbed(self):
        self.write({'state': 'done'})
