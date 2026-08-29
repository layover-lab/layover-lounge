'use client'

import type { CSSProperties } from 'react'
import { saveLang, type Lang } from '@/lib/i18n'

/* 언어를 눈에 보이게 고르는 버튼.
   이게 없으면 URL(?lang=)이나 브라우저 설정으로만 정해져서
   "어쩔 땐 한글, 어쩔 땐 일본어"로 보입니다.

   자리는 부모가 정합니다 — 채팅방은 헤더 안, 나머지는 화면 오른쪽 위. */
export default function LangToggle({
  lang,
  onChange,
}: {
  lang: Lang
  onChange: (l: Lang) => void
}) {
  return (
    <div style={wrap}>
      {(['ja', 'ko'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            saveLang(l)
            document.documentElement.lang = l   /* 안 맞추면 크롬이 번역을 겁니다 */
            onChange(l)
          }}
          aria-pressed={l === lang}
          style={btn(l === lang)}
        >
          {l === 'ja' ? 'JA' : 'KO'}
        </button>
      ))}
    </div>
  )
}

const wrap: CSSProperties = {
  display: 'inline-flex', gap: 2, padding: 2,
  background: 'var(--color-surface)', border: '1px solid #F2E4E8',
  borderRadius: 'var(--radius-full)',
}

function btn(on: boolean): CSSProperties {
  return {
    padding: '5px 11px', borderRadius: 'var(--radius-full)', border: 'none',
    background: on ? 'var(--color-primary)' : 'transparent',
    color: on ? 'var(--color-text)' : 'var(--color-text-sub)',
    fontSize: 12, fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer',
  }
}
