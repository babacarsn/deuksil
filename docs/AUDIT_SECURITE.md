# DEUKSIL — Rapport d'audit de sécurité (Supabase)

Date : 22 octobre 2026 · Périmètre : base PostgreSQL (schémas `public`, `app`, `storage`), API REST (PostgREST), Supabase Auth, fonction Edge `gerer-acces`, application web (navigateur).

> Ce rapport décrit ce qui a été **réellement vérifié**, sur quel environnement, et ce qui **reste à vérifier**. Aucune application n'est inviolable : les mesures ci-dessous réduisent la surface d'attaque, elles ne l'annulent pas.

---

## 1. Environnement des tests

Les tests ont été exécutés sur une **réplique locale** de Supabase (Docker et la CLI Supabase n'étaient pas disponibles dans l'environnement de travail) :

| Composant | Version utilisée pour les tests | Sur Supabase hébergé |
|---|---|---|
| PostgreSQL | 16.15 | 15 ou 17 selon le projet |
| Supabase Auth (GoTrue) | v2.164.0 | version gérée par Supabase |
| PostgREST | 12.2.3 | version gérée par Supabase |
| Fonction Edge | Deno 2.1.4, code `supabase/functions/gerer-acces/index.ts` inchangé | Edge Runtime Supabase |
| Storage | **émulation** (passerelle `supabase/tests-local/replique/passerelle.js`) : droits vérifiés par les politiques RLS de `storage.objects`, URL signées émulées | service Storage Supabase |

Conséquence : les politiques RLS, déclencheurs et fonctions SQL ont été testés sur un vrai PostgreSQL avec de vrais jetons Auth ; **le comportement exact du service Storage hébergé et de la plateforme Edge n'a pas été testé**. Procédure à rejouer sur un projet Supabase de test : README_SUPABASE.md §14.

## 2. Modèle de menace

| Acteur | Ce qu'il ne doit pas pouvoir faire |
|---|---|
| Visiteur anonyme | lire autre chose que les annonces publiées et l'annuaire public ; écrire ailleurs que dans le formulaire de contact |
| Client | lire les données d'un autre client ; modifier une visite ; se donner un rôle, une vérification, des permissions |
| Propriétaire / agence | lire ou modifier un autre espace ; rattacher le compte d'un tiers à son bail ; s'approprier un profil |
| Membre d'équipe | dépasser ses permissions (finances, suppression de biens) ; administrer l'équipe |
| Locataire | modifier un loyer, un message du bailleur ; signaler sur un autre logement |
| Propriétaire mandant | modifier les factures de l'agence |
| Navigateur compromis / requête forgée | contourner la RLS en envoyant d'autres `owner_id`, rôles, statuts, numéros |

Données sensibles : CNI, téléphones et adresses e-mail, baux et loyers, factures, documents du coffre (bucket privé), messages.

## 3. Constats et corrections

Gravité : **C** critique · **É** élevée · **M** moyenne · **F** faible.

