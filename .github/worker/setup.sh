#!/usr/bin/env bash
# One-time setup for the now-playing Worker's cron. Run from anywhere in
# the repository:
#
#   bash .github/worker/setup.sh
#
# It logs in to Cloudflare if needed (a browser tab asks you to allow it),
# makes the key the Worker and the listening Action share, asks for the
# GitHub token the Worker starts runs with (typing is hidden), deploys the
# Worker, and starts a run of the listening Action.
set -euo pipefail

REPO=ankthba/ankthba.github.io
cd "$(dirname "$0")"

echo "1/5  Cloudflare"
npx --yes wrangler@4 whoami >/dev/null 2>&1 || npx --yes wrangler@4 login

echo "2/5  The key the Worker and the Action share"
KEY=$(openssl rand -hex 32)
printf '%s' "$KEY" | npx --yes wrangler@4 secret put LOG_KEY
gh secret set LISTENING_BUFFER_KEY --repo "$REPO" --body "$KEY"

echo "3/5  GitHub token"
echo "     github.com > Settings > Developer settings > Fine-grained tokens > Generate:"
echo "     repository $REPO only, permission Actions: Read and write."
read -rsp "     Paste it here (hidden), then Enter: " TOKEN
echo
[ -n "$TOKEN" ] || { echo "No token given."; exit 1; }
printf '%s' "$TOKEN" | npx --yes wrangler@4 secret put GITHUB_TOKEN
unset TOKEN

echo "4/5  Deploy"
git pull --quiet origin main
npx --yes wrangler@4 deploy

echo "5/5  A run now"
gh workflow run listening.yml --repo "$REPO"
echo "Done. From the next quarter hour a Listening run starts every 15 minutes:"
echo "  https://github.com/$REPO/actions/workflows/listening.yml"
