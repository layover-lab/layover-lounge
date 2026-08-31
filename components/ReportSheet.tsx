'use client'

import { useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { dict, type Mode } from '@/lib/i18n'
import { LINE, ctaBtn, ctaGhost, tab } from '@/lib/ui'

/* 기획서 19.3 의 11종. 순서는 바꿔도 되지만 **값은 DB check 와 같아야 합니다** */
const REASONS = [
  'harassment', 'abuse', 'sexual', 'stalking', 'personal_info',
  'impersonation', 'copyright', 'banned_image', 'spam', 'scam', 'other',
] as const
type Reason = (typeof REASONS)[number]

/* ─────────────────────────────────────────────────────────
   신고 접수 (기획서 19장)

   · 빨간 경고문 대신 담백한 목록 (19.1)
   · 직접 항의하지 말고 신고하도록 안내 (19.1)
   · 스크린샷을 요구하지 않습니다 — 접수율이 급락합니다 (19.3)
   · 대상 메시지는 자동으로 붙습니다 (19.3)
   ───────────────────────────────────────────────────────── */
export default function ReportSheet({
  lang, roomId, messageId, reporterId, targetId, onClose, onDone,
}: {
  lang: Mode
  roomId: string
  messageId: string
  reporterId: string | null
  targetId: string | null
  onClose: () => void
  onDone: (note: string) => void
}) {
  const t = dict(lang).room
  const [reason, setReason] = useState<Reason | null>(null)
  const [detail, setDetail] = useState('')

  async function send() {
    if (!reason) return
    const { error } = await supabase.from('reports').insert({
      room_id: roomId,
      message_id: messageId,
      reporter_id: reporterId,
      target_id: targetId,
      reason,
      detail: detail.trim() || null,
    })
    /* 실패해도 같은 문구를 보여줍니다 — 신고했다는 사실이 화면에 오래 남으면
       옆 사람에게 보입니다. 실패는 콘솔로만 남깁니다 */
    if (error) console.error('신고 접수 실패:', error)
    onDone(t.reportDone)
  }

  return (
    <div style={wrapStyle} role="dialog" aria-modal="true">
      <div style={sheetStyle}>
        <b style={{ fontSize: 15 }}>{t.reportTitle}</b>
        <p style={{ fontSize: 12, color: 'var(--color-text-sub)', margin: '6px 0 12px', lineHeight: 1.6 }}>
          {t.reportLead}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)} style={tab(reason === r)}>
              {(t as unknown as Record<string, string>)['r_' + r]}
            </button>
          ))}
        </div>

        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={t.reportDetail}
          maxLength={500}
          rows={3}
          style={textareaStyle}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ ...ctaGhost, flex: 1, fontSize: 14 }}>{t.close}</button>
          <button onClick={send} disabled={!reason}
                  style={{ ...ctaBtn, flex: 1, fontSize: 14, opacity: reason ? 1 : 0.5 }}>
            {t.reportSubmit}
          </button>
        </div>
      </div>
    </div>
  )
}

const wrapStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(43,34,38,.35)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 20,
}
const sheetStyle: CSSProperties = {
  width: '100%', maxWidth: 480, background: 'var(--color-surface)',
  borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '80dvh', overflowY: 'auto',
}
const textareaStyle: CSSProperties = {
  width: '100%', padding: 12, fontSize: 14, lineHeight: 1.6,
  borderRadius: 'var(--radius-card)', border: `1px solid ${LINE}`,
  background: 'var(--color-bg)', resize: 'none',
}
