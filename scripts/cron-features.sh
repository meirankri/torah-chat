#!/bin/bash
export PATH="/Users/meirankri/.local/bin:/Users/meirankri/.nvm/versions/node/v24.11.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="/Users/meirankri"

cd /Users/meirankri/Documents/torah-chat

# Logs horodatés par run
LOG_DIR="/Users/meirankri/Documents/torah-chat/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/cron-$(date +%Y%m%d-%H%M%S).log"

echo "=== Run started at $(date) ===" >> "$LOG"

# Garde-fou anti-exécution simultanée
LOCKFILE="/tmp/torah-chat-cron.lock"
if [ -f "$LOCKFILE" ]; then
  echo "Another instance is running, skipping" >> "$LOG"
  exit 0
fi
trap "rm -f $LOCKFILE" EXIT
touch "$LOCKFILE"

/Users/meirankri/.local/bin/claude -p "Lis features-tracker.md, trouve les prochaines features non faites, et implémente le prochain batch. Suis le workflow du CLAUDE.md. À la fin : 1) lance npm run test — tous les tests doivent passer 2) lance npm run build — le build doit passer 3) si tout est OK, fais git add des fichiers modifiés et git commit avec un message descriptif au format feat: <description>. Ne push PAS." --dangerously-skip-permissions >> "$LOG" 2>&1

EXIT_CODE=$?
echo "=== Claude exited with code $EXIT_CODE at $(date) ===" >> "$LOG"
