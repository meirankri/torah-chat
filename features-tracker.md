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

## Phase 15 — P3 Export & Admin

- [x] Export conversation en Markdown (GET /api/conversations/:id/export + bouton téléchargement dans sidebar)
- [x] Suppression textes custom admin (DELETE /api/admin/custom-texts?title=)

## Phase 16 — P3 SEO Pages Statiques

- [x] Route /questions/:slug — page SSR avec JSON-LD FAQ schema, meta description, sources
- [x] Route /questions — index des questions publiées groupées par catégorie + CTA chat
- [x] API admin CRUD /api/admin/static-questions (POST/GET/DELETE, auto-slug)
- [x] Migration D1 0003_static_questions (slug UNIQUE, published, sources_json)

## Phase 17 — SEO Technique & Monitoring

- [x] GET /sitemap.xml — sitemap dynamique (pages statiques + /questions/:slug publiées)
- [x] GET /robots.txt — Disallow admin/api, Sitemap pointant vers l'origine
- [x] GET /api/health — healthcheck DB (200 ok / 503 degraded, no-cache)
- [x] Admin dashboard enrichi — section Contenu (textes RAG, chunks, pages SEO publiées)

## Phase 18 — RAG multilingue + Infra

- [x] Migration RAG : bge-base-en-v1.5 → bge-m3 (multilingue HE/FR/EN, configurable via EMBEDDING_MODEL)
- [x] generateEmbedding / queryVectorize / retrieveCustomSources acceptent un model override
- [x] POST /api/cron/reset-quotas — reset bulk mensuel des compteurs questions (CRON_SECRET)
- [x] .env.example documenté avec EMBEDDING_MODEL

## Phase 19 — Crons Cloudflare + Config

- [x] Handler scheduled() dans workers/app.ts — dispatch trial-reminders (0 9 * * *) et reset-quotas (0 0 1 * *)
- [x] wrangler.jsonc triggers.crons configurés + vars APP_VERSION, PLAN_PREMIUM_QUESTIONS_LIMIT, EMBEDDING_MODEL
- [x] PLAN_PREMIUM_QUESTIONS_LIMIT lu depuis env dans api.chat.ts (était hardcodé)

## Phase 10 — DevOps / Production
- [x] GitHub Actions CI/CD (tests + build + deploy Cloudflare Workers sur push main)
- [x] .env.example complet (toutes les variables, Apple Sign-In, CRON_SECRET, GEMINI_API_KEY)

## Phase 20 — RAG Sefaria via Gemini Embedding + Vectorize

- [x] Benchmark embedding models sur golden set Sefaria (3708 paires HE↔EN)
  - bge-m3 : 36% recall@1 (insuffisant sur araméen)
  - Gemini Embedding 001 : 95.8% recall@1 (retenu)
- [x] Index Vectorize `torah-chat-sefaria` (1536 dim, cosine, metadata indexes book/category)
- [x] Migration D1 `sefaria_chunks` + `sefaria_ingestion_log`
- [x] Script `fetch-sefaria-corpus.ts` : fetch API Sefaria → NDJSON (Torah + Rashi + Mishna + 3 Talmud)
- [x] Script `ingest-sefaria.ts` : embed Gemini (1536 dim, RETRIEVAL_DOCUMENT) + upsert Vectorize/D1 via REST CF
- [x] Corpus ingéré : 27 868 chunks (Torah 5846 + Rashi 7793 + Mishna 4192 + Talmud 10037)
- [x] Service `sefaria-rag-service.ts` : embed query (RETRIEVAL_QUERY) → Vectorize → fetch D1
- [x] Intégration dans `api.chat.ts` : RAG prioritaire + fallback Sefaria ES

## Phase 21 — Agent de recherche autonome (ReAct)

- [x] `GeminiAgentClient` avec function calling (Gemini 2.5 Flash)
- [x] `search-agent.ts` : boucle ReAct max 3 itérations
- [x] Outils : vectorize_search, exact_text_search, keyword_search, get_text, finish
- [x] `searchByHebrewPhrase` dans SefariaClient (phrase HE exacte + filtre category via ES)
- [x] Déduplication + tri (exact > sémantique) + context builder
- [x] Résout le problème d'exhaustivité (ex: 3 occurrences viande/lait → toutes trouvées)

## Phase 22 — Sélecteur de modèle Standard/Premium

- [x] Migration `gemini_credits` (5 par défaut pour tous les users)
- [x] `isGeminiEligible()` + `decrementGeminiCredits()` dans quota-service
- [x] Dual pipeline dans `api.chat.ts` : Standard (Llama 70B + RAG direct) / Premium (Agent Gemini)
- [x] API accepte `model: "standard" | "premium"` dans le body, retourne `modelUsed` + `geminiCreditsRemaining`
- [x] Composant `ModelSelector.tsx` : dropdown Standard/Premium avec crédits restants
- [x] `use-chat.ts` : state selectedModel + envoi dans le fetch + lecture crédits
- [x] i18n FR/EN/HE pour tous les labels
- [x] Pin React 19.0.0 (fix bug useContext hydratation React 19.1+)
- [x] Fix imports profile.tsx (imports après export causait duplicate React dans Vite)