| # | G. | Constat (avant) | Correction | Vérification |
|---|---|---|---|---|
| 1 | C | Authentification locale dans le navigateur (mots de passe hachés côté client, comptes de démonstration, `demo123`) | Supabase Auth uniquement ; aucune donnée d'authentification côté client | connexion/déconnexion réelles dans tous les tests navigateur |
| 2 | C | Rôle et attributs privilégiés fournis par le navigateur | `user_metadata` limité à client/owner/agency ; parent, permissions, baux, rôle de membre posés **uniquement** par la fonction Edge (clé service_role) dans `app_metadata` ; déclencheur `app.proteger_profil` (colonnes modifiables par cas) | tests « Profil » (7) |
| 3 | C | Création **automatique** de comptes locataires et mandants à chaque affichage, avec des adresses **inventées** `prenom.nom@gmail.com` (adresses potentiellement réelles de tiers) et mot de passe fixe `demo123` | Supprimé. Ouverture d'accès explicite avec l'adresse réelle (fonction Edge, mot de passe provisoire aléatoire affiché une fois, changement imposé à la 1re connexion) ; rattachement à un compte existant par `public.rattacher_locataire` | `tests/acces-comptes.js` (14/14) |
| 4 | É | Rattachement d'un bail : un bailleur pouvait viser n'importe quel compte | `rattacher_locataire` exige le titulaire de l'espace, le bail de l'espace, un compte client, et une **relation** (visite, conversation, déjà locataire) | tests « Comptes » (6) |
| 5 | É | Visites : le client pouvait modifier sa demande (statut « acceptée », autre espace, agent) | politique UPDATE client supprimée ; `app.controler_visite` impose statut `attente`, ni agent ni compte-rendu | tests « Client » |
| 6 | É | Messages de bail : le locataire pouvait écrire « au nom du bailleur » et réécrire un message reçu | `app.controler_message_bail` : auteur et côté imposés, seul le destinataire marque « lu », message immuable | tests « Locataire » |
| 7 | É | Mandant : politique UPDATE sur les factures (montants, lignes modifiables) | politique supprimée (l'accord est saisi par l'agence) | test « Mandant » (non applicable au jeu de test : aucune facture sur les biens du mandant — **à rejouer avec une telle facture**) |
| 8 | É | Demande de gestion : le propriétaire pouvait accepter lui-même sa demande | `app.controler_demande_lien` : transitions contrôlées | test « Liens agence » |
| 9 | É | Conversations : liste de participants modifiable (s'ajouter à la conversation d'autrui) | `app.controler_conversation` : participants fixés à la création (2 à 4) | test « Messagerie » |
| 10 | M | Numérotation des pièces calculée par le navigateur (max + 1) : doublons entre membres simultanés, numéro arbitraire possible | `app.numeroter()` (verrou consultatif par espace/préfixe/année) + index uniques partiels | 12 factures simultanées → 12 numéros distincts ; ticket « n'importe quoi » → `MNT-AAAA-NNNNN` |
| 11 | M | Écritures automatiques par chaque navigateur (rappels à chaque page, expiration des contrats, reconduction tacite, rappels de visite) : doublons et conflits entre utilisateurs | fonctions serveur `app.generer_rappels()` et `app.reconduire_baux()` (idempotentes, clés uniques), planifiées par pg_cron | exécutions répétées sans doublon ; `tests/ecritures-auto.js` : plus aucune écriture sans action de l'utilisateur, hors « marquer lu » |
| 12 | M | Mots de passe de 6 caractères acceptés | 8 caractères minimum avec lettre et chiffre (Auth, fonction Edge, interface) ; quelques mots de passe courants refusés par la fonction Edge et l'interface | — |
| 13 | M | Faille fonctionnelle de `app.proteger_profil` : `permises || 'mdp_provisoire'` interprété comme tableau → l'utilisateur ne pouvait pas quitter son mot de passe provisoire | `array_append` | `tests/acces-comptes.js` (première connexion) |
| 14 | M | Demande de gestion vers une agence refusée à tort (la politique lisait `profiles` sous la RLS du demandeur) | fonction `app.est_agence_active` | test « Liens agence » |
| 15 | M | Pas de politique de sécurité du contenu (CSP) : une injection HTML aurait pu exécuter du script | CSP `script-src 'self'`, aucun gestionnaire inline (le seul `onclick` a été retiré) | sonde : 0 violation CSP sur 6 profils ; un `<img onerror>` injecté volontairement **ne s'exécute pas** |
| 16 | F | Jeu de test avec des adresses `@gmail.com` réalistes | adresses ramenées au domaine réservé `deuksil.test` | — |
| 17 | F | `app.verifier_ticket_locataire` bloquait les imports serveur | contrôle limité aux appels avec utilisateur | import de données synthétiques |
| 18 | F | (fonctionnel) Premier affichage possible avant l'exécution des derniers modules : accueil incomplet sur un serveur rapide | le premier rendu attend `DOMContentLoaded` | `tests/formulaires.js` F1 |
| 19 | F | (fonctionnel) Mot de passe réinitialisé : le message de confirmation était effacé par le rechargement de session | notification puis retour à l'espace | `tests/formulaires.js` F4 |

## 4. Injection SQL

* L'application n'assemble **aucune** requête SQL : elle appelle PostgREST (paramètres typés) et des fonctions RPC à paramètres typés.
* Les fonctions SQL n'utilisent du SQL dynamique qu'à un endroit (`app.numeroter`), avec `format('%I')` sur le nom de la table du déclencheur (valeur interne) et des paramètres liés (`using`).
* Toutes les fonctions `SECURITY DEFINER` fixent `search_path = ''` et qualifient les objets.
* Tests exécutés (catégorie « Injection ») : 5 charges classiques (`' or '1'='1`, `; drop table`, `union select … auth.users`, `pg_sleep`) dans des filtres `eq` et `ilike` → traitées comme du texte, aucun délai ; une charge enregistrée puis relue à l'identique ; `order` injecté refusé ; jointure vers `profiles` sans résultat ; schéma `auth` et fonctions du schéma `app` non exposés.

