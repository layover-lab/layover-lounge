-- ─────────────────────────────────────────────────────────
-- 「이런 옷도 입고 싶어요」 (기획서 8.2 · 9장)
--
-- 지금 수요는 착용·저장 같은 **행동으로 추정**합니다. 건의는 사람이 직접
-- 말해주는 거라 신호가 훨씬 셉니다. 8.2 가 「폼이면 충분합니다」라고 못 박은 자리입니다.
--
--   · 남의 건의는 **안 보여줍니다.** 공개하면 응원방만큼의 모더레이션이 또 생깁니다
--   · 지금 입은 코디를 같이 저장합니다 — 「무슨 옷을 보다가 이런 생각을 했나」가 맥락입니다
--   · 도배 방지는 응원방과 같은 방식 (client_id 기준)
-- ─────────────────────────────────────────────────────────

create table wishes (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null,
  body       text not null check (char_length(btrim(body)) between 1 and 300),
  look       text,                      -- 건의할 때 입고 있던 코디 (?look= 값)
  lang       text,                      -- 어느 언어 화면에서 왔나
  created_at timestamptz default now()
);

create index wishes_created_idx on wishes (created_at desc);

alter table wishes enable row level security;

-- 접수만 됩니다. select 정책이 없으니 아무도 못 읽습니다 —
-- 남의 건의를 읽을 이유가 없고, 운영자는 대시보드로 봅니다
create policy "anyone can wish" on wishes
  for insert with check (length(client_id) >= 8);

-- 도배 방지 — 응원방과 같은 기준 (20260829080502)
create or replace function public.limit_wishes()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int; hourly int;
begin
  select count(*) into recent from wishes
   where client_id = new.client_id and created_at > now() - interval '10 seconds';
  if recent > 0 then
    raise exception 'wish_too_fast';
  end if;

  select count(*) into hourly from wishes
   where client_id = new.client_id and created_at > now() - interval '1 hour';
  if hourly >= 20 then
    raise exception 'wish_too_many';
  end if;

  return new;
end $$;

drop trigger if exists limit_wishes_trg on wishes;
create trigger limit_wishes_trg before insert on wishes
  for each row execute function public.limit_wishes();

-- ── 디스코드 알림 ──────────────────────────────
-- 방이 없는 알림도 보낼 수 있게 한 겹 나눕니다. 기존 트리거는 그대로 돕니다
create or replace function public.notify_discord_plain(title text, body text)
returns void language plpgsql security definer set search_path = public as $$
declare hook text;
begin
  select decrypted_secret into hook from vault.decrypted_secrets where name = 'discord_webhook';
  if hook is null then return; end if;
  perform net.http_post(
    url     := hook,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object('content', title || E'\n> ' || left(coalesce(body, ''), 300))
  );
end $$;

create or replace function public.notify_wish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_discord_plain('👗 옷 건의', new.body);
  return new;
end $$;

drop trigger if exists notify_wish_trg on wishes;
create trigger notify_wish_trg after insert on wishes
  for each row execute function public.notify_wish();
