#!/bin/bash
# Prérequis : base « dk » préparée par rejouer.sh (rôles anon/authenticated et faux schéma auth en place).
# Scénarios CNI par type de compte. Chaque test : un bloc SQL joué « en tant que » un compte connecté.
P="psql -h /tmp -p 54399 -U postgres -d dk -q -At -v ON_ERROR_STOP=1"
OWN=11111111-1111-1111-1111-111111111111; OWN2=22222222-2222-2222-2222-222222222222
AGC=33333333-3333-3333-3333-333333333333; AGT=44444444-4444-4444-4444-444444444444
ADM=55555555-5555-5555-5555-555555555555; MAN=66666666-6666-6666-6666-666666666666
$P <<SQL
insert into auth.users(id,email,raw_user_meta_data) values
 ('$OWN','proprio@test.sn','{"role":"owner","first_name":"Awa"}'),
 ('$OWN2','proprio2@test.sn','{"role":"owner","first_name":"Moussa"}'),
 ('$AGC','agence@test.sn','{"role":"agency","agency_name":"Agence Test"}');
insert into auth.users(id,email,raw_app_meta_data) values
 ('$AGT','agent@test.sn','{"deuksil_role":"agent","parent_id":"$AGC","perms":["biens"]}');
insert into auth.users(id,email) values ('$ADM','admin@test.sn');
update public.profiles set role='admin' where id='$ADM';
SQL
ok=0; ko=0
t() { # t "nom" uid "sql" attendu(OK|texte d'erreur attendu)
  local nom="$1" uid="$2" sql="$3" att="$4"
  local out; out=$($P 2>&1 <<SQL
begin; set local role authenticated; select set_config('request.jwt.claim.sub','$uid',true);
$sql
commit;
SQL
)
  local err; err=$(echo "$out" | grep -iE "ERROR|ERREUR" | head -1 | sed -E 's/^.*(ERROR|ERREUR): *//')
  if [ "$att" = "OK" ]; then
    if [ -z "$err" ]; then echo "OK    $nom"; ok=$((ok+1)); else echo "ECHEC $nom -> $err"; ko=$((ko+1)); fi
  else
    if echo "$err" | grep -qF "$att"; then echo "OK    $nom -> refus : $err"; ok=$((ok+1)); else echo "ECHEC $nom -> obtenu : ${err:-aucune erreur}"; ko=$((ko+1)); fi
  fi
}
BIEN="insert into public.properties(owner_id,title,type,transaction,price,listing_status)"
t "Propriétaire sans CNI : brouillon accepté"        $OWN "$BIEN values('$OWN','Villa test','villa','location',100000,'brouillon');" OK
t "Propriétaire sans CNI : publication refusée"      $OWN "$BIEN values('$OWN','Villa 2','villa','location',100000,'publiee');" "renseignez votre numéro de CNI (13 chiffres) dans Paramètres"
t "Propriétaire : CNI renseignée (13 chiffres)"      $OWN "update public.profiles set cni='1234567890123' where id='$OWN';" OK
t "Propriétaire avec CNI : publication acceptée"     $OWN "$BIEN values('$OWN','Villa 3','villa','location',100000,'publiee');" OK
t "Propriétaire : brouillon -> publié accepté"       $OWN "update public.properties set listing_status='publiee' where owner_id='$OWN' and listing_status='brouillon';" OK
t "Propriétaire : CNI modifiée ensuite refusée"      $OWN "update public.profiles set cni='9999999999999' where id='$OWN';" "Champs non modifiables"
t "Propriétaire 2 : CNI déjà utilisée -> message clair" $OWN2 "update public.profiles set cni='1234567890123' where id='$OWN2';" "déjà utilisé par un autre compte"
t "CNI à 12 chiffres refusée par la base"            $OWN2 "update public.profiles set cni='123456789012' where id='$OWN2';" "check"
t "Fonction cni_espace_renseignee (propriétaire)"    $OWN "do \$\$ begin if not public.cni_espace_renseignee() then raise exception 'attendu vrai'; end if; end \$\$;" OK
t "Fonction cni_espace_renseignee (propriétaire 2)"  $OWN2 "do \$\$ begin if public.cni_espace_renseignee() then raise exception 'attendu faux'; end if; end \$\$;" OK
t "Agent, agence sans CNI : publication refusée"     $AGT "$BIEN values('$AGC','Appart agence','appartement','location',200000,'publiee');" "le titulaire du compte doit renseigner son numéro de CNI"
t "Agent : ne peut pas poser la CNI de l'agence (0 ligne modifiée)" $AGT "with m as (update public.profiles set cni='5555555555555' where id='$AGC' returning 1) select 1 / (case when count(*) > 0 then 0 else 1 end) from m;" OK
t "Agent sans CNI agence : brouillon accepté"        $AGT "$BIEN values('$AGC','Appart brouillon','appartement','location',200000,'brouillon');" OK
t "Agence (titulaire) : publication sans CNI refusée" $AGC "$BIEN values('$AGC','Bureau','bureau','location',300000,'publiee');" "renseignez votre numéro de CNI"
t "Agence : la CNI est restée vide après la tentative de l'agent" $AGC "do \$\$ begin if public.cni_espace_renseignee() then raise exception 'la CNI a été posée par l agent'; end if; end \$\$;" OK
t "Agence : CNI renseignée"                          $AGC "update public.profiles set cni='7777777777777' where id='$AGC';" OK
t "Agent, agence avec CNI : publication acceptée"    $AGT "$BIEN values('$AGC','Appart 2','appartement','location',200000,'publiee');" OK
t "Agent : cni_espace_renseignee = CNI de l'agence"  $AGT "do \$\$ begin if not public.cni_espace_renseignee() then raise exception 'attendu vrai'; end if; end \$\$;" OK
t "Admin : peut corriger une CNI erronée"            $ADM "update public.profiles set cni='1234567890124' where id='$OWN';" OK
t "Admin : correction vers une CNI prise -> refus clair" $ADM "update public.profiles set cni='7777777777777' where id='$OWN';" "déjà utilisé par un autre compte"
t "Propriétaire 2 : CNI libre acceptée"              $OWN2 "update public.profiles set cni='1234567890123' where id='$OWN2';" OK
t "Autres champs du profil : modif toujours possible" $OWN2 "update public.profiles set phone='771234567', first_name='Moussa B' where id='$OWN2';" OK
echo; echo "Résultat : $ok réussis, $ko échoués"; [ $ko -eq 0 ]
