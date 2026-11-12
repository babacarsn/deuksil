# DEUKSIL — Comptes ouverts par un tiers et relations (12 novembre 2026)

## 1. Qui ouvre quoi, et comment chacun se connecte

| Compte | Ouvert par | Où | Ce qu'il faut | Connexion |
|---|---|---|---|---|
| Agent, gestionnaire | Agence ou propriétaire (titulaire) | **Équipe** → « Ajouter un membre » (ouvre Gestion → Équipe & accès) | Prénom, nom, **e-mail** (identifiant), téléphone, rôle, droits | Immédiate |
| Propriétaire mandant | Agence | **Propriétaires** → ligne du propriétaire → « Ouvrir l'accès » | **E-mail réel** du propriétaire | Immédiate |
| Locataire | Propriétaire ou agence | Gestion → Équipe & accès → « Donner un accès à un locataire » (ou depuis le bail) | Bail actif + **e-mail** du locataire | Immédiate |

Dans les trois cas :
1. Le compte est créé par la fonction serveur **`gerer-acces`** (elle seule peut créer un compte d'authentification). **Elle doit être déployée** : `supabase functions deploy gerer-acces`. Sans elle, l'écran affiche maintenant « La fonction serveur « gerer-acces » n'est pas déployée… ».
2. Une fenêtre **« Accès créé : identifiants à transmettre »** affiche l'adresse de connexion, l'identifiant (e-mail) et un **mot de passe provisoire**, avec les boutons **Copier**, **Envoyer par WhatsApp** (numéro +221 si le téléphone est connu) et **Envoyer par e-mail**.
3. À sa première connexion, la personne **choisit son propre mot de passe** (écran imposé).
4. Mot de passe provisoire perdu : bouton **« Nouveau mot de passe »** sur la ligne de la personne (équipe, propriétaires, locataires), tant qu'elle ne s'est pas connectée. Après, elle utilise « Mot de passe oublié ».

Chaque personne a donc **ses propres identifiants**. Un e-mail ne sert qu'à un compte : si la personne a déjà un compte DEUKSIL, le message le dit (le propriétaire peut alors confier ses biens depuis son espace).

## 2. Relations (vérifiées en base, `supabase/tests-cni/relations.sh`)

| Relation | Lien en base | Ce que la personne voit / fait |
|---|---|---|
| Agent → agence | `profiles.parent_id` + droits `perms` | Voit les biens de l'agence ; modifie **seulement les biens qui lui sont attribués** ; crée des brouillons ; ne change pas ses droits |
| Gestionnaire → titulaire | `profiles.parent_id` + droits | Selon ses droits (ex. sans « biens » : ne crée pas de bien) |
| Titulaire → équipe | — | Modifie les droits, suspend, supprime **ses** membres seulement |
| Mandant → agence | `profiles.mandant_of` + `owner_rec` ; fiche `owner_records.compte_id` + `lien = 'accepte'` | Voit les biens liés à sa fiche (`properties.client_owner_id`), leurs baux, mandats, relevés ; ne modifie rien |
| Locataire → bail | `profiles.owner_ref` + `lease_id(s)` | Voit son bail et le bien loué, rien d'autre |
| Agence A ↔ Agence B | `app.espace()` | Aucune donnée de l'autre (fiches, baux, brouillons, comptes) |
| Compte suspendu | `status = 'suspendu'` | Ne voit plus rien de privé |

## 3. Bug corrigé : le mandant arrivait sur un espace vide

Quand l'agence ouvrait l'accès d'un mandant, la fiche `owner_records` n'était jamais reliée au compte (`compte_id` et `lien` vides). Tout ce que voit un mandant passe par `app.mes_fiches()`, qui exige ce lien : il se connectait sur un espace vide.

**Migration `20261112000200_relations_comptes.sql`** : la fiche est reliée automatiquement à la création du compte, et les mandants déjà créés sont réparés. Sécurité testée : une inscription libre qui se déclare mandant est ignorée ; un compte d'une autre agence ne peut pas se relier à la fiche.

## 4. Autres corrections (site)

- Agents et gestionnaires : bouton « Nouveau mot de passe » (n'existait que pour mandants et locataires).
- Fiche d'identifiants prête à transmettre (WhatsApp, e-mail, copie).
- Message clair si `gerer-acces` n'est pas déployée ou est injoignable (au lieu de « Requested function was not found »).
- Après l'ouverture de l'accès d'un mandant, sa fiche est relue (« Compte rattaché »).

## 5. À faire côté Supabase

1. `supabase functions deploy gerer-acces` (sans `--no-verify-jwt`).
2. `supabase db push` : applique `20261112000100_cni_fiabilite.sql` et `20261112000200_relations_comptes.sql` (d'abord sur le projet de test).
3. Contrôle : `select count(*) from public.owner_records o join public.profiles p on p.owner_rec = o.id where o.compte_id is null;` doit donner **0**.
