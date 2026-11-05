-- =============================================================================
-- DEUKSIL — Migration 0200 : tables, relations et contraintes
--
-- Conventions
--   * Clés primaires uuid (générées par le navigateur pour l'écriture optimiste,
--     sinon par gen_random_uuid()).
--   * owner_id = « espace » propriétaire de la donnée : le compte du propriétaire
--     ou de l'agence. Les membres d'équipe (gestionnaire, agent) agissent pour
--     cet espace (profiles.parent_id).
--   * Montants en francs CFA entiers : bigint, jamais négatifs.
--   * extra jsonb : champs descriptifs secondaires que l'interface peut ajouter
--     sans migration. Aucun champ servant aux droits, aux relations, aux montants
--     ou aux filtres n'y est stocké : tous ceux-là sont des colonnes typées.
-- =============================================================================

-- --- Comptes -----------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             text not null default 'client'
                   check (role in ('client','owner','agency','admin','tenant','manager','agent')),
  status           text not null default 'actif' check (status in ('actif','suspendu')),
  first_name       text not null default '' check (length(first_name) <= 80),
  last_name        text not null default '' check (length(last_name) <= 80),
  email            text check (email is null or email = lower(email)),
  phone            text check (phone is null or length(phone) <= 30),
  cni              text check (cni is null or cni ~ '^\d{13}$'),
  agency_name      text check (agency_name is null or length(agency_name) <= 120),
  agency_desc      text check (agency_desc is null or length(agency_desc) <= 2000),
  address          text check (address is null or length(address) <= 300),
  ninea            text check (ninea is null or length(ninea) <= 40),
  rccm             text check (rccm is null or length(rccm) <= 60),
  avatar_url       text,
  verif_level      text,
  -- Membre d'équipe : compte titulaire (propriétaire ou agence) pour lequel il agit.
  parent_id        uuid references public.profiles(id) on delete cascade,
  perms            text[] not null default '{}'
                   check (perms <@ array['biens','visites','messages','gestion','finances','documents']),
  titre            text,
  -- Locataire : baux auxquels ce compte a accès (gérés par le bailleur, jamais par le locataire).
  lease_id         uuid,
  lease_ids        uuid[] not null default '{}',
  -- Compte ouvert par un tiers (bailleur, agence) : qui l'a créé.
  owner_ref        uuid references public.profiles(id) on delete set null,
  mandant_of       uuid references public.profiles(id) on delete set null,
  owner_rec        uuid,                       -- fiche owner_records liée (clé ajoutée plus bas)
  hours            text,
  notif_prefs      jsonb,
  regles           jsonb,
  doc_info         jsonb,
  statut_le        timestamptz,
  statut_par       uuid references public.profiles(id) on delete set null,
  doublon_de       uuid references public.profiles(id) on delete set null,
  rapproche_le     timestamptz,
  mdp_provisoire   boolean not null default false,
  cgu_acceptees_le timestamptz,
  extra            jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint profil_membre_role check ((parent_id is null) = (role not in ('manager','agent'))),
  constraint profil_pas_son_parent check (parent_id is distinct from id)
);
comment on table public.profiles is 'Compte DEUKSIL (1 ligne par utilisateur auth.users). Données personnelles : lecture restreinte par RLS ; annuaire public via public.annuaire().';
create unique index profiles_cni_unique on public.profiles (cni) where cni is not null and doublon_de is null;
create unique index profiles_email_unique on public.profiles (email) where email is not null;

-- --- Biens et annonces ---------------------------------------------------------
create table public.properties (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  agent_id         uuid references public.profiles(id) on delete set null,
  apporteur_id     uuid references public.profiles(id) on delete set null,
  client_owner_id  uuid,                        -- fiche owner_records du mandant (agence)
  ex_client_owner_id uuid,
  title            text not null check (length(title) between 3 and 200),
  type             text not null check (length(type) <= 40),
  transaction      text not null check (transaction in ('location','vente','terrain')),
  price            bigint not null default 0 check (price >= 0),
  region           text, city text, commune text, quartier text,
  surface          numeric(12,2) check (surface is null or surface >= 0),
  rooms            integer not null default 0 check (rooms between 0 and 200),
  baths            integer not null default 0 check (baths between 0 and 200),
  status           text not null default 'disponible',
  listing_status   text not null default 'brouillon'
                   check (listing_status in ('brouillon','avalider','attente','publiee','pause','refusee','archivee')),
  prev_listing     text,
  description      text check (description is null or length(description) <= 10000),
  amenities        text[] not null default '{}',
  furnished        boolean not null default false,
  parking          boolean not null default false,
  views            integer not null default 0 check (views >= 0),
  contacts         integer not null default 0 check (contacts >= 0),
  available_from   date,
  photos           text[] not null default '{}' check (cardinality(photos) <= 20),
  verif_level      text,
  published_at     timestamptz,
  valide_le        timestamptz,
  renvoi_motif     text,
  foncier          jsonb,
  extra            jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.units (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  ref         text not null,
  floor       text, surface numeric(12,2), rooms integer,
  rent        bigint check (rent is null or rent >= 0),
  charges     bigint check (charges is null or charges >= 0),
  status      text not null default 'libre',
  lease_id    uuid,
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (property_id, ref)
);

-- --- Relation client / annonce --------------------------------------------------
create table public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, property_id)
);

