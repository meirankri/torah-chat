# Features Tracker — Chatbot Torah IA

> Ce fichier est mis à jour automatiquement par Claude Code.
> Chaque `[x]` signifie que la feature a été implémentée et commitée.

---

## Phase 1 — Setup projet
- [x] Init projet React Router v7 (Remix) + TypeScript strict + Tailwind CSS (sur Cloudflare)
- [x] Setup Vitest + React Testing Library + miniflare (config + premiers tests smoke)
- [x] Config Wrangler + Cloudflare Workers (backend API)
- [x] Setup D1 schema (users, conversations, messages, sources)
- [x] Setup KV namespace (cache sources Sefaria)
- [x] Config ESLint + Prettier
- [x] Setup structure hexagonale (domain / application / infrastructure)
- [x] Fichier .env.example avec toutes les variables nécessaires

## Phase 2 — P0 Module Chat (interface)
- [x] Interface chat : champ de saisie avec support multilingue
- [x] Affichage des messages (user + assistant) avec Markdown rendering
- [x] Streaming LLM via SSE (Workers AI)
- [x] System prompt configurable (stocké dans un fichier, pas hard-codé)
- [x] Indication de frappe (typing animation) pendant la génération
- [x] Auto-scroll pendant le streaming (avec détection scroll utilisateur)
- [x] Gestion des erreurs chat (timeout, API down, quota dépassé, input trop long)

## Phase 3 — P0 Système de Sources Sefaria
- [x] Intégration Sefaria Linker API (POST /api/find-refs) pour extraction des citations
- [x] Récupération textes Sefaria (GET /api/v3/texts/{ref}) hébreu + traduction EN/FR
- [x] Composant bloc source (replié par défaut, déplié au clic, badge catégorie)
- [x] Lien "Voir sur Sefaria" dans chaque bloc source
- [x] Gestion erreur Sefaria (fallback : réponse sans sources + message)

## Phase 4 — P0 Authentification
- [x] Inscription email + password (validation, email de confirmation)
- [x] Connexion email + password
- [x] Google OAuth (bouton "Continuer avec Google")
- [x] JWT : access token (15min) + refresh token (7j) en cookies httpOnly
- [x] Mot de passe oublié (email avec lien reset, token expire 1h)
- [x] Protection brute force (5 essais ratés → blocage 15 min)
- [x] Page profil utilisateur (lecture : email, nom, langue, plan, questions restantes)

## Phase 5 — P0 Gestion des Conversations
- [x] CRUD conversations (créer, lister, lire, supprimer)
- [x] Sidebar liste conversations (triée par date, titre + date relative)
- [x] Titre auto-généré par LLM après le 1er échange
- [x] Renommer une conversation (édition inline)
- [x] Contexte conversationnel (N derniers messages envoyés au LLM, configurable)
- [x] Bouton "Nouvelle conversation"
- [x] Archiver une conversation (section Archives repliable dans la sidebar, désarchivage)

## Phase 6 — P0 Multilingue (i18n)
- [x] Setup i18n avec fichiers JSON (fr.json, en.json, he.json)
- [x] Toutes les chaînes UI dans les fichiers de traduction
- [x] Support RTL complet pour l'hébreu (layout mirroré, dir="rtl")
- [x] Sélecteur de langue dans le header
- [x] Détection langue navigateur (fallback anglais)
- [x] Sauvegarde préférence langue (profil si connecté, cookie sinon)

## Phase 7 — P0 Paiement Stripe
- [x] Création Stripe Customer à l'inscription
- [x] Page pricing avec les 3 plans (Free trial, Standard, Premium)
- [x] Stripe Checkout Sessions (redirect vers Stripe)
- [x] Webhooks Stripe : checkout.session.completed, subscription.updated/deleted, invoice events
- [x] Compteur questions/mois (incrémentation + reset mensuel)
- [x] Switch modèle LLM selon le plan (Llama 8B → 70B → Claude/GPT)
- [x] Portail client Stripe (lien "Gérer mon abonnement")

## Phase 8 — P0 PWA
- [x] manifest.json (nom, icônes 192+512px, theme_color, display standalone)
- [x] Service Worker (cache app shell, network-first pour API)
- [x] Page offline ("Connexion requise pour poser une question")
- [x] Bannière "Ajouter à l'écran d'accueil"

## Phase 9 — P1 Améliorations
- [x] Bouton Stop generation
- [x] Bouton Regenerate (regénérer dernière réponse)
- [x] Bouton Copy response
- [x] Questions suggérées (3-4 chips au démarrage)
- [x] Cache sources Sefaria dans KV (TTL 24h configurable)
- [x] Rate limiting (30 req/min → HTTP 429)
- [x] Emails transactionnels Brevo (confirmation inscription, reset password, rappel trial)
- [x] Apple Sign-In

## Phase 11 — P2 Améliorations UX
- [x] Feedback 👍/👎 sur chaque réponse (stocké en DB, table message_feedback)
- [x] Notification quota 80% : bannière amber avec CTA upgrade vers /pricing
- [x] Modification du nom dans le profil (édition inline avec PATCH /api/profile)
- [x] Suppression de compte RGPD (DELETE /api/profile — annule Stripe + supprime toutes les données, confirmation modale)

## Phase 12 — P2 Partage & SEO

- [x] Partage de conversations (lien public lecture seule `/share/:token`, révocation, bouton sidebar)

## Phase 13 — Dashboard Admin

- [x] Dashboard admin `/admin` (stats utilisateurs par plan, questions ce mois, conversations, feedback, taux de satisfaction — protégé par ADMIN_SECRET)

## Phase 14 — RAG Sources Custom

- [x] Service RAG Vectorize : chunking, embedding Workers AI (@cf/baai/bge-base-en-v1.5), query top-K
- [x] Route admin POST /api/admin/custom-texts — ingestion textes (title, author, category, content → chunks → Vectorize + D1)
- [x] Intégration dans api.chat.ts : sources custom enrichissent le contexte LLM + affichage frontend comme bloc source "custom"

## Phase 10 — DevOps / Production
- [x] GitHub Actions CI/CD (tests + build + deploy Cloudflare Workers sur push main)
- [x] .env.example complet (toutes les variables, Apple Sign-In, CRON_SECRET, GEMINI_API_KEY)
