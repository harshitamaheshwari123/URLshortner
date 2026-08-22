

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  short_code text unique not null,
  destination_url text not null,
  is_custom_alias boolean not null default false,
  tags text[] default '{}',
  expires_at timestamptz,
  max_clicks integer,
  is_archived boolean not null default false,
  is_disabled boolean not null default false,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_links_owner_id on public.links(owner_id);
create index if not exists idx_links_short_code on public.links(short_code);

create table if not exists public.clicks (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer text,
  user_agent text,
  device_type text,
  browser text,
  country text,
  city text,
  ip_hash text
);

create index if not exists idx_clicks_link_id on public.clicks(link_id);
create index if not exists idx_clicks_clicked_at on public.clicks(clicked_at);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_links_updated_at on public.links;
create trigger trg_links_updated_at
  before update on public.links
  for each row execute function public.set_updated_at();

alter table public.links enable row level security;
alter table public.clicks enable row level security;

drop policy if exists "links_owner_full_access" on public.links;
create policy "links_owner_full_access"
  on public.links
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "links_public_read" on public.links;
create policy "links_public_read"
  on public.links
  for select
  using (is_archived = false and is_disabled = false);

drop policy if exists "clicks_owner_read" on public.clicks;
create policy "clicks_owner_read"
  on public.clicks
  for select
  using (
    exists (
      select 1 from public.links
      where public.links.id = clicks.link_id
      and public.links.owner_id = auth.uid()
    )
  );
