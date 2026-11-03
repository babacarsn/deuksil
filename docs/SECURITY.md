# DEUKSIL — Règles de sécurité

État au 2 novembre 2026. Ce document liste les règles en vigueur et l'endroit où chacune est appliquée. L'audit détaillé du 22 octobre 2026 (modèle de menace, injection, XSS, tests) reste dans [AUDIT_SECURITE.md](AUDIT_SECURITE.md). Aucune application n'est inviolable : ces mesures réduisent la surface d'attaque, elles ne l'annulent pas.

## 1. Principes

| Règle | Où elle est appliquée |
|---|---|
| Aucun secret dans le navigateur ni dans Git | `js/00-config.js` ne contient que l'URL et la clé publique. La clé `service_role` n'existe que dans les fonctions Edge `gerer-acces` et `nettoyer-fichiers` (variables d'environnement Supabase). Vérifié par le test S7 (`tests/photos.js`) |
| Ne jamais croire le rôle fourni par le navigateur | rôle, espace, droits, vérification et CNI lus en base (`app.espace()`, `app.a_droit()`, déclencheurs `proteger_profil`, `controler_annonce`) |
| Toute table sous RLS | 32 tables sur 32 ; schéma `app` non exposé par l'API |
| Les limites de l'interface sont revérifiées en base | 20 photos (contrainte + déclencheur), forme des URL de photos, CNI avant publication, permissions d'équipe |
| Opérations sensibles côté serveur | création et suppression de comptes (`gerer-acces`), nettoyage des fichiers (`nettoyer-fichiers`), compteurs (`compter`), notifications vers un tiers (`notifier`) |

## 2. Photos et fichiers (nouveau au 2 novembre 2026)

| Menace | Protection | Test |
|---|---|---|
| Déposer une photo dans le dossier d'un autre propriétaire | 1er dossier = son espace (`dossier_autorise`) | S1 |
| Déposer pour le bien d'un autre, depuis son propre dossier | 2e dossier = bien de son espace | S2 |
| Supprimer ou écraser une photo encore affichée | refusé si `app.fichier_reference` | S3 |
| Agent qui touche aux photos des biens de ses collègues | agent limité aux biens attribués (`agent_id`) | S4 |
| URL de photo piégée (injection d'attribut) ou externe (pistage) | interface : URL échappées ; base : forme contrôlée, dossier du bien imposé | S5 |
| Plus de 20 photos | contrainte + déclencheur | S5 |
| Lister les fichiers d'un autre compte | lecture par l'API limitée à son dossier | S8 |
| Appeler les fonctions de nettoyage | `service_role` seulement ; fonction Edge protégée par un secret de 32 caractères au moins, comparé à durée constante | S6, C1 |
| Faux fichier image (exécutable renommé en .jpg) | l'interface lit le vrai format dans les octets puis **ré-encode** l'image (le fichier d'origine n'est jamais envoyé) ; le compartiment n'accepte que des types image | P3 |
| Fuite de métadonnées (GPS, appareil) | le ré-encodage par canvas ne recopie pas l'EXIF | — |

**Limite connue** : un appel direct à l'API Storage (hors interface) peut déclarer `image/jpeg` pour un autre contenu. Le compartiment contrôle le type déclaré et la taille ; le contrôle du contenu réel par le service hébergé n'a pas été vérifié. Ces fichiers ne seraient servis qu'en image (`X-Content-Type-Options: nosniff`, §3), depuis le domaine de Supabase et non celui du site.

## 2 bis. Assistant de l'espace (nouveau au 3 novembre 2026)

- Les outils s'exécutent dans le navigateur, sur les données déjà lues sous la RLS. Les écritures passent par `DB`, comme les écrans : RLS et déclencheurs s'appliquent. Le serveur de l'assistant ne détient aucune clé de service.
- Chaque écriture exige un clic humain (« Confirmer ») sur un résumé chiffré. Aucune suppression n'est proposée.
- Consignes et liste des outils sont fixées côté serveur. Le navigateur n'envoie que la conversation, contrôlée en forme et en taille ; les rôles autres que `user` et `model` sont refusés.
- Mode agent : connexion vérifiée par Supabase Auth, et `GEMINI_PAYANT=oui` (données personnelles).
- Limite de débit : 40 demandes par minute et par adresse IP pour tous les modes, y compris les questions sans connexion. Comme elle est tenue par instance, fixez aussi un plafond de dépense dans la console Google.
- Risque résiduel : un texte piégé dans une donnée (description, message) peut tenter d'orienter le modèle. Parades : consigne explicite, confirmation obligatoire, droits limités à ceux de l'utilisateur.

## 3. En-têtes HTTP du site (`vercel.json`, nouveau)

| En-tête | Valeur | Raison |
|---|---|---|
| `Content-Security-Policy` | `frame-ancestors 'none'` | empêche l'affichage du site dans un cadre (détournement de clic) ; impossible à poser par la balise `<meta>` |
| `X-Frame-Options` | `DENY` | même protection, anciens navigateurs |
| `X-Content-Type-Options` | `nosniff` | un fichier n'est jamais interprété comme un autre type |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | déjà dans `<meta>`, posé aussi en en-tête |
| `Strict-Transport-Security` | `max-age=31536000` | HTTPS imposé pendant un an (sans `includeSubDomains`, pour ne pas toucher d'autres sous-domaines) |

La politique de sécurité du contenu principale reste dans `index.html` :
- `script-src 'self'`, sans script en ligne ;
- `connect-src` limité à `*.supabase.co`.

Avec un domaine personnalisé Supabase, l'ajouter à `connect-src`.

## 4. Journalisation

- La base trace les actions de gestion (`audit_log`, déclencheurs) sans mot de passe ni jeton.
- La fonction de nettoyage renvoie des nombres et des chemins de fichiers, pas de données personnelles.
- Les erreurs refusées par la base sont gardées en mémoire du navigateur (`DB.erreurs`) pour le diagnostic, sans être envoyées ailleurs.

## 5. Risques résiduels

Les points 1 à 5 et 7 à 10 de [AUDIT_SECURITE.md](AUDIT_SECURITE.md) §8 restent ouverts : tests sur projet hébergé, annuaire, nuisance par notifications, énumération de comptes, MFA des administrateurs, domaine Supabase personnalisé, volume chargé, mots de passe divulgués, essai de restauration. Le point 6, sur les en-têtes HTTP, est traité au §3.

Non testé :
- Storage et fonctions Edge hébergés ;
- Safari iOS et Android réels ;
- tests de charge et d'intrusion, non autorisés dans cette mission.
