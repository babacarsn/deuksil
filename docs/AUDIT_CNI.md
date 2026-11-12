# DEUKSIL — Audit de la CNI (12 novembre 2026)

Problème remonté en recette : « on ne peut pas publier », « on ne trouve pas où écrire la CNI », « on nous dit que la CNI n'est pas renseignée alors qu'on l'a renseignée ». Cet audit couvre **tous les types de compte** et les deux côtés : le site (ce qui est affiché) et la base Supabase (ce qui est autorisé).

## 1. Comment la règle fonctionne

- Pour **publier** une annonce, la base exige que le **titulaire de l'espace** ait une CNI de 13 chiffres (`app.controler_annonce`, migration `20261028000100`).
- Le titulaire de l'espace est le compte lui-même (propriétaire, agence) ; pour un **agent ou un gestionnaire**, c'est le compte de l'agence ou du propriétaire qui l'a créé.
- Un **brouillon** est toujours accepté sans CNI.
- Une CNI ne sert qu'à **un seul compte** (index unique `profiles_cni_unique`).
- L'utilisateur la saisit **une fois** ; ensuite seule l'administration peut la corriger.

| Compte | CNI demandée pour publier | Qui la saisit | Où |
|---|---|---|---|
| Propriétaire | la sienne | lui-même | Paramètres (« Mon profil »), ou le formulaire qui s'ouvre au clic sur Publier |
| Agence | la sienne (titulaire) | le responsable de l'agence | Paramètres → carte « Pièce d'identité (CNI) », ou le formulaire au clic sur Publier |
| Agent / gestionnaire | celle du **titulaire** | le titulaire, pas le membre | — (le membre voit un message explicatif) |
| Propriétaire sous mandat | la sienne | lui-même | Mon profil (il publie rarement : la gestion est à l'agence) |
| Client, locataire | — (ne publient pas) | — | — |
| Administration | jamais bloquée | — | — |

## 2. Bugs trouvés

| N° | Gravité | Comptes | Symptôme | Cause | Correction |
|---|---|---|---|---|---|
| CNI-1 | Bloquant | Agence | Impossible de trouver où saisir la CNI | Le champ n'existait que dans « Mon profil », absent du menu de l'agence | Carte CNI dans Paramètres + formulaire au clic sur Publier (`js/99n-menus-cni.js`) |
| CNI-2 | Bloquant | Tous | « CNI non renseignée » alors qu'on l'a saisie | Le plus souvent : la **même CNI déjà utilisée par un autre compte** (comptes de test). Le site affichait « Profil mis à jour », puis le serveur refusait avec « Cet élément existe déjà. » et la CNI disparaissait | Message clair « déjà utilisé par un autre compte » (site **et** base), fenêtre « CNI non enregistrée » après la réponse du serveur |
| CNI-3 | Bloquant | Propriétaire, agence | Le formulaire CNI se refermait aussitôt ouvert (publication depuis le formulaire du bien) | Le récapitulatif « Publier cette annonce ? » (`js/63-publication.js`) ferme toutes les fenêtres juste après | La CNI est vérifiée **avant** le récapitulatif ; la fenêtre s'ouvre au tour suivant |
| CNI-4 | Majeur | Propriétaire, agence | « Annonce publiée » affiché, puis refus du serveur | Bouton Publier d'une carte : succès annoncé avant la réponse | Succès annoncé seulement après confirmation du serveur |
| CNI-5 | Majeur | Tous | Après un refus, « vérifiez la connexion » alors que la connexion n'y est pour rien | Message fixe dans `js/99k-photos.js` | Message selon la vraie cause |
| CNI-6 | Majeur | Agence, agent | Le message de refus renvoyait vers « Mon profil » (inexistant pour l'agence) et ne disait pas que l'agent dépend de la CNI du titulaire | Texte de la règle SQL | Nouveau message : titulaire ou membre, avec « Paramètres » (migration `20261112000100`) |
| CNI-7 | Mineur | Agence | Une CNI saisie pour un agent laissait croire qu'il pourrait publier | Champ « CNI » du formulaire d'équipe sans explication | Précision sous le champ : sans effet sur la publication |
| CNI-8 | À décider | Propriétaire + agence | Une personne qui a un compte propriétaire **et** dirige une agence ne peut pas mettre sa CNI sur les deux | Une CNI = un seul compte | Option prête, désactivée, dans la migration (§4) |

Déjà en place et vérifié (pas de bug) : un agent ne peut pas modifier la CNI de son agence (la base ignore la modification) ; une CNI ne se modifie pas après coup (seule l'administration peut la corriger) ; le format est contrôlé par la base (13 chiffres).

## 3. Patch Supabase à appliquer

Migration : `supabase/migrations/20261112000100_cni_fiabilite.sql`. **Aucune table, colonne ni donnée supprimée** ; rejouable sans risque.

1. Message de refus juste (titulaire / membre, « Paramètres »).
2. CNI déjà utilisée : refus clair (`P0001`) avant l'index unique.
3. `public.cni_espace_renseignee()` : la base dit si la CNI de l'espace est enregistrée (diagnostic : dans la console du navigateur, `await SB.rpc('cni_espace_renseignee')`).

Appliquer, **d'abord sur le projet de test** :
```bash
supabase link --project-ref <projet>
supabase db push
```
ou : SQL Editor → coller tout le fichier → Run.

Contrôles après application :
```sql
select proname from pg_proc where proname in ('verifier_cni_unique', 'cni_espace_renseignee');   -- 2 lignes
select tgname from pg_trigger where tgname = 'verifier_cni_unique';                               -- 1 ligne
```

Ordre : le site corrigé fonctionne **avec ou sans** cette migration (il affiche déjà le bon message en cas de doublon). Elle peut donc être appliquée avant ou après la fusion.

## 4. Décision à prendre (CNI-8)

Aujourd'hui une CNI = un compte. Pour autoriser « une CNI par type de compte » (propriétaire et agence pour la même personne), décommenter le bloc 4 de la migration. C'est une décision produit : cela affaiblit un peu la détection des faux annonceurs.

## 5. Débloquer un compte

```sql
-- Qui utilise ce numéro ?
select email, role, status from public.profiles where cni = '<13 chiffres>';
-- Corriger une CNI erronée (administration uniquement, SQL Editor) :
update public.profiles set cni = '<13 chiffres corrects>' where email = '<e-mail>';
-- Comptes de TEST qui partagent une CNI : en libérer une
update public.profiles set cni = null where email = '<compte de test>';
```

## 6. Tests

- **Base** (`supabase/tests-cni/`) : toutes les migrations rejouées sur PostgreSQL 16 avec un faux Supabase, puis 22 scénarios par type de compte (propriétaire, agence, agent, administration ; brouillon, publication, doublon, modification, correction). `bash supabase/tests-cni/rejouer.sh` — **jamais sur la production**.
- **Site** (`tests/test-menus-cni.js`, lancé par le contrôle GitHub) : 27 cas, dont la chaîne réelle de publication (récapitulatif qui ferme les fenêtres) et les refus du serveur.
- **Non testé** : le vrai projet Supabase et un vrai navigateur. À vérifier sur l'adresse de prévisualisation Vercel (UAT : PRO-44 et 45, AGE-35 à 38, AGT-18).
