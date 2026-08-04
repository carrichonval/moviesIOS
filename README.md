# Krokmo'vie

Base Expo/React Native pour démarrer une nouvelle app iOS avec l'authentification (login, inscription,
déconnexion, gestion de profil, suppression de compte) déjà câblée sur Supabase.

Clonée depuis [templateIOS](../templateIOS) (lui-même extrait de [gameTracker](../gameTracker)) — ne
garde que le socle générique (auth, session, profil), pas
le code spécifique à ce projet-là (bibliothèque de jeux, IGDB, verrou biométrique).

## Stack

- **Expo** (SDK 54) + **expo-router** (routing par fichiers, groupes de routes)
- **Supabase** (`@supabase/supabase-js`) — auth, base Postgres, RLS
- **TanStack Query** — cache réseau, persisté sur disque via AsyncStorage
- **NativeWind** (Tailwind pour React Native)
- **react-hook-form** + **zod** — formulaires et validation

## Comment fonctionne l'app

### Navigation et protection des routes

`src/app/_layout.tsx` est le point d'entrée. Il enveloppe toute l'app dans `AuthProvider`, puis affiche
soit le groupe `(app)` soit le groupe `(auth)` selon qu'une session Supabase existe, via les
`<Stack.Protected guard={...}>` d'expo-router :

- `src/app/(auth)/` — écrans non authentifiés : `login.tsx`, `register.tsx`.
- `src/app/(app)/(tabs)/` — écrans authentifiés : `index.tsx` (placeholder à remplacer par ton premier
  vrai écran) et `profile.tsx`.
- `src/app/index.tsx` redirige vers l'un ou l'autre au démarrage.
- `src/app/auth/callback.tsx` est la page de retour du lien de confirmation d'email.

### Session et stockage du token

`src/lib/supabase.ts` crée le client Supabase avec un adaptateur de stockage custom
(`LargeSecureStore`) : la clé de chiffrement AES vit dans `expo-secure-store` (Keychain iOS), et le
JWT chiffré (souvent > 2048 octets, la limite de SecureStore) vit dans `AsyncStorage`. Supabase gère
lui-même le refresh automatique du token (`autoRefreshToken: true`) et la persistance de session
(`persistSession: true`).

`src/features/auth/AuthProvider.tsx` expose `useAuth()` (`{ session, isLoading }`), écoute
`supabase.auth.onAuthStateChange`, vide le cache TanStack Query à la déconnexion, et intercepte les
deep links (`krokmovie://...` → ton scheme) pour poser la session après un clic sur le lien de
confirmation d'email.

### Appels d'authentification

Tout est dans `src/features/auth/api.ts` :

