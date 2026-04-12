#!/bin/bash

# ============================================
# Script d'automatisation Claude Code
# Lance Claude Code pour implémenter la prochaine feature
# ============================================

set -euo pipefail

PROJECT_DIR="/Users/meirankri/Documents/torah-chat"
LOG_DIR="$PROJECT_DIR/logs"
ENV_FILE="$PROJECT_DIR/.env.automation"

# Créer le dossier de logs si nécessaire
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/claude_$TIMESTAMP.log"

echo "=== Claude Code Run: $(date) ===" >> "$LOG_FILE"

# Charger les variables d'environnement (Cloudflare, Stripe, etc.)
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Claude Code utilise l'auth via le compte Claude (abonnement Max)
# Pas besoin de ANTHROPIC_API_KEY

# Se placer dans le répertoire du projet
cd "$PROJECT_DIR"

# Vérifier qu'il reste des features à faire
if ! grep -q '\[ \]' features-tracker.md; then
    echo "Toutes les features sont terminées !" >> "$LOG_FILE"
    exit 0
fi

# Lancer Claude Code
claude --dangerously-skip-permissions \
    -p "Tu es en mode automatisé. Suis EXACTEMENT les instructions de CLAUDE.md. Lis features-tracker.md et trouve la PROCHAINE feature non cochée ('[ ]'). Implémente-la en suivant les specs de features-specification.md. OBLIGATOIRE : écris des tests unitaires (Vitest + Testing Library) et des tests d'intégration pour chaque feature. Lance 'npm run test' et 'npm run build' — ne committe QUE si tout passe. Mets à jour features-tracker.md en cochant '[x]'. Committe avec 'git add' des fichiers pertinents puis 'git commit'. Ne fais QU'UNE SEULE feature. Si le projet n'est pas initialisé (pas de package.json), commence par la Phase 1 et inclus la config Vitest + Testing Library dans le setup." \
    --output-format text \
    >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

echo "=== Fin (exit code: $EXIT_CODE): $(date) ===" >> "$LOG_FILE"

# Garder seulement les 50 derniers logs
ls -t "$LOG_DIR"/claude_*.log | tail -n +51 | xargs rm -f 2>/dev/null || true
