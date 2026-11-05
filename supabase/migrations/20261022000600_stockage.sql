-- =============================================================================
-- DEUKSIL — Migration 0600 : stockage des fichiers (Supabase Storage)
--
--   photos     public   photos d'annonces          photos/<espace>/<bien>/<fichier>
--   avatars    public   photos de profil           avatars/<utilisateur>/<fichier>
--   documents  privé    coffre, pièces jointes     documents/<espace>/…            (coffre de l'espace)
--                                                  documents/conv/<conversation>/…  (pièces de messagerie)
--                                                  documents/bail/<bail>/…          (échanges bailleur / locataire)
-- Les fichiers privés ne sont lus qu'avec une URL signée à durée limitée.
-- Tailles et types contrôlés par le compartiment (refus côté serveur).
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos',    'photos',    true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('avatars',   'avatars',   true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('documents', 'documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp',
     'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le dossier de premier niveau désigne le propriétaire du fichier.
create or replace function app.dossier_autorise(bucket text, chemin text, ecriture boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare d text[] := storage.foldername(chemin); cible uuid;
begin
  if auth.uid() is null or cardinality(d) < 1 then return false; end if;
  begin
    cible := (case when d[1] in ('conv','bail') then d[2] else d[1] end)::uuid;
  exception when others then return false;   -- dossier qui n'est pas un identifiant
  end;
  if bucket = 'avatars' then return cible = auth.uid(); end if;
  if bucket = 'photos' then return cible = app.espace() and app.a_droit('biens'); end if;
  if bucket = 'documents' then
    if d[1] = 'conv' then
      return exists (select 1 from public.conversations c where c.id = cible
                     and (auth.uid() = any (c.participants) or (app.espace() = any (c.participants) and app.a_droit('messages'))));
    elsif d[1] = 'bail' then
      return cible = any (app.mes_baux())
          or exists (select 1 from public.leases l where l.id = cible and l.owner_id = app.espace() and app.a_droit('gestion'));
    else
      return (cible = app.espace() and app.a_droit('documents')) or (not ecriture and app.est_admin());
    end if;
  end if;
  return false;
end $$;
grant execute on function app.dossier_autorise(text, text, boolean) to authenticated;

create policy "deuksil : lecture des fichiers privés" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and app.dossier_autorise(bucket_id, name, false));
create policy "deuksil : dépôt" on storage.objects for insert to authenticated
  with check (bucket_id in ('photos','avatars','documents') and app.dossier_autorise(bucket_id, name, true));
create policy "deuksil : remplacement" on storage.objects for update to authenticated
  using (bucket_id in ('photos','avatars','documents') and app.dossier_autorise(bucket_id, name, true))
  with check (bucket_id in ('photos','avatars','documents') and app.dossier_autorise(bucket_id, name, true));
create policy "deuksil : suppression" on storage.objects for delete to authenticated
  using (bucket_id in ('photos','avatars','documents') and app.dossier_autorise(bucket_id, name, true));
-- Les compartiments publics (photos, avatars) sont lisibles par URL publique sans politique SELECT.
