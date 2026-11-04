#!/usr/bin/env bash
# Dump the production database and filestore to ~/.local/share/ea-desk/backups/<timestamp>/.
set -euo pipefail
dir="$HOME/.local/share/ea-desk/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$dir"
docker exec ea-desk-db-1 pg_dump -U odoo -Fc ea_desk > "$dir/ea_desk.dump"
docker exec ea-desk-odoo-1 tar -C /var/lib/odoo -cz filestore/ea_desk > "$dir/filestore.tgz" 2>/dev/null || true
cp -a "$HOME/.local/share/ea-desk/poc/ea-desk.db" "$dir/poc.db" 2>/dev/null || true
ls -la "$dir"
