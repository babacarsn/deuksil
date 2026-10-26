# DEUKSIL — Configuration Supabase et Gemini (mise en ligne)

À l'équipe backend. Ce document liste **tout ce qui doit être réglé côté Supabase et Gemini** pour que le site en ligne fonctionne : comptes, e-mails, connexion Google, fonctions serveur, assistant IA et premier administrateur. Chaque étape finit par un **contrôle** : on ne passe pas à la suivante tant qu'il n'est pas bon.

La référence complète reste `README_CONFIGURATION.md` (toutes les étapes, de bout en bout) ; ce fichier-ci en est la partie « mise en ligne ».

| | Valeur |
|---|---|
| Site en ligne | `https://deuksil.vercel.app` (Vercel, branche `main` du dépôt `babacarsn/deuksil`) |
| Projet Supabase | `fqrmulupzaqmvjoybela` → `https://fqrmulupzaqmvjoybela.supabase.co` |
| Clé publique dans le site | `sb_publishable_…` dans `js/00-config.js` (publique par conception) |
| Fonctions serveur | `gerer-acces` (comptes ouverts par un tiers), `assistant-ia` (relais Gemini) |
| Secrets serveur | `DEUKSIL_ORIGINES`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_PAYANT` (+ `DEUKSIL_CLE_PUBLIQUE` facultatif) |

> 🔒 **Règles** : la clé `service_role`, le mot de passe de la base, la clé Gemini, les secrets Google et SMTP ne vont **jamais** dans `js/`, dans Git, dans un message ou dans ce document. Ils vont uniquement dans le tableau de bord Supabase ou dans `supabase secrets set`.

---

## 0. Avant de commencer

1. **Outils** : Supabase CLI (`supabase --version`), un terminal, l'accès au tableau de bord du projet.
2. **Relier la CLI au projet** (une fois) :
   ```bash
   supabase login
   supabase link --project-ref fqrmulupzaqmvjoybela
   ```
3. **Code à jour** : prendre le dossier `deuksil-supabase-integration` livré le 26/10/2026 (il contient la **nouvelle** fonction `assistant-ia` avec les outils IA). ⚠️ La branche `supabase-integration` du dépôt contient encore l'ancienne version de `supabase/functions/assistant-ia/index.ts` : la remplacer par celle du dossier livré.

> **✅ Contrôle** : `supabase projects list` montre le projet marqué comme lié.

---

## 1. Base de données

Les 8 migrations de `supabase/migrations/` doivent être appliquées (déjà fait si l'étape 5 du guide a été suivie).

```bash
supabase db push
```

> **✅ Contrôle** (SQL Editor) :
> ```sql
> select count(*) from supabase_migrations.schema_migrations;                        -- 8
> select count(*) from pg_tables where schemaname = 'public' and not rowsecurity;  -- 0 (RLS partout)
> select jobname, schedule, active from cron.job;                                   -- deuksil-rappels | 0 7 * * * | true
> ```
> Si la tâche `deuksil-rappels` manque : activer l'extension **pg_cron** (Database → Extensions) puis
> `select cron.schedule('deuksil-rappels', '0 7 * * *', 'select app.generer_rappels()');`

**Projet vide avant l'ouverture** : aucune donnée de test ne doit être présente.

```bash
psql "$DATABASE_URL" -f supabase/outils/verifier-projet-vide.sql        # toutes les lignes à 0
```

Si des données de test y ont été importées par erreur : **sauvegarde d'abord** (`supabase/sauvegarde/sauvegarder.sh`), puis
`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "set deuksil.vider = 'oui'" -f supabase/outils/vider-projet.sql`
et `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… CONFIRMER=oui node supabase/outils/vider-fichiers.js` (fichiers). Irréversible.

---

## 2. Authentification (tableau de bord → Authentication)

### 2.1 Adresses du site — **indispensable**

**Authentication → URL Configuration**

| Champ | Valeur |
|---|---|
| Site URL | `https://deuksil.vercel.app` |
| Redirect URLs | `https://deuksil.vercel.app/**` |

