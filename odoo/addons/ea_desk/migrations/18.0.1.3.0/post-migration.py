from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    """Existing databases: fill the new document attributes of seed products."""
    env = api.Environment(cr, SUPERUSER_ID, {})
    env['ea.product']._ea_apply_doc_defaults()