create table public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null check (length(name) <= 120),
  criteria   jsonb not null default '{}',
  extra      jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visits (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  client_id     uuid references public.profiles(id) on delete set null,
  agent_id      uuid references public.profiles(id) on delete set null,
  planifiee_par uuid references public.profiles(id) on delete set null,
  status        text not null default 'attente',
  date          date not null,
  time          text not null check (time ~ '^\d{2}:\d{2}$'),
  message       text check (message is null or length(message) <= 2000),
  client_name   text, client_phone text, note text, source text,
  cr            jsonb,
  extra         jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.client_requests (            -- « demandes » clients d'une agence
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  agent_id    uuid references public.profiles(id) on delete set null,
  confie_par  uuid references public.profiles(id) on delete set null,
  name        text not null, phone text,
  transaction text, type text,
  budget      bigint check (budget is null or budget >= 0),
  lieu        text, rooms integer,
  status      text not null default 'active',
  vus         uuid[] not null default '{}',
  closed_at   timestamptz, confie_le timestamptz,
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --- Messagerie ------------------------------------------------------------------
create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  participants uuid[] not null check (cardinality(participants) between 2 and 10),
  property_id  uuid references public.properties(id) on delete set null,
  agent_id     uuid references public.profiles(id) on delete set null,
  phone        text,
  extra        jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Une ligne par message : deux personnes peuvent écrire en même temps sans
-- écraser le message de l'autre (le tableau « items » de l'interface est
-- reconstitué à la lecture).
create table public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  text            text not null default '' check (length(text) <= 5000),
  pj              jsonb,
  read_at         timestamptz,
  extra           jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  text       text not null check (length(text) <= 1000),
  link       text check (link is null or link ~ '^#/'),
  read       boolean not null default false,
  key        text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index notifications_cle_unique on public.notifications (user_id, key) where key is not null;

-- --- Gestion locative ------------------------------------------------------------
create table public.leases (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  property_id      uuid not null references public.properties(id) on delete restrict,
  unit_id          uuid references public.units(id) on delete set null,
  unit_ref         text,
  tenant           text not null check (length(tenant) <= 160),
  phone            text,
  rent             bigint not null check (rent >= 0),
  deposit          bigint not null default 0 check (deposit >= 0),
  start            date not null,
  months           integer not null default 12 check (months between 1 and 600),
  due_day          integer not null default 5 check (due_day between 1 and 31),
  status           text not null default 'actif',
  ended_at         timestamptz,
  renewals         jsonb not null default '[]',
  revisions        jsonb not null default '[]',
  preavis          jsonb,
  retenues         jsonb,
  caution_chez     text, caution_statut text,
  caution_rendue   bigint check (caution_rendue is null or caution_rendue >= 0),
  caution_rendue_le timestamptz,
  duree_initiale   integer,
  reconductions    jsonb not null default '[]',          -- historique des reconductions tacites [{le, depuis, mois}]
  extra            jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.units add constraint units_lease_fk foreign key (lease_id) references public.leases(id) on delete set null;

create table public.rents (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  lease_id    uuid not null references public.leases(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  month       text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount      bigint not null check (amount >= 0),
  paid_at     date,
  method      text, pay_ref text,
  payments    jsonb not null default '[]',
  reminded_at timestamptz,
  reminders   integer not null default 0 check (reminders >= 0),
  penalite    bigint check (penalite is null or penalite >= 0),
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (lease_id, month)                      -- une échéance par bail et par mois
);

create table public.lease_messages (              -- échanges bailleur / locataire
  id         uuid primary key default gen_random_uuid(),
  lease_id   uuid not null references public.leases(id) on delete cascade,
  owner_id   uuid not null references public.profiles(id) on delete cascade,  -- rempli par déclencheur
  "from"     text not null check (length("from") <= 64),
  author_id  uuid references public.profiles(id) on delete set null default auth.uid(),
  text       text not null default '' check (length(text) <= 5000),
  read       boolean not null default false,
  pj         jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspections (                 -- états des lieux
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  lease_id   uuid not null references public.leases(id) on delete cascade,
  kind       text not null check (kind in ('entree','sortie')),
  extra      jsonb not null default '{}',             -- pièces, relevés, observations
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, kind)
);

create table public.providers (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null, job text, phone text,
  extra      jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tickets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  tenant_id   uuid references public.profiles(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  expense_id  uuid,
  ref         text,
  title       text not null check (length(title) <= 200),
  category    text, priority text, note text, photo text,
  cost        bigint check (cost is null or cost >= 0),
  status      text not null default 'ouvert',
  en_regie    boolean,
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --- Ventes, documents commerciaux, finances -------------------------------------
create table public.deals (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  client_id   uuid references public.profiles(id) on delete set null,
  agent_id    uuid references public.profiles(id) on delete set null,
  buyer       text, buyer_phone text, phone text,
  offer       bigint check (offer is null or offer >= 0),
  price       bigint check (price is null or price >= 0),
  mode        text check (mode is null or mode in ('unique','acompte','echelonne')),
  deposit     bigint check (deposit is null or deposit >= 0),
  tranches    integer check (tranches is null or tranches between 0 and 120),
  promise_at  date, deadline date, signed_at date,
  plan        jsonb not null default '[]',
  stage       text not null default 'prospect',
  promise_ref text, act_ref text,
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.billing_docs (                -- devis, factures, avoirs, proformas
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  type          text not null check (type in ('DEV','FAC','AV','PF')),
  ref           text not null,
  client        text, client_phone text,
  client_id     uuid references public.profiles(id) on delete set null,
  property_id   uuid references public.properties(id) on delete set null,
  deal_id       uuid references public.deals(id) on delete set null,
  items         jsonb not null default '[]',
  discount      numeric(5,2) not null default 0 check (discount between 0 and 100),
  tax           numeric(5,2) not null default 0 check (tax between 0 and 100),
  status        text not null default 'émise',
  due           date,
  owner_decision text, decided_at timestamptz,
  decided_by    text check (decided_by is null or length(decided_by) <= 160),   -- nom de la personne qui a donné son accord
  extra         jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, ref)                         -- numérotation unique par espace
);

create table public.billing_payments (            -- encaissements de factures
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  doc_id      uuid references public.billing_docs(id) on delete cascade,
  doc_ref     text, client text,
  client_id   uuid references public.profiles(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  amount      bigint not null check (amount > 0),
  method      text, ref text, rec text,
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  ticket_id   uuid references public.tickets(id) on delete set null,
  proof_id    uuid,
  ref         text, supplier text, cat text, method text,
  amount      bigint not null check (amount >= 0),
  date        date not null default current_date,
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.tickets add constraint tickets_expense_fk foreign key (expense_id) references public.expenses(id) on delete set null;

create table public.contracts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete set null,
  client_id    uuid references public.profiles(id) on delete set null,
  deal_id      uuid references public.deals(id) on delete set null,
  renewed_from uuid references public.contracts(id) on delete set null,
  ref          text, type text, genre text, party text, conditions text,
  start        date, "end" date,
  amount       bigint check (amount is null or amount >= 0),
  deposit      bigint check (deposit is null or deposit >= 0),
  charges      bigint check (charges is null or charges >= 0),
  status       text not null default 'actif',
  extra        jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ("end" is null or start is null or "end" >= start)
);

-- --- Agence : propriétaires mandants, mandats, reversements, honoraires ----------
create table public.owner_records (               -- fiches des propriétaires confiés à une agence
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,     -- l'agence
  compte_id   uuid references public.profiles(id) on delete set null,             -- compte DEUKSIL du propriétaire
  name        text not null, phone text, email text, cni text, address text, kind text,
  rate        numeric(5,2) check (rate is null or rate between 0 and 100),
  lien        text, demande_le timestamptz, lien_le timestamptz,
  status      text not null default 'actif',
  closed_at   timestamptz, source text,
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles add constraint profiles_owner_rec_fk foreign key (owner_rec) references public.owner_records(id) on delete set null;
alter table public.properties add constraint properties_client_owner_fk foreign key (client_owner_id) references public.owner_records(id) on delete set null;

create table public.mandates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  owner_id2  uuid references public.owner_records(id) on delete cascade,
  ref        text,
  rate       numeric(5,2) check (rate is null or rate between 0 and 100),
  start      date, "end" date,
  properties uuid[] not null default '{}',
  services   text[] not null default '{}',
  status     text not null default 'actif',
  ended_at   timestamptz,
  extra      jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sale_mandates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  owner_id2   uuid references public.owner_records(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  ref         text,
  price       bigint check (price is null or price >= 0),
  rate        numeric(5,2) check (rate is null or rate between 0 and 100),
  payer       text, exclusif boolean not null default false,
  start       date, "end" date,
  status      text not null default 'actif',
  sold_at     timestamptz, ended_at timestamptz,
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.owner_transfers (             -- reversements de l'agence au propriétaire
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  owner_id2   uuid references public.owner_records(id) on delete cascade,
  ref         text,
  month       text check (month is null or month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount      bigint not null default 0,
  encaisse    bigint, dep bigint, com bigint, du bigint,
  solde_avant bigint, solde_apres bigint,
  rate        numeric(5,2),
  method      text, pay_ref text,
  status      text not null default 'à reverser',
  paid_on     date,
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.fees (                        -- honoraires d'agence
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  lease_id       uuid references public.leases(id) on delete set null,
  deal_id        uuid references public.deals(id) on delete set null,
  property_id    uuid references public.properties(id) on delete set null,
  agent_id       uuid references public.profiles(id) on delete set null,
  apporteur_id   uuid references public.profiles(id) on delete set null,
  ref            text, kind text, payer text, payer_name text,
  ht             bigint, tva bigint, ttc bigint,
  agent_part     bigint not null default 0 check (agent_part >= 0),
  apporteur_part bigint not null default 0 check (apporteur_part >= 0),
  status         text not null default 'du',
  paid_at        timestamptz, method text, pay_ref text,
  agent_paid_at  timestamptz, agent_method text,
  extra          jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Un seul honoraire par bail et par vente (règle de creerHonoraire, garantie ici).
create unique index fees_un_par_bail on public.fees (lease_id) where lease_id is not null;
create unique index fees_un_par_vente on public.fees (deal_id) where deal_id is not null;

create table public.agency_link_requests (        -- un propriétaire demande à une agence de gérer ses biens
  id         uuid primary key default gen_random_uuid(),
  proprio_id uuid not null references public.profiles(id) on delete cascade,
  agence_id  uuid not null references public.profiles(id) on delete cascade,
  fiche_id   uuid references public.owner_records(id) on delete set null,
  message    text check (message is null or length(message) <= 500),
  statut     text not null default 'attente' check (statut in ('attente','acceptee','refusee','annulee')),
  repondu_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proprio_id <> agence_id)
);
create unique index agency_link_une_attente on public.agency_link_requests (proprio_id, agence_id) where statut = 'attente';

-- --- Documents, confiance, journal, contact ----------------------------------------
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete set null,
  recu_de      uuid references public.profiles(id) on delete set null,
  name         text not null check (length(name) <= 255),
  mime         text check (mime is null or length(mime) <= 100),
  storage_path text not null,                    -- chemin dans le compartiment privé « documents »
  size_bytes   bigint check (size_bytes is null or size_bytes between 0 and 10485760),
  cat          text, expiry date, src_ref text, pj_src text, pj_i integer,
  auto         boolean not null default false,
  extra        jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.expenses add constraint expenses_proof_fk foreign key (proof_id) references public.documents(id) on delete set null;

create table public.reports (                     -- signalements d'annonces
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title       text,
  reason      text not null check (length(reason) <= 120),
  comment     text check (comment is null or length(comment) <= 2000),
  status      text not null default 'nouveau',
  extra       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index reports_un_par_personne on public.reports (property_id, reporter_id) where status = 'nouveau';

create table public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null default auth.uid(),
  text       text not null check (length(text) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.audit_log (                   -- journal d'un espace, en écriture seule
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null default auth.uid(),
  who        text, action text not null, detail text,
  changes    jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  name       text not null check (length(name) between 2 and 120),
  email      text not null check (email ~* '^[^\s@]+@[^\s@]+\.[a-z]{2,}$' and length(email) <= 254),
  phone      text check (phone is null or length(phone) <= 30),
  subject    text not null check (subject in ('question','acces','annonce','technique','agence','abus','autre')),
  message    text not null check (length(message) between 10 and 3000),
  statut     text not null default 'nouveau' check (statut in ('nouveau','traite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- Horodatage updated_at sur toutes les tables ---------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('create trigger maj_horodatage before update on public.%I for each row execute function app.maj_horodatage()', t);
  end loop;
end $$;
