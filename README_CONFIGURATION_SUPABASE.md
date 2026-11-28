# DEUKSIL — Supabase : ce qu'il faut configurer pour les modifications récentes (11, 12, 22 et 27 novembre 2026)

**Pour la personne qui gère Supabase.** Ce document ne reprend PAS l'installation d'origine (déjà faite) : il liste seulement ce que les modifications récentes demandent côté Supabase, **dans l'ordre**, avec un contrôle (✅) après chaque étape.

| | |
|---|---|
| Projet Supabase | `fqrmulupzaqmvjoybela` |
| Branche à tester | `test` — https://deuksil-git-test-babacarsns-projects.vercel.app |
| Site en ligne (nom de domaine officiel) | https://deuksil.com (aussi https://deuksil.vercel.app) |

> La branche `test` utilise **la même base Supabase** que le site en ligne : ce que vous appliquez ici vaut pour les deux. Les deux migrations ne cassent rien pour le site en ligne actuel (aucune table, colonne ni donnée supprimée).

---

## 28 novembre 2026 — téléphone unique, e-mails, retours de connexion

Projet Supabase : `fqrmulupzaqmvjoybela`. Faire une sauvegarde avant.

### 1. Un numéro de téléphone = un compte (SQL)

SQL Editor → coller **tout** `20261128000100_telephone_unique.sql` → **Run** (rejouable sans risque).

Les comptes qui partagent DÉJÀ un numéro ne sont pas modifiés. Pour les voir :

```sql
select app.tel_court(phone) as numero, count(*) as comptes, string_agg(email || ' (' || role || ')', ', ') as qui
from public.profiles where app.tel_court(phone) is not null and doublon_de is null
group by 1 having count(*) > 1;
```

Contrôle : `select public.telephone_libre('77 000 00 00');` répond `true` ou `false`.

### 2. URL de retour (connexion Google, liens des e-mails) — indispensable

Authentication → URL Configuration :
- *Site URL* : `https://www.deuksil.com`
- *Redirect URLs* : `https://www.deuksil.com/**`, `https://deuksil.com/**`, `https://deuksil.vercel.app/**`, `https://deuksil-git-test-babacarsns-projects.vercel.app/**`

### 3. Modèles d'e-mails : le code ET un lien qui marche sur tous les appareils

Authentication → Emails → Templates.

**Reset Password** (mot de passe oublié) — remplacer le contenu par :

```html
<h2>Réinitialiser votre mot de passe DEUKSIL</h2>
<p>Votre code : <b style="font-size:20px;letter-spacing:3px">{{ .Token }}</b></p>
<p>Saisissez-le sur la page « Nouveau mot de passe », ou cliquez sur ce lien (il marche aussi sur un autre téléphone ou ordinateur) :</p>
<p><a href="{{ .SiteURL }}/#/reinitialiser-mot-de-passe?token_hash={{ .TokenHash }}&type=recovery">Choisir un nouveau mot de passe</a></p>
<p>Si vous n'avez rien demandé, ignorez cet e-mail.</p>
```

**Confirm signup** (inscription) — remplacer le contenu par :

```html
<h2>Bienvenue sur DEUKSIL</h2>
<p>Votre code de confirmation : <b style="font-size:20px;letter-spacing:3px">{{ .Token }}</b></p>
<p>Ou cliquez sur ce lien : <a href="{{ .SiteURL }}/#/verifier-email?token_hash={{ .TokenHash }}&type=email">Confirmer mon adresse</a></p>
```

