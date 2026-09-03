-- ─────────────────────────────────────────────────────────
-- 건의를 두 종류로 — 옷 · 멤놀방
--
-- 지금까지 불편한 점은 **사람이 직접 말해준 것**으로만 들어왔습니다
-- (코드 주석에 「학생 피드백 2026-08-29」처럼 남아 있습니다). 낯선 사람이
-- 들어오기 시작하면 그 통로가 사라집니다 — 받을 창구가 필요합니다.
--
-- 새 테이블을 만들지 않습니다 (부록 E.6 「안 쓰는 테이블은 미리 만들지 마세요」).
-- wishes 에는 도배 방지와 디스코드 알림이 이미 붙어 있어서, 종류만 늘리면
-- 그 둘을 그대로 물려받습니다.
--
--   kind='clothes'  이런 옷도 입고 싶어요   (드레스룸)   맥락 = 입고 있던 코디
--   kind='lounge'   개선이 필요해요        (입장 화면)  맥락 = 마지막에 있던 방
-- ─────────────────────────────────────────────────────────

alter table wishes add column if not exists kind text not null default 'clothes';
alter table wishes drop constraint if exists wishes_kind_check;
alter table wishes add constraint wishes_kind_check check (kind in ('clothes', 'lounge'));

-- 어느 방에서 겪은 불편인가. 코디(look)와 자리가 다릅니다 — 종류마다 맥락이 다릅니다
alter table wishes add column if not exists room text;

-- ⚠️ 도배 방지를 **종류별로** 셉니다. 안 그러면 옷 건의를 보낸 직후 멤놀방
--    건의를 못 씁니다 — 다른 화면에서 다른 얘기를 하는 건데 막히면 버그로 보입니다.
--    응원방에서 같은 것을 이미 한 번 겪었습니다 (20260901090000).
create or replace function public.limit_wishes()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int; hourly int;
begin
  select count(*) into recent from wishes
   where client_id = new.client_id and kind = new.kind
     and created_at > now() - interval '10 seconds';
  if recent > 0 then
    raise exception 'wish_too_fast';
  end if;

  select count(*) into hourly from wishes
   where client_id = new.client_id and kind = new.kind
     and created_at > now() - interval '1 hour';
  if hourly >= 20 then
    raise exception 'wish_too_many';
  end if;

  return new;
end $$;

-- 알림도 종류를 밝힙니다. 어느 화면 얘기인지 모르면 답을 못 씁니다
create or replace function public.notify_wish()
returns trigger language plpgsql security definer set search_path = public as $$
declare rname text;
begin
  if new.kind = 'lounge' then
    select r.title into rname from rooms r where r.slug = new.room;
    perform public.notify_discord_raw(
      '💬 개선이 필요해요' || coalesce(' · ' || rname, '') || E'\n> '
      || left(coalesce(new.body, ''), 300)
    );
  else
    perform public.notify_discord_plain('👗 옷 건의', new.body);
  end if;
  return new;
end $$;
