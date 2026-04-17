---
name: React 19.0.0 pin obligatoire
description: Ne jamais upgrader React au-delà de 19.0.0 tant que le bug useContext avec React Router 7 n'est pas résolu
type: feedback
originSessionId: c6198da6-fe5d-43a3-8ddd-488c207acc76
---
React DOIT rester à 19.0.0 exact (pas de ^). Les versions 19.1+ causent un crash `Cannot read properties of null (reading 'useContext')` lors de l'hydratation avec React Router 7.

**Why:** Bug confirmé dans react-router issue #13998. L'erreur est silencieuse côté serveur (SSR renvoie 200), ne se manifeste que côté client. Très difficile à diagnostiquer car intermittent et amplifié par le Service Worker PWA qui cache les vieux bundles.

**How to apply:** 
- `package.json` : `"react": "19.0.0"` (sans `^`)
- Après tout `npm install`, vérifier `node -e "console.log(require('react/package.json').version)"` = 19.0.0
- Si bug `useContext` réapparaît : 1) vérifier version React, 2) clear Service Worker via DevTools, 3) `rm -rf node_modules/.vite .react-router`
- Ne JAMAIS mettre d'imports après un `export` dans les fichiers routes (causait un duplicate React via Vite)