(Sans `{{ .Token }}` dans le modèle, l'e-mail ne contient pas de code et la page « Saisir le code » ne peut pas servir.)

### 4. Fonction gerer-acces (message plus clair pour un téléphone déjà pris)

```bash
supabase functions deploy gerer-acces
```

### Vérifier sur le site
- Inscription avec un numéro déjà utilisé : message « Ce numéro de téléphone est déjà utilisé… ».
- « Mot de passe oublié » : l'e-mail contient un code et un lien ; le lien ouvert sur un autre appareil mène directement à « Choisissez votre nouveau mot de passe ».
- « Continuer avec Google » : la session s'ouvre ; un nouveau compte arrive sur « Compléter mon profil ».

## 27 novembre 2026 — nom de domaine officiel deuksil.com

Le site répond maintenant sur **https://deuksil.com**. Le site y renvoie les liens des e-mails (confirmation, mot de passe oublié) et la connexion Google. Sans ces réglages : liens d'e-mail renvoyés vers l'ancienne adresse, et assistant / création de comptes refusés depuis deuksil.com.

1. **Authentication → URL Configuration** (indispensable pour « Continuer avec Google » et les liens des e-mails)
   - *Site URL* : `https://www.deuksil.com` (deuksil.com renvoie vers www)
   - *Redirect URLs* : `https://www.deuksil.com/**`, `https://deuksil.com/**`, `https://deuksil.vercel.app/**` et `https://deuksil-git-test-babacarsns-projects.vercel.app/**`.
   - Le site demande à revenir sur l'adresse où la personne se trouve : si cette adresse manque dans la liste, Supabase renvoie vers la *Site URL* et la connexion Google ne s'ouvre pas (« la page se recharge et le compte disparaît »).
2. **Secret des fonctions** `DEUKSIL_ORIGINES` (s'il est défini) : il doit contenir deuksil.com, sinon l'assistant et la création des accès sont refusés depuis deuksil.com :
   ```bash
   supabase secrets set DEUKSIL_ORIGINES="https://deuksil.com,https://www.deuksil.com,https://deuksil.vercel.app,https://deuksil-git-test-babacarsns-projects.vercel.app"
   ```
3. Si la connexion Google est activée : Google Cloud → ID client OAuth → *Origines JavaScript autorisées* : ajouter `https://deuksil.com` et `https://www.deuksil.com`. (L'URI de redirection `https://fqrmulupzaqmvjoybela.supabase.co/auth/v1/callback` ne change pas.) Écran de consentement OAuth : ajouter `deuksil.com` aux domaines autorisés.
4. **Authentication → Emails → modèles** : si un modèle contient l'adresse `deuksil.vercel.app` écrite en dur, la remplacer par `{{ .SiteURL }}`.

✅ Sur https://deuksil.com : « Mot de passe oublié » envoie un e-mail dont le lien ouvre deuksil.com ; la connexion Google revient sur deuksil.com ; l'assistant répond.

## 27 novembre 2026 — corrections du retest (à faire en premier)

| Modification (site) | Ce qu'il faut côté Supabase |
|---|---|
| Messages de contact et signalements « 0 » dans l'administration | **Migration `20261127000100_recette_27nov.sql`** |
| Alertes : le client n'était jamais prévenu d'une nouvelle annonce | même migration (déclencheur `prevenir_alertes`) |
| F3 loué resté « En discussion » et visible dans la recherche | même migration (déclencheur `bien_loue_par_bail` + réparation) |
| Loyer « non reçu » d'un bail terminé le jour de son début | même migration (retrait des échéances jamais dues, sans versement) |
| Acte de vente « expiré » au bout d'un an, avec « Renouveler » | même migration (un acte signé n'a plus de date de fin) |
| Comparateur, fiche (photos, carte, partage), caution, accueil | Rien (site uniquement) |

**A. Appliquer la migration** (après une sauvegarde, étape 0) : SQL Editor → coller tout `supabase/migrations/20261127000100_recette_27nov.sql` → Run. Rejouable sans risque. Testée sur un PostgreSQL vierge avec `supabase/tests-cni/recette-27nov.sh` (19 scénarios réussis, et les 65 scénarios existants toujours réussis ; ne jamais lancer ce script sur la production).

✅ Contrôles :
```sql
-- 2 lignes : bien_loue_par_bail, prevenir_alertes
select tgname from pg_trigger where tgname in ('bien_loue_par_bail', 'prevenir_alertes');
-- 1 ligne, valeur « non » (sauf si la double authentification des admins est activée)
select * from app.reglages where cle = 'admin_mfa_obligatoire';
-- Le compte administrateur : rôle « admin », statut « actif »
select id, email, role, status from public.profiles where role = 'admin';
-- 0 : plus aucun bien « disponible / en discussion » avec un bail actif
select count(*) from public.properties p where p.status not in ('loue','vendu','archive')
  and exists (select 1 from public.leases l where l.property_id = p.id and l.unit_id is null and l.status = 'actif');
```
Puis, connecté comme administrateur sur le site : **Messages de contact** et **Signalements** doivent montrer les messages envoyés. Si la base ne reconnaît pas le compte comme administrateur, un bandeau rouge en haut de ces écrans donne la raison exacte.

---

## 22 novembre 2026 — corrections de la recette (à faire en premier si les étapes 0 à 8 sont déjà faites)

| Modification (site) | Ce qu'il faut côté Supabase |
|---|---|
| Le relevé du mandant affichait « Encaissé 0 FCFA » (bloquant) | **Migration `20261122000100_recette_loyers_contact.sql`** |
| Message de contact « envoyé » mais introuvable | même migration (fonction `envoyer_contact`) + contrôle C ci-dessous |
| « Nouveau mot de passe » pour un agent ou un gestionnaire, à tout moment | **Redéployer `gerer-acces`** |
| PDF, session expirée, TVA, comptes, fiche d'un bien, recherche… | Rien (site uniquement) |

**A. Appliquer la migration** (après une sauvegarde, étape 0) : SQL Editor → coller tout `supabase/migrations/20261122000100_recette_loyers_contact.sql` → Run. (Ou `supabase db push` si `supabase migration list` ne montre que celle-ci en attente.) Rejouable sans risque.

✅ Contrôles :
```sql
-- 2 lignes : loyer_suit_bail, loyers_suivent_bail
select tgname from pg_trigger where tgname in ('loyer_suit_bail', 'loyers_suivent_bail');
-- 0 : plus aucun loyer sans bien
select count(*) from public.rents where property_id is null;
-- 1 ligne
select proname from pg_proc where proname = 'envoyer_contact';
```

**B. Redéployer la fonction** : `supabase functions deploy gerer-acces` (SANS `--no-verify-jwt`).

**C. Messages de contact : vérifier la lecture par l'administrateur**
```sql
-- Les messages sont-ils enregistrés ?
select count(*), max(created_at) from public.contact_messages;
-- Si 'oui', l'administrateur doit se connecter avec la double authentification pour les lire
select valeur from app.reglages where cle = 'admin_mfa_obligatoire';
-- Le compte administrateur est-il bien 'admin' et 'actif' ?
select email, role, status from public.profiles where role = 'admin';
```
Si des messages existent mais que la page Admin › Messages de contact en affiche 0, elle indique maintenant pourquoi (lecture refusée).

✅ Sur le site de test : Contact → envoyer → le message apparaît dans Admin › Messages de contact ; compte mandant → Mes relevés = mêmes montants que Reversements côté agence.

Tests automatiques (base locale de test, jamais la production) : `supabase/tests-cni/recette.sh` (lancé par `rejouer.sh`).

---

## 11 et 12 novembre 2026 — ce qui a changé et ce que cela demande à Supabase

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
   supabase secrets set DEUKSIL_ORIGINES="https://deuksil.com,https://www.deuksil.com,https://deuksil.vercel.app,https://deuksil-git-test-babacarsns-projects.vercel.app"
   ```
2. **Authentication → URL Configuration → Redirect URLs** : ajouter `https://deuksil-git-test-babacarsns-projects.vercel.app/**` (garder celles du site en ligne).
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