Sans cela, les liens de confirmation, « mot de passe oublié » et le retour de connexion Google renvoient vers une mauvaise adresse.

### 2.2 Inscription et mots de passe

**Authentication → Providers → Email** : *Confirm email* activé · mot de passe **8 caractères minimum**.
**Authentication → Email Templates** : coller les modèles de `supabase/templates/` (confirmation par **code**, réinitialisation par **code**) — le site attend un code à 6 chiffres.

### 2.3 Envoi des e-mails (SMTP)

Le service d'e-mails intégré de Supabase est limité à quelques messages par heure : **configurer un SMTP** (Authentication → SMTP Settings) avec le fournisseur choisi (Brevo, Resend, Mailjet…). Expéditeur : une adresse du domaine DEUKSIL.

> **✅ Contrôle** : sur `https://deuksil.vercel.app`, « Créer un compte » avec une vraie adresse → l'e-mail avec le code arrive en moins d'une minute, le code est accepté.

### 2.4 Connexion Google

1. **Google Cloud Console → API et services → Identifiants → ID client OAuth** (type *Application Web*) :
   - *Origines JavaScript autorisées* : `https://deuksil.vercel.app`
   - *URI de redirection autorisés* : `https://fqrmulupzaqmvjoybela.supabase.co/auth/v1/callback`
2. **Supabase → Authentication → Providers → Google** : activer, coller l'ID client et le secret client.
3. Dans le site, `js/00-config.js` : `googleActif: true` (déjà fait).

> **✅ Contrôle** : « Continuer avec Google » sur le site ouvre le choix du compte Google puis revient connecté sur `https://deuksil.vercel.app`.

---

## 3. Fonctions serveur

### 3.1 `gerer-acces` — comptes ouverts par un propriétaire ou une agence

