#!/usr/bin/env bash
# Create odoo/config/{db_password,admin_password,master_password,odoo.conf} once.
# Passwords are random and never printed. The directory is 0700 so other host
# users cannot read them; files are 0644 because the containers run as their own uids.
set -euo pipefail
mkdir -p "$HOME/.config/ea-desk/odoo"
chmod 700 "$HOME/.config/ea-desk" "$HOME/.config/ea-desk/odoo"
cd "$HOME/.config/ea-desk/odoo"
umask 022
gen() { [ -s "$1" ] || openssl rand -base64 30 | tr -d '/+=\n' > "$1"; }
gen db_password
gen admin_password
gen master_password
cat > odoo.conf <<CONF
[options]
addons_path = /mnt/extra-addons
data_dir = /var/lib/odoo
db_host = db
db_port = 5432
db_user = odoo
db_password = $(cat db_password)
db_name = ea_desk
dbfilter = ^ea_desk\$
list_db = False
admin_passwd = $(cat master_password)
proxy_mode = True
workers = 0
max_cron_threads = 1
without_demo = all
limit_time_real = 300
log_level = info
CONF

echo "config ready in $(pwd)"
