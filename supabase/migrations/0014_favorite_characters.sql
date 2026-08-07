-- Personal favorite character per title (like ratings — each person picks their own,
-- both visible to both). Denormalizes the chosen cast member (name/character/photo)
-- instead of storing only the TMDB person id, so displaying a saved pick never needs a
-- refetch of that title's credits.
create table movies.favorite_characters (
  id uuid primary key default gen_random_uuid(),
  library_entry_id uuid not null references movies.library_entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  character_person_id integer not null,
  character_name text not null,
  actor_name text not null,
  profile_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_entry_id, user_id)
);
alter table movies.favorite_characters enable row level security;
create policy "favorite_characters: read" on movies.favorite_characters for select to authenticated using (true);
create policy "favorite_characters: insert own" on movies.favorite_characters for insert to authenticated with check (user_id = auth.uid());
create policy "favorite_characters: update own" on movies.favorite_characters for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "favorite_characters: delete own" on movies.favorite_characters for delete to authenticated using (user_id = auth.uid());
-- Table grants are handled automatically by 0003's `alter default privileges`.
