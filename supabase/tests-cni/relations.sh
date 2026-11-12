#!/bin/bash
# Relations entre comptes : agence, agent, gestionnaire, mandant, locataire, deuxième agence.
# Comptes « ouverts par un tiers » créés comme le fait la fonction gerer-acces (app_metadata).
# Prérequis : base « dk » préparée par rejouer.sh. Ne JAMAIS lancer sur la production.
P="psql -h /tmp -p 54399 -U postgres -d dk -q -At -v ON_ERROR_STOP=1"
A=a0000000-0000-0000-0000-00000000000a; B=b0000000-0000-0000-0000-00000000000b
AGT=a0000000-0000-0000-0000-0000000000a1; GES=a0000000-0000-0000-0000-0000000000a2
MAN=a0000000-0000-0000-0000-0000000000a3; LOC=a0000000-0000-0000-0000-0000000000a4
FICHE=f0000000-0000-0000-0000-0000000000f1
BA1=c0000000-0000-0000-0000-000000000001; BA2=c0000000-0000-0000-0000-000000000002; BB1=c0000000-0000-0000-0000-000000000003
BAIL=d0000000-0000-0000-0000-000000000001; BAIL2=d0000000-0000-0000-0000-000000000002
$P <<SQL
insert into auth.users(id,email,raw_user_meta_data) values
 ('$A','rel-agence-a@test.sn','{"role":"agency","agency_name":"Agence A","cni":"3131313131313"}'),
 ('$B','rel-agence-b@test.sn','{"role":"agency","agency_name":"Agence B","cni":"3232323232323"}');
insert into public.owner_records(id, owner_id, name, email) values ('$FICHE','$A','Mandant Diop','rel-mandant@test.sn');
insert into public.properties(id, owner_id, title, type, transaction, price, listing_status, agent_id, client_owner_id) values
 ('$BA1','$A','Villa du mandant (brouillon)','villa','location',300000,'brouillon',null,'$FICHE'),
 ('$BA2','$A','Appartement agence (brouillon)','appartement','location',200000,'brouillon',null,null),
 ('$BB1','$B','Bureau agence B (brouillon)','bureau','location',500000,'brouillon',null,null);
insert into public.leases(id, owner_id, property_id, tenant, rent, start) values
 ('$BAIL','$A','$BA1','Locataire Fall',300000,'2026-11-01'),
 ('$BAIL2','$A','$BA2','Autre locataire',200000,'2026-11-01');
-- Comptes ouverts par l'agence A (comme gerer-acces : app_metadata)
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('$AGT','rel-agent@test.sn','{"first_name":"Agent","last_name":"Ndiaye"}','{"deuksil_role":"agent","parent_id":"$A","perms":["biens","visites","messages"],"mdp_provisoire":true}'),
 ('$GES','rel-gestion@test.sn','{"first_name":"Gestion","last_name":"Sow"}','{"deuksil_role":"manager","parent_id":"$A","perms":["finances"],"mdp_provisoire":true}'),
 ('$MAN','rel-mandant@test.sn','{"first_name":"Mandant","last_name":"Diop"}','{"deuksil_role":"owner","mandant_of":"$A","owner_rec":"$FICHE","mdp_provisoire":true}'),
 ('$LOC','rel-locataire@test.sn','{"first_name":"Locataire","last_name":"Fall"}','{"deuksil_role":"tenant","owner_ref":"$A","lease_id":"$BAIL","lease_ids":["$BAIL"],"mdp_provisoire":true}');
SQL
ok=0; ko=0
q() { $P 2>&1 <<SQL
begin; set local role authenticated; select set_config('request.jwt.claim.sub','$1',true) \g /dev/null
$2
rollback;
SQL
}
egal() { local nom="$1" uid="$2" sql="$3" att="$4" r; r=$(q "$uid" "$sql" | grep -v '^$' | tail -1)
  if [ "$r" = "$att" ]; then echo "OK    $nom ($r)"; ok=$((ok+1)); else echo "ECHEC $nom : obtenu « $r », attendu « $att »"; ko=$((ko+1)); fi; }
