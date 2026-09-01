-- ─────────────────────────────────────────────────────────
-- 사용자 글 번역 — 저장형 (부록 B Q18 · 5.14 · 15.9)
--
-- 응원방은 **읽기 연습장**입니다 (5.1.1). 남이 쓴 한국어 아래에 일본어 뜻이 붙으면
-- 그 자체로 읽기 연습이 되고, 반대로 일본어 응원에 한국어가 붙으면 대표가 읽습니다.
--
-- **저장형입니다** — 쓸 때 한 번 번역해서 넣어두고, 볼 때는 DB 에서 꺼내 씁니다.
--   · 화면을 열 때마다 번역하면 같은 글을 수백 번 다시 번역합니다 (돈이 그만큼 나갑니다)
--   · 번역기가 죽어도 이미 쌓인 글은 그대로 보입니다
--   · **소급이 됩니다** — 나중에 붙여도 옛날 글까지 채울 수 있어서 급하지 않았습니다
--
-- ⚠️ 멤놀방(world='idol')은 번역하지 않습니다. 거기는 **쓰기·대화** 연습이고,
--    한국어 옆에 일본어가 늘 붙어 있으면 한국어를 읽을 이유가 없어집니다 (5.1.1 난이도 사다리).
--    멤놀방에서 막히는 문장은 「고쳐주세요」(첨삭)가 받습니다.
-- ─────────────────────────────────────────────────────────

alter table messages add column if not exists body_ko   text;
alter table messages add column if not exists body_ja   text;
-- 원문이 무슨 언어였나 (DeepL 이 감지한 값). 원문을 굵게 두고 번역을 아래 붙일 때 씁니다
alter table messages add column if not exists body_lang text;

-- 아직 번역 안 된 응원 글을 찾는 데 씁니다. 번역이 끝난 글은 인덱스에서 빠집니다
create index if not exists messages_untranslated_idx
  on messages (created_at) where body_lang is null;
