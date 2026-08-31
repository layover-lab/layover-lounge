-- ─────────────────────────────────────────────────────────
-- 게이트 자동 증설 (기획서 3.6 · 3.7)
--
-- 방을 사용자가 만들지 않습니다. 운영자가 **상황**을 제공하고, 사람이 차면
-- 같은 상황의 다음 **게이트**가 자동으로 열립니다.
--
--   일본 여행 가는 날 · 1번 게이트   (8명)
--   일본 여행 가는 날 · 2번 게이트   ← 9번째 사람이 오면 여기가 열립니다
--
-- 이렇게 하면 ① 「무슨 말을 하지?」 문제가 안 생기고(3.6) ② 빈 방이 안 생기며(4.6)
-- ③ 방 제목에 실존 인물 이름이 들어갈 구멍이 없습니다(3.5).
-- ─────────────────────────────────────────────────────────

-- ① 상황 묶음과 게이트 번호
alter table rooms add column if not exists situation_key text;
alter table rooms add column if not exists gate_no       int default 1;

-- 절대 규칙 ④ — DB 에 저장하는 이름도 언어별로
alter table rooms add column if not exists title_ja     text;
alter table rooms add column if not exists title_en     text;
alter table rooms add column if not exists situation_ja text;
alter table rooms add column if not exists situation_en text;

create index if not exists rooms_situation_idx on rooms (situation_key, gate_no);

-- ② 이미 있던 방을 1번 게이트로 편입
update rooms
   set situation_key = 'japan-trip',
       gate_no       = 1,
       title_ja      = '日本旅行に行く日',
       title_en      = 'The Japan trip',
       situation_ja  = 'メンバーで日本旅行に来た',
       situation_en  = 'The members are on a trip to Japan'
 where slug = 'japan-trip';

-- ③ 상황 넷 추가 (기획서 3.6 의 아이돌 목록에서)
insert into rooms (slug, situation_key, gate_no, world, is_official, capacity,
                   title, title_ja, title_en, situation, situation_ja, situation_en) values
  ('showtime-1', 'showtime', 1, 'idol', true, 8,
   '공연 10분 전', '本番10分前', 'Ten minutes to showtime',
   '대기실에 다 모였다', '楽屋にみんな集まった', 'Everyone is in the green room'),
  ('merch-shop-1', 'merch-shop', 1, 'idol', true, 8,
   '다 같이 굿즈샵', 'みんなでグッズショップ', 'Merch shopping together',
   '굿즈샵에 왔다', 'グッズショップに来た', 'At the merch shop'),
  ('new-member-1', 'new-member', 1, 'idol', true, 8,
   '새 멤버가 왔다', '新メンバーが来た', 'A new member joined',
   '오늘 새 멤버가 합류했다', 'きょう新しいメンバーが加わった', 'A new member joined today'),
  ('pajama-party-1', 'pajama-party', 1, 'idol', true, 8,
   '오늘은 파자마 파티', 'きょうはパジャマパーティー', 'Pyjama party tonight',
   '숙소에 다 모였다', '宿舎にみんな集まった', 'Everyone is back at the dorm')
on conflict (slug) do nothing;

-- ④ 정원 검사를 join_room 안으로. 직접 주소로 들어와도 9번째는 못 들어옵니다
create or replace function public.join_room(
  p_room_id   uuid,
  p_client_id text,
  p_name      text,
  p_color_key text,
  p_role      text default null,
  p_avatar    text default 'preset-01'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid   uuid;
  cap   int;
  taken int;
begin
  if p_client_id is null or length(p_client_id) < 8 then
    raise exception 'bad_client_id';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'name_required';
  end if;

  select id into pid from participants
   where room_id = p_room_id and client_id = p_client_id;

  -- 이미 들어와 있던 사람은 정원과 무관하게 다시 들어옵니다.
  -- 안 그러면 잠깐 끊긴 사람이 자기 방에서 밀려납니다.
  if pid is null then
    select capacity into cap from rooms where id = p_room_id;
    select count(*) into taken from participants where room_id = p_room_id;
    if cap is not null and taken >= cap then
      raise exception 'gate_full';
    end if;
  end if;

  insert into participants (room_id, client_id, name, role, color_key, avatar)
  values (p_room_id, p_client_id, btrim(p_name),
          nullif(btrim(coalesce(p_role,'')), ''), p_color_key, p_avatar)
  on conflict (room_id, client_id) do update
    set name = excluded.name, role = excluded.role,
        color_key = excluded.color_key, avatar = excluded.avatar
  returning id into pid;

  return pid;
end
$$;

-- ⑤ 상황을 고르면 자리 있는 게이트를 찾아주고, 없으면 새로 엽니다
create or replace function public.join_gate(
  p_situation text,
  p_client_id text,
  p_name      text,
  p_color_key text,
  p_role      text default null,
  p_avatar    text default 'preset-01'
)
returns text                       -- 들어갈 방의 slug
language plpgsql
security definer
set search_path = public
as $$
declare
  target   record;
  next_no  int;
  new_slug text;
begin
  -- 이미 이 상황의 어느 게이트에 있던 사람은 그 게이트로 돌려보냅니다
  select r.* into target
    from rooms r
    join participants p on p.room_id = r.id and p.client_id = p_client_id
   where r.situation_key = p_situation
   order by r.gate_no
   limit 1;

  -- 아니면 자리 있는 가장 앞 게이트. **앞에서부터 채워야 빈 방이 안 생깁니다** (4.6)
  if target is null then
    select r.* into target
      from rooms r
     where r.situation_key = p_situation
       and r.closed_at is null
       and (select count(*) from participants p where p.room_id = r.id) < coalesce(r.capacity, 8)
     order by r.gate_no
     limit 1;
  end if;

  -- 다 찼으면 다음 게이트를 엽니다
  if target is null then
    select coalesce(max(gate_no), 0) + 1 into next_no
      from rooms where situation_key = p_situation;
    if next_no = 1 then
      raise exception 'no_such_situation';   -- 없는 상황을 열어주지는 않습니다
    end if;
    new_slug := p_situation || '-' || next_no;

    insert into rooms (slug, situation_key, gate_no, world, is_official, capacity,
                       title, title_ja, title_en, situation, situation_ja, situation_en)
    select new_slug, situation_key, next_no, world, is_official, capacity,
           title, title_ja, title_en, situation, situation_ja, situation_en
      from rooms where situation_key = p_situation order by gate_no limit 1
    returning * into target;
  end if;

  perform public.join_room(target.id, p_client_id, p_name, p_color_key, p_role, p_avatar);
  return target.slug;
end
$$;

revoke all on function public.join_gate(text, text, text, text, text, text) from public;
grant execute on function public.join_gate(text, text, text, text, text, text) to anon, authenticated;