refus() { local nom="$1" uid="$2" sql="$3" att="$4" r; r=$(q "$uid" "$sql" | grep -iE "ERROR" | head -1)
  if echo "$r" | grep -qF "$att"; then echo "OK    $nom -> refusé"; ok=$((ok+1)); else echo "ECHEC $nom : ${r:-aucun refus}"; ko=$((ko+1)); fi; }

echo "--- Création des comptes par un tiers (comme gerer-acces) ---"
egal "Agent : rattaché à l'agence A, rôle agent, droits, mot de passe provisoire" $A "select role||'|'||parent_id||'|'||array_to_string(perms,',')||'|'||mdp_provisoire from public.profiles where id='$AGT';" "agent|$A|biens,visites,messages|true"
egal "Mandant : rattaché à l'agence A et à sa fiche"  $A "select role||'|'||mandant_of||'|'||owner_rec from public.profiles where id='$MAN';" "owner|$A|$FICHE"
egal "Locataire : rattaché au bailleur et au bail"     $A "select role||'|'||owner_ref||'|'||lease_id from public.profiles where id='$LOC';" "tenant|$A|$BAIL"
egal "Agence A voit ses 3 comptes ouverts + l'agent"   $A "select count(*) from public.profiles where id in ('$AGT','$GES','$MAN','$LOC');" "4"
egal "Agence B ne voit aucun compte de l'agence A"     $B "select count(*) from public.profiles where id in ('$AGT','$GES','$MAN','$LOC');" "0"
echo "--- Agent ---"
egal "Agent voit les biens de l'agence A (brouillons compris)" $AGT "select count(*) from public.properties where owner_id='$A';" "2"
egal "Agent ne voit pas les brouillons de l'agence B"   $AGT "select count(*) from public.properties where owner_id='$B';" "0"
egal "Agent : modifier un bien NON attribué -> 0 ligne" $AGT "with m as (update public.properties set price=1 where id='$BA2' returning 1) select count(*) from m;" "0"
$P -c "update public.properties set agent_id='$AGT' where id='$BA2';"
egal "Agent : modifier un bien qui lui est attribué -> 1 ligne" $AGT "with m as (update public.properties set price=250000 where id='$BA2' returning 1) select count(*) from m;" "1"
egal "Agent : créer un brouillon pour l'agence"         $AGT "with m as (insert into public.properties(owner_id,title,type,transaction,price,agent_id) values('$A','Nouveau','villa','vente',1,'$AGT') returning 1) select count(*) from m;" "1"
refus "Agent : ne peut pas changer ses propres droits"  $AGT "update public.profiles set perms='{biens,finances}' where id='$AGT';" "Champs non modifiables"
egal "Agent : voit le profil de son agence (nom, CNI pour publier)" $AGT "select count(*) from public.profiles where id='$A';" "1"
echo "--- Gestionnaire (droit finances seulement) ---"
refus "Gestionnaire sans droit biens : ne crée pas de bien" $GES "insert into public.properties(owner_id,title,type,transaction,price) values('$A','X','villa','vente',1);" "row-level security"
echo "--- Titulaire et équipe ---"
egal "Agence A : modifie les droits de son agent"        $A "with m as (update public.profiles set perms='{biens,visites,messages,gestion}' where id='$AGT' returning 1) select count(*) from m;" "1"
egal "Agence A : suspend son agent"                      $A "with m as (update public.profiles set status='suspendu' where id='$AGT' returning 1) select count(*) from m;" "1"
egal "Agence B : ne peut pas toucher l'agent de A (0 ligne)" $B "with m as (update public.profiles set status='suspendu' where id='$AGT' returning 1) select count(*) from m;" "0"
$P -c "update public.profiles set status='suspendu' where id='$AGT';"
egal "Agent suspendu : ne voit plus aucun brouillon"     $AGT "select count(*) from public.properties where listing_status <> 'publiee';" "0"
$P -c "update public.profiles set status='actif' where id='$AGT';"
echo "--- Mandant ---"
egal "Fiche reliée automatiquement au compte du mandant (compte, lien accepté)" $A "select (compte_id = '$MAN')::text||'|'||lien from public.owner_records where id='$FICHE';" "true|accepte"
egal "Mandant voit le bien lié à sa fiche"               $MAN "select count(*) from public.properties where id='$BA1';" "1"
egal "Mandant ne voit pas les autres brouillons de l'agence" $MAN "select count(*) from public.properties where id in ('$BA2','$BB1');" "0"
egal "Mandant : ne modifie pas le bien (0 ligne)"        $MAN "with m as (update public.properties set price=1 where id='$BA1' returning 1) select count(*) from m;" "0"
egal "Mandant voit le bail de son bien"                  $MAN "select count(*) from public.leases where property_id='$BA1';" "1"
egal "Mandant ne voit pas le bail d'un autre bien"       $MAN "select count(*) from public.leases where id='$BAIL2';" "0"
echo "--- Réparation des mandants créés avant la migration ---"
$P -c "update public.owner_records set compte_id = null, lien = null where id = '$FICHE';"
egal "Fiche « cassée » (comme avant la migration) : le mandant ne voit plus rien" $MAN "select count(*) from public.properties where id='$BA1';" "0"
$P -f "$(dirname "$0")/../migrations/20261112000200_relations_comptes.sql" >/dev/null
egal "Après la migration (réparation) : le mandant revoit son bien" $MAN "select count(*) from public.properties where id='$BA1';" "1"
echo "--- Sécurité de la liaison ---"
F3=f0000000-0000-0000-0000-0000000000f3; PIRATE=e0000000-0000-0000-0000-0000000000e1; PIRATE2=e0000000-0000-0000-0000-0000000000e2
$P -c "insert into public.owner_records(id, owner_id, name) values ('$F3','$A','Fiche libre de A');"
$P -c "insert into auth.users(id,email,raw_user_meta_data) values ('$PIRATE','pirate@test.sn','{\"role\":\"owner\",\"owner_rec\":\"$F3\",\"mandant_of\":\"$A\"}');"
egal "Inscription libre se déclarant mandant d'une fiche : ignorée" $A "select coalesce(compte_id::text,'aucun') from public.owner_records where id='$F3';" "aucun"
$P -c "insert into auth.users(id,email,raw_app_meta_data) values ('$PIRATE2','pirate2@test.sn','{\"deuksil_role\":\"owner\",\"mandant_of\":\"$B\",\"owner_rec\":\"$F3\"}');"
egal "Compte rattaché à l'agence B visant une fiche de l'agence A : pas de liaison" $A "select coalesce(compte_id::text,'aucun') from public.owner_records where id='$F3';" "aucun"
echo "--- Locataire ---"
egal "Locataire voit son bail"                           $LOC "select count(*) from public.leases where id='$BAIL';" "1"
egal "Locataire ne voit pas le bail d'un autre"          $LOC "select count(*) from public.leases where id='$BAIL2';" "0"
egal "Locataire voit le bien loué"                       $LOC "select count(*) from public.properties where id='$BA1';" "1"
egal "Locataire ne voit pas les autres brouillons"       $LOC "select count(*) from public.properties where id in ('$BA2','$BB1');" "0"
echo "--- Isolement entre agences ---"
egal "Agence B ne voit pas les fiches de A"              $B "select count(*) from public.owner_records where owner_id='$A';" "0"
egal "Agence B ne voit pas les baux de A"                $B "select count(*) from public.leases where owner_id='$A';" "0"
egal "Agence B ne voit pas les brouillons de A"          $B "select count(*) from public.properties where owner_id='$A' and listing_status<>'publiee';" "0"
echo; echo "Relations : $ok réussis, $ko échoués"; [ $ko -eq 0 ]
