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
- [ ] Interface chat : champ de saisie avec support multilingue
- [ ] Affichage des messages (user + assistant) avec Markdown rendering
- [ ] Streaming LLM via SSE (Workers AI)
- [x] System prompt configurable (stocké dans un fichier, pas hard-codé)
- [ ] Indication de frappe (typing animation) pendant la génération
- [ ] Auto-scroll pendant le streaming (avec détection scroll utilisateur)
- [ ] Gestion des erreurs chat (timeout, API down, quota dépassé, input trop long)

## Phase 3 — P0 Système de Sources Sefaria
- [ ] Intégration Sefaria Linker API (POST /api/find-refs) pour extraction des citations
- [ ] Récupération textes Sefaria (GET /api/v3/texts/{ref}) hébreu + traduction EN/FR
- [ ] Composant bloc source (replié par défaut, déplié au clic, badge catégorie)
- [ ] Lien "Voir sur Sefaria" dans chaque bloc source
- [ ] Gestion erreur Sefaria (fallback : réponse sans sources + message)

## Phase 4 — P0 Authentification
- [ ] Inscription email + password (validation, email de confirmation)
- [ ] Connexion email + password
- [ ] Google OAuth (bouton "Continuer avec Google")
- [ ] JWT : access token (15min) + refresh token (7j) en cookies httpOnly
- [ ] Mot de passe oublié (email avec lien reset, token expire 1h)
- [ ] Protection brute force (5 essais ratés → blocage 15 min)
- [ ] Page profil utilisateur (lecture : email, nom, langue, plan, questions restantes)

## Phase 5 — P0 Gestion des Conversations
- [ ] CRUD conversations (créer, lister, lire, supprimer)
- [ ] Sidebar liste conversations (triée par date, titre + date relative)
- [ ] Titre auto-généré par LLM après le 1er échange
- [ ] Renommer une conversation (édition inline)
- [ ] Contexte conversationnel (N derniers messages envoyés au LLM, configurable)
- [ ] Bouton "Nouvelle conversation"

## Phase 6 — P0 Multilingue (i18n)
- [ ] Setup i18n avec fichiers JSON (fr.json, en.json, he.json)
- [ ] Toutes les chaînes UI dans les fichiers de traduction
- [ ] Support RTL complet pour l'hébreu (layout mirroré, dir="rtl")
- [ ] Sélecteur de langue dans le header
- [ ] Détection langue navigateur (fallback anglais)
- [ ] Sauvegarde préférence langue (profil si connecté, cookie sinon)

## Phase 7 — P0 Paiement Stripe
- [ ] Création Stripe Customer à l'inscription
- [ ] Page pricing avec les 3 plans (Free trial, Standard, Premium)
- [ ] Stripe Checkout Sessions (redirect vers Stripe)
- [ ] Webhooks Stripe : checkout.session.completed, subscription.updated/deleted, invoice events
- [ ] Compteur questions/mois (incrémentation + reset mensuel)
- [ ] Switch modèle LLM selon le plan (Llama 8B → 70B → Claude/GPT)
- [ ] Portail client Stripe (lien "Gérer mon abonnement")

## Phase 8 — P0 PWA
- [ ] manifest.json (nom, icônes 192+512px, theme_color, display standalone)
- [ ] Service Worker (cache app shell, network-first pour API)
- [ ] Page offline ("Connexion requise pour poser une question")
- [ ] Bannière "Ajouter à l'écran d'accueil"

## Phase 9 — P1 Améliorations
- [ ] Bouton Stop generation
- [ ] Bouton Regenerate (regénérer dernière réponse)
- [ ] Bouton Copy response
- [ ] Questions suggérées (3-4 chips au démarrage)
- [ ] Cache sources Sefaria dans KV (TTL 24h configurable)
- [ ] Rate limiting (30 req/min → HTTP 429)
- [ ] Emails transactionnels Brevo (confirmation inscription, reset password, rappel trial)
- [ ] Apple Sign-In
