#!/usr/bin/env python3
"""Point ea.weiwu.my.id at Odoo, with a per-browser switch back to the POC.

    sudo python3 deploy/caddy_ea_switch.py          # install the switch block
    sudo python3 deploy/caddy_ea_switch.py --poc    # roll back: whole site → POC only
    python3 deploy/caddy_ea_switch.py --file /tmp/x --no-reload   # dry run on a copy

Keeps the existing basicauth lines, backs up the Caddyfile, validates, reloads,
and restores the backup if validation or reload fails.
"""
import re
import shutil
import subprocess
import sys
import time

CADDYFILE = '/etc/caddy/Caddyfile'
SITE = 'ea.weiwu.my.id'

SWITCH = """
	# Per-browser switch: /_poc → POC (8090) until the browser closes, /_odoo → Odoo (8069, default).
	handle /_poc {{
		header Set-Cookie "ea_view=poc; Path=/; Secure; HttpOnly; SameSite=Lax"
		redir * / 302
	}}
	handle /_odoo {{
		header Set-Cookie "ea_view=odoo; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax"
		redir * /odoo 302
	}}
	@poc header Cookie *ea_view=poc*
	handle @poc {{
		reverse_proxy 127.0.0.1:8090
	}}
	handle {{
		reverse_proxy 127.0.0.1:8069
	}}
"""
POC_ONLY = """
	reverse_proxy 127.0.0.1:8090
"""


def site_block(text):
    """Return (start, end) of the `ea.weiwu.my.id { ... }` block, matching braces."""
    m = re.search(r'(?m)^' + re.escape(SITE) + r'\s*\{', text)
    if not m:
        sys.exit(f'Blok {SITE} tidak ditemukan di {CADDYFILE}.')
    depth, i = 0, m.end() - 1
    while i < len(text):
        depth += {'{': 1, '}': -1}.get(text[i], 0)
        if depth == 0:
            return m.start(), i + 1
        i += 1
    sys.exit('Kurung kurawal blok tidak seimbang.')


def main():
    global CADDYFILE
    poc_only = '--poc' in sys.argv
    if '--file' in sys.argv:  # test against a copy
        CADDYFILE = sys.argv[sys.argv.index('--file') + 1]
    reload_cmd = [] if '--no-reload' in sys.argv else ['systemctl', 'reload', 'caddy']
    text = open(CADDYFILE).read()
    start, end = site_block(text)
    auth = re.search(r'(?ms)^\s*(basicauth|basic_auth)\s*\{.*?^\s*\}', text[start:end])
    if not auth:
        sys.exit('Blok basicauth tidak ditemukan; batal supaya situs tidak terbuka tanpa login.')
    body = (POC_ONLY if poc_only else SWITCH.format())
    new_block = f'{SITE} {{\n{auth.group(0).rstrip()}\n{body}}}'
    backup = f'{CADDYFILE}.bak-{time.strftime("%Y%m%d-%H%M%S")}'
    shutil.copy2(CADDYFILE, backup)
    open(CADDYFILE, 'w').write(text[:start] + new_block + text[end:])
    try:
        subprocess.run(['caddy', 'validate', '--config', CADDYFILE, '--adapter', 'caddyfile'], check=True, capture_output=True)
        if reload_cmd:
            subprocess.run(reload_cmd, check=True)
    except subprocess.CalledProcessError as err:
        shutil.copy2(backup, CADDYFILE)
        if reload_cmd:
            subprocess.run(reload_cmd)
        sys.exit(f'Gagal ({err}); Caddyfile dikembalikan dari {backup}.\n{(err.stderr or b"").decode()[-800:]}')
    print(f'OK: {SITE} → {"POC saja" if poc_only else "Odoo (+ /_poc untuk review POC)"}. Backup: {backup}')


if __name__ == '__main__':
    main()
