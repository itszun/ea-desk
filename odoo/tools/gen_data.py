"""Generate the ea_desk seed data XML from the POC's playbook.json.

The POC playbook stays the single source of truth for the initial operating
model (stages, modes, gate criteria, generic steps, principles, seed products).
Records are written with noupdate="1": once installed, they are owned by the
EA team and edited in Odoo, not overwritten on module upgrade.

Usage: python3 odoo/tools/gen_data.py
"""
import json
import re
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
PLAYBOOK = json.loads((ROOT / 'playbook.json').read_text())
TEMPLATES = ROOT / 'public' / 'templates'
OUT = ROOT / 'odoo' / 'addons' / 'ea_desk' / 'data' / 'ea_playbook_data.xml'

APPROVER = {'Sponsor': 'sponsor', 'Enterprise Architect': 'ea'}
ARTIFACT_TYPES = {'Deliverable': 'deliverable', 'Catalog': 'catalog', 'Matrix': 'matrix', 'Diagram': 'diagram', 'ADR': 'adr', 'Standar/Panduan': 'standard', 'Lainnya': 'other'}
SERVICES = {s: f'svc{i + 1}' for i, s in enumerate(PLAYBOOK['ea_services'])}
ALTITUDES = {'L0': 'l0', 'L1': 'l1', 'L0–L1': 'l01', 'L2+': 'l2'}
MODE_COLORS = {1: 4, 2: 10, 3: 2, 4: 7}


def xid(*parts):
    return '_'.join(re.sub(r'[^a-z0-9]+', '_', str(p).lower()).strip('_') for p in parts)


def field(name, value=None, ref=None, eval_=None):
    if ref:
        return f'        <field name="{name}" ref="{ref}"/>'
    if eval_ is not None:
        return f'        <field name="{name}" eval="{escape(eval_, {chr(34): "&quot;"})}"/>'
    if value in (None, ''):
        return None
    return f'        <field name="{name}">{escape(str(value))}</field>'


def record(model, rid, fields):
    body = '\n'.join(f for f in fields if f)
    return f'    <record id="{rid}" model="{model}">\n{body}\n    </record>'


def template_body(tid):
    path = TEMPLATES / f'{tid}.md'
    return path.read_text() if path.exists() else ''


def step_records(steps, product_xid, prefix, templates):
    out = []
    for seq, st in enumerate(steps, start=1):
        art = st.get('artifact') or {}
        tpl = art.get('template')
        if tpl and tpl not in templates:
            templates[tpl] = xid(prefix, 'tpl', tpl)
        out.append(record('ea.product.step', xid(prefix, 'step', st['stage'], st['id']), [
            field('product_id', ref=product_xid) if product_xid else None,
            field('sequence', seq * 10),
            field('stage_id', ref=xid('stage', st['stage'])),
            field('code', st['id']),
            field('name', st['title']),
            field('altitude', ALTITUDES.get(st.get('altitude'))),
            field('how', st.get('how')),
            field('output', st.get('output')),
            field('ref', st.get('ref')),
            field('artifact_name', art.get('name')),
            field('artifact_type', ARTIFACT_TYPES.get(art.get('type'))) if art else None,
            field('template_id', ref=templates[tpl]) if tpl else None,
            field('makes_adr', eval_='True') if 'adr' in st else None,
            field('adr_title', st.get('adr')) if st.get('adr') else None,
        ]))
    return out


def template_records(templates, product_xid, names):
    return [record('ea.product.template', rid, [
        field('product_id', ref=product_xid) if product_xid else None,
        field('code', tid),
        field('name', names.get(tid, tid)),
        field('body', template_body(tid)),
    ]) for tid, rid in templates.items()]


def main():
    recs = []
    for seq, s in enumerate(PLAYBOOK['stages'], start=1):
        recs.append(record('ea.stage', xid('stage', s['id']), [
            field('name', s['label']), field('code', s['id']), field('title', s['name']),
            field('purpose', s['purpose']), field('approver', APPROVER[s['approver']]), field('sequence', seq * 10),
        ]))
    for m in PLAYBOOK['modes']:
        stage_refs = ', '.join(f"ref('{xid('stage', s)}')" for s in m['stages'])
        recs.append(record('ea.mode', xid('mode', m['id']), [
            field('name', m['name']), field('number', m['id']), field('touch', m['touch']), field('load', m['load']),
            field('when', m['when']), field('ea_role', m['ea_role']), field('color', MODE_COLORS[m['id']]),
            field('stage_ids', eval_=f'[(6, 0, [{stage_refs}])]'),
        ]))
    for stage, items in PLAYBOOK['checklists'].items():
        for seq, c in enumerate(items, start=1):
            modes = ', '.join(f"ref('{xid('mode', n)}')" for n in c.get('modes', []))
            recs.append(record('ea.gate.criterion', xid('crit', stage, c['id']), [
                field('stage_id', ref=xid('stage', stage)), field('sequence', seq * 10), field('code', c['id']),
                field('name', c['text']), field('optional', eval_='True') if c.get('optional') else None,
                field('mode_ids', eval_=f'[(6, 0, [{modes}])]') if modes else None,
            ]))
    for seq, p in enumerate(PLAYBOOK['principles'], start=1):
        recs.append(record('ea.principle', xid('principle', seq), [field('sequence', seq * 10), field('name', p['name']), field('description', p['text'])]))

    # Generic Planting Seed steps (no product) and their shared templates.
    generic_templates = {}
    steps = [dict(st, stage=stage) for stage, items in PLAYBOOK['default_steps'].items() for st in items]
    step_recs = step_records(steps, None, 'default', generic_templates)
    recs += template_records(generic_templates, None, {'dokumen-kerja': 'Dokumen Kerja Arsitektur'})
    recs += step_recs

    for p in PLAYBOOK['seed_products']:
        pid = xid('product', p['id'])
        recs.append(record('ea.product', pid, [
            field('name', p['name']), field('code', p['id']), field('sop_output', p.get('sop_output')),
            field('service', SERVICES.get(p.get('service'))), field('customer', p.get('customer')),
            field('decision', p['decision']), field('when_to_use', p.get('when')), field('deliverable', p['deliverable']),
            field('default_mode_id', ref=xid('mode', p['default_mode'])), field('version', p.get('version', '0.1')),
            field('maturity', (p.get('maturity') or 'Draft').lower()), field('ref', p.get('ref')),
        ]))
        steps = [dict(st, stage=stage) for stage, items in p['stages'].items() for st in items]
        templates = {t['template']: xid(p['id'], 'tpl', t['template']) for t in p.get('tools', []) if t.get('template')}
        step_recs = step_records(steps, pid, p['id'], templates)
        recs += template_records(templates, pid, {t['template']: t['name'] for t in p.get('tools', []) if t.get('template')})
        recs += step_recs
        for seq, t in enumerate(p.get('tools', []), start=1):
            recs.append(record('ea.product.tool', xid(p['id'], 'tool', seq), [
                field('product_id', ref=pid), field('sequence', seq * 10), field('name', t['name']), field('ref', t.get('ref')),
                field('template_id', ref=templates[t['template']]) if t.get('template') else None,
            ]))

    OUT.write_text('<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated by odoo/tools/gen_data.py from playbook.json. Do not edit by hand. -->\n'
                   '<odoo noupdate="1">\n' + '\n'.join(recs) + '\n</odoo>\n')
    print(f'{OUT.relative_to(ROOT)}: {len(recs)} records')


if __name__ == '__main__':
    main()
