from . import models
from . import wizard
from . import controllers


def post_init_hook(env):
    env['ea.product']._ea_apply_doc_defaults()