```bash
supabase functions deploy gerer-acces
supabase secrets set DEUKSIL_ORIGINES="https://deuksil.vercel.app"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase : **ne pas** les définir.

> **✅ Contrôle** :
> ```bash
> curl -s -o /dev/null -w "%{http_code}\n" -X POST https://fqrmulupzaqmvjoybela.supabase.co/functions/v1/gerer-acces
> ```
> → **401** (la fonction refuse les inconnus : c'est le bon comportement).

### 3.2 `assistant-ia` — l'assistant DEUKSIL (Gemini)

```bash
supabase functions deploy assistant-ia --no-verify-jwt
supabase secrets set GEMINI_API_KEY="<clé Gemini>"            # SECRET
supabase secrets set GEMINI_MODEL="gemini-flash-latest"       # facultatif
supabase secrets set GEMINI_PAYANT="non"                      # voir la partie 4 avant de mettre « oui »
supabase secrets list                                          # GEMINI_API_KEY, GEMINI_PAYANT, DEUKSIL_ORIGINES
```

Pourquoi `--no-verify-jwt` : l'assistant répond aussi aux visiteurs sans compte, et la clé publique `sb_publishable_…` n'est pas un jeton JWT. La fonction **vérifie elle-même** l'utilisateur (Supabase Auth) pour tout ce qui touche à ses données, et le rôle administrateur dans la base pour la modération.

*Facultatif* : si les anciennes clés JWT du projet ont été désactivées (Project Settings → API Keys → *Legacy*), ajouter la clé publique pour que la fonction puisse vérifier les utilisateurs :
`supabase secrets set DEUKSIL_CLE_PUBLIQUE="sb_publishable_…"`.

> **✅ Contrôles** :
> ```bash
> # question générale (visiteur)
> curl -s -X POST https://fqrmulupzaqmvjoybela.supabase.co/functions/v1/assistant-ia \
>   -H "content-type: application/json" \
>   -d '{"mode":"chat","turns":[{"role":"user","content":"Réponds en une phrase."},{"role":"user","content":"Bonjour"}]}'
> # → {"text":"…"}        {"message":"Assistant non configuré."} = GEMINI_API_KEY manquante
>
> # outil sans connexion
> curl -s -X POST https://fqrmulupzaqmvjoybela.supabase.co/functions/v1/assistant-ia \
>   -H "content-type: application/json" -d '{"mode":"tache","tache":"annonce","donnees":{}}'
> # → {"code":"connexion",…}   (refus attendu)
> ```
> Sur le site, connecté en propriétaire : formulaire d'un bien → **« Rédiger avec l'assistant »** propose un titre et une description.

---

## 4. Gemini : offre gratuite ou payante (`GEMINI_PAYANT`)

Les conditions de l'API Gemini distinguent deux offres :

| | Offre **gratuite** | Offre **payante** (facturation activée) |
|---|---|---|
| Utilisation des données par Google | peut les utiliser pour améliorer ses produits ; relecture humaine possible | **non** ; conservées un temps limité pour détecter les abus |
| Données personnelles ou confidentielles | **interdites** (« Do not submit sensitive, confidential, or personal information ») | autorisées |

DEUKSIL en tient compte **côté serveur** :

| Outil de l'assistant | Où dans le site | Exige `GEMINI_PAYANT=oui` |
|---|---|---|
| Questions générales (chat, recherche en langage naturel) | partout | non |
| Rédiger l'annonce · Estimer le prix | formulaire d'un bien | non |
| Suggestions de biens pour une demande client (anonymisée) | Agence → Clients | non |
| Analyser une annonce (rôle admin vérifié en base) | Administration → Modération | non |
| Questions sur **ses** données (factures, devis, contrats, loyers, aide à la décision) | chat, connecté | **oui** |
| Message de relance d'impayé | Gestion → Loyers | **oui** |
| Rapport du mois · relevé d'un propriétaire mandant | Gestion, Gestion → Rapports | **oui** |
| Résumer une conversation | Messagerie | **oui** |
| Lire une facture ou un reçu (photo) | Gestion → Dépenses | **oui** |

**Pour activer les outils « oui »** :

1. Activer la **facturation** du projet Google (Google AI Studio → page des clés API / *Billing* : rattacher un compte de facturation Google Cloud au projet de la clé).
2. Fixer un **plafond de budget** et une alerte (Google Cloud → Facturation → Budgets et alertes) : l'assistant est ouvert aux visiteurs.
3. Seulement ensuite :
   ```bash
   supabase secrets set GEMINI_PAYANT=oui
   ```
   (Les secrets sont lus au démarrage de la fonction : pas besoin de redéployer ; en cas de doute, `supabase functions deploy assistant-ia --no-verify-jwt`.)

> **✅ Contrôle** : connecté en propriétaire, ouvrir l'assistant et cliquer « Quelles factures sont impayées ? » → la réponse cite les vraies références (FAC-…). Avec `GEMINI_PAYANT=non`, la réponse se termine par « … ne sont pas encore activées … » : c'est normal.

La politique de confidentialité du site (pied de page → Politique de confidentialité) décrit déjà cet envoi à Google ; elle doit rester vraie : **ne pas** mettre `oui` sans facturation.

---

## 5. Premier administrateur

1. Sur le site, **Créer un compte** (profil *Client*) avec `babacarsamb3075@gmail.com`, confirmer le code reçu par e-mail.
2. SQL Editor :
   ```sql
   update public.profiles set role = 'admin' where email = 'babacarsamb3075@gmail.com';
   select email, role from public.profiles where role = 'admin';
   ```
3. Se déconnecter / reconnecter → espace **Administration**.
4. Activer la double authentification depuis l'espace administrateur, **puis** :
   ```sql
   update app.reglages set valeur = 'oui' where cle = 'admin_mfa_obligatoire';
   ```
   ⚠️ Dans cet ordre, sinon l'administrateur perd l'accès aux fonctions d'administration.

> **✅ Contrôle** : `select email, role from public.profiles where role = 'admin';` → une seule ligne.

---

## 6. Mise à jour du site (Vercel)

Le site est publié par Vercel depuis la branche `main` de `babacarsn/deuksil`. Le dossier `MISE_EN_LIGNE` (script `LANCER_MISE_EN_LIGNE.bat`) remplace le contenu du dépôt par `DEUKSIL_SITE_A_PUBLIER.zip` et pousse sur `main` après confirmation « OUI » ; Vercel redéploie en 1 à 2 minutes. L'ancienne démo reste récupérable : étiquette Git `demo-avant-supabase`.

Seuls `index.html`, `sw.js`, `manifest.webmanifest`, `css/`, `js/`, `img/` sont publiés. **Jamais** les dossiers `supabase/`, `tests/` ni le jeu de test.

> **✅ Contrôle** : `https://deuksil.vercel.app` → accueil vide (« Aucune annonce en ligne pour le moment », 0 bien). Dans la console du navigateur (F12), aucune erreur rouge.

