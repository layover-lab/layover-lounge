-- ─────────────────────────────────────────────────────────
-- 물어보기 알림 — 답을 쓸 수 있을 만큼 담습니다
--
-- 지금 알림은 「✏️ 첨삭 요청 — 일본 여행 가는 날」 + 문장 한 줄이 전부라
-- **답을 쓸 수가 없었습니다.** 누가 물었는지, 몇 번 게이트인지, 어디로 가야
-- 하는지가 없습니다. 방 이름만 보고 주소를 직접 쳐서 찾아 들어가야 했습니다.
--
-- 그리고 이제 한 번에 세 문장까지 묶어서 묻습니다 (3353e6b).
-- corrections 에 트리거가 붙어 있으면 **질문 하나에 알림이 세 번** 옵니다.
-- 알림을 세는 단위를 「기록」에서 「질문」으로 옮깁니다 —
--   corrections = 나중에 볼 기록 (강좌·AI 재료)
--   messages(kind='ask') = 지금 답해야 할 질문   ← 알림은 이쪽
--
-- ⚠️ 24시간 무응답만 알리는 방식은 아직 아닙니다. 방에 답할 사람이 있을 때
--    쓰는 규칙인데, 지금은 한산해서 사실상 모든 질문이 무응답이 되고
--    답이 하루씩 늦어지기만 합니다. 방이 붐비기 시작하면 그때 켭니다.
-- ─────────────────────────────────────────────────────────

-- ① 내용을 통째로 넘기는 문. vault 조회와 http_post 는 **여기 한 곳에서만** 합니다
--    (20260831210000 에서 두 군데로 갈라져 있던 것을 모은 것과 같은 이유)
create or replace function public.notify_discord_raw(content text)
returns void language plpgsql security definer set search_path = public as $$
declare hook text;
begin
  select decrypted_secret into hook from vault.decrypted_secrets where name = 'discord_webhook';
  if hook is null then return; end if;      -- 비밀이 없으면 조용히 넘어갑니다
  perform net.http_post(
    url     := hook,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object('content', content)
  );
end $$;

create or replace function public.notify_discord_plain(title text, body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_discord_raw(title || E'\n> ' || left(coalesce(body, ''), 300));
end $$;

-- ② 색 점 — 이름만 보면 누구인지 안 붙습니다. 이 방은 색이 곧 사람입니다 (기획서 3.3)
create or replace function public.color_emoji(k text)
returns text language sql immutable as $$
  select case k
    when 'yellow' then '💛' when 'red'    then '❤️' when 'green'  then '💚'
    when 'blue'   then '💙' when 'orange' then '🧡' when 'lightblue' then '🩵'
    when 'purple' then '💜' when 'pink'   then '🩷' else '🤍' end
$$;

-- ③ 질문 하나 = 알림 하나
create or replace function public.notify_ask()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rname text; rslug text; gate int;
  pname text; ckey text; prole text;
begin
  if new.kind is distinct from 'ask' then return new; end if;

  select r.title, r.slug, r.gate_no into rname, rslug, gate
    from rooms r where r.id = new.room_id;
  select p.name, p.color_key, p.role into pname, ckey, prole
    from participants p where p.id = new.participant_id;

  perform public.notify_discord_raw(
    '✏️ 물어봤어요 · ' || coalesce(rname, '?')
      || coalesce(' · ' || gate::text || '번 게이트', '') || E'\n'
    || public.color_emoji(ckey) || ' '
      || coalesce(prole || ' ', '') || coalesce(pname, '?') || E'\n'
    -- 세 문장이 올 수 있어서 줄마다 인용을 답니다. 한 번만 붙이면 둘째 줄부터 안 걸립니다
    || '> ' || replace(left(coalesce(new.body, ''), 900), E'\n', E'\n> ') || E'\n'
    -- 링크가 있어야 폰에서 바로 들어갑니다. 도메인이 바뀌면 여기를 고치세요
    || 'https://layover-lounge.vercel.app/lounge/' || coalesce(rslug, '')
  );
  return new;
end $$;

drop trigger if exists notify_ask_trg on messages;
create trigger notify_ask_trg after insert on messages
  for each row when (new.kind = 'ask') execute function public.notify_ask();

-- ④ 기록 쪽 트리거는 내립니다. 안 내리면 세 문장짜리 질문에 알림이 네 번 옵니다
drop trigger if exists notify_correction_trg on corrections;
