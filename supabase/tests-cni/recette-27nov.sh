#!/bin/bash
# Retest du 27 novembre 2026 : administrateur, alertes, bien loué, échéances des baux terminés.
# Prérequis : base « dk » préparée par rejouer.sh puis relations.sh. Ne JAMAIS lancer sur la production.
H=${PGHOST_DK:-/tmp}
P="psql -h $H -p 54399 -U postgres -d dk -q -At -v ON_ERROR_STOP=1"
M="$(cd "$(dirname "$0")" && pwd)/../migrations/20261127000100_recette_27nov.sql"
A=a0000000-0000-0000-0000-00000000000a
ADM=a0000000-0000-0000-0000-0000000000ad; CLI=a0000000-0000-0000-0000-0000000000c1; CLI2=a0000000-0000-0000-0000-0000000000c2
P1=c0000000-0000-0000-0000-0000000000e1; P2=c0000000-0000-0000-0000-0000000000e2; P3=c0000000-0000-0000-0000-0000000000e3
L1=d0000000-0000-0000-0000-0000000000e1; L2=d0000000-0000-0000-0000-0000000000e2
ok=0; ko=0
q() { $P 2>&1 <<SQL
begin; set local role ${3:-authenticated}; select set_config('request.jwt.claim.sub','$1',true) \g /dev/null
$2
rollback;
SQL
}
egal() { local nom="$1" uid="$2" sql="$3" att="$4" r; r=$(q "$uid" "$sql" "$5" | grep -v '^$' | tail -1)
  if [ "$r" = "$att" ]; then echo "OK    $nom ($r)"; ok=$((ok+1)); else echo "ECHEC $nom : obtenu « $r », attendu « $att »"; ko=$((ko+1)); fi; }

$P <<SQL
insert into auth.users(id,email,raw_user_meta_data) values
 ('$ADM','r27-admin@test.sn','{"role":"client","first_name":"Admin","last_name":"Test"}'),
 ('$CLI','r27-client@test.sn','{"role":"client","first_name":"Client","last_name":"Alerte"}'),
 ('$CLI2','r27-client2@test.sn','{"role":"client","first_name":"Autre","last_name":"Client"}');
update public.profiles set role = 'admin' where id = '$ADM';
insert into public.saved_searches(user_id, name, criteria) values
 ('$CLI', 'Chambre à Dakar', '{"transaction":"location","type":"chambre","region":"Dakar","city":"","min":"","max":"200000","rooms":"","furnished":false}'),
 ('$CLI2', 'Villa à vendre', '{"transaction":"vente","type":"villa","region":"Dakar"}');
SQL

echo "--- 1. Administrateur : messages de contact et signalements ---"
$P -c "select public.envoyer_contact('Visiteur R27','r27-visiteur@test.sn',null,'question','Message du retest du 27 novembre.');" >/dev/null
egal "L'administrateur voit le message de contact" $ADM "select count(*) from public.contact_messages where email='r27-visiteur@test.sn';" "1"
$P -c "delete from app.reglages where cle='admin_mfa_obligatoire';"
egal "Réglage absent : l'administrateur voit toujours le message" $ADM "select count(*) from public.contact_messages where email='r27-visiteur@test.sn';" "1"
egal "Diagnostic : la base le reconnaît comme administrateur" $ADM "select (public.diagnostic_admin()->>'est_admin');" "true"
$P -c "insert into app.reglages values ('admin_mfa_obligatoire','oui') on conflict (cle) do update set valeur='oui';"
egal "Double authentification exigée : le diagnostic donne la raison" $ADM "select (public.diagnostic_admin()->>'mfa_exigee') || '/' || (public.diagnostic_admin()->>'est_admin');" "true/false"
$P -c "update app.reglages set valeur='non' where cle='admin_mfa_obligatoire';"
egal "Un client ne lit pas les messages de contact" $CLI "select count(*) from public.contact_messages;" "0"
egal "Diagnostic d'un client : pas administrateur" $CLI "select (public.diagnostic_admin()->>'role') || '/' || (public.diagnostic_admin()->>'est_admin');" "client/false"

