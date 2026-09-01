import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase-admin'

/* ─────────────────────────────────────────────────────────
   응원 글 번역 (부록 B Q18)

   기획서는 「DeepL + Edge Function」으로 적어뒀는데 **Claude API 로 바꿨습니다.**
   Q18 이 아직 미결정 사항이라 바꿀 수 있는 자리였고, 이 방에는 기계번역이 못 넘는
   말이 계속 나옵니다 —

     · 「최애」「매너챗」「멤놀방」은 사전에 없는 팬덤 말입니다
     · 특히 **`なりきり` 로 옮기면 안 됩니다.** 일본에서 실존 인물 역할극을
       연상시켜서 3.5 의 경계를 화면에서 무너뜨립니다. 기계번역은 이걸 모릅니다
     · 응원은 팬의 말투로 남아야 합니다. 운영자 말투로 번역되면 방의 온도가 바뀝니다

   아래 용어집을 지시로 넘기면 그게 다 지켜집니다. DeepL 에는 이런 걸 시킬 방법이 없습니다.
   (덤으로 DeepL 무료 키가 요구하던 카드 등록도 없어집니다)

   ⚠️ 응원방(world='cheer') 글만. 멤놀방은 한국어를 **쓰는** 연습이라
      옆에 번역이 늘 붙어 있으면 안 됩니다 (5.1.1).
   ───────────────────────────────────────────────────────── */

/* 한 번에 20개를 **묶어서 한 번** 부릅니다. 한 글에 한 번씩 부르면
   같은 지시문을 20번 다시 보내게 됩니다 */
const BATCH = 20

const Out = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      lang: z.string(),   /* 원문 언어 — ko · ja · other */
      ko: z.string(),
      ja: z.string(),
    })
  ),
})

const SYSTEM = `너는 K-pop 팬덤 응원 게시판의 번역기다. 한국어 ↔ 일본어.

받은 글마다 한국어판과 일본어판을 **둘 다** 만들어라.
원문이 이미 그 언어면 원문을 그대로 넣는다 (다듬지 마라).

말투
- 팬이 최애에게 하는 말이다. 다정하고 가벼운 구어체를 유지해라.
- 운영자·공지 말투로 바꾸지 마라. 「〜させていただきます」 같은 과한 경어는 쓰지 마라.
- 원문이 짧으면 번역도 짧게. 설명을 덧붙이지 마라.

용어
- 최애 → 推し
- 매너챗 → やさしい言葉
- 멤놀방 → キャラチャット
- **「なりきり」는 절대 쓰지 마라.** 일본에서 실존 인물 역할극을 연상시킨다.
- 색 이름(노랑·핑크 등)은 그 언어의 일반적인 색 이름으로 옮겨라.

그 외
- 사람 이름처럼 보이는 것이 있어도 판단하지 말고 음차해서 그대로 옮겨라.
- 오타·비문이 있어도 뜻을 살려서 옮겨라. 고쳐주려 하지 마라.
- lang 에는 원문 언어를 ko · ja · other 중 하나로 적어라.
- 받은 id 를 그대로 돌려줘라. 순서와 개수를 바꾸지 마라.`

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    /* 키가 없어도 화면은 돌아야 합니다 — 번역만 안 붙습니다 */
    return NextResponse.json({ ok: false, reason: 'no_key', done: 0 })
  }

  const db = adminClient()

  /* 아직 번역 안 된 응원 글. `rooms!inner` 로 응원방만 걸러냅니다 */
  const { data: rows, error } = await db
    .from('messages')
    .select('id, body, rooms!inner(world)')
    .eq('rooms.world', 'cheer')
    .is('body_lang', null)
    .order('created_at', { ascending: false })
    .limit(BATCH)

  if (error) {
    console.error('번역 대상 조회 실패:', error)
    return NextResponse.json({ ok: false, reason: 'query_failed', done: 0 }, { status: 500 })
  }
  if (!rows?.length) return NextResponse.json({ ok: true, done: 0 })

  const items = (rows as unknown as { id: string; body: string }[]).map((r) => ({
    id: r.id,
    text: r.body,
  }))

  const client = new Anthropic()
  const res = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(items) }],
    output_config: {
      format: zodOutputFormat(Out),
      /* 한 줄짜리 응원을 옮기는 일이라 얕게 생각해도 충분합니다.
         번역이 어색해지면 이 한 줄을 지우세요 (지우면 기본값으로 깊게 생각합니다) */
      effort: 'low',
    },
  })

  /* 안전 분류기가 거절하면 200 에 stop_reason='refusal' 로 옵니다 — content 를 읽기 전에 봅니다 */
  if (res.stop_reason === 'refusal') {
    console.error('번역 거절됨:', res.stop_details)
    return NextResponse.json({ ok: false, reason: 'refusal', done: 0 })
  }
  if (!res.parsed_output) {
    console.error('번역 형식 어긋남')
    return NextResponse.json({ ok: false, reason: 'unparsed', done: 0 })
  }

  const byId = new Map(items.map((i) => [i.id, i.text]))
  let done = 0
  for (const out of res.parsed_output.items) {
    /* 모델이 만들어낸 id 는 버립니다 — 보낸 것만 씁니다 */
    if (!byId.has(out.id)) continue
    const { error: upErr } = await db
      .from('messages')
      .update({ body_ko: out.ko, body_ja: out.ja, body_lang: out.lang })
      .eq('id', out.id)
    if (upErr) {
      console.error('번역 저장 실패:', upErr)
      break
    }
    done += 1
  }

  return NextResponse.json({ ok: true, done })
}
