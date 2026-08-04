# templateIOS

Base réutilisable pour les apps mobiles de l'utilisateur (voir README.md pour le détail). Toute app
dérivée de ce template partage cette architecture — utile pour comprendre rapidement un projet cloné
depuis ici.

## Stack

Expo (expo-router, groupes de routes) + Supabase (auth + Postgres + RLS) + TanStack Query (cache
persisté AsyncStorage) + NativeWind + react-hook-form/zod.

## Conventions

- **Feature folders** : `src/features/<domaine>/` contient `api.ts` (appels Supabase bruts),
  `hooks.ts` (wrappers TanStack Query), `schemas.ts` (validation zod), `components/`. Ne pas mélanger
  la logique de plusieurs domaines dans un même fichier — c'est ce qui a dû être trié en extrayant ce
  template depuis gameTracker (profil vs biométrie vs métier du jeu).
- **Routing** : `src/app/` suit expo-router. `(auth)` = écrans non connectés, `(app)/(tabs)` = écrans
  connectés. La protection se fait dans `src/app/_layout.tsx` via `<Stack.Protected guard={...}>` sur
  la session Supabase (`useAuth()` de `src/features/auth/AuthProvider.tsx`), pas par redirection
  manuelle dans chaque écran.
- **Deep links** : ne jamais coder en dur un scheme d'URL (`monapp://...`). Utiliser
  `Linking.createURL(path)` (`expo-linking`) comme le font `signUp`/`updateEmail` — le scheme vient
  d'un seul endroit, `app.config.js`.
- **Nouvel écran protégé** : ajouter un fichier dans `src/app/(app)/(tabs)/` (ou un sous-groupe) et le
  déclarer dans le `_layout.tsx` du groupe de tabs correspondant.
- **Style** : classes Tailwind via NativeWind. Palette sombre uniquement (`tailwind.config.js`) — ne
  pas ajouter de thème clair sans en discuter, l'app n'a pas de palette claire.
- **Types Supabase** : `src/types/database.ts` est généré (`supabase gen types typescript`), ne pas
  l'éditer à la main au-delà du stub initial — le régénérer après tout changement de schéma côté
  Supabase.
- **Pas de migrations dans ce template** : toutes les apps perso de l'utilisateur partagent le même
  projet Supabase (même `auth.users`/table `users`, déjà en place). Une nouvelle app consomme ces
  tables existantes et n'ajoute que les siennes — ne pas proposer de recréer le schéma `users` ou de
  monter un nouveau projet Supabase par défaut.

## Où se trouve la logique d'auth

`src/features/auth/` (provider, appels API, schémas, champ de formulaire) et
`src/features/profile/` (lecture/édition du profil, suppression de compte). Voir README.md section
"Comment fonctionne l'app" pour le détail du flux de session.