- `signInWithPassword(email, password)`
- `signUp(email, password)` — envoie un email de confirmation dont le lien de retour est généré par
  `Linking.createURL('auth/callback')` (donc automatiquement basé sur le `scheme` défini dans
  `app.config.js` — pas besoin de modifier ce fichier si tu renommes l'app)
- `signOut()`
- `deleteAccount()` — appelle la fonction Postgres `delete_user()` (RPC), puis déconnecte

### Profil (`src/features/profile/`)

`api.ts` expose `getProfile`, `updateUsername`, `updatePassword`, `updateEmail` (même mécanisme de
deep link que `signUp`). `hooks.ts` les enrobe en hooks TanStack Query. L'écran
`src/app/(app)/(tabs)/profile.tsx` les assemble : changement de username/email/mot de passe
(`EditableRow`), déconnexion, et suppression de compte avec confirmation
(`ConfirmDeleteAccountModal`).

### Backend Supabase

Ce template ne contient **aucune migration** : il part du principe que le projet Supabase existe déjà
(voir section suivante) avec une table `users` (miroir de `auth.users`, avec `username`, RLS par
propriétaire, trigger `handle_new_user` qui crée la ligne à l'inscription) et une fonction
`delete_user()` (`security definer`) que `deleteAccount()` appelle via RPC. `src/types/database.ts`
est un stub qui reflète ce schéma déjà en place.

Si un jour tu pars d'un tout nouveau projet Supabase (pas le projet partagé habituel), il faudra
recréer ces deux éléments — la référence est dans
`gameTracker/supabase/migrations/0001_initial_schema.sql` et `0002_delete_user_function.sql`.

## Démarrer une nouvelle app à partir de ce template

1. **Copier le dossier** vers l'emplacement de ton nouveau projet, puis `npm install`.
2. **Renommer le projet** :
   - `package.json` → champ `"name"`.
   - `app.config.js` → remplace chaque `__PLACEHOLDER__` (voir commentaires dans le fichier) :
     `name`, `slug`, `scheme`, `ios.bundleIdentifier`, `android.package`, `extra.eas.projectId`,
     `owner`. Le `scheme` est la seule valeur qui compte niveau code — le reste (auth, deep links)
     s'adapte automatiquement.
   - `eas.json` → remplace `appleId`, `ascAppId`, `appleTeamId` dans `submit.production.ios` par tes
     identifiants Apple Developer (visibles sur [App Store Connect](https://appstoreconnect.apple.com)
     et `eas credentials`).
3. **Supabase** : les apps perso réutilisent toutes le **même projet Supabase** existant (donc la
   même base `auth.users` / table `users`, déjà en place depuis la première app) — pas besoin de
   migration, cette app consomme directement les tables existantes et n'ajoute que les siennes.
   - `cp .env.example .env` et remplir `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
     avec les valeurs du projet Supabase existant (Project Settings → API) — les mêmes pour toutes
     les apps.
   - Pour cette app, ajouter uniquement les tables propres à son domaine directement dans ce projet
     (SQL editor Supabase, ou tes propres migrations si tu veux les versionner).
   - Régénérer les types à jour du projet partagé : `supabase gen types typescript --linked >
     src/types/database.ts`.
4. **EAS** : `eas init` pour lier le projet à ton compte Expo (remplit `extra.eas.projectId`
   automatiquement si tu préfères ne pas le taper à la main).
5. Lancer sur un iPhone branché : `npx expo prebuild` puis `npx expo run:ios --device`.

## Déploiement avec EAS

Une fois l'app prête pour un premier envoi sur TestFlight/App Store, dans l'ordre :

1. **`eas login`** — connexion au compte Expo (email/mot de passe ou SSO). À faire une seule fois par
   machine.
2. **`eas init`** — si `extra.eas.projectId` est encore un placeholder dans `app.config.js`, cette
   commande crée le projet EAS et remplit le `projectId` automatiquement. Confirme le nom/slug
   proposé (doit correspondre à `name`/`slug` de `app.config.js`).
3. **`eas build --platform ios --profile production`** — lance le build de production sur les
   serveurs EAS. Première fois, plusieurs prompts apparaissent :
   - *"Log in to your Apple account"* → oui, avec l'Apple ID développeur (compte payant Apple
     Developer Program requis).
   - *Bundle identifier* → confirme qu'il correspond à `ios.bundleIdentifier` d'`app.config.js` ; si
     l'identifiant n'existe pas encore sur le compte Apple Developer, EAS propose de le créer
     automatiquement (accepter).
   - *"Generate a new Distribution Certificate / Provisioning Profile?"* → oui, laisser EAS gérer les
     credentials (recommandé, stockés chiffrés sur ton compte Expo) plutôt que de fournir les
     fichiers `.p12`/`.mobileprovision` manuellement.
   - *"Would you like to create this app on App Store Connect?"* (si l'app n'y existe pas encore) →
     oui ; cela crée l'entrée ASC et récupère l'`ascAppId` (à recopier dans `eas.json` si le prompt ne
     le fait pas automatiquement).
   - Le build tourne ~10-20 min sur les serveurs EAS ; le lien de suivi et le `.ipa` final s'affichent
     à la fin (aussi consultable via `eas build:list`).
4. **`eas submit --platform ios --latest`** — envoie le dernier build buildé à l'étape précédente vers
   App Store Connect/TestFlight.
   - Utilise `submit.production.ios` (`appleId`, `ascAppId`, `appleTeamId`) dans `eas.json` ; si un
     champ est manquant/placeholder, la CLI le demande interactivement (connexion Apple, sélection de
     l'app sur ASC) et peut proposer de sauvegarder les valeurs dans `eas.json` pour la prochaine
     fois.
   - Confirme l'upload ; le traitement Apple (antivirus/validation) prend ensuite ~10-30 min avant que
     le build apparaisse dans TestFlight.
5. Une fois le build visible sur [App Store Connect](https://appstoreconnect.apple.com) : ajouter les
   testeurs TestFlight, ou remplir les métadonnées (captures, description) et soumettre pour review
   App Store — ces deux étapes restent manuelles sur le site ASC, `eas submit` ne fait que l'upload du
   binaire.

Pour les builds suivants (mise à jour de l'app), refaire seulement les étapes 3 et 4.

## Ce qui n'est volontairement pas inclus

- Verrou biométrique (Face ID/Touch ID) — était spécifique à gameTracker, à réintroduire au besoin
  depuis `expo-local-authentication` (déjà dans `package.json`).
- Tout écran/logique métier au-delà de l'auth et du profil : `index.tsx` est un placeholder à remplacer.
