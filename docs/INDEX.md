# DEUKSIL — Index : justification et vérification

58 index créés par `supabase/migrations/20261022000800_performances.sql`, en plus des contraintes d'unicité métier des migrations précédentes (`rents (lease_id, month)`, `billing_docs (owner_id, ref)`, `favorites (user_id, property_id)`, créneau de visite, numéros de pièces…) qui servent aussi d'index.

**Colonnes du tableau**
* *Requête visée* : la lecture ou l'opération qui en a besoin.
* *Raison* : pourquoi un index (filtre RLS, clé étrangère, tri, fraction de lignes).
* *Mesure* : scénario de `docs/PERFORMANCES.md` qui l'utilise (médiane avant → après, jeu synthétique d'environ 1 million de lignes). « — » : pas de scénario dédié.
* *Vérification* : `supabase/tests-local/perf/verifier-index.js` — **choisi** = le planificateur l'utilise de lui-même avec les volumes de test ; **utilisable** = sur une table presque vide, le parcours séquentiel reste moins cher (normal), mais avec `enable_seqscan = off` le plan l'utilise : la forme de la requête correspond. Résultat : 33 choisis, 25 utilisables, 0 inutile.

**Coût** : chaque index ralentit les écritures de la table et occupe de la place. Mesure sur `rents` (3 index) : environ +15 à +35 % sur une insertion de masse (≈ 5 à 14 µs par ligne) ; sur `notifications`, dans le bruit de mesure. Les index partiels (`where … is not null`, statut) limitent ce coût aux lignes concernées. Détail : docs/PERFORMANCES.md.

