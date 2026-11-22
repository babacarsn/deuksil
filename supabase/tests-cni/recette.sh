#!/bin/bash
# Recette du 22 novembre 2026 : loyers visibles du mandant, contact avec accusé.
# Prérequis : base « dk » préparée par rejouer.sh (après relations.sh). Ne JAMAIS lancer sur la production.
P="psql -h /tmp -p 54399 -U postgres -d dk -q -At -v ON_ERROR_STOP=1"
A=a0000000-0000-0000-0000-00000000000a; MAN=a0000000-0000-0000-0000-0000000000a3
LOC=a0000000-0000-0000-0000-0000000000a4; BAIL=d0000000-0000-0000-0000-000000000001
ok=0; ko=0
q() { $P 2>&1 <<SQL
begin; set local role ${3:-authenticated}; select set_config('request.jwt.claim.sub','$1',true) \g /dev/null
$2
rollback;
SQL
}
egal() { local nom="$1" uid="$2" sql="$3" att="$4" r; r=$(q "$uid" "$sql" "$5" | grep -v '^$' | tail -1)
  if [ "$r" = "$att" ]; then echo "OK    $nom ($r)"; ok=$((ok+1)); else echo "ECHEC $nom : obtenu « $r », attendu « $att »"; ko=$((ko+1)); fi; }
echo "--- Loyers du mandant ---"
$P -c "delete from public.rents where lease_id='$BAIL';"
egal "L'agence crée un loyer SANS property_id (comme le site)" $A "with m as (insert into public.rents(owner_id, lease_id, month, amount, paid_at) values ('$A','$BAIL','2026-09',300000,'2026-09-05') returning property_id) select property_id is not null from m;" "t"
$P -c "insert into public.rents(owner_id, lease_id, month, amount, paid_at) values ('$A','$BAIL','2026-09',300000,'2026-09-05'), ('$A','$BAIL','2026-10',300000,null);"
egal "Le mandant voit les loyers de son bien" $MAN "select count(*) from public.rents;" "2"
egal "Le mandant voit le loyer encaissé" $MAN "select coalesce(sum(amount),0) from public.rents where paid_at is not null;" "300000"
egal "Le locataire voit toujours ses loyers" $LOC "select count(*) from public.rents;" "2"
egal "Le mandant ne modifie pas un loyer" $MAN "with m as (update public.rents set amount=1 returning 1) select count(*) from m;" "0"
$P -c "update public.rents set property_id=null where lease_id='$BAIL';" 2>/dev/null
egal "Un property_id effacé est remis par le déclencheur" $A "select count(*) from public.rents where lease_id='$BAIL' and property_id is null;" "0"
echo "--- Contact ---"
egal "Visiteur : envoyer_contact renvoie un identifiant" "" "select public.envoyer_contact('Visiteur Test','visiteur@test.sn',null,'question','Bonjour, ceci est un message de test.') is not null;" "t" anon
$P -c "select public.envoyer_contact('Visiteur Test','visiteur2@test.sn',null,'question','Message conservé pour l''administration.');" >/dev/null
egal "Message enregistré, statut nouveau, sans auteur" "" "select count(*) from public.contact_messages where email='visiteur2@test.sn' and statut='nouveau' and user_id is null;" "1" postgres
r=$(q "" "select public.envoyer_contact('X','pasunemail',null,'question','Message trop court?');" anon | grep -c ERROR); [ "$r" -ge 1 ] && { echo "OK    Adresse invalide refusée"; ok=$((ok+1)); } || { echo "ECHEC adresse invalide acceptée"; ko=$((ko+1)); }
echo; echo "Recette : $ok réussis, $ko échoués"