---

## 7. Récapitulatif à cocher

| ☐ | Réglage | Contrôle |
|---|---|---|
| ☐ | CLI liée au projet `fqrmulupzaqmvjoybela` | `supabase projects list` |
| ☐ | 8 migrations, RLS partout, `deuksil-rappels` actif | partie 1 |
| ☐ | Projet vide avant l'ouverture | `verifier-projet-vide.sql` → 0 |
| ☐ | Site URL + Redirect URLs = `https://deuksil.vercel.app` | partie 2.1 |
| ☐ | Confirmation e-mail, 8 caractères, modèles à code | inscription test |
| ☐ | SMTP personnalisé | e-mail reçu < 1 min |
| ☐ | Google : origine + URI de redirection + provider activé | connexion Google |
| ☐ | `gerer-acces` déployée, `DEUKSIL_ORIGINES` défini | `curl` → 401 |
| ☐ | `assistant-ia` (nouvelle version) déployée `--no-verify-jwt`, `GEMINI_API_KEY` défini | `curl` → `{"text":…}` |
| ☐ | `GEMINI_PAYANT` : `oui` **seulement** avec facturation + budget | partie 4 |
| ☐ | Premier administrateur, double authentification, puis obligatoire | partie 5 |
| ☐ | Aucune clé `service_role` ni clé Gemini dans le dépôt | `git grep -n "service_role\|AIza"` → commentaires seulement |

---

## 8. En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| « Configuration incomplète » sur le site | `js/00-config.js` vide | renseigner `supabaseUrl` et `supabaseAnonKey` (clé publique) |
| Le code de confirmation n'arrive pas | SMTP non configuré ou limite atteinte | partie 2.3 ; vérifier les spams |
| Après Google, retour sur `localhost` ou erreur de redirection | Site URL / Redirect URLs / URI Google | parties 2.1 et 2.4 |
| « Ouverture d'accès » (locataire, équipe) refusée | `gerer-acces` non déployée ou `DEUKSIL_ORIGINES` faux | partie 3.1 |
| L'assistant répond « ne répond pas pour le moment » | `GEMINI_API_KEY` absente/invalide, quota Gemini dépassé | `supabase functions logs assistant-ia` |
| L'assistant dit « … pas encore activées … » | `GEMINI_PAYANT` ≠ `oui` | normal tant que la facturation n'est pas activée (partie 4) |
| Un utilisateur connecté reçoit « Connectez-vous pour utiliser cet outil » | anciennes clés JWT désactivées | `supabase secrets set DEUKSIL_CLE_PUBLIQUE="sb_publishable_…"` (partie 3.2) |
| « Outil réservé à l'administration » | le compte n'a pas `role = 'admin'` | partie 5 |
| `42501` / « permission denied » | une règle RLS refuse | normal pour un compte sans droit ; sinon voir `README_SUPABASE.md` §18 |
