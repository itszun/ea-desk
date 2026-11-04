from datetime import timedelta

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models
from odoo.tools import html2plaintext

MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']


class EaEngagement(models.Model):
    _inherit = 'ea.engagement'

    @api.model
    def get_executive_summary(self):
        """Everything the Ringkasan Eksekutif dashboard shows, in one call."""
        env = self.env
        now = fields.Datetime.now()
        today = fields.Date.context_today(self)
        since_90 = now - timedelta(days=90)
        Engagement, Decision = env['ea.engagement'], env['ea.decision']
        running = Engagement.search([('state', 'in', ('active', 'on_hold'))])
        active = running.filtered(lambda e: e.state == 'active')

        attention = []
        for e in active:
            if e.gate_ready:
                attention.append({'kind': 'gate', 'id': e.id, 'code': e.code, 'name': e.name,
                                  'text': f'Siap lewat gerbang {e.stage_id.name}'})
            if e.target_date and e.target_date < today:
                attention.append({'kind': 'late', 'id': e.id, 'code': e.code, 'name': e.name,
                                  'text': f'Melewati target {e.target_date.strftime("%d-%m-%Y")}'})
            if e.write_date < now - timedelta(days=14):
                attention.append({'kind': 'stale', 'id': e.id, 'code': e.code, 'name': e.name,
                                  'text': f'Tanpa aktivitas {(now - e.write_date).days} hari'})
        proposed = Decision.search([('state', '=', 'proposed')])
        waiting_long = proposed.filtered(lambda d: d.create_date < now - timedelta(days=7))
        for d in waiting_long:
            attention.append({'kind': 'adr', 'id': d.engagement_id.id, 'decision_id': d.id, 'code': d.code, 'name': d.name,
                              'text': f'ADR menunggu keputusan {(now - d.create_date).days} hari'})

        stages = env['ea.stage'].search([])
        modes = env['ea.mode'].search([])
        limit = int(env['ir.config_parameter'].sudo().get_param('ea_desk.capacity_limit', 8))
        capacity = [{'name': m.display_name, 'count': len(active.filtered(lambda e, m=m: e.mode_id == m)),
                     'load': len(active.filtered(lambda e, m=m: e.mode_id == m)) * m.load} for m in modes]

        # Last six calendar months, oldest first.
        first = today.replace(day=1) - relativedelta(months=5)
        months = [first + relativedelta(months=i) for i in range(6)]

        def per_month(records, field):
            counts = [0] * 6
            for r in records:
                value = r[field]
                if value:
                    idx = (value.year - first.year) * 12 + value.month - first.month
                    if 0 <= idx < 6:
                        counts[idx] += 1
            return counts

        start = fields.Datetime.to_datetime(first)
        gates = env['ea.gate.pass'].search([('passed_date', '>=', start)])
        accepted = Decision.search([('state', '=', 'accepted'), ('decided_date', '>=', start)])
        closed = Engagement.search([('state', '=', 'closed'), ('closed_date', '>=', start)])

        messages = env['mail.message'].search([
            ('model', 'in', ('ea.engagement', 'ea.decision', 'ea.product')), ('message_type', 'in', ('comment', 'notification')),
        ], limit=8, order='id desc')

        return {
            'kpi': {
                'active': len(active),
                'on_hold': len(running) - len(active),
                'ready': len(active.filtered('gate_ready')),
                'attention': len({(a['kind'], a['id']) for a in attention}),
                'adr_proposed': len(proposed),
                'adr_waiting_long': len(waiting_long),
                'artifact_draft': env['ea.artifact'].search_count([('state', '=', 'draft')]),
                'foundation_open': env['ea.foundation.item'].search_count([('state', '!=', 'done')]),
            },
            'impact_90': {
                'gates': env['ea.gate.pass'].search_count([('passed_date', '>=', since_90)]),
                'adr_accepted': Decision.search_count([('state', '=', 'accepted'), ('decided_date', '>=', since_90)]),
                'closed': Engagement.search_count([('state', '=', 'closed'), ('closed_date', '>=', since_90)]),
                'artifacts': env['ea.artifact'].search_count([('create_date', '>=', since_90)]),
                'foundation_done': env['ea.foundation.item'].search_count([('state', '=', 'done'), ('done_date', '>=', since_90)]),
            },
            'pipeline': [{'id': s.id, 'name': s.name, 'title': s.title, 'count': len(running.filtered(lambda e, s=s: e.stage_id == s))} for s in stages],
            'capacity': {'limit': limit, 'total': sum(c['load'] for c in capacity), 'modes': capacity},
            'trend': {
                'labels': [f'{MONTHS_ID[m.month - 1]} {str(m.year)[2:]}' for m in months],
                'gates': per_month(gates, 'passed_date'),
                'adr_accepted': per_month(accepted, 'decided_date'),
                'closed': per_month(closed, 'closed_date'),
            },
            'attention': attention[:10],
            'engagements': [{
                'id': e.id, 'code': e.code, 'name': e.name, 'product': e.product_id.name or '—', 'mode': e.mode_id.display_name,
                'stage': e.stage_id.name, 'progress': round(e.gate_progress), 'sponsor': e.sponsor_id.name,
                'target': e.target_date.strftime('%d-%m-%Y') if e.target_date else '', 'state': e.state, 'ready': e.gate_ready,
            } for e in running.sorted(lambda e: (e.stage_id.sequence, e.code))],
            'decisions': [{'id': d.id, 'code': d.code, 'name': d.name, 'engagement': d.engagement_id.code or '',
                           'age': (now - d.create_date).days} for d in proposed.sorted('code')[:8]],
            'products': [{'id': p.id, 'name': p.name, 'maturity': dict(p._fields['maturity'].selection)[p.maturity],
                          'maturity_key': p.maturity, 'version': p.version, 'running': len(p.engagement_ids.filtered(lambda e: e.state in ('active', 'on_hold'))),
                          'open_feedback': p.improvement_open_count}
                         for p in env['ea.product'].search([('maturity', '!=', 'obsolete')])],
            'recent': [{'date': fields.Datetime.context_timestamp(self, m.date).strftime('%d-%m %H:%M'), 'model': m.model, 'res_id': m.res_id,
                        'record': m.record_name or '', 'text': self._message_text(m)[:140],
                        'author': m.author_id.name or ''} for m in messages],
        }

    @api.model
    def _message_text(self, message):
        text = html2plaintext(message.body or '').strip()
        if text:
            return text
        changes = [f'{t.field_id.field_description}: {t.old_value_char or "—"} → {t.new_value_char or "—"}'
                   for t in message.sudo().tracking_value_ids if t.old_value_char or t.new_value_char]
        return '; '.join(changes) or (message.subtype_id.name or '')
