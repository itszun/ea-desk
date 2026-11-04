import re

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

TOKEN_RE = re.compile(r'\{(prefix|sop|produk|engagement|tahun|urut)\}')


class EaInfoClassification(models.Model):
    """Reference data: information classification levels (local list until the
    enterprise Information Classification Scheme owned by S3.5.1 exists)."""
    _name = 'ea.info.classification'
    _description = 'Klasifikasi Informasi'
    _order = 'sequence, id'

    sequence = fields.Integer(default=10)
    name = fields.Char('Klasifikasi', required=True)
    code = fields.Char('Kode', required=True)
    handling = fields.Text('Perlakuan', help='Aturan penyimpanan, distribusi, dan akses untuk level ini.')
    active = fields.Boolean(default=True)

    _sql_constraints = [('code_uniq', 'unique(code)', 'Kode klasifikasi harus unik.')]


class EaDocumentScheme(models.Model):
    """Reference data: how deliverable document codes are built.

    Tokens: {prefix} {sop} {produk} {engagement} {tahun} {urut}. A code is
    assigned once, when the document is first generated, and never changes;
    the document version is tracked separately."""
    _name = 'ea.document.scheme'
    _description = 'Skema Kode Dokumen'
    _order = 'is_default desc, name'

    name = fields.Char('Nama skema', required=True)
    prefix = fields.Char('Prefiks', default='DLV')
    pattern = fields.Char('Pola kode', required=True, default='{prefix}/{sop}/{engagement}',
                          help='Token: {prefix} {sop} {produk} {engagement} {tahun} {urut}')
    sequence_id = fields.Many2one('ir.sequence', 'Penomoran {urut}', readonly=True, copy=False)
    is_default = fields.Boolean('Skema bawaan', help='Dipakai produk yang tidak memilih skema sendiri.')
    description = fields.Text('Keterangan')
    active = fields.Boolean(default=True)
    example = fields.Char('Contoh', compute='_compute_example')

    @api.depends('pattern', 'prefix')
    def _compute_example(self):
        sample = {'prefix': None, 'sop': 'O-S313-01', 'produk': 'DOMAIN-DATA', 'engagement': 'ENG-2026-001',
                  'tahun': str(fields.Date.today().year), 'urut': '001'}
        for s in self:
            s.example = TOKEN_RE.sub(lambda m: (s.prefix or '') if m.group(1) == 'prefix' else sample[m.group(1)], s.pattern or '')

    @api.constrains('pattern')
    def _check_pattern(self):
        for s in self:
            unknown = set(re.findall(r'\{(\w+)\}', s.pattern or '')) - {'prefix', 'sop', 'produk', 'engagement', 'tahun', 'urut'}
            if unknown:
                raise ValidationError(_('Token tidak dikenal: %s', ', '.join(sorted(unknown))))
            if '{engagement}' not in s.pattern and '{urut}' not in s.pattern:
                raise ValidationError(_('Pola harus memuat {engagement} atau {urut} supaya setiap kode unik.'))

    @api.constrains('is_default')
    def _check_single_default(self):
        if self.search_count([('is_default', '=', True)]) > 1:
            raise ValidationError(_('Hanya boleh ada satu skema bawaan.'))

    @api.model
    def default_scheme(self):
        return self.search([('is_default', '=', True)], limit=1)

    def next_code(self, engagement):
        self.ensure_one()
        values = {
            'prefix': self.prefix or '', 'sop': engagement.product_id.sop_output or 'NA',
            'produk': (engagement.product_id.code or 'NA').upper(), 'engagement': engagement.code,
            'tahun': str(fields.Date.context_today(self).year), 'urut': '',
        }
        if '{urut}' in self.pattern:
            if not self.sequence_id:
                # Reference data is read-only for regular users; numbering setup is system work.
                self.sudo().sequence_id = self.env['ir.sequence'].sudo().create({
                    'name': f'Kode dokumen · {self.name}', 'code': f'ea.document.scheme.{self.id}', 'padding': 3})
            values['urut'] = self.sequence_id.sudo().next_by_id()
        return TOKEN_RE.sub(lambda m: values[m.group(1)], self.pattern)
