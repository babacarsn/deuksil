# DEUKSIL — Assistant de l'espace (consulte et agit)

État au 3 novembre 2026.

## 1. Ce que fait l'assistant

Pour un utilisateur **connecté**, l'assistant :

- **lit toute la base visible par le compte**, à la demande :
  - biens, baux, loyers, devis, proformas, factures, avoirs, paiements, dépenses, contrats, travaux, ventes ;
  - mandants, mandats de gestion et de vente, honoraires, reversements ;
  - visites, demandes de clients, prestataires, unités, états des lieux, messages des baux ;
  - notifications, conversations, documents, favoris, recherches enregistrées, journal des actions, annuaire des propriétaires et agences ;
  - l'administration lit chaque collection pour tous les espaces, plus les comptes, les signalements, l'activité et les messages de contact.

  Avec `details: true`, il lit tous les champs d'une ligne : conditions d'un contrat, révisions d'un bail, note d'une intervention… Seuls les secrets et les fichiers sont retirés (mot de passe, CNI, contenu des fichiers) ;
- **répond à toutes les questions** :
  - sur ces données, toujours après les avoir lues, avec les montants et les références exacts ; les totaux, moyennes et regroupements par mois sont calculés par l'application, pas par le modèle ;
  - sur l'utilisation de DEUKSIL ;
  - sur tout autre sujet (immobilier au Sénégal, calculs, rédaction, culture générale), avec ses connaissances, en signalant ce qui est incertain ; pour le droit ou la fiscalité, il donne des repères et renvoie vers un professionnel ;
- **agit**, toujours après un clic sur **Confirmer** :

