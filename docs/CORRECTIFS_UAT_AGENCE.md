# Correctifs UAT Agence — ce qu'il faut faire côté Supabase

**Bonne nouvelle : aucune nouvelle migration SQL.** La règle « CNI avant de publier » existe déjà (migration `20261028000100_cni_avant_publication.sql`). Il reste à vérifier trois choses, par la personne Supabase.

## 1. La règle CNI est bien en place (SQL Editor)

```sql
-- doit renvoyer 1 ligne
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'app' and proname = 'espace_a_une_cni';
-- doit renvoyer 1 ligne (une CNI ne sert qu'à un seul compte)
select indexname from pg_indexes where indexname = 'profiles_cni_unique';
```
Si la première requête ne renvoie rien : appliquer la migration (`supabase db push`, d'abord sur le projet de test).

## 2. La fonction « gerer-acces » est déployée

C'est elle qui crée les comptes des **agents et gestionnaires**, des **locataires** et des **propriétaires mandants**. Sans elle, « Ajouter un membre », « Donner un accès à un locataire » et « Ouvrir l'accès » échouent.

```bash
supabase functions deploy gerer-acces        # SANS --no-verify-jwt : elle exige une connexion
```
Contrôle : Supabase → Edge Functions → `gerer-acces` présente et active.

À savoir : chaque agent, gestionnaire, locataire ou mandant a besoin de **sa propre adresse e-mail** (c'est son identifiant). Le compte est confirmé d'office et un **mot de passe provisoire s'affiche une seule fois** à l'écran de la personne qui crée l'accès : aucun e-mail n'est envoyé. Une adresse ou une CNI déjà utilisée renvoie « Un compte existe déjà… ».

## 3. Option : débloquer tout de suite les comptes de TEST sans CNI

Uniquement pour des comptes de test (13 chiffres, uniques) :
```sql
update public.profiles set cni = '1234567890123'
 where id = (select id from auth.users where email = 'agence-test@exemple.com');
```
Une fois posée, la CNI n'est plus modifiable par l'utilisateur. Pour les vrais comptes, la personne la saisit elle-même dans le formulaire.

## 4. Contrôle après déploiement du site

```sql
select email, role, cni is not null as cni_ok from public.profiles where role in ('agency', 'owner') order by created_at desc limit 20;
```
Après avoir enregistré une CNI dans le formulaire, `cni_ok` doit passer à `true` pour ce compte.

## 5. « CNI manquante » alors qu'elle apparaît dans Paramètres (diagnostic)

Cas observé sur un compte propriétaire : le site affiche la CNI, mais la publication est refusée avec « Renseignez un numéro de CNI… ». Le site croit la CNI enregistrée ; le **serveur** dit le contraire. Ce correctif resynchronise le site (le formulaire de CNI réapparaît) et affiche la vraie raison d'un refus, mais la cause reste à confirmer dans la base :

**Côté navigateur** (F12 → Console), juste après le refus :
```js
Auth.current().cni          // ce que le site croit
DB.erreurs.slice(-5)        // les refus du serveur : code + message
```

**Côté Supabase** (SQL Editor) :
```sql
select p.email, p.role, p.status, p.parent_id, p.cni is not null as cni_ok
  from public.profiles p where p.email = 'email-du-proprietaire';
```

| Résultat | Cause | Que faire |
|---|---|---|
| `cni_ok = false` | La CNI n'a jamais été enregistrée sur le serveur (écriture refusée) | Lire `DB.erreurs` : `23505` = ce numéro est déjà utilisé par un AUTRE compte (index `profiles_cni_unique`, souvent un compte de test) ; `42501` = écriture non autorisée |
| `cni_ok = true` et `status` différent de `actif` | `app.espace()` renvoie « aucun espace » pour un compte non actif : la règle croit qu'il n'y a pas de CNI | Remettre le compte à `actif` |
| `parent_id` non vide | Compte de gestionnaire ou d'agent : la règle regarde la CNI du TITULAIRE (le compte parent), pas la sienne | Renseigner la CNI sur le compte titulaire |
| `cni_ok = true`, `status = actif`, `parent_id` vide | Règle SQL correcte ; vérifier que la migration `20261028000100` est la version appliquée (§1) | Rejouer la migration sur le projet de test |

Pour trouver un doublon : `select email, role from public.profiles where cni = '<le numéro>';`

## Rien d'autre

Pas de nouveau secret, pas de changement de table, pas de réglage d'authentification.
