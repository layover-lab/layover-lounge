'use client'

import type { dict } from '@/lib/i18n'
import { askCardStyle, askCancelStyle, tplSendStyle, pickListStyle, pickTextStyle, pickRow } from './styles'

type Room = ReturnType<typeof dict>['room']
type Line = { id: string; body: string }

/* -----------------------------------------------------------
   물어볼 문장 고르기.

   ⚠️ max 를 늘리지 마세요. 다섯 개를 한꺼번에 던지면 답하는 사람이 숙제를
      받습니다 — 자원봉사자는 미루고, 미루면 답이 안 옵니다. 이 방은 묻는
      비용만큼 **답하는 비용**이 중요합니다.
   ----------------------------------------------------------- */
export default function AskPicker({
  t, lines, picked, max, onToggle, onSend, onClose,
}: {
  t: Room
  lines: Line[]
  picked: string[]
  max: number
  onToggle: (id: string) => void
  onSend: () => void
  onClose: () => void
}) {
  return (
    <div style={askCardStyle}>
      <div style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 13.5 }}>{t.askPickTitle}</b>
        <span style={{ fontSize: 12, color: 'var(--color-text-sub)', marginLeft: 6 }}>
          {t.askPickMax}
        </span>
      </div>

      <ul style={pickListStyle}>
        {lines.map((m) => {
          const on = picked.includes(m.id)
          /* 다 찼을 때 안 고른 줄은 눌러도 안 되는 게 보여야 합니다 */
          const full = !on && picked.length >= max
          return (
            <li key={m.id}>
              <button onClick={() => onToggle(m.id)} aria-pressed={on} style={pickRow(on, full)}>
                <span style={{ flex: 'none' }}>{on ? '☑' : '☐'}</span>
                <span style={pickTextStyle}>{m.body}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSend}
          disabled={picked.length === 0}
          style={{ ...tplSendStyle, flex: 1, opacity: picked.length ? 1 : 0.45 }}
        >{t.askSend}</button>
        <button onClick={onClose} style={askCancelStyle}>{t.askClose}</button>
      </div>
    </div>
  )
}
