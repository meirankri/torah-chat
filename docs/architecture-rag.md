---
name: RAG Sefaria + Agent + Model Tiering
description: Architecture complète du système de sources et de tiering modèle — Gemini Embedding, Vectorize, agent ReAct, sélecteur Standard/Premium
type: project
originSessionId: c6198da6-fe5d-43a3-8ddd-488c207acc76
---
## Architecture RAG Sefaria (déployé 2026-04-16)

**Embedding** : `gemini-embedding-001` (1536 dim Matryoshka, truncated depuis 3072).
- Benchmark officiel Sefaria : 95.8% recall@1 sur 3708 paires HE↔EN
- bge-m3 (Workers AI) testé et rejeté : 36% recall@1, s'effondre sur araméen
- **Why:** Gemini couvre tout (Tanakh 94%, Talmud 94%, Yerushalmi 97%, Targum 100%)
- **How to apply:** Tout retrieval utilise Gemini Embedding. Index Vectorize `torah-chat-sefaria` (1536 dim, cosine). Metadata indexes : `book`, `category`.

**Corpus** : 27 868 chunks — Torah 5 livres + Rashi + Mishna 63 traités + Talmud Bavli (Berakhot, Shabbat, Pesachim).
- Scripts : `scripts/fetch-sefaria-corpus.ts` (Sefaria API → NDJSON) + `scripts/ingest-sefaria.ts` (embed + Vectorize/D1 via REST)
- D1 table `sefaria_chunks`, Vectorize binding `VECTORIZE_SEFARIA`

## Agent de recherche ReAct (déployé 2026-04-16)

**Fichier** : `app/application/services/search-agent.ts`
- Gemini 2.5 Flash avec function calling, max 3 itérations
- 5 outils : vectorize_search, exact_text_search, keyword_search, get_text, finish
- Résout l'exhaustivité (ex: "viande/lait dans la Torah" → 3 refs via exact_text_search)
- `GeminiAgentClient` dans `gemini-client.ts` : step() method avec tools

## Tiering Standard/Premium (déployé 2026-04-17)

- **Standard** = Llama 70B (Workers AI, gratuit, illimité) + RAG direct Vectorize
- **Premium** = Gemini (agent ReAct + chat) — 5 crédits à vie pour free, illimité payants
- Champ `gemini_credits` dans `users` (migration 0005)
- `isGeminiEligible(plan, credits)` dans quota-service
- `api.chat.ts` accepte `model: "standard"|"premium"`, retourne `modelUsed` + `geminiCreditsRemaining`
- Frontend : `ModelSelector.tsx` dropdown à côté du ChatInput

## Limites connues

- Vectorize binding `VECTORIZE_SEFARIA` ne marche PAS en local dev → tester en déployé
- React **pinné à 19.0.0** (19.1+ casse hydratation avec React Router 7 — issue #13998)
- Service Worker PWA cache vieux bundles → clear cache si bug `useContext` 
- Llama 70B ne supporte pas le function calling → pas d'agent en mode Standard
- Corpus Sefaria partiel : manque Talmud complet, Prophètes, Ketuvim, Rambam, Shulhan Aroukh
