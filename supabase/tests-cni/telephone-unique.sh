#!/bin/bash
# Téléphone unique (28/11). Base « dk » préparée par rejouer.sh. Ne JAMAIS lancer sur la production.
H=${PGHOST_DK:-/tmp}; P="psql -h $H -p 54399 -U postgres -d dk -q -At"
ok=0; ko=0
t() { if [ "$2" = "$3" ]; then echo "OK    $1"; ok=$((ok+1)); else echo "ECHEC $1 : obtenu « $2 », attendu « $3 »"; ko=$((ko+1)); fi; }
U1=b0000000-0000-4000-8000-0000000000f1; U2=b0000000-0000-4000-8000-0000000000f2; U3=b0000000-0000-4000-8000-0000000000f3
$P -c "insert into auth.users(id,email,raw_user_meta_data) values ('$U1','tel1@test.sn','{\"role\":\"client\",\"phone\":\"77 555 44 33\"}');" >/dev/null
r=$($P -c "insert into auth.users(id,email,raw_user_meta_data) values ('$U2','tel2@test.sn','{\"role\":\"agency\",\"phone\":\"+221775554433\"}');" 2>&1 | grep -c "déjà utilisé")
t "Inscription avec un numéro déjà pris (+221…) : refusée" "$r" "1"
$P -c "insert into auth.users(id,email,raw_user_meta_data) values ('$U3','tel3@test.sn','{\"role\":\"owner\",\"phone\":\"70 111 22 33\"}');" >/dev/null
t "Inscription avec un autre numéro : acceptée" "$($P -c "select count(*) from public.profiles where id='$U3'")" "1"
r=$($P 2>&1 <<SQL | grep -c "déjà utilisé"
begin; set local role authenticated; select set_config('request.jwt.claim.sub','$U3',true) \g /dev/null
update public.profiles set phone='775554433' where id='$U3';
rollback;
SQL
)
t "Changer son numéro pour un numéro pris : refusé" "$r" "1"
r=$($P 2>&1 <<SQL | tail -1
begin; set local role authenticated; select set_config('request.jwt.claim.sub','$U3',true) \g /dev/null
update public.profiles set phone='70 111 22 34' where id='$U3'; select phone from public.profiles where id='$U3';
rollback;
SQL
)
t "Changer son numéro pour un numéro libre : accepté" "$r" "70 111 22 34"
t "telephone_libre : numéro pris" "$($P -c "set role anon; select public.telephone_libre('77-555-44-33')")" "f"
t "telephone_libre : numéro libre" "$($P -c "set role anon; select public.telephone_libre('76 000 00 00')")" "t"
r=$($P 2>&1 <<SQL | tail -1
begin; set local role authenticated; select set_config('request.jwt.claim.sub','$U1',true) \g /dev/null
select public.telephone_libre('775554433');
rollback;
SQL
)
t "telephone_libre : son propre numéro compte comme libre" "$r" "t"
echo; echo "Téléphone unique : $ok réussis, $ko échoués"
