# Torah Chat — Chatbot IA avec Sources

## Stack technique
- Backend: Cloudflare Workers (Wrangler)
- DB: Cloudflare D1 (SQLite)
- Vector: Cloudflare Vectorize
- Cache: Cloudflare KV
- LLM: Workers AI (Llama 8B/70B) + optionnel Claude/GPT pour Premium
- Frontend: React Router v7 (Remix) + TypeScript + Tailwind CSS + Vite
- Auth: Email + Google OAuth (JWT httpOnly cookies)
- Paiement: Stripe Checkout + Webhooks
- i18n: FR/EN/HE avec support RTL
- Emails: Brevo (transactionnels)

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

## Documents de référence
- `features-specification.md` — Spécifications détaillées de chaque feature
- `cahier-des-charges-chatbot-torah.docx` — Cahier des charges technique
- `features-tracker.md` — Suivi de l'avancement (mis à jour automatiquement)

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
