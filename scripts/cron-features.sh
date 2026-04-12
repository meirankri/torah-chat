#!/bin/bash
export PATH="/Users/meirankri/.local/bin:/Users/meirankri/.nvm/versions/node/v24.11.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="/Users/meirankri"

cd /Users/meirankri/Documents/torah-chat

LOG="/tmp/torah-chat-cron.log"

echo "=== Run started at $(date) ===" >> "$LOG"

# stdbuf force le flush ligne par ligne pour voir en temps réel
stdbuf -oL /Users/meirankri/.local/bin/claude -p "Lis features-tracker.md, trouve les prochaines features non faites, et implémente le prochain batch. Suis le workflow du CLAUDE.md. À la fin : 1) lance npm run test — tous les tests doivent passer 2) lance npm run build — le build doit passer 3) si tout est OK, fais git add des fichiers modifiés et git commit avec un message descriptif au format feat: <description>. Ne push PAS." --dangerously-skip-permissions >> "$LOG" 2>&1

echo "=== Run finished at $(date) ===" >> "$LOG"
