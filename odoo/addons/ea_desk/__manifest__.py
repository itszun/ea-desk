{
    'name': 'EA Desk',
    'version': '18.0.1.3.0',
    'category': 'Productivity',
    'summary': 'Manajemen kerja fungsi Enterprise Architecture: Planting Seed, Mode EA, ADR, Produk EA',
    'description': """
Sistem manajemen kerja fungsi EA (bukan tool pemodelan).
Engagement mengikuti siklus tata kelola Planting Seed (/seed, /sprout, /cultivate, /harvest)
dengan 4 Mode Keterlibatan EA. Setiap engagement memesan sebuah Produk EA, yang membawa
resep kerja (metode), template, dan tools sendiri.
""",
    'author': 'Abdul Malik Aljun',
    'license': 'LGPL-3',
    'depends': ['base', 'mail'],
    'data': [
        'security/ea_security.xml',
        'security/ir.model.access.csv',
        'data/ea_sequence.xml',
        'data/ea_config_data.xml',
        'data/ea_reference_data.xml',
        'data/ea_playbook_data.xml',
        'views/ea_config_views.xml',
        'views/ea_product_views.xml',
        'views/ea_decision_views.xml',
        'views/ea_artifact_views.xml',
        'views/ea_foundation_views.xml',
        'views/ea_reference_views.xml',
        'views/ea_issue_views.xml',
        'views/ea_document_views.xml',
        'wizard/ea_gate_wizard_views.xml',
        'views/ea_engagement_views.xml',
        'views/ea_menus.xml',
    ],
    'assets': {
        'web._assets_primary_variables': [
            ('prepend', 'ea_desk/static/src/scss/primary_variables.scss'),
        ],
        'web.assets_backend': [
            'ea_desk/static/src/scss/ea_desk.scss',
            'ea_desk/static/lib/marked/marked.min.js',
            'ea_desk/static/src/markdown/markdown_field.js',
            'ea_desk/static/src/markdown/markdown_field.xml',
            'ea_desk/static/src/dashboard/executive_summary.js',
            'ea_desk/static/src/dashboard/executive_summary.xml',
        ],
    },
    'post_init_hook': 'post_init_hook',
    'application': True,
    'installable': True,
}
