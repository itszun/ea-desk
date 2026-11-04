#!/usr/bin/env bash
# Promote a REVIEWED commit to production. Run by Claude or the owner only, never by agy.
#   odoo/tools/release.sh <commit>
# Steps: backup → move the release worktree to <commit> → upgrade ea_desk → restart Odoo → restart POC.
set -euo pipefail
REL=/home/clouduser/Projects/ea-desk-release
commit=${1:?Usage: release.sh <commit>}
DEV=/home/clouduser/Projects/ea-desk
# Preflight: production only gets what is in git. Refuse if module files are ignored or untracked.
stray=$(git -C "$DEV" status --porcelain --ignored -- odoo/addons | grep -vE "__pycache__|\.pyc$" || true)
[ -z "$stray" ] || { echo "Module files not in git (would be missing in production):" >&2; echo "$stray" >&2; exit 1; }
cd "$REL"
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "Release worktree has local changes; aborting." >&2; exit 1; }
"$REL/odoo/tools/backup.sh"
git checkout -q --detach "$commit"
echo "release worktree → $(git log -1 --oneline)"
cd "$REL/odoo"
docker compose stop odoo
log=$(mktemp /tmp/ea-release-XXXX.log)
if ! docker compose run --rm -T odoo odoo -d ea_desk -u ea_desk --stop-after-init >"$log" 2>&1 || grep -qE " (ERROR|CRITICAL) " "$log"; then
  echo "Upgrade failed; Odoo left STOPPED for inspection. Log: $log" >&2
  grep -E " (ERROR|CRITICAL) |Error: " "$log" | tail -5 >&2
  exit 1
fi
docker compose up -d
for i in $(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:8069/web/login && break; sleep 2; done
curl -s -o /dev/null -w "odoo: HTTP %{http_code}\n" http://127.0.0.1:8069/web/login
systemctl --user restart ea-desk
for i in $(seq 1 15); do curl -sf -o /dev/null http://127.0.0.1:8090/ && break; sleep 1; done
curl -s -o /dev/null -w "poc: HTTP %{http_code}\n" http://127.0.0.1:8090/
