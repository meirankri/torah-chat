#!/bin/bash
cd /Users/meirankri/Documents/torah-chat
/Users/meirankri/.local/bin/claude -p "Lis features-tracker.md, trouve les prochaines features non faites, et implémente le prochain batch. Suis le workflow du CLAUDE.md. À la fin : 1) lance npm run test — tous les tests doivent passer 2) lance npm run build — le build doit passer 3) si tout est OK, fais git add des fichiers modifiés et git commit avec un message descriptif au format feat: <description>. Ne push PAS." --dangerously-skip-permissions >> /tmp/torah-chat-cron.log 2>&1
