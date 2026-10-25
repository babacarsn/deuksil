# Fiche de recette manuelle — formulaires (projet Supabase de TEST)

À faire à l'**étape 9** du guide, sur le **projet de test**, jamais sur la production. Durée : environ 15 minutes.
Elle remplace `tests/formulaires.js`, qui ne peut pas lire les e-mails d'un projet hébergé.

**Préparer**
- deux adresses e-mail de test **auxquelles vous avez accès** (A pour le client, B pour l'agence). Astuce Gmail : `vous+client@gmail.com`, `vous+agence@gmail.com` arrivent dans la même boîte ;
- un téléphone ou un ordinateur, navigateur en navigation privée ;
- l'adresse du site de test.

Testeur : ______________________ Date : ____ / ____ / ______ Navigateur : ______________

Cocher **OK** ou **KO**. En cas de KO, noter le message affiché et faire une capture d'écran.

---

## 1. Accueil (2 min)

| # | Action | Résultat attendu | OK | KO |
|---|---|---|---|---|
| 1.1 | Ouvrir le site | page d'accueil complète, pas de « Configuration incomplète » | ☐ | ☐ |
| 1.2 | Cliquer « Publier un bien » | formulaire d'inscription, profil **Propriétaire** coché | ☐ | ☐ |
| 1.3 | Revenir, cliquer « Créer un compte agence » | profil **Agence** coché, champs de l'agence visibles | ☐ | ☐ |
| 1.4 | Lire le formulaire | aucune mention de « démonstration », « fictif » ou « paiement » | ☐ | ☐ |

## 2. Inscription d'un client avec l'adresse A (4 min)

Ouvrir « Créer un compte », choisir **Client**, puis :

| # | Action | Résultat attendu | OK | KO |
|---|---|---|---|---|
| 2.1 | Étape 2 : e-mail `pas-une-adresse` | message « Adresse e-mail invalide », on reste à l'étape 2 | ☐ | ☐ |
| 2.2 | Téléphone `12345` | message « téléphone invalide » | ☐ | ☐ |
| 2.3 | CNI `123` | message « 13 chiffres » | ☐ | ☐ |
| 2.4 | Corriger : adresse **A**, téléphone `77 123 45 67`, CNI de 13 chiffres | passage à l'étape 3 | ☐ | ☐ |
| 2.5 | Mot de passe `abcdefgh` (sans chiffre) | refusé (« trop faible » / chiffre manquant) | ☐ | ☐ |
| 2.6 | Mot de passe et confirmation différents | « ne correspondent pas » | ☐ | ☐ |
| 2.7 | Ne pas cocher les conditions d'utilisation | refusé (« conditions ») | ☐ | ☐ |
| 2.8 | Mot de passe valide (8 caractères, lettre et chiffre), conditions cochées, valider | page « Vérifiez votre adresse e-mail » | ☐ | ☐ |
| 2.9 | Ouvrir la boîte A | e-mail « Confirmez votre adresse DEUKSIL » avec un **code à 6 chiffres**, reçu en moins de 2 min (regarder aussi les indésirables) | ☐ | ☐ |
| 2.10 | Taper un faux code `000000` | refusé, pas de connexion | ☐ | ☐ |
| 2.11 | Taper le bon code | connecté, arrivée sur l'espace client | ☐ | ☐ |

Délai de réception de l'e-mail : ______ secondes.

## 3. Connexion (2 min)

| # | Action | Résultat attendu | OK | KO |
|---|---|---|---|---|
| 3.1 | Se déconnecter, ouvrir « Se connecter » | champ « Adresse e-mail », lien « Mot de passe oublié ? » | ☐ | ☐ |
| 3.2 | Adresse A + mauvais mot de passe | message « incorrect », pas de connexion | ☐ | ☐ |
| 3.3 | Adresse A + bon mot de passe | connecté | ☐ | ☐ |

## 4. Mot de passe oublié (3 min)

| # | Action | Résultat attendu | OK | KO |
|---|---|---|---|---|
| 4.1 | Se déconnecter → « Mot de passe oublié ? » → adresse A | « Code envoyé » (le message ne dit pas si le compte existe) | ☐ | ☐ |
| 4.2 | Boîte A | e-mail « Votre code DEUKSIL » avec un code à 6 chiffres | ☐ | ☐ |
| 4.3 | « J'ai déjà un code » : adresse A, code, nouveau mot de passe ×2 | message « Mot de passe modifié », arrivée sur l'espace du compte | ☐ | ☐ |
| 4.4 | Se déconnecter, se reconnecter avec le **nouveau** mot de passe | connecté | ☐ | ☐ |
| 4.5 | Essayer l'**ancien** mot de passe | refusé | ☐ | ☐ |

## 5. Inscription d'une agence avec l'adresse B (2 min)

| # | Action | Résultat attendu | OK | KO |
|---|---|---|---|---|
| 5.1 | « Créer un compte agence » : nom de l'agence, adresse, NINEA, prénom, nom, adresse **B**, téléphone, CNI, mot de passe, conditions | page « Vérifiez votre adresse e-mail » | ☐ | ☐ |
| 5.2 | Taper le code reçu sur B | arrivée sur le **tableau de bord de l'agence** | ☐ | ☐ |

## 6. Photos d'une annonce (2 min, connecté en agence)

| # | Action | Résultat attendu | OK | KO |
|---|---|---|---|---|
| 6.1 | « Ajouter un bien » | la zone photos annonce « jusqu'à 20 photos » | ☐ | ☐ |
| 6.2 | Choisir **23** photos d'un coup | **20** gardées (compteur « 20/20 »), l'ajout de photos se désactive | ☐ | ☐ |
| 6.3 | Compléter et enregistrer le bien, puis le rouvrir | les photos s'affichent | ☐ | ☐ |

## 7. Formulaire de contact (1 min, déconnecté)

| # | Action | Résultat attendu | OK | KO |
|---|---|---|---|---|
| 7.1 | Pied de page → « Nous écrire » | page Contact | ☐ | ☐ |
| 7.2 | Message `court` | refusé (« trop court ») | ☐ | ☐ |
| 7.3 | Message complet, envoyer | « Message envoyé » | ☐ | ☐ |
| 7.4 | Se connecter en administrateur → notifications | une notification « Contact · … » avec le message | ☐ | ☐ |

---

## Contrôles dans la base (éditeur SQL du projet de test)

Remplacer les adresses par celles utilisées.

```sql
-- 2 : le client existe, avec sa CNI et la date d'acceptation des conditions
select role, cni, cgu_acceptees_le is not null as cgu from public.profiles where email = 'adresse-A';
-- 5 : l'agence existe avec son nom et son NINEA
select role, agency_name, ninea from public.profiles where email = 'adresse-B';
-- 7 : le message de contact est enregistré, statut « nouveau »
select statut, subject, created_at from public.contact_messages order by created_at desc limit 1;
-- aucun mot de passe en clair nulle part dans public
select count(*) from information_schema.columns where table_schema = 'public' and column_name ilike '%password%';  -- 0
```

| Contrôle | OK | KO |
|---|---|---|
| profil client (role `client`, CNI, cgu = true) | ☐ | ☐ |
| profil agence (role `agency`, nom, NINEA) | ☐ | ☐ |
| message de contact (statut `nouveau`) | ☐ | ☐ |
| aucune colonne de mot de passe (0) | ☐ | ☐ |

## Résultat

Nombre de OK : ______ / 36  Nombre de KO : ______

☐ **Recette validée** (tout est OK) ☐ **Recette refusée** (au moins un KO : à corriger puis refaire la fiche)

Signature : ______________________

En cas de KO : README_SUPABASE.md §18 (erreurs fréquentes). E-mails non reçus → vérifier le SMTP personnalisé (Authentication → SMTP) et les indésirables.
