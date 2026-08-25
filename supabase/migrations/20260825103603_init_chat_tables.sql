-- ① 테이블 3개 (기획서 5.6)
create table rooms (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  situation   text,
  world       text default 'idol',
  is_official boolean default false,
  capacity    int default 8,
  closed_at   timestamptz,
  created_at  timestamptz default now()
);

create table participants (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid references rooms on delete cascade,
  client_id text not null,
  name      text not null,
  role      text,
  color_key text not null,
  avatar    text not null,
  joined_at timestamptz default now(),
  left_at   timestamptz,
  unique (room_id, client_id)
);

create table messages (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid references rooms on delete cascade,
  layer          text not null check (layer in ('stage','backstage')),
  participant_id uuid references participants,
  kind           text default 'line' check (kind in ('line','action','system')),
  body           text not null,
  client_msg_id  text,
  reactions      jsonb default '{}'::jsonb,
  created_at     timestamptz default now()
);

create index on messages (room_id, layer, created_at);
create unique index on messages (room_id, client_msg_id) where client_msg_id is not null;

-- ② Realtime 켜기 (이거 빼면 메시지가 실시간으로 안 옵니다)
alter publication supabase_realtime add table messages;

-- ③ RLS — 세 테이블 모두 켜고 dev용 정책
alter table rooms        enable row level security;
alter table participants enable row level security;
alter table messages     enable row level security;

create policy "dev read"   on rooms        for select using (true);
create policy "dev read"   on participants for select using (true);
create policy "dev insert" on participants for insert with check (true);
create policy "dev read"   on messages     for select using (true);
create policy "dev insert" on messages     for insert with check (true);