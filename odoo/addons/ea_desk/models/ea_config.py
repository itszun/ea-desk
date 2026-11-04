from odoo import fields, models

# Shared vocabularies, kept in one place so views, data and wizards agree.
ALTITUDES = [('l0', 'L0 · Strategis'), ('l1', 'L1 · Konseptual'), ('l01', 'L0–L1'), ('l2', 'L2+ · Logis/fisik (parkir)')]
ARTIFACT_TYPES = [('deliverable', 'Deliverable'), ('catalog', 'Catalog'), ('matrix', 'Matrix'), ('diagram', 'Diagram'),
                  ('adr', 'ADR'), ('standard', 'Standar/Panduan'), ('other', 'Lainnya')]
FOUNDATION_KINDS = [('principle', 'Prinsip'), ('metamodel', 'Metamodel'), ('notation', 'Notasi'), ('template', 'Template'),
                    ('tech_standard', 'Standar Teknologi'), ('process', 'Proses Kerja EA')]


class EaStage(models.Model):
    _name = 'ea.stage'
    _description = 'Tahap Planting Seed'
    _order = 'sequence, id'

    name = fields.Char('Label', required=True, help='mis. /seed')
    code = fields.Char(required=True)
    title = fields.Char('Nama', required=True)
    purpose = fields.Text('Tujuan')
    approver = fields.Selection([('sponsor', 'Sponsor'), ('ea', 'Enterprise Architect')], 'Penyetuju gerbang', required=True, default='ea')
    sequence = fields.Integer(default=10)
    fold = fields.Boolean('Lipat di kanban')
    criterion_ids = fields.One2many('ea.gate.criterion', 'stage_id', 'Kriteria gerbang')

    _sql_constraints = [('code_uniq', 'unique(code)', 'Kode tahap harus unik.')]


class EaMode(models.Model):
    _name = 'ea.mode'
    _description = 'Mode Keterlibatan EA'
    _order = 'number'

    name = fields.Char(required=True)
    number = fields.Integer('Nomor', required=True)
    touch = fields.Char('Intensitas')
    load = fields.Integer('Bobot kapasitas', default=1)
    when = fields.Text('Kapan dipakai')
    ea_role = fields.Text('Peran EA')
    color = fields.Integer()
    stage_ids = fields.Many2many('ea.stage', string='Tahap yang dilalui', required=True)

    _sql_constraints = [('number_uniq', 'unique(number)', 'Nomor mode harus unik.')]

    def _compute_display_name(self):
        for mode in self:
            mode.display_name = f'M{mode.number} · {mode.name}'

    def flow(self):
        """Stages this mode goes through, in Planting Seed order."""
        self.ensure_one()
        return self.stage_ids.sorted(lambda s: (s.sequence, s.id))


class EaGateCriterion(models.Model):
    _name = 'ea.gate.criterion'
    _description = 'Kriteria Gerbang'
    _order = 'stage_id, sequence, id'

    stage_id = fields.Many2one('ea.stage', 'Tahap', required=True, ondelete='cascade')
    sequence = fields.Integer(default=10)
    code = fields.Char()
    name = fields.Text('Kriteria', required=True)
    optional = fields.Boolean('Opsional', help='Tidak menghalangi gerbang.')
    mode_ids = fields.Many2many('ea.mode', string='Hanya untuk mode', help='Kosong = berlaku untuk semua mode.')

    def applies_to(self, mode):
        return self.filtered(lambda c: not c.mode_ids or mode in c.mode_ids)


class EaPrinciple(models.Model):
    _name = 'ea.principle'
    _description = 'Prinsip Kerja EA'
    _order = 'sequence, id'

    sequence = fields.Integer(default=10)
    name = fields.Char(required=True)
    description = fields.Text()
