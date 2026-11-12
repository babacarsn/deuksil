# DEUKSIL — Supabase : ce qu'il faut configurer pour les modifications des 11 et 12 novembre 2026

**Pour la personne qui gère Supabase.** Ce document ne reprend PAS l'installation d'origine (déjà faite) : il liste seulement ce que les modifications d'hier et d'aujourd'hui demandent côté Supabase, **dans l'ordre**, avec un contrôle (✅) après chaque étape.

| | |
|---|---|
| Projet Supabase | `fqrmulupzaqmvjoybela` |
| Branche à tester | `test` — https://deuksil-git-test-babacarsns-projects.vercel.app |
| Site en ligne (inchangé tant que `test` n'est pas fusionnée) | https://deuksil.vercel.app |

> La branche `test` utilise **la même base Supabase** que le site en ligne : ce que vous appliquez ici vaut pour les deux. Les deux migrations ne cassent rien pour le site en ligne actuel (aucune table, colonne ni donnée supprimée).

---

## Ce qui a changé et ce que cela demande à Supabase

| Date | Modification (site) | Ce qu'il faut côté Supabase |
|---|---|---|
| 11 nov. | Menu ordinateur = barre du bas ; « Équipe » et « Visites » pour l'agence | Rien |
| 11 nov. | Formulaire CNI au moment de publier ; carte CNI dans Paramètres de l'agence | Règle CNI déjà en base (étape 4 : vérifier) |
| 12 nov. | CNI déjà utilisée expliquée ; message de refus juste (titulaire / agent) | **Migration `20261112000100_cni_fiabilite.sql`** (étape 2) |
| 12 nov. | Le propriétaire mandant voit enfin ses biens (espace vide avant) | **Migration `20261112000200_relations_comptes.sql`** (étape 2) |
| 12 nov. | Comptes ouverts par l'agence ou le propriétaire (agent, gestionnaire, mandant, locataire) : fiche d'identifiants, nouveau mot de passe | **Fonction `gerer-acces` déployée** (étape 3) |
| 12 nov. | Branche `test` avec son adresse Vercel | **Autoriser l'adresse de test** (étape 5) |

---

## Étape 0 — Sauvegarde

```bash
bash supabase/sauvegarde/sauvegarder.sh
```
✅ Un dossier de sauvegarde daté existe (à garder hors Git).

## Étape 1 — Prendre le code de la branche `test`

```bash
cd deuksil
git fetch origin && git checkout test && git pull
supabase link --project-ref fqrmulupzaqmvjoybela      # si ce n'est pas déjà fait sur cet ordinateur
```
✅ `ls supabase/migrations/2026111*` affiche les deux nouveaux fichiers.

## Étape 2 — Appliquer les deux nouvelles migrations

| Fichier | Ce qu'il fait |
|---|---|
| `20261112000100_cni_fiabilite.sql` | Message de refus juste (« CNI manquante… Paramètres », différent pour un agent) ; une CNI déjà utilisée est refusée avec un message clair ; fonction `public.cni_espace_renseignee()` |
| `20261112000200_relations_comptes.sql` | Relie automatiquement la fiche du propriétaire mandant à son compte quand l'agence ouvre son accès ; **répare** les mandants déjà créés |

**D'abord, vérifier ce que Supabase croit déjà appliqué** (important si d'anciennes migrations ont été collées à la main dans le SQL Editor) :
```bash
supabase migration list
```
- Si **seules les deux migrations du 12 novembre** apparaissent sans date côté « Remote » : `supabase db push` (il n'applique que celles-là).
- Si **d'anciennes migrations** (22 octobre → 2 novembre) apparaissent aussi sans date côté « Remote » alors qu'elles sont déjà en place dans la base : **ne pas lancer `db push`** (il les rejouerait et échouerait). Utiliser le SQL Editor ci-dessous, puis, une fois, pour remettre la liste à jour :
  ```bash
  supabase migration repair --status applied 20261022000100 20261022000200 20261022000300 20261022000400 20261022000500 20261022000600 20261022000700 20261022000800 20261028000100 20261102000100 20261112000100 20261112000200
  ```
  (ne mettre dans cette liste que les migrations réellement présentes dans la base.)

**Avec le SQL Editor** (toujours possible) : coller tout `20261112000100_cni_fiabilite.sql` → Run ; puis tout `20261112000200_relations_comptes.sql` → Run (dans cet ordre). Les deux peuvent être rejouées sans risque.

✅ Contrôles (SQL Editor) :
```sql
-- 3 lignes : verifier_cni_unique, cni_espace_renseignee, lier_fiche_mandant
select proname from pg_proc where proname in ('verifier_cni_unique', 'cni_espace_renseignee', 'lier_fiche_mandant');
-- 2 lignes : les deux déclencheurs
select tgname from pg_trigger where tgname in ('verifier_cni_unique', 'lier_fiche_mandant');
-- 0 : plus aucun mandant sans lien avec sa fiche
select count(*) from public.owner_records o join public.profiles p on p.owner_rec = o.id where o.compte_id is null;
```

## Étape 3 — Déployer la fonction `gerer-acces` (indispensable)

C'est elle qui crée les comptes des **agents, gestionnaires, propriétaires mandants et locataires** et renvoie le mot de passe provisoire affiché dans la fiche d'identifiants. Sans elle, le site affiche : « La fonction serveur « gerer-acces » n'est pas déployée sur Supabase… ».

```bash
supabase functions deploy gerer-acces          # SANS --no-verify-jwt
```
✅ `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://fqrmulupzaqmvjoybela.supabase.co/functions/v1/gerer-acces` → **401** (elle refuse les inconnus : c'est normal).
✅ Dans le tableau de bord : Edge Functions → `gerer-acces` présente, active.

## Étape 4 — Vérifier que la règle CNI est en place

Elle date du 28 octobre (`20261028000100_cni_avant_publication.sql`) ; les formulaires d'hier s'appuient dessus.
```sql
-- 1 ligne
select proname from pg_proc where proname = 'espace_a_une_cni';
-- 1 ligne (une CNI ne sert qu'à un seul compte)
select indexname from pg_indexes where indexname = 'profiles_cni_unique';
```
Si la première requête est vide : appliquer `20261028000100_cni_avant_publication.sql` puis refaire l'étape 2.

## Étape 5 — Autoriser l'adresse de test

Sans cela, la création des comptes est refusée **depuis le site de test** (« … gerer-acces est injoignable… ») et les liens d'e-mail renvoient vers le site en ligne.

1. **Secret des fonctions** (les deux adresses, séparées par une virgule) :
   ```bash
   supabase secrets set DEUKSIL_ORIGINES="https://deuksil.vercel.app,https://deuksil-git-test-babacarsns-projects.vercel.app"
   ```
2. **Authentication → URL Configuration → Redirect URLs** : ajouter `https://deuksil-git-test-babacarsns-projects.vercel.app/**` (garder celle du site en ligne ; **ne pas** changer la Site URL).
3. Si la connexion Google est activée : Google Cloud → ID client OAuth → *Origines JavaScript autorisées* : ajouter `https://deuksil-git-test-babacarsns-projects.vercel.app`.

✅ `supabase secrets list` montre `DEUKSIL_ORIGINES`. Sur le site de test : « Mot de passe oublié » envoie un code qui fonctionne.

## Étape 6 — Comptes de test : une CNI différente par compte

Cause principale du bug « CNI non renseignée alors qu'on l'a saisie » : le même numéro saisi sur plusieurs comptes de test. Une CNI ne sert qu'à **un** compte.

```sql
-- Numéros utilisés par plusieurs comptes (doit être vide grâce à l'index ; sinon, comptes marqués doublons)
select cni, count(*) from public.profiles where cni is not null group by cni having count(*) > 1;
-- Qui utilise ce numéro ?
select email, role from public.profiles where cni = '<13 chiffres>';
-- Libérer la CNI d'un compte de TEST (seulement un compte de test)
update public.profiles set cni = null where email = '<compte de test>';
```

## Étape 7 — Accès des testeurs au site de test (Vercel)

Si l'adresse de test demande une connexion Vercel : Vercel → projet `deuksil` → **Settings → Deployment Protection** → autoriser l'accès aux aperçus (ou inviter les testeurs dans l'équipe Vercel).

✅ L'adresse de test s'ouvre sur un téléphone qui n'est pas connecté à Vercel.

## Étape 8 — Contrôle sur le site de test

| ☐ | Test | Résultat attendu |
|---|---|---|
| ☐ | Agence → Équipe → Ajouter un membre (agent) | Fenêtre « Accès créé : identifiants à transmettre » ; l'agent se connecte et choisit son mot de passe |
| ☐ | Agence → Propriétaires → « Ouvrir l'accès » | Fiche d'identifiants ; la ligne indique « Compte rattaché » ; le mandant voit ses biens confiés |
| ☐ | Compte sans CNI → Publier | Le formulaire CNI s'ouvre ; après la CNI, la publication se fait |
| ☐ | CNI déjà utilisée | « Ce numéro de CNI est déjà utilisé par un autre compte DEUKSIL… » |
| ☐ | Agent d'une agence sans CNI → Publier | « …le titulaire du compte doit renseigner son numéro de CNI dans Paramètres… » |

La recette complète : `tests/uat/` (commencer par `00_Comptes_de_test.xlsx`).

---

## Dépannage (modifications du 11-12 novembre)

| Symptôme | Cause | Solution |
|---|---|---|
| « La fonction serveur « gerer-acces » n'est pas déployée » | étape 3 non faite | étape 3 |
| « … gerer-acces est injoignable » sur le site de test | adresse de test absente de `DEUKSIL_ORIGINES` | étape 5.1 |
| « Ce numéro de CNI est déjà utilisé… » | une CNI = un compte | étape 6 |
| Message de refus encore « Renseignez un numéro de CNI dans « Mon profil » » | migration `…000100` non appliquée | étape 2 |
| Le mandant ne voit aucun bien | migration `…000200` non appliquée, ou aucun bien rattaché à sa fiche côté agence | étape 2 ; rattacher les biens |
| Lien d'e-mail qui renvoie vers le site en ligne | Redirect URL de test absente | étape 5.2 |

Journaux : Edge Functions → `gerer-acces` → **Logs**.

## Retour arrière

| Élément | Commande |
|---|---|
| `20261112000200_relations_comptes.sql` | `drop trigger if exists lier_fiche_mandant on public.profiles;` (les liaisons faites restent : elles sont justes) |
| `20261112000100_cni_fiabilite.sql` | rejouer `20261028000100_cni_avant_publication.sql`, puis `drop trigger if exists verifier_cni_unique on public.profiles;` |
| Données | restaurer la sauvegarde de l'étape 0 |

---

## Pour mémoire : configuration de base (déjà en place, ne pas refaire)

Projet, API, authentification (e-mails à code, SMTP, Google), stockage, `assistant-ia` (offre gratuite, sans `GEMINI_PAYANT`), `nettoyer-fichiers`, tâches planifiées, premier administrateur : voir `README_SUPABASE_GEMINI.md` et `README_SUPABASE.md`.

Détails des modifications : `docs/AUDIT_CNI.md` (CNI), `docs/COMPTES_ET_RELATIONS.md` (comptes et mandants).
