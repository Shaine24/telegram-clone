-- Telegram-style messenger schema
-- profiles / chats / chat_members / messages with RLS + realtime

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_color text not null default '#8774e1',
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by signed-in users" on public.profiles;
create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------------ chats
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.chats enable row level security;

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index if not exists chat_members_user_idx on public.chat_members (user_id);

alter table public.chat_members enable row level security;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_chat_created_idx
  on public.messages (chat_id, created_at desc);

alter table public.messages enable row level security;

-- ------------------------------------------------------------ helper fns
create or replace function public.is_chat_member(
  p_chat_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = p_chat_id and user_id = p_user_id
  );
$$;

-- ------------------------------------------------------------------- RLS
drop policy if exists "members can read chats" on public.chats;
create policy "members can read chats"
  on public.chats for select to authenticated
  using (public.is_chat_member(id));

drop policy if exists "users can create chats" on public.chats;
create policy "users can create chats"
  on public.chats for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "members can read chat_members" on public.chat_members;
create policy "members can read chat_members"
  on public.chat_members for select to authenticated
  using (public.is_chat_member(chat_id));

drop policy if exists "users can join chats themselves" on public.chat_members;
create policy "users can join chats themselves"
  on public.chat_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users can update their membership" on public.chat_members;
create policy "users can update their membership"
  on public.chat_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users can leave chats" on public.chat_members;
create policy "users can leave chats"
  on public.chat_members for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "members can read messages" on public.messages;
create policy "members can read messages"
  on public.messages for select to authenticated
  using (public.is_chat_member(chat_id));

drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_chat_member(chat_id));

-- ------------------------------------------------------- profile bootstrap
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  uname text;
  i int := 0;
  palette text[] := array[
    '#e17076', '#7bc862', '#e5ca77', '#65aadd',
    '#a695e7', '#ee7aae', '#6ec9cb', '#faa774'
  ];
begin
  base := lower(coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, 'user'), '@', 1),
    'user'
  ));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if base = '' then
    base := 'user';
  end if;

  uname := base;
  loop
    exit when not exists (
      select 1 from public.profiles where lower(username) = uname
    );
    i := i + 1;
    uname := base || i::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_color)
  values (
    new.id,
    uname,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      initcap(base)
    ),
    palette[1 + floor(random() * array_length(palette, 1))::int]
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------- app RPCs
create or replace function public.get_or_create_direct_chat(p_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if p_other_user = v_me then
    raise exception 'Cannot start a chat with yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_other_user) then
    raise exception 'User not found';
  end if;

  select c.id into v_chat
  from public.chats c
  join public.chat_members me on me.chat_id = c.id and me.user_id = v_me
  join public.chat_members other on other.chat_id = c.id and other.user_id = p_other_user
  where c.is_group = false
  limit 1;

  if v_chat is not null then
    return v_chat;
  end if;

  insert into public.chats (is_group, created_by)
  values (false, v_me)
  returning id into v_chat;

  insert into public.chat_members (chat_id, user_id)
  values (v_chat, v_me), (v_chat, p_other_user);

  return v_chat;
end;
$$;

create or replace function public.list_my_chats()
returns table (
  id uuid,
  is_group boolean,
  name text,
  peer_id uuid,
  peer_name text,
  peer_username text,
  peer_color text,
  last_message text,
  last_message_at timestamptz,
  last_message_sender uuid,
  unread_count int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.is_group,
    c.name,
    p.id as peer_id,
    p.display_name as peer_name,
    p.username as peer_username,
    p.avatar_color as peer_color,
    lm.body as last_message,
    lm.created_at as last_message_at,
    lm.sender_id as last_message_sender,
    (
      select count(*)::int
      from public.messages m
      where m.chat_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > greatest(cm.last_read_at, cm.joined_at)
    ) as unread_count
  from public.chat_members cm
  join public.chats c on c.id = cm.chat_id
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.messages m
    where m.chat_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join public.chat_members other
    on other.chat_id = c.id and other.user_id <> auth.uid()
  left join public.profiles p on p.id = other.user_id
  where cm.user_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

create or replace function public.search_users(p_query text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_color text
)
language sql
security definer
set search_path = public
stable
as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_color
  from public.profiles pr
  where pr.id <> auth.uid()
    and (
      coalesce(trim(p_query), '') = ''
      or lower(pr.username) like '%' || lower(trim(p_query)) || '%'
      or lower(pr.display_name) like '%' || lower(trim(p_query)) || '%'
    )
  order by pr.display_name
  limit 20;
$$;

create or replace function public.mark_chat_read(p_chat_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_members
  set last_read_at = now()
  where chat_id = p_chat_id and user_id = auth.uid();
$$;

-- ------------------------------------------------------------- privileges
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.chats to authenticated;
grant select, insert, update, delete on public.chat_members to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

grant execute on function public.is_chat_member(uuid, uuid) to authenticated;
grant execute on function public.get_or_create_direct_chat(uuid) to authenticated;
grant execute on function public.list_my_chats() to authenticated;
grant execute on function public.search_users(text) to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- --------------------------------------------------------------- realtime
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end;
$$;