## 5. XSS (injection de script stockée)

* Sonde `tests/xss-sonde.js` : une charge `"><img src=x onerror=…>` insérée dans **49 colonnes** texte/JSON de la base (3 refusées par des contraintes), puis visite de toutes les pages de menu de **9 profils** (≈ 119 pages) et de fiches d'annonces : **aucune exécution, aucun élément injecté** ; la charge apparaît comme du texte.
* Témoin positif : la sonde détecte bien un élément injecté volontairement.
* Limites : modales, PDF et écrans ouverts par des actions ne sont pas tous parcourus par la sonde. La CSP couvre aussi ces cas (aucun script inline ne s'exécute).

## 6. Secrets

* Navigateur : URL du projet et clé **anon** (publique par conception) dans `js/00-config.js`. Aucune clé `service_role`.
* `service_role` : uniquement dans l'environnement de la fonction Edge (fourni par Supabase) et des outils locaux sur base de test.
* `.gitignore` couvre `.env*`, clés locales, journaux ; `.env.example` ne contient aucune valeur réelle.
* Les clés de la réplique de test sont signées avec le secret **public** par défaut des outils locaux Supabase : elles n'ouvrent aucun projet hébergé.

## 7. Résultats des tests (réplique locale, 22/10/2026)

| Suite | Résultat |
|---|---|
| `supabase/tests-local/securite-rls.test.js` — API REST avec de vrais comptes (11 comptes : 8 rôles, plus le visiteur anonyme) | **65/65** |
| `tests/acces-comptes.js` — ouverture d'accès, rattachement, première connexion | **14/14** |
| `tests/formulaires.js` — inscription avec code reçu par e-mail, connexion, mot de passe oublié, agence, photos, contact | **27/27** |
| `tests/xss-sonde.js` — XSS stockée | **0** exécution |
| contrôle CSP (6 profils, toutes pages de menu) | **0** violation |
| `tests/sonde-pages.js` — 9 profils, toutes les pages de menu | aucune erreur JS ni requête refusée |
| `tests/ecritures-auto.js` — écritures sans action | uniquement « marquer comme lu » |

Les fichiers de résultats sont produits dans `supabase/tests-local/resultats/`.

## 8. Risques résiduels et recommandations

1. **Rejouer les tests sur un projet Supabase de test** (non production) avant la mise en ligne : Storage et Edge n'ont été testés qu'en émulation.
2. **Annuaire** : tout compte connecté voit le téléphone et l'e-mail des propriétaires et agences actifs (choix fonctionnel : les contacter). À confirmer.
3. **Notifications** : un compte connecté peut notifier un annonceur (limite 60/min par expéditeur). Risque de nuisance, pas de fuite.
4. **Énumération** : un titulaire d'espace peut savoir si une adresse a déjà un compte (messages de `gerer-acces` / `rattacher_locataire`).
5. **Administrateurs** : activer la double authentification (MFA) puis passer `app.reglages.admin_mfa_obligatoire` à `oui`.
6. **En-têtes HTTP** chez l'hébergeur du site : `frame-ancestors 'none'` (ou `X-Frame-Options: DENY`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff` — impossibles à poser par une balise `<meta>`.
7. **Domaine personnalisé Supabase** : l'ajouter à `connect-src` de la CSP (`index.html`).
8. **Volume** : l'interface charge toutes les lignes visibles (dont tout le catalogue public) ; à surveiller (docs/PERFORMANCES.md).
9. **Protection des mots de passe divulgués** (HaveIBeenPwned) : option de Supabase Auth réservée à certaines offres — à envisager seulement si le besoin est établi.
10. **Sauvegardes** : vérifier la restauration (README_SUPABASE.md §17) avant d'accueillir des données réelles.

## 9. Non testé

* Tests de charge et d'intrusion (non autorisés dans cette mission) ; attaques par déni de service.
* Envoi réel d'e-mails (SMTP capturé localement), connexion Google (non configurée : identifiants OAuth requis).
* Comportement sur PostgreSQL 15 / 17 hébergé (testé sur 16.15).
