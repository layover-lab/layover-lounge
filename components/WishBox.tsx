'use client'

import { useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { getClientId } from '@/lib/client-id'
import { ERR, isErr } from '@/lib/errors'
import { track } from '@/lib/analytics'
import { LINE, ctaBtn } from '@/lib/ui'
import type { Mode } from '@/lib/i18n'

/* 화면마다 문구가 다릅니다. 키 이름은 같게 두고 값만 바꿔 끼웁니다 */
export type WishStrings = {
  wishTitle: string; wishPlaceholder: string; wishSend: string
  wishDone: string; wishNotice: string; wishTooFast: string; wishFailed: string
}

/* ─────────────────────────────────────────────────────────
   건의 상자 — 드레스룸(옷)과 입장 화면(멤놀방)이 **같은 것**을 씁니다.

   ⚠️ 복사하지 마세요. 두 번째 화면을 만들 때 폼을 통째로 베끼면 도배 방지
      처리나 실패 문구를 한쪽만 고치게 됩니다.

   · 남의 건의는 안 보여줍니다 (기획서 6.7) — 공개하면 모더레이션이 또 하나 생깁니다
   · 맥락을 같이 보냅니다. 옷은 입고 있던 코디, 멤놀방은 마지막에 있던 방입니다
   · 막혔을 때 **쓴 글을 지우지 않습니다** — 쓴 것까지 날아가면 다시 안 씁니다
   ───────────────────────────────────────────────────────── */
export default function WishBox({
  t, lang, kind, look, room,
}: {
  t: WishStrings
  lang: Mode
  kind: 'clothes' | 'lounge'
  look?: string | null
  room?: string | null
}) {
  const [body, setBody] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function send() {
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    const { error } = await supabase.from('wishes').insert({
      client_id: getClientId(), body: text, kind, look: look ?? null, room: room ?? null, lang,
    })
    setBusy(false)
    if (error) {
      setNote(isErr(error, ERR.wishTooFast, ERR.wishTooMany) ? t.wishTooFast : t.wishFailed)
      return
    }
    setBody('')
    setNote(t.wishDone)
    track('wish_submitted', { lang, kind })
  }

  return (
    <section style={boxStyle}>
      <b style={{ fontSize: 14 }}>{t.wishTitle}</b>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0 8px' }}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }}
          placeholder={t.wishPlaceholder}
          maxLength={300}
          style={inputStyle}
        />
        <button
          onClick={send}
          disabled={!body.trim() || busy}
          style={{ ...ctaBtn, fontSize: 14, padding: '11px 16px', opacity: body.trim() ? 1 : 0.5 }}
        >
          {t.wishSend}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-text-sub)' }}>
        {note || t.wishNotice}
      </p>
    </section>
  )
}

const boxStyle: CSSProperties = {
  marginTop: 24, padding: 16, borderRadius: 'var(--radius-card)',
  background: 'var(--color-surface)', border: `1px solid ${LINE}`,
}
const inputStyle: CSSProperties = {
  flex: 1, minWidth: 0, padding: 11, fontSize: 14,
  borderRadius: 'var(--radius-full)', border: `1px solid ${LINE}`,
  background: 'var(--color-bg)',
}
