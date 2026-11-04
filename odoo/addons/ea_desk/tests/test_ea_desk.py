from odoo.exceptions import UserError, ValidationError
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestEaDesk(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.sponsor = cls.env['res.partner'].create({'name': 'Dir. Keuangan'})
        cls.mode = {n: cls.env.ref(f'ea_desk.mode_{n}') for n in (1, 2, 3, 4)}
        cls.domain_data = cls.env.ref('ea_desk.product_domain_data')

    def _engagement(self, mode=2, **vals):
        return self.env['ea.engagement'].create({
            'name': 'Konsolidasi aplikasi procurement', 'sponsor_id': self.sponsor.id,
            'decision_needed': 'Pilih platform procurement tunggal', 'mode_id': self.mode[mode].id, **vals,
        })

    def _complete_stage(self, e):
        e.criterion_line_ids.filtered(lambda l: not l.optional).write({'done': True})

    def _pass_all(self, e, lessons=()):
        while e.state == 'active':
            self._complete_stage(e)
            is_last = e.stage_id == e.mode_id.flow()[-1:]
            e.pass_gate('Sponsor', lessons=lessons if is_last else ())

    def test_decision_first(self):
        with self.assertRaises(Exception):
            self.env['ea.engagement'].create({'name': 'x', 'sponsor_id': self.sponsor.id, 'mode_id': self.mode[2].id})
        e = self._engagement()
        self.assertRegex(e.code, r'^ENG-\d{4}-\d{3}$')
        self.assertEqual(e.stage_id.code, 'seed')

    def test_gate_blocked_until_criteria_met(self):
        e = self._engagement()
        with self.assertRaises(UserError):
            e.pass_gate('Sponsor')
        self._complete_stage(e)
        self.assertTrue(e.gate_ready)
        with self.assertRaises(UserError):
            e.pass_gate('  ')
        e.pass_gate('Dir. Keuangan')
        self.assertEqual(e.stage_id.code, 'sprout')
        self.assertEqual(len(e.gate_ids), 1)

    def test_gatekeeper_skips_sprout_and_uses_compliance_checklist(self):
        e = self._engagement(mode=3)
        self.assertEqual(e.mode_id.flow().mapped('code'), ['seed', 'cultivate', 'harvest'])
        self._complete_stage(e)
        e.pass_gate('Sponsor')
        self.assertEqual(e.stage_id.code, 'cultivate')
        codes = e.criterion_line_ids.criterion_id.mapped('code')
        self.assertIn('checklist', codes)
        self.assertNotIn('review', codes)

    def test_mode_locked_after_first_stage(self):
        e = self._engagement()
        e.mode_id = self.mode[1]
        self._complete_stage(e)
        e.pass_gate('Sponsor')
        with self.assertRaises(UserError):
            e.mode_id = self.mode[3]

    def test_no_orphan_artifact(self):
        e = self._engagement()
        with self.assertRaises(ValidationError):
            self.env['ea.artifact'].create({'name': 'Map', 'owner': ' ', 'consumer': 'Tim', 'purpose': 'x', 'engagement_id': e.id})

    def test_adr_needs_decider_and_decision(self):
        d = self.env['ea.decision'].create({'name': 'Ariba jadi SoRec', 'context': 'Duplikasi vendor'})
        self.assertRegex(d.code, r'^ADR-\d{3}$')
        with self.assertRaises(UserError):
            d.action_accept()
        d.decided_by = 'Dir. Keuangan'
        with self.assertRaises(UserError):
            d.action_accept()
        d.decision = 'Ariba menjadi SoRec'
        d.action_accept()
        self.assertEqual(d.state, 'accepted')
        self.assertTrue(d.decided_date)

    def test_full_cycle_harvests_and_feeds_product_recipe(self):
        e = self._engagement(mode=4, product_id=self.domain_data.id)
        art = self.env['ea.artifact'].create({'name': 'Domain Map', 'type': 'diagram', 'owner': 'EA', 'consumer': 'DGO', 'purpose': 'Domain', 'engagement_id': e.id})
        for _stage in ('seed', 'cultivate'):
            self._complete_stage(e)
            e.pass_gate('Sponsor')
        self.assertEqual(e.stage_id.code, 'harvest', 'draft artifacts do not block earlier gates')
        self._complete_stage(e)
        with self.assertRaises(UserError):
            e.pass_gate('EA')
        art.state = 'approved'
        self._pass_all(e, lessons=[{'name': 'Tambah langkah validasi homonim', 'kind': 'process'}])
        self.assertEqual(e.state, 'closed')
        self.assertEqual(art.state, 'harvested')
        self.assertEqual(len(e.gate_ids), 3)
        self.assertIn('Tambah langkah validasi homonim', self.domain_data.improvement_ids.mapped('name'))
        with self.assertRaises(UserError):
            e.state = 'active'

    def test_recipe_from_product_and_generic_fallback(self):
        e = self._engagement(mode=4, product_id=self.domain_data.id)
        self.assertEqual(e.step_line_ids.step_id.product_id, self.domain_data)
        self.assertTrue(e.step_line_ids.sorted(lambda l: (l.sequence, l.id))[0].is_next)
        plain = self._engagement(mode=2)
        self.assertFalse(plain.step_line_ids.step_id.product_id, 'no product → generic Planting Seed steps')
        # Ticking a recipe step does not count toward the gate.
        e.step_line_ids[0].done = True
        self.assertEqual(e.gate_done, 0)

    def test_changing_product_in_seed_swaps_unticked_steps(self):
        e = self._engagement(mode=4)
        generic = e.step_line_ids
        generic[0].done = True
        e.product_id = self.domain_data
        self.assertIn(generic[0], e.step_line_ids, 'ticked steps are kept')
        self.assertTrue(e.step_line_ids.filtered(lambda l: l.step_id.product_id == self.domain_data))

    def test_missed_artifacts_from_earlier_stage(self):
        e = self._engagement(mode=4, product_id=self.domain_data.id)
        self._complete_stage(e)
        e.pass_gate('Sponsor')
        self.assertIn('dokumen kerja', (e.missed_artifacts or '').lower())

    def test_product_copy_starts_as_draft(self):
        self.domain_data.maturity = 'tested'
        copy = self.domain_data.copy()
        self.assertEqual((copy.maturity, copy.version), ('draft', '0.1'))
        self.assertEqual(len(copy.step_ids), len(self.domain_data.step_ids))
        self.assertNotEqual(copy.code, self.domain_data.code)
        self.assertEqual(copy.step_ids.template_id.product_id, copy, 'copied steps use the copy\'s templates')

    # ---------------------------------------------------------------- change request 2026-10-29
    def test_templates_available_at_every_stage(self):
        e = self._engagement(mode=4, product_id=self.domain_data.id)
        generic = self.env['ea.product.template'].search([('product_id', '=', False)])
        self.assertTrue(self.domain_data.template_ids <= e.template_ids)
        self.assertTrue(generic <= e.template_ids)
        self._pass_all(e)
        self.assertEqual(e.state, 'closed')
        self.assertTrue(self.domain_data.template_ids <= e.template_ids, 'still reachable after closing')

    def test_template_preview_is_a_detached_copy(self):
        tpl = self.domain_data.template_ids[:1]
        action = tpl.action_open_preview()
        preview = self.env['ea.template.preview'].browse(action['res_id'])
        self.assertEqual(preview.body, tpl.body)
        preview.body = 'diubah'
        self.assertNotEqual(tpl.body, 'diubah', 'editing the preview never changes the template')
        self.assertIn(f'/ea_desk/template/{tpl.id}/download', preview.action_download()['url'])

    def test_decisions_sorted_by_code(self):
        self.assertEqual(self.env['ea.decision']._order, 'code, id')
        e = self._engagement()
        for name in ('B', 'A', 'C'):
            self.env['ea.decision'].create({'name': name, 'context': 'x', 'engagement_id': e.id})
        codes = e.decision_ids.mapped('code')
        self.assertEqual(codes, sorted(codes))

    def test_artifact_accepts_upload(self):
        e = self._engagement()
        att = self.env['ir.attachment'].create({'name': 'domain-map.pdf', 'raw': b'%PDF-1.4'})
        art = self.env['ea.artifact'].create({'name': 'Domain Map', 'owner': 'EA', 'consumer': 'DGO', 'purpose': 'x',
                                              'engagement_id': e.id, 'attachment_ids': [(6, 0, att.ids)]})
        self.assertEqual(art.attachment_count, 1)

    def test_executive_summary(self):
        e = self._engagement(mode=1)
        self._complete_stage(e)
        self.env['ea.decision'].create({'name': 'X', 'context': 'y', 'engagement_id': e.id})
        d = self.env['ea.engagement'].get_executive_summary()
        self.assertGreaterEqual(d['kpi']['active'], 1)
        self.assertGreaterEqual(d['kpi']['ready'], 1)
        self.assertGreaterEqual(d['kpi']['adr_proposed'], 1)
        self.assertTrue(any(a['kind'] == 'gate' and a['id'] == e.id for a in d['attention']))
        self.assertEqual(len(d['trend']['labels']), 6)
        self.assertEqual(sum(s['count'] for s in d['pipeline']), len(d['engagements']))
        self.assertGreaterEqual(d['capacity']['total'], 3)

    # ---------------------------------------------------------------- deliverable documents (ADR-003/004)
    def _doc_engagement(self, **vals):
        return self._engagement(mode=4, product_id=self.domain_data.id, **vals)

    def test_product_defaults_for_documents(self):
        p = self.domain_data
        self.assertTrue(p.classification_id, 'seed product has a classification')
        self.assertTrue(p.service)
        d1 = p.step_ids.filtered(lambda s: s.code == 'd1')
        self.assertTrue(d1.doc_section and d1.content_id, 'D1 is a chapter carrying the standard criteria')
        self.assertEqual(p.step_ids.filtered(lambda s: s.code == 'workdoc').step_type, 'governance')

    def test_classification_override(self):
        e = self._doc_engagement()
        self.assertEqual(e.classification_id, self.domain_data.classification_id)
        secret = self.env.ref('ea_desk.classification_confidential')
        e.classification_override_id = secret
        self.assertEqual(e.classification_id, secret)

    def test_document_scheme_codes(self):
        scheme = self.env['ea.document.scheme'].default_scheme()
        e = self._doc_engagement()
        self.assertEqual(scheme.next_code(e), f'DLV/{self.domain_data.sop_output}/{e.code}')
        numbered = self.env['ea.document.scheme'].create({'name': 'Urut', 'prefix': 'EA', 'pattern': '{prefix}/{tahun}/{urut}'})
        first, second = numbered.next_code(e), numbered.next_code(e)
        self.assertNotEqual(first, second)
        with self.assertRaises(ValidationError):
            self.env['ea.document.scheme'].create({'name': 'Tidak unik', 'pattern': '{prefix}/{sop}'})

    def test_validation_blocks_and_warns(self):
        e = self._doc_engagement()
        renderer = self.env['ea.document.renderer']
        self.assertFalse([f for f in renderer.check(e) if f['level'] == 'block'])
        self.domain_data.service = False
        self.assertTrue([f for f in renderer.check(e) if f['level'] == 'block'])
        plain = self._engagement()
        self.assertTrue(any('Produk EA' in f['text'] for f in renderer.check(plain)))
        self._complete_stage(e)
        e.pass_gate('Sponsor', note='Disampaikan secara lisan')
        self.domain_data.service = 'svc1'
        self.assertTrue(any(f['level'] == 'warn' and 'lemah' in f['text'] for f in renderer.check(e)))

    def test_generate_document(self):
        e = self._doc_engagement()
        self.env['ea.decision'].create({'name': 'Kriteria Domain Data', 'context': 'x', 'engagement_id': e.id})
        self.env['ea.issue'].create({'name': 'Rumah Proses Bisnis', 'engagement_id': e.id})
        wizard = self.env['ea.document.wizard'].with_context(default_engagement_id=e.id).create({})
        self.assertFalse(wizard.blocked)
        wizard.action_generate()
        art = e.artifact_ids.filtered('document_code')
        self.assertEqual(art.document_code, f'DLV/{self.domain_data.sop_output}/{e.code}')
        body = art.doc_body
        for expected in ('## Lembar Kendali Dokumen', '## 0. Ringkasan Eksekutif', '## 1. Tujuan Dokumen', '## 3. Metode',
                         'Prinsip & Kriteria Domain (D1)', 'K1', 'Business Object Catalog (D2)', 'ISU-', 'Diisi manual'):
            self.assertIn(expected, body)
        self.assertNotIn('⚠️', body, 'no unknown tokens')
        self.assertNotIn('Buat dokumen kerja', body.split('## 3. Metode')[1].split('##')[0], 'governance steps stay out of Metode')
        code = art.document_code
        self.env['ea.document.wizard'].with_context(default_engagement_id=e.id).create({'version': '0.2'}).action_generate()
        self.assertEqual((art.document_code, art.doc_version), (code, '0.2'), 'code is stable, version moves')

    def test_gate_snapshot(self):
        e = self._doc_engagement()
        self.env['ea.document.wizard'].with_context(default_engagement_id=e.id).create({}).action_generate()
        art = e.artifact_ids.filtered('document_code')
        self._complete_stage(e)
        e.pass_gate('Riha', note='https://notulen/1')
        snap = art.attachment_ids.filtered(lambda a: a.name.endswith('_seed.md'))
        self.assertEqual(len(snap), 1)
        self.assertIn('/seed', art.doc_body)

    def test_issue_to_adr(self):
        e = self._doc_engagement()
        issue = self.env['ea.issue'].create({'name': 'Perubahan di IT Service atau Solution Delivery?', 'engagement_id': e.id})
        self.assertRegex(issue.code, r'^ISU-\d{3}$')
        with self.assertRaises(UserError):
            issue.action_resolve()
        issue.action_convert_to_adr()
        self.assertEqual(issue.state, 'to_adr')
        self.assertEqual(issue.decision_id.engagement_id, e)
        self.assertIn(issue.code, issue.decision_id.context)

    def test_adr_supersede_chain(self):
        e = self._doc_engagement()
        old_adr = self.env['ea.decision'].create({
            'name': 'Gunakan PostgreSQL',
            'context': 'Kebutuhan database transaksi',
            'decision': 'Pilih PostgreSQL',
            'decided_by': 'Dir. Keuangan',
            'engagement_id': e.id,
        })
        old_adr.action_accept()
        self.assertEqual(old_adr.state, 'accepted')
        decided_date_before = old_adr.decided_date
        self.assertTrue(decided_date_before)
        self.assertFalse(old_adr.superseded_date)

        with self.assertRaises(UserError):
            old_adr.action_supersede()

        old_adr.superseded_by_id = old_adr
        with self.assertRaises(UserError):
            old_adr.action_supersede()

        new_adr = self.env['ea.decision'].create({
            'name': 'Migrasi ke Spanner',
            'context': 'Skala transaksi melampaui single-node',
            'decision': 'Ganti ke Spanner',
            'decided_by': 'Dir. Keuangan',
            'engagement_id': e.id,
        })
        new_adr.action_accept()

        old_adr.superseded_by_id = new_adr
        old_adr.action_supersede()

        self.assertEqual(old_adr.state, 'superseded')
        self.assertEqual(old_adr.superseded_by_id, new_adr)
        self.assertIn(old_adr, new_adr.supersedes_ids)
        self.assertEqual(old_adr.decided_date, decided_date_before)
        self.assertTrue(old_adr.superseded_date)

        wizard = self.env['ea.document.wizard'].with_context(default_engagement_id=e.id).create({})
        wizard.action_generate()
        art = e.artifact_ids.filtered('document_code')
        self.assertIn(f'Superseded → {new_adr.code}', art.doc_body)

    def test_adr_supersede_preserves_decided_date(self):
        adr = self.env['ea.decision'].create({
            'name': 'Gunakan Redis untuk caching',
            'context': 'Latency tinggi pada query katalog',
            'decision': 'Gunakan Redis cluster',
            'decided_by': 'Dir. Teknologi',
        })
        adr.action_accept()
        self.assertEqual(adr.state, 'accepted')
        self.assertTrue(adr.decided_date)
        self.assertFalse(adr.superseded_date)
        original_decided_date = adr.decided_date

        replacement = self.env['ea.decision'].create({
            'name': 'Gunakan Dragonfly untuk caching',
            'context': 'Kompatibilitas Redis dengan utilisasi memori lebih hemat',
            'decision': 'Migrasi Redis ke Dragonfly',
            'decided_by': 'Dir. Teknologi',
        })
        replacement.action_accept()

        adr.superseded_by_id = replacement
        adr.action_supersede()

        self.assertEqual(adr.state, 'superseded')
        self.assertEqual(adr.decided_date, original_decided_date, 'Tanggal keputusan asli tidak boleh berubah saat di-supersede')
        self.assertTrue(adr.superseded_date, 'Waktu supersede wajib terisi')
        self.assertGreaterEqual(adr.superseded_date, original_decided_date)