| Index | Table (colonnes) | Type | Requête visée | Raison | Mesure | Vérification |
|---|---|---|---|---|---|---|
| `properties_owner_idx` | properties (owner_id) | B-tree | biens d'un espace (politique « espace »), suppression d'un compte (cascade) | filtre de toutes les lectures d'un propriétaire/agence | 491.6 → 27.0 ms | choisi par le planificateur (30052 lignes) |
| `leases_owner_idx` | leases (owner_id) | B-tree | baux de l'espace | filtre RLS « owner_id = espace » | 280.2 → 1.5 ms | choisi par le planificateur (12011 lignes) |
| `rents_owner_idx` | rents (owner_id) | B-tree | loyers de l'espace | plus grosse table de gestion (12 échéances par bail) | 263.3 → 1.5 ms | choisi par le planificateur (144125 lignes) |
| `visits_owner_date_idx` | visits (owner_id, date) | B-tree composite | visites de l'espace, tri / filtre par date | colonne RLS + date des agendas | 5.7 → 1.5 ms | choisi par le planificateur (42008 lignes) |
| `billing_payments_owner_idx` | billing_payments (owner_id) | B-tree | encaissements de l'espace | filtre RLS | 5.4 → 1.6 ms | choisi par le planificateur (23915 lignes) |
| `documents_owner_idx` | documents (owner_id) | B-tree | coffre de l'espace | filtre RLS | 2.9 → 1.7 ms | choisi par le planificateur (20000 lignes) |
| `tickets_owner_idx` | tickets (owner_id) | B-tree | maintenance de l'espace | filtre RLS | 2.7 → 2.6 ms | choisi par le planificateur (10003 lignes) |
| `expenses_owner_idx` | expenses (owner_id) | B-tree | dépenses de l'espace | filtre RLS ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `contracts_owner_idx` | contracts (owner_id) | B-tree | contrats de l'espace | filtre RLS ; l'index unique partiel (owner_id, ref) ne couvre que les numéros CTR-… | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (4 lignes) |
| `deals_owner_idx` | deals (owner_id) | B-tree | dossiers de vente | filtre RLS ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (3 lignes) |
| `owner_records_owner_idx` | owner_records (owner_id) | B-tree | propriétaires d'une agence | filtre RLS ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (2 lignes) |
| `mandates_owner_idx` | mandates (owner_id) | B-tree | mandats de gestion | filtre RLS ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `sale_mandates_owner_idx` | sale_mandates (owner_id) | B-tree | mandats de vente | filtre RLS ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `owner_transfers_owner_idx` | owner_transfers (owner_id) | B-tree | reversements | filtre RLS ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (1 lignes) |
| `fees_owner_idx` | fees (owner_id) | B-tree | honoraires | filtre RLS ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `providers_owner_idx` | providers (owner_id) | B-tree | prestataires | filtre RLS ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `client_requests_owner_idx` | client_requests (owner_id) | B-tree | demandes clients d'une agence | filtre RLS ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (3 lignes) |
| `audit_log_owner_date_idx` | audit_log (owner_id, created_at) | B-tree composite | journal de l'espace trié par date | table en écriture seule qui ne fait que grossir | 11.6 → 1.6 ms | choisi par le planificateur (100005 lignes) |
| `notifications_user_date_idx` | notifications (user_id, created_at) | B-tree composite | « mes notifications » triées | l'index unique partiel (user_id, key) ne sert pas les notifications sans clé | 36.9 → 0.4 ms | choisi par le planificateur (200041 lignes) |
| `visits_client_idx` | visits (client_id) partiel | B-tree partiel (client_id non nul) | « mes visites » (client), annuaire, rattachement | politique client ; les visites sans compte client sont exclues | 5.3 → 1.4 ms | choisi par le planificateur (42008 lignes) |
| `saved_searches_user_idx` | saved_searches (user_id) | B-tree | recherches enregistrées | politique « propriétaire de la ligne » ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (1 lignes) |
| `activity_log_actor_idx` | activity_log (actor_id) | B-tree | « mon activité » | politique ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (9 lignes) |
| `reports_reporter_idx` | reports (reporter_id) | B-tree | « mes signalements » | politique ; cascade | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (1 lignes) |
| `tickets_tenant_idx` | tickets (tenant_id) partiel | B-tree partiel | tickets du locataire | politique locataire | 2.8 → 2.0 ms | choisi par le planificateur (10003 lignes) |
| `billing_docs_client_idx` | billing_docs (client_id) partiel | B-tree partiel | factures d'un acheteur | politique client | 248.4 → 2.2 ms | choisi par le planificateur (30005 lignes) |
| `billing_payments_client_idx` | billing_payments (client_id) partiel | B-tree partiel | paiements d'un acheteur | politique client | — | choisi par le planificateur (23915 lignes) |
| `deals_client_idx` | deals (client_id) partiel | B-tree partiel | dossiers d'un acheteur | politique client ; app.biens_client() | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (3 lignes) |
| `contracts_client_idx` | contracts (client_id) partiel | B-tree partiel | contrats d'un client | politique client | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (4 lignes) |
| `fees_agent_idx` | fees (agent_id) partiel | B-tree partiel | commissions d'un agent | politique « agent : commissions » | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `fees_apporteur_idx` | fees (apporteur_id) partiel | B-tree partiel | commissions d'un apporteur | même politique (bras OU indexable) | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `client_requests_agent_idx` | client_requests (agent_id) partiel | B-tree partiel | demandes suivies par un agent | politique agent | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (3 lignes) |
| `agency_link_agence_idx` | agency_link_requests (agence_id) | B-tree | demandes reçues par une agence | politique ; l'index unique partiel commence par proprio_id | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `mandates_mandant_idx` | mandates (owner_id2) partiel | B-tree partiel | mandats d'un propriétaire mandant | politique mandant (owner_id2 = any(mes fiches)) | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `sale_mandates_mandant_idx` | sale_mandates (owner_id2) partiel | B-tree partiel | idem (vente) | politique mandant | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `owner_transfers_mandant_idx` | owner_transfers (owner_id2) partiel | B-tree partiel | reversements d'un mandant | politique mandant | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (1 lignes) |
| `conversations_participants_gin` | conversations (participants) | GIN (tableau) | « participants @> [moi] » | « x = any(participants) » n'est pas indexable : politiques réécrites en @> | 5.2 → 0.7 ms | choisi par le planificateur (20002 lignes) |
| `conversation_messages_conv_idx` | conversation_messages (conversation_id, created_at) | B-tree composite | messages d'une conversation, dans l'ordre | table la plus volumineuse de la messagerie | 183.0 → 1.8 ms | choisi par le planificateur (120012 lignes) |
| `conversation_messages_sender_idx` | conversation_messages (sender_id) | B-tree | suppression d'un compte (cascade) | clé étrangère ON DELETE CASCADE | 181.3 → 129.7 ms | choisi par le planificateur (120012 lignes) |
| `lease_messages_lease_idx` | lease_messages (lease_id, created_at) | B-tree composite | fil bailleur / locataire | politique locataire | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (6 lignes) |
| `profiles_parent_idx` | profiles (parent_id) partiel | B-tree partiel | équipe d'un espace | politique profiles, annuaire | — | choisi par le planificateur (34429 lignes) |
| `profiles_owner_ref_idx` | profiles (owner_ref) partiel | B-tree partiel | locataires ouverts par un bailleur | politique profiles | — | choisi par le planificateur (34429 lignes) |
| `profiles_mandant_of_idx` | profiles (mandant_of) partiel | B-tree partiel | mandants d'une agence | politique profiles | — | choisi par le planificateur (34429 lignes) |
| `profiles_lease_idx` | profiles (lease_id) partiel | B-tree partiel | locataire d'un bail (rappels) | jointure des rappels de loyer | 77 849.6 → 3 550.4 ms | choisi par le planificateur (34429 lignes) |
| `profiles_lease_ids_gin` | profiles (lease_ids) | GIN (tableau) | « lease_ids @> [bail] », « && » (annuaire) | un OU sur deux colonnes forçait une boucle imbriquée de 144 000 × 34 000 | 77 849.6 → 3 550.4 ms | choisi par le planificateur (34429 lignes) |
| `owner_records_compte_idx` | owner_records (compte_id) partiel | B-tree partiel | fiches d'un mandant (app.mes_fiches) | appelée par les politiques mandant | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (2 lignes) |
| `properties_client_owner_idx` | properties (client_owner_id) partiel | B-tree partiel | biens confiés par un mandant (app.biens_mandant) | fonction appelée par 8 politiques | 248.4 → 2.2 ms | choisi par le planificateur (30052 lignes) |
| `properties_agent_idx` | properties (agent_id) partiel | B-tree partiel | biens attribués à un agent ; cascade SET NULL | politique de modification agent | — | choisi par le planificateur (30052 lignes) |
| `properties_publiees_date_idx` | properties (created_at) partiel publiee | B-tree partiel (annonces publiées) | catalogue public trié par date | évite le tri de toutes les annonces | 183.7 → 4.7 ms | choisi par le planificateur (30052 lignes) |
| `leases_property_idx` | leases (property_id) | B-tree | baux d'un bien ; contrôle ON DELETE RESTRICT | sans index, supprimer un bien parcourt tous les baux | 6.4 → 0.7 ms | choisi par le planificateur (12011 lignes) |
| `rents_property_idx` | rents (property_id) partiel | B-tree partiel | loyers des biens d'un mandant | politique mandant | — | choisi par le planificateur (144125 lignes) |
| `billing_docs_property_idx` | billing_docs (property_id) partiel | B-tree partiel | factures des biens d'un mandant | politique mandant | — | choisi par le planificateur (30005 lignes) |
| `expenses_property_idx` | expenses (property_id) partiel | B-tree partiel | dépenses d'un bien | politique mandant ; rentabilité | — | utilisable (petite table : parcours séquentiel moins cher aujourd'hui) (0 lignes) |
| `tickets_property_idx` | tickets (property_id) partiel | B-tree partiel | tickets d'un logement | politique locataire | — | choisi par le planificateur (10003 lignes) |
| `favorites_property_idx` | favorites (property_id) | B-tree | suppression d'un bien (cascade) | l'index unique commence par user_id | — | choisi par le planificateur (50004 lignes) |
| `billing_payments_doc_idx` | billing_payments (doc_id) partiel | B-tree partiel | encaissements d'une facture | état des factures, rappels | — | choisi par le planificateur (23915 lignes) |
| `documents_expiry_idx` | documents (expiry) partiel | B-tree partiel | documents à échéance (rappels) | seuls les documents datés sont indexés | — | choisi par le planificateur (20000 lignes) |
| `visits_a_venir_idx` | visits (date) partiel attente/acceptée | B-tree partiel | visites du jour et du lendemain (rappels) | index limité aux visites encore à venir | — | choisi par le planificateur (42008 lignes) |
| `rents_impayes_idx` | rents (lease_id) partiel impayés | B-tree partiel (paid_at nul) | échéances impayées (rappels, tableaux de bord) | une petite fraction des échéances | — | choisi par le planificateur (144125 lignes) |

## Suivi en production

```sql
-- index jamais utilisés (après quelques semaines d'exploitation)
select relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
  from pg_stat_user_indexes where schemaname = 'public' order by idx_scan, pg_relation_size(indexrelid) desc;
-- requêtes les plus coûteuses (extension pg_stat_statements, active sur Supabase)
select calls, round(mean_exec_time::numeric, 1) as ms, left(query, 120) from pg_stat_statements order by total_exec_time desc limit 20;
```
Un index sans utilisation après une période représentative peut être supprimé **dans une nouvelle migration**, après vérification.
