# Features Specification — Chatbot Torah IA

> Document de référence détaillant toutes les fonctionnalités du produit.
> À lire en complément du Cahier des Charges Technique (`.docx`).

---

## Table des matières

1. [Module Chat](#1-module-chat)
2. [Système de Sources](#2-système-de-sources)
3. [Authentification & Comptes](#3-authentification--comptes)
4. [Gestion des Conversations](#4-gestion-des-conversations)
5. [Multilingue (i18n)](#5-multilingue-i18n)
6. [Paiement & Abonnements (Stripe)](#6-paiement--abonnements-stripe)
7. [PWA & Mobile](#7-pwa--mobile)
8. [Administration](#8-administration)
9. [SEO & Marketing](#9-seo--marketing)
10. [Priorités & Roadmap](#10-priorités--roadmap)

---

## 1. Module Chat

### 1.1 Interface de chat

| Feature | Description | Priorité |
|---------|-------------|----------|
| Input texte | Champ de saisie avec support multilingue, détection auto de la langue | P0 |
| Streaming | Réponse affichée token par token (SSE ou WebSocket), pas d'attente du message complet | P0 |
| Markdown rendering | Le texte de réponse supporte le bold, italic, listes, citations | P0 |
| Stop generation | Bouton pour arrêter la génération en cours | P1 |
| Regenerate | Bouton pour regénérer la dernière réponse | P1 |
| Copy response | Bouton copier sur chaque message assistant | P1 |
| Feedback | Boutons 👍/👎 sur chaque réponse (stocké en DB pour amélioration) | P2 |
| Suggestion chips | 3-4 questions suggérées affichées au démarrage d'une nouvelle conversation | P1 |
| Indication de frappe | Animation "typing" pendant la génération | P0 |
| Scroll auto | Auto-scroll vers le bas pendant le streaming, avec détection si l'utilisateur a scrollé vers le haut | P0 |

### 1.2 Flow de question-réponse

```
Utilisateur envoie une question
       │
       ▼
[1] Détection de la langue (FR/EN/HE)
       │
       ▼
[2] Vérification du quota utilisateur
    ├── Quota dépassé → Message d'erreur + CTA upgrade
    │
    └── OK ─▶ [3] Construction du prompt
                   │
                   ├── System prompt (configurable, stocké en fichier)
                   ├── Historique conversation (N derniers messages, configurable)
                   ├── Contexte Sefaria (si RAG/search activé)
                   └── Contexte custom DB (si sources custom disponibles)
                   │
                   ▼
              [4] Appel LLM (modèle selon le plan utilisateur)
                   │
                   ├── Streaming de la réponse vers le frontend
                   │
                   ▼
              [5] Post-processing (en parallèle du streaming)
                   │
                   ├── Extraction des références (Linker API Sefaria)
                   ├── Récupération des textes sources (API Sefaria v3)
                   ├── Recherche sources custom (Vectorize) si applicable
                   │
                   ▼
              [6] Envoi des blocs sources au frontend
                   │
                   ▼
              [7] Sauvegarde en DB (message + sources + tokens utilisés)
```

### 1.3 Gestion des erreurs chat

| Erreur | Comportement |
|--------|-------------|
| LLM timeout (>30s) | Message "La réponse prend plus de temps que prévu. Veuillez réessayer." + bouton Retry |
| LLM API down | Fallback vers un modèle alternatif si configuré. Sinon message d'erreur avec estimation de disponibilité |
| Sefaria API down | La réponse est générée sans blocs sources. Mention "Sources temporairement indisponibles" |
| Quota dépassé | Message clair avec le nombre de questions restantes et CTA vers upgrade |
| Rate limit (>30 req/min) | HTTP 429 + message "Trop de requêtes, veuillez patienter" |
| Input trop long (>2000 chars) | Validation côté client avant envoi, message d'erreur inline |

### 1.4 System prompt

Le system prompt est stocké dans un fichier de configuration (pas hard-codé). Il doit être modifiable sans redéploiement via une variable d'environnement ou un fichier dans R2.

**Contenu du system prompt :**

```
Tu es un assistant spécialisé dans les textes juifs (Torah, Talmud, Midrash, 
Halakha, Hassidout, Kabbale, Moussar).

RÈGLES OBLIGATOIRES :
1. Toujours citer les sources précises au format Sefaria 
   (ex: "Talmud Bavli, Berakhot 5a", "Rambam, Hilkhot Teshouva 3:4")
2. Ne JAMAIS inventer de sources. Si tu ne connais pas la source exacte, 
   dis-le explicitement.
3. Répondre dans la langue de la question (français, anglais ou hébreu).
4. Quand un sujet fait l'objet d'une ma'hloket (divergence d'opinions), 
   présenter les différents avis avec leurs sources.
5. Ne JAMAIS émettre de psak halakha. Toujours renvoyer à un rav compétent 
   pour les questions pratiques.
6. Utiliser la translittération courante pour les termes hébraïques 
   (ex: "Shabbat" pas "Sabbath").
7. Structurer les réponses avec des paragraphes clairs.

FORMAT DE RÉPONSE :
- Réponse claire et structurée
- Sources citées entre crochets : [Talmud Bavli, Kiddoushin 31a]
- Disclaimer systématique en fin de réponse
```

---

## 2. Système de Sources

### 2.1 Types de sources

| Type | Source de données | Affichage | Badge couleur |
|------|------------------|-----------|---------------|
| `sefaria` | API Sefaria en temps réel | Texte hébreu + traduction | Bleu |
| `custom` | Base Vectorize (livres custom) | Texte hébreu + traduction si dispo | Vert |
| `hebrewbooks` | HebrewBooks.org (Phase 3) | Image de la page + référence | Orange |
| `unverified` | Connaissances internes du LLM | Pas de bloc source, mention "non vérifié" | Gris |

### 2.2 Bloc source (composant frontend)

```
┌─────────────────────────────────────────────────────┐
│ 📖 Talmud Bavli, Kiddoushin 31a          [Talmud]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ אמר רב יוסף כד הוה שמע קל כרעא דאמיה              │
│ אמר איקום מקמי שכינה דאתיא                         │
│                                                     │
│ ─────────────────────────────────────────            │
│                                                     │
│ Rav Yosef, when he would hear the sound of          │
│ his mother's footsteps, would say: "I will          │
│ stand before the Shekhinah (Divine Presence)        │
│ that is coming."                                    │
│                                                     │
│                              ▼ Voir plus            │
├─────────────────────────────────────────────────────┤
│ 🔗 Voir sur Sefaria                                │
└─────────────────────────────────────────────────────┘
```

**Spécifications du bloc :**

- **État replié (défaut)** : En-tête + 3 premières lignes du texte hébreu + bouton "Voir plus"
- **État déplié** : Texte hébreu complet (aligné RTL) + traduction complète (alignée LTR)
- **En-tête** : Nom de la source + badge catégorie coloré (Talmud, Torah, Halakha, Midrash, Hassidout, etc.)
- **Pied** : Lien cliquable vers Sefaria (ouvre dans un nouvel onglet) ou mention de la source custom
- **Responsive** : Sur mobile, hébreu et traduction empilés. Sur desktop, côte à côte si la largeur le permet
- **Animation** : Transition smooth à l'ouverture/fermeture (200ms ease-in-out)

### 2.3 Récupération des sources Sefaria

**Étape 1 — Extraction des citations :**

Après génération de la réponse LLM, appeler le Linker API :

```
POST https://www.sefaria.org/api/find-refs
Body: { "text": { "body": "<texte de la réponse>" } }
```

Renvoie les positions et refs de chaque citation identifiée.

**Étape 2 — Récupération du texte :**

Pour chaque ref identifiée :

```
GET https://www.sefaria.org/api/v3/texts/{ref}
GET https://www.sefaria.org/api/v3/texts/{ref}?version=english
```

Renvoie `versions[0].text` (hébreu par défaut, anglais si `?version=english`).

Pour le français (si disponible) :
```
GET https://www.sefaria.org/api/v3/texts/{ref}?version=french
```

**Étape 3 — Recherche sémantique Sefaria (pour enrichir le contexte) :**

```
POST https://www.sefaria.org/api/search/text/_search
Body: {
  "from": 0,
  "size": 5,
  "highlight": { "fields": { "exact": { "fragment_size": 200 } } },
  "query": { "match_phrase": { "exact": { "query": "<termes de recherche>" } } }
}
```

### 2.4 Récupération des sources custom (RAG)

Pour les textes hors Sefaria, stockés dans Vectorize :

1. Générer l'embedding de la question via Workers AI (EmbeddingGemma)
2. Query Vectorize avec le vecteur résultant (top 5 résultats)
3. Récupérer le texte original depuis D1 (table `custom_texts`) via l'ID du chunk
4. Inclure dans le contexte LLM + afficher comme bloc source de type `custom`

### 2.5 Caching des sources

- Les textes récupérés depuis Sefaria sont cachés dans Cloudflare KV pendant 24h (clé = ref Sefaria)
- Réduit les appels API et accélère les réponses pour les sources fréquemment citées
- TTL configurable via variable d'environnement

---

## 3. Authentification & Comptes

### 3.1 Inscription

| Méthode | Flow |
|---------|------|
| Email + password | Formulaire → email de confirmation → activation du compte |
| Google OAuth | Bouton "Continuer avec Google" → redirect OAuth → création/connexion auto |
| Apple Sign-In | Bouton "Continuer avec Apple" → redirect OAuth → création/connexion auto |

**Champs à l'inscription :**
- Email (requis)
- Nom affiché (requis)
- Mot de passe (requis si email, min 8 caractères, 1 majuscule, 1 chiffre)
- Langue préférée (sélection FR/EN/HE, défaut détecté via navigateur)
- Acceptation CGU + politique de confidentialité (checkbox obligatoire)

### 3.2 Connexion

- Email + password
- OAuth (Google / Apple)
- "Mot de passe oublié" → email avec lien de reset (token unique, expire en 1h)
- Tentatives max : 5 essais ratés → blocage 15 min (protection brute force)

### 3.3 Sessions

- JWT stocké en cookie httpOnly (pas localStorage, pour la sécurité)
- Access token : durée 15 min
- Refresh token : durée 7 jours, avec rotation à chaque utilisation
- Déconnexion : suppression du cookie + invalidation du refresh token

### 3.4 Profil utilisateur

| Champ | Modifiable | Notes |
|-------|-----------|-------|
| Email | Non (sauf procédure spéciale) | Identifiant unique |
| Nom | Oui | Affiché dans l'interface |
| Langue | Oui | Change la langue de l'UI et des réponses |
| Photo de profil | Non (Phase 1) | Optionnel en Phase 2 |
| Plan actif | Non (via Stripe) | Affiché en lecture seule |
| Questions restantes | Non | Compteur mensuel, affiché en lecture seule |

### 3.5 Suppression de compte

- Bouton "Supprimer mon compte" dans les paramètres
- Confirmation par email ou re-saisie du mot de passe
- Suppression : annulation abonnement Stripe + suppression données en D1 sous 30 jours
- Conformité RGPD : droit à l'effacement

---

## 4. Gestion des Conversations

### 4.1 Liste des conversations (sidebar)

- Affichée en sidebar gauche (ou droite en mode RTL hébreu)
- Triée par date de dernière activité (la plus récente en haut)
- Chaque item affiche : titre (auto-généré) + date relative ("il y a 2h", "hier", etc.)
- Bouton "Nouvelle conversation" en haut de la sidebar
- Recherche dans les conversations (par titre ou contenu) — P2

### 4.2 Titre auto-généré

- Le titre est généré automatiquement après le 1er échange (question + réponse)
- Méthode : demander au LLM un titre court (5-8 mots) basé sur la question
- Le titre est modifiable manuellement par l'utilisateur (clic sur le titre → input inline)

### 4.3 Actions sur une conversation

| Action | Comportement |
|--------|-------------|
| Renommer | Édition inline du titre |
| Archiver | Déplacée dans une section "Archives" (repliable) |
| Supprimer | Confirmation modale → suppression définitive de la conversation et ses messages |
| Partager (P2) | Génère un lien public en lecture seule de la conversation |
| Exporter PDF (P3) | Génère un PDF formaté avec les sources |

### 4.4 Contexte conversationnel

- Les N derniers messages de la conversation sont envoyés au LLM comme contexte
- N est configurable (défaut : 10 messages, soit 5 échanges)
- Si le contexte dépasse la fenêtre du modèle, les messages les plus anciens sont tronqués
- Le système doit compter les tokens du contexte et ajuster dynamiquement

---

## 5. Multilingue (i18n)

### 5.1 Langues supportées

| Langue | Code | Direction | Interface | Chat | Sources |
|--------|------|-----------|-----------|------|---------|
| Français | `fr` | LTR | ✅ | ✅ | Traduction FR si dispo sur Sefaria |
| Anglais | `en` | LTR | ✅ | ✅ | Traduction EN (large couverture Sefaria) |
| Hébreu | `he` | RTL | ✅ | ✅ | Texte original |

### 5.2 Détection de langue

1. Si l'utilisateur est connecté → utiliser sa langue préférée (profil)
2. Sinon → détecter via `navigator.language` du navigateur
3. Fallback → anglais

### 5.3 Changement de langue

- Sélecteur de langue dans le header (icône drapeau ou code langue)
- Le changement est instantané (pas de rechargement de page)
- Si l'utilisateur est connecté, le choix est sauvegardé dans son profil
- Sinon, stocké en cookie

### 5.4 Spécifications RTL (hébreu)

- Tout le layout est mirroré : sidebar à droite, texte aligné à droite
- L'attribut `dir="rtl"` est ajouté au `<html>` ou au container principal
- Les icônes directionnelles (flèches, chevrons) sont inversées
- Le champ de saisie du chat est aligné à droite
- Les blocs sources affichent l'hébreu en premier, la traduction en dessous

### 5.5 Fichiers de traduction

- Un fichier JSON par langue : `fr.json`, `en.json`, `he.json`
- Structure plate ou imbriquée (au choix du dev), mais cohérente
- Les clés sont en anglais : `"chat.placeholder": "Posez votre question..."`
- Toutes les chaînes visibles par l'utilisateur DOIVENT être dans les fichiers i18n (aucun texte hard-codé)

---

## 6. Paiement & Abonnements (Stripe)

### 6.1 Plans

| Plan | Prix | Trial | Limites | Modèle LLM | Features |
|------|------|-------|---------|-------------|----------|
| Free trial | 0€ | 7 jours | Illimité pendant le trial | Léger (Llama 8B) | Chat + sources Sefaria |
| Standard | 9.99€/mois | — | 500 questions/mois | Moyen (Llama 70B) | Chat + sources + historique illimité |
| Premium | 19.99€/mois | — | Illimité | Avancé (Claude/GPT) | Chat + sources + historique + export + priorité |

> Les prix, limites et modèles LLM sont configurables via variables d'environnement.

### 6.2 Cycle de vie utilisateur

```
Inscription
    │
    ▼
Trial (7 jours)
    │
    ├── Jour 5 : Email rappel "Votre trial expire dans 2 jours"
    │
    ├── Jour 7 : Trial expiré
    │       │
    │       ├── Peut voir ses conversations passées
    │       ├── Ne peut PLUS poser de questions
    │       └── CTA "S'abonner" affiché en permanence
    │
    ▼
Abonnement (Stripe Checkout)
    │
    ├── Paiement réussi → plan activé immédiatement
    ├── Paiement échoué → retry automatique (Stripe) + email notification
    │
    ▼
Abonné actif
    │
    ├── Changement de plan → via portail Stripe (upgrade/downgrade)
    ├── Annulation → accès maintenu jusqu'à fin de période payée
    └── Non-renouvellement → retour au statut "expired"
```

### 6.3 Intégration Stripe

**Checkout :**
- Utiliser Stripe Checkout Sessions (pas de formulaire custom de carte)
- Redirect vers Stripe → retour sur `/payment/success` ou `/payment/cancel`
- Créer un `Stripe Customer` à l'inscription (même pour le trial)

**Webhooks à écouter :**

| Événement | Action |
|-----------|--------|
| `checkout.session.completed` | Activer le plan, mettre à jour la DB |
| `customer.subscription.updated` | Mettre à jour le plan (upgrade/downgrade) |
| `customer.subscription.deleted` | Passer le plan en "expired" |
| `invoice.payment_failed` | Email à l'utilisateur + flag en DB |
| `invoice.paid` | Reset du compteur mensuel de questions |

**Portail client :**
- Lien vers le portail Stripe pour gérer l'abonnement en autonomie
- Accessible depuis la page profil : "Gérer mon abonnement"
- Le portail permet : changer de plan, mettre à jour la carte, annuler, voir les factures

### 6.4 Compteur de questions

- Champ `questions_this_month` dans la table `users`
- Incrémenté à chaque question posée (pas à chaque message, seulement les questions user)
- Reset mensuel via webhook `invoice.paid` ou cron job Cloudflare le 1er de chaque mois
- Affiché dans l'interface : "42/500 questions ce mois"
- Quand quota atteint à 80% : notification inline "Il vous reste X questions"
- Quand quota atteint à 100% : blocage + CTA upgrade

---

## 7. PWA & Mobile

### 7.1 Progressive Web App

| Feature | Spécification |
|---------|--------------|
| `manifest.json` | Nom, icônes (192px + 512px), theme_color, background_color, display: "standalone" |
| Service Worker | Cache app shell (HTML, CSS, JS), stratégie network-first pour les API calls |
| Install prompt | Bannière "Ajouter à l'écran d'accueil" sur mobile (après 2 visites) |
| Offline | Page offline avec message "Connexion requise pour poser une question" |
| Splash screen | Logo + nom de l'app sur fond uni |

### 7.2 Préparation pour app native

- La logique métier frontend (gestion du state, appels API, formatage) DOIT être séparée de la couche UI (composants visuels)
- Pattern recommandé : hooks/composables pour la logique, composants pour l'affichage
- Le backend étant une API REST/JSON, il sera directement réutilisable par React Native ou Flutter
- Documenter les endpoints API de manière exhaustive (OpenAPI/Swagger)

---

## 8. Administration

### 8.1 Dashboard admin (Phase 2)

> Interface web protégée par login admin, accessible à `/admin`

| Feature | Description | Priorité |
|---------|-------------|----------|
| Stats utilisateurs | Nombre total, nouveaux/jour, répartition par plan | P1 |
| Stats questions | Questions/jour, sources les plus citées, langues | P1 |
| Coûts LLM | Tokens consommés/jour, coût estimé par modèle | P1 |
| Gestion sources custom | Upload texte, voir les chunks, relancer l'embedding | P1 |
| Modifier le system prompt | Éditeur texte + bouton "Sauvegarder" (stocké en KV ou R2) | P2 |
| Gestion utilisateurs | Liste, recherche, changer le plan manuellement | P2 |
| Logs erreurs | Dernières erreurs LLM/API avec détails | P2 |

### 8.2 Pipeline d'ingestion de sources custom

> Interface admin pour ajouter des livres hors Sefaria

```
Upload fichier (TXT, JSON, ou PDF)
       │
       ▼
[1] Si PDF → OCR (Google Vision API pour l'hébreu)
       │
       ▼
[2] Saisie des métadonnées : titre, auteur, catégorie, langue
       │
       ▼
[3] Chunking automatique (150-300 mots, overlap 50 mots)
       │
       ▼
[4] Preview des chunks (l'admin peut ajuster le découpage)
       │
       ▼
[5] Lancement de l'embedding (via Cloudflare Queue → Workers AI)
       │
       ▼
[6] Insertion dans Vectorize + sauvegarde texte brut en D1
       │
       ▼
[7] Confirmation : "X chunks indexés, source disponible"
```

---

## 9. SEO & Marketing

### 9.1 Pages SEO statiques (Phase 3)

- Générer des pages statiques pour les questions les plus fréquemment posées
- URL format : `/questions/que-dit-le-talmud-sur-le-respect-des-parents`
- Contenu : réponse pré-générée + blocs sources + CTA "Posez votre propre question"
- Indexables par Google, avec meta tags et structured data (JSON-LD FAQ schema)

### 9.2 Branding agence

- Bandeau discret en bas de page : "Créé par [Nom Agence] — Automatisation & IA pour votre business"
- Lien vers la landing page de l'agence
- Pixel de retargeting (Meta Pixel, Google Ads tag) sur toutes les pages
- UTM tracking sur les liens vers l'agence

### 9.3 Partage social (Phase 2)

- Bouton "Partager cette réponse" sur chaque message assistant
- Génère une image OG avec le texte de la question + début de réponse
- Formats : lien web, image pour WhatsApp/Telegram, copie texte
- Les liens partagés sont des pages publiques en lecture seule

---

## 10. Priorités & Roadmap

### Légende des priorités

| Label | Signification |
|-------|--------------|
| **P0** | Indispensable au MVP. Bloque le lancement si absent. |
| **P1** | Important. À livrer dans le MVP ou la semaine suivant le lancement. |
| **P2** | Nice-to-have. Phase 2 (mois 3-4). |
| **P3** | Futur. Phase 3+ (mois 5+). |

### Récapitulatif par priorité

**P0 — MVP obligatoire :**
- Chat avec streaming
- Intégration LLM (Workers AI)
- Blocs sources Sefaria
- Auth (email + Google OAuth)
- Gestion des conversations (CRUD)
- i18n (FR, EN, HE avec RTL)
- Stripe (trial + abonnements)
- Switch modèle LLM par plan
- PWA basique (manifest + service worker)

**P1 — MVP souhaité :**
- Apple Sign-In
- Stop/Regenerate/Copy sur les messages
- Questions suggérées
- Cache sources Sefaria (KV)
- Compteur de questions avec notifications
- Emails transactionnels (Brevo) : confirmation, reset password, rappel trial
- Rate limiting

**P2 — Phase 2 :**
- Sources custom (RAG sur Vectorize)
- Pipeline d'ingestion admin
- Dashboard admin
- Partage de réponses
- Recherche dans les conversations
- Feedback 👍/👎

**P3 — Phase 3+ :**
- HebrewBooks (OCR + images de pages)
- Export PDF des conversations
- Pages SEO statiques
- Nouvelles langues (espagnol, russe)
- App native (React Native / Flutter)
- Analytics avancés

---

*Ce document est complémentaire au Cahier des Charges Technique (.docx) qui détaille l'architecture, les schémas de base de données, les estimations de coûts et les credentials nécessaires.*