echo "--- 2. Alertes ---"
$P -c "insert into public.properties(id, owner_id, title, type, transaction, price, region, city, quartier, listing_status) values ('$P1','$A','Chambre meublée Point E','chambre','location',150000,'Dakar','Dakar','Point E','avalider');"
egal "Annonce à valider : personne n'est prévenu" $CLI "select count(*) from public.notifications where key like 'alerte:%';" "0"
$P -c "update public.properties set listing_status='publiee' where id='$P1';"
egal "Publication : le client de l'alerte est prévenu" $CLI "select count(*) from public.notifications where key like 'alerte:%' and link = '#/property/$P1';" "1"
egal "Le texte nomme l'alerte et l'annonce" $CLI "select text from public.notifications where key like 'alerte:%';" "Nouvelle annonce pour votre alerte « Chambre à Dakar » : Chambre meublée Point E"
egal "L'autre client (alerte villa) n'est pas prévenu" $CLI2 "select count(*) from public.notifications where key like 'alerte:%';" "0"
$P -c "update public.properties set listing_status='pause' where id='$P1'; update public.properties set listing_status='publiee' where id='$P1';"
egal "Republication : pas de deuxième notification" $CLI "select count(*) from public.notifications where key like 'alerte:%';" "1"
$P -c "insert into public.properties(id, owner_id, title, type, transaction, price, region, city, listing_status) values ('$P2','$A','Chambre trop chère','chambre','location',350000,'Dakar','Dakar','publiee');"
egal "Prix au-dessus du maximum : pas de notification" $CLI "select count(*) from public.notifications where link = '#/property/$P2';" "0"

echo "--- 3. Bien loué ---"
$P -c "insert into public.properties(id, owner_id, title, type, transaction, price, region, city, listing_status, status) values ('$P3','$A','F3 en discussion','appartement','location',360000,'Dakar','Dakar','publiee','discussion');"
$P -c "insert into public.leases(id, owner_id, property_id, tenant, rent, start, deposit, due_day) values ('$L1','$A','$P3','Locataire F3',360000,'2026-11-22',720000,5);"
egal "Bail actif : le bien passe « loué »" "" "select status from public.properties where id='$P3';" "loue" postgres
egal "Un visiteur ne voit plus le bien parmi les disponibles" "" "select count(*) from public.properties where id='$P3' and listing_status='publiee' and status not in ('loue','vendu');" "0" anon
$P -c "update public.properties set status='discussion' where id='$P3';"
$P -v ON_ERROR_STOP=1 -f "$M" >/dev/null 2>&1
egal "Réparation : un bien « en discussion » avec bail actif repasse « loué »" "" "select status from public.properties where id='$P3';" "loue" postgres

echo "--- 4. Échéances des baux terminés ---"
$P <<SQL
insert into public.leases(id, owner_id, property_id, tenant, rent, start, deposit, due_day, status, ended_at) values ('$L2','$A','$P2','Bail terminé le jour du début',425000,'2026-11-26',850000,5,'termine','2026-11-26');
insert into public.rents(owner_id, lease_id, month, amount) values ('$A','$L2','2026-11',425000), ('$A','$L2','2026-12',425000);
insert into public.rents(owner_id, lease_id, month, amount, paid_at, payments) values ('$A','$L1','2026-11',360000,null,'[{"date":"2026-11-22","amount":100000}]');
SQL
$P -v ON_ERROR_STOP=1 -f "$M" >/dev/null 2>&1
egal "Bail terminé le jour du début : ses échéances jamais dues sont retirées" "" "select count(*) from public.rents where lease_id='$L2';" "0" postgres
egal "Un loyer avec un acompte n'est jamais retiré" "" "select count(*) from public.rents where lease_id='$L1';" "1" postgres

echo "--- 5. Actes de vente ---"
$P <<SQL
insert into public.contracts(owner_id, type, party, start, "end", amount, status, extra) values
 ('$A','vente','Acheteur acte','2025-10-01','2026-10-01',90000000,'expiré','{"genre":"acte"}'),
 ('$A','vente','Acheteur promesse','2026-11-01','2027-01-30',50000000,'actif','{"genre":"promesse"}');
SQL
$P -v ON_ERROR_STOP=1 -f "$M" >/dev/null 2>&1
egal "Acte de vente : plus de date de fin, plus « expiré »" "" "select coalesce(\"end\"::text,'aucune') || '/' || status from public.contracts where party='Acheteur acte';" "aucune/actif" postgres
egal "Promesse de vente : garde sa date limite" "" "select \"end\"::text from public.contracts where party='Acheteur promesse';" "2027-01-30" postgres

echo; echo "Retest 27/11 : $ok réussis, $ko échoués"