| Profil | Actions |
|---|---|
| Propriétaire, agence (et membres selon leurs droits) | créer un devis, une proforma ou une facture ; transformer un devis ou une proforma ; émettre un avoir ; encaisser une facture ; encaisser un loyer (en entier ou en acompte) ; relancer un locataire ; enregistrer une dépense ; ouvrir une intervention ; planifier une visite ; créer un bail et ses loyers ; modifier un bien (prix, titre, description, statut de l'annonce) ; créer un bien en brouillon ; ouvrir un dossier de vente |
| Client | demander une visite, ajouter un favori |
| Locataire | demander une visite, ajouter un favori, signaler un problème au bailleur |
| Administrateur | lecture seule |

L'assistant ne supprime rien. Visiteurs non connectés : rien ne change, ils gardent l'assistant général sans données de compte.

## 2. Fonctionnement

```
Navigateur (js/99m-ia-agent.js)                  Fonction assistant-ia (mode « agent »)        Gemini
 question ───────────────────────────────────────▶ vérifie la connexion, l'offre payante,  ───▶ appel
                                                    la forme et la taille de la conversation;
                                                    ajoute consignes + outils (fixés ici)
 ◀──────────────── parties du modèle (texte ou appel d'outil), renvoyées telles quelles ◀──────
 outil exécuté DANS le navigateur, sur les données
 déjà chargées sous la RLS de l'utilisateur
 action → carte « Confirmer / Annuler »
 résultat de l'outil ─────────────────────────────▶ … jusqu'à la réponse finale (8 étapes au plus)
```

- **Où s'exécutent les outils.** Dans l'application, avec la même couche de données que les écrans (`DB`). Une écriture de l'assistant est donc soumise aux mêmes politiques RLS et déclencheurs qu'un clic dans l'écran : l'assistant n'a jamais plus de droits que l'utilisateur.
- **Ce que fait le serveur.** Il ne lit ni n'écrit aucune donnée de gestion. Il fixe les consignes et la liste des outils (`AGENT`, `OUTILS` dans `supabase/functions/assistant-ia/index.ts`), puis relaie la conversation.
- **Signatures de raisonnement.** Les parties renvoyées par le modèle sont gardées et renvoyées sans modification, `thoughtSignature` comprise, comme l'exige l'API Gemini. Pour la même raison, le mode agent ne bascule pas sur un autre modèle en cas d'erreur.
- **Confirmation.** Avant toute écriture, chaque action est **préparée** : contrôles, puis résumé chiffré affiché dans une carte. Les contrôles sont ceux des écrans : montant ≤ reste dû, date non future, référence de paiement déjà utilisée, bien déjà loué, créneau de visite pris, téléphone à 9 chiffres… Si un contrôle échoue, aucune carte n'apparaît : le modèle reçoit l'explication. Après **Confirmer**, l'application attend la réponse de la base (`DB.attendre()`). Si la base refuse, la carte passe en « Échec ». Le modèle ne reçoit `ok: true` et la référence (FAC-…, PAY-…, REC-…) qu'après confirmation par la base.
- **Droits d'équipe.** Pour un membre (agent, gestionnaire, comptable…), les collections lisibles et les actions disponibles suivent ses droits (`memberCan`, mêmes noms que `31-rbac.js`). Exemple : sans le droit « finances », le membre ne voit ni les pièces, ni les paiements, ni les dépenses, et ne peut pas créer de facture.
- **Débit.** 40 demandes par minute et par adresse IP au plus (secret facultatif `DEUKSIL_IA_PAR_MINUTE`). La limite est tenue par chaque instance de la fonction : fixez aussi un plafond de dépense dans la console Google.
- **Taille.** Une lecture renvoie au plus 100 lignes et environ 20 000 caractères ; au-delà, le modèle est invité à filtrer ou à calculer. Le serveur refuse une conversation de plus de 160 000 caractères (413) : bouton « + » pour en commencer une nouvelle.
- **Contenus écrits par des tiers.** Descriptions, messages, noms : les consignes demandent au modèle de les traiter comme des informations, jamais comme des ordres. C'est une consigne, pas une garantie. La vraie protection est la carte de confirmation, plus le fait qu'aucune action ne dépasse les droits de l'utilisateur.

## 3. Mise en service

Le mode agent envoie au modèle des données personnelles (noms de locataires, montants). Il n'est donc actif qu'avec l'**offre payante** de l'API Gemini. L'offre gratuite autorise Google à utiliser les données envoyées.

1. Déployer la fonction : `supabase functions deploy assistant-ia`.
2. Secrets (tableau de bord Supabase, Edge Functions → Secrets), jamais dans Git ni dans le navigateur :
   - `GEMINI_API_KEY` : clé d'un projet Google AI avec facturation activée ;
   - `GEMINI_PAYANT=oui` ;
   - facultatif : `GEMINI_MODEL`, `DEUKSIL_ORIGINES=https://deuksil.com,https://www.deuksil.com`.
3. Sans `GEMINI_PAYANT=oui`, la fonction répond 403 `gestion_off`. L'application revient alors automatiquement à l'assistant précédent (résumé en lecture seule, ou réponses générales).
4. `GEMINI_URL` ne sert qu'aux tests locaux. Ne pas le définir en production.

## 4. Tests

`node tests/ia-agent.js` : 26 vérifications sur la réplique locale, avec un **faux Gemini** (`supabase/tests-local/replique/faux-gemini.js`) qui renvoie des réponses écrites par le test.

Ce qui est vérifié :

- lecture et calcul conformes aux données de l'espace ;
- signature renvoyée au tour suivant ;
- consignes et outils fixés par le serveur ;
- aucune écriture avant « Confirmer » ;
- facture créée et relue dans la base, avec le bon total TTC ;
- annulation sans effet ;
- acompte sur loyer enregistré ;
- refus sans carte (facture inconnue, bien d'un autre propriétaire) ;
- droits d'un membre et d'un locataire ;
- lecture de toute la base visible : administration (tous les espaces), agence (mandats, états des lieux, messages des baux, annuaire), lecture détaillée sans secrets ;
- consigne de répondre à toutes les questions ;
- côté serveur : connexion obligatoire (401), forme contrôlée (400), taille (413), offre payante obligatoire (403, sans aucun appel au modèle).

**Non testé :** le vrai modèle Gemini, qu'on ne peut pas joindre depuis l'environnement de test. La qualité des réponses, le choix des bons outils et la tenue face à un texte piégé restent à vérifier en recette, avec la vraie clé, sur un projet Supabase de test. Questions à essayer :

- « Quels loyers sont impayés ce mois-ci ? »
- « Combien ai-je encaissé par mois cette année ? »
- « Fais une facture de 150 000 FCFA à M. Diop pour frais de gestion »
- « Transforme le devis DEV-2026-003 en facture »
- « Enregistre le paiement Wave de 200 000 sur le loyer d'Awa Ndiaye »
- « Planifie une visite de la villa des Almadies demain à 10 h avec Fatou, 77 123 45 67 »

## 5. Fichiers

| Fichier | Rôle |
|---|---|
| `js/99m-ia-agent.js` | collections lisibles, filtres et calculs, actions (préparer → confirmer → exécuter), boucle de conversation, cartes |
| `supabase/functions/assistant-ia/index.ts` | mode `agent` : contrôles, consignes `AGENT`, déclarations `OUTILS`, relais |
| `supabase/tests-local/replique/faux-gemini.js`, `fonction-ia-locale.ts` | tests locaux (port 54328 et 54327, route `/functions/v1/assistant-ia` de la passerelle) |
| `tests/ia-agent.js` | tests |

Ajouter une action :

1. Ajouter une entrée dans `ACTIONS` (`99m-ia-agent.js`) avec `preparer()`, qui renvoie `{resume, details, executer}`.
2. Ajouter sa déclaration, sous le même nom, dans `OUTILS` (`index.ts`).
3. Relancer `node outils/versionner-site.js`.
