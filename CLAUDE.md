# Torah Chat — Chatbot IA avec Sources

## Stack technique
- Backend: Cloudflare Workers (Wrangler)
- DB: Cloudflare D1 (SQLite)
- Vector: Cloudflare Vectorize (index `torah-chat-sefaria`, 1536 dim, cosine)
- Embedding: Gemini Embedding 001 (via REST API, taskType RETRIEVAL_QUERY/DOCUMENT)
- Cache: Cloudflare KV
- LLM Standard: Workers AI Llama 3.1-70B (gratuit, illimité)
- LLM Premium: Google Gemini 2.5 Flash (via REST API, function calling pour l'agent)
- Frontend: React Router v7 + TypeScript + Tailwind CSS + Vite
- Auth: Email + Google + Apple OAuth (JWT httpOnly cookies)
- Paiement: Stripe Checkout + Webhooks
- i18n: FR/EN/HE avec support RTL
- Emails: Brevo (transactionnels)

## Architecture RAG / Sources

### Pipeline Premium (Gemini — agent de recherche ReAct)
1. L'utilisateur envoie une question avec `model: "premium"`
2. `search-agent.ts` → Gemini 2.5 Flash avec function calling, max 3 itérations
3. Outils dispo : `vectorize_search`, `exact_text_search`, `keyword_search`, `get_text`, `finish`
4. Sources accumulées, dédupliquées, triées (exact > sémantique)
5. Gemini génère la réponse finale avec les sources en contexte

### Pipeline Standard (Llama 70B — RAG direct)
1. L'utilisateur envoie une question avec `model: "standard"`
2. `sefaria-rag-service.ts` → embed question via Gemini Embedding → query Vectorize top-5
3. Llama 70B génère la réponse avec les sources RAG en contexte

### Corpus Sefaria indexé (27 868 chunks)
- Torah 5 livres (5 846 versets) + Rashi sur Torah (7 793 commentaires)
- Mishna complète 63 traités (4 192 mishnayot)
- Talmud Bavli : Berakhot, Shabbat, Pesachim (10 037 lignes)
- Scripts d'ingestion : `scripts/fetch-sefaria-corpus.ts` + `scripts/ingest-sefaria.ts`
- DB : table `sefaria_chunks` (D1), index Vectorize `torah-chat-sefaria`

### Sélecteur de modèle
- Free users : 5 crédits Premium à vie + Standard illimité
- Standard/Premium plans : Premium illimité
- Champ `gemini_credits` dans la table `users` (migration 0005)
- Frontend : `ModelSelector.tsx` → dropdown Standard/Premium avec crédits restants

## Règles strictes
- Ne JAMAIS utiliser `any` en TypeScript — utiliser des types stricts
- Réutiliser le code existant au maximum
- Architecture hexagonale : domain / application / infrastructure
- Pas de code hard-codé pour les textes UI — tout dans les fichiers i18n
- Pas de secrets dans le code — tout en variables d'environnement
- System prompt configurable via fichier (pas hard-codé)
- Chaque feature DOIT avoir des tests (voir section Tests ci-dessous)

## Tests — OBLIGATOIRE
Chaque feature implémentée DOIT être accompagnée de tests. Ne JAMAIS committer sans que les tests passent.

### Stack de tests
- **Framework** : Vitest (rapide, compatible TypeScript natif)
- **Composants React** : React Testing Library (`@testing-library/react`)
- **API / Workers** : Vitest + `miniflare` pour simuler l'environnement Cloudflare
- **Mocks** : `vitest` built-in (vi.mock, vi.fn) — pas de librairie externe

### Philosophie des tests — MVP first
- **PAS de tests de wording / contenu textuel** (pas de `toHaveTextContent("Mon titre")`)
- **PAS de tests UI cosmétiques** (pas de vérification de classes CSS, couleurs, layout)
- **Uniquement des tests fonctionnels** : le composant se monte, les interactions marchent, la logique métier est correcte, les API répondent correctement
- Objectif : valider que le code **fonctionne**, pas qu'il **affiche le bon texte**

### Types de tests à écrire

**Tests unitaires** (dossier `__tests__/` à côté du fichier testé) :
- Fonctions utilitaires (formatage, validation, parsing)
- Logique métier du domaine (entités, value objects)
- Services applicatifs (use cases) avec mocks des dépendances
- Hooks React custom (avec `renderHook`)
- Exemples : validation email, calcul quota, parsing refs Sefaria, formatage dates

**Tests d'intégration** (dossier `tests/integration/`) :
- Routes API Workers (requête HTTP → réponse, avec D1/KV mockés via miniflare)
- Flow complet chat : envoi question → appel LLM → extraction sources → réponse
- Flow auth : inscription → login → refresh token → accès protégé
- Flow Stripe webhooks : événement → mise à jour DB
- Composants React avec interactions fonctionnelles (clic → action, saisie → soumission)

### Convention de nommage
- Tests unitaires : `maFonction.test.ts` ou `MonComposant.test.tsx`
- Tests d'intégration : `tests/integration/chat-flow.test.ts`

### Règle de commit
1. Implémenter la feature
2. Écrire les tests unitaires correspondants
3. Écrire au moins 1 test d'intégration si la feature touche une API ou un flow utilisateur
4. Lancer `npm run test` — TOUS les tests doivent passer
5. Lancer `npm run build` — le build doit réussir
6. Seulement ALORS committer et cocher la feature dans le tracker
7. **Mettre à jour la documentation** (voir section ci-dessous)

## Documentation — OBLIGATOIRE après chaque feature

**À chaque feature implémentée**, les fichiers suivants DOIVENT être mis à jour dans le même commit (ou un commit `docs:` juste après) :

1. **`features-tracker.md`** — Cocher `[x]` la feature terminée. Si c'est une nouvelle phase, créer la section.
2. **`CLAUDE.md`** — Mettre à jour si la feature change :
   - L'architecture (nouveau service, nouvelle API, nouveau binding)
   - La stack technique (nouveau modèle, nouveau provider)
   - Les fichiers clés (nouveau fichier important ajouté)
   - Les limites connues (nouveau bug connu, nouveau workaround)
3. **`docs/architecture-rag.md`** — Mettre à jour si la feature touche le RAG, l'agent, le tiering, les embeddings, ou le corpus Sefaria.
4. **`docs/known-issues.md`** — Ajouter tout nouveau bug/workaround découvert pendant l'implémentation.

**Règle simple** : si un nouveau développeur (ou une nouvelle IA) ouvrait le projet demain, pourrait-il comprendre ce qui a été fait sans lire le code ? Si non, la doc manque.

## Documents de référence
- `features-specification.md` — Spécifications détaillées de chaque feature
- `cahier-des-charges-chatbot-torah.docx` — Cahier des charges technique
- `features-tracker.md` — Suivi de l'avancement (mis à jour automatiquement)

## Fichiers clés à connaître
- `app/routes/api.chat.ts` — Endpoint chat principal, dual pipeline Standard/Premium
- `app/application/services/search-agent.ts` — Agent ReAct Gemini (function calling)
- `app/application/services/sefaria-rag-service.ts` — RAG direct Vectorize
- `app/infrastructure/gemini/gemini-client.ts` — Client Gemini (chat + agent + embedding)
- `app/infrastructure/sefaria/sefaria-client.ts` — Client API Sefaria (ES, getText, searchByHebrewPhrase)
- `app/application/services/quota-service.ts` — Quotas, crédits Gemini, éligibilité
- `app/components/ModelSelector.tsx` — Sélecteur Standard/Premium dans le chat
- `scripts/fetch-sefaria-corpus.ts` — Fetch textes Sefaria → NDJSON
- `scripts/ingest-sefaria.ts` — Embed Gemini + upsert Vectorize/D1 via REST

## Limites connues
- Vectorize ne fonctionne pas en local dev (binding remote only) → tester en déployé ou via REST API
- React 19.0.0 pinné (19.1+ casse l'hydratation avec React Router 7)
- Service Worker PWA peut cacher de vieux bundles JS → clear via DevTools si bug useContext
- L'agent search (Premium) ne fonctionne qu'avec Gemini (function calling), pas Llama

## Workflow automatisé (quand lancé par le cron)
1. Lire `features-tracker.md` pour identifier l'avancement actuel
2. Regrouper les features restantes qui sont liées et les implémenter ensemble (ex: Wrangler + D1 + KV = un seul batch)
3. Implémenter les features du batch complètement
4. Écrire les tests fonctionnels pour le code ajouté (pas de tests de wording)
5. Écrire les tests d'intégration si les features touchent une API ou un flow
6. Lancer `npm run test` — vérifier que TOUS les tests passent
7. Lancer `npm run build` — vérifier que le build passe
8. Si les tests ou le build échouent : corriger avant de continuer
9. Mettre à jour `features-tracker.md` en cochant `[x]` les features terminées
10. Committer avec un message descriptif au format : "feat: <description>"
11. Priorité MVP : aller vite, pas de sur-ingénierie

## Structure du projet attendue
```
torah-chat/
├── app/                      # React Router (Remix) app
│   ├── routes/               # Routes (file-based routing)
│   ├── components/           # Composants React
│   ├── lib/                  # Logique métier / hooks
│   ├── domain/               # Entités et interfaces du domaine
│   ├── application/          # Use cases / services applicatifs
│   ├── infrastructure/       # Implémentations (API calls, DB, etc.)
│   └── i18n/                 # Fichiers de traduction
├── workers/                  # Cloudflare Workers (backend API)
├── public/                   # Assets statiques + PWA
├── tests/
│   └── integration/          # Tests d'intégration (flows complets)
├── vite.config.ts            # Config Vite + Tailwind + Cloudflare
├── wrangler.jsonc            # Config Cloudflare Workers
└── ...
```
