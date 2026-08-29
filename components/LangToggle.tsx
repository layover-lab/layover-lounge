'use client'

import type { CSSProperties } from 'react'
import { saveLang, type Lang } from '@/lib/i18n'

/* 언어를 눈에 보이게 고르는 버튼.

   학생 피드백 2026-08-29 (안녕하세연) —
   "오른쪽 위에 있는 JA KO의 차이를 모르겠습니다"

   「JA」·「KO」는 코드라서 뜻을 아는 사람만 읽습니다.
   각 언어를 그 언어로 적으면 설명 없이 읽힙니다 — 「한국어」라고 한글로 적혀 있으면
   누르면 한국어 화면이 된다는 게 그 자체로 보입니다.
   🌐 는 언어 전환의 만국 공통 기호라 「번역」이라는 오해도 막아줍니다.

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
      <span aria-hidden style={globe}>🌐</span>
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
          aria-label={l === 'ja' ? '日本語で表示' : '한국어로 보기'}
          style={btn(l === lang)}
        >
          {l === 'ja' ? '日本語' : '한국어'}
        </button>
      ))}
    </div>
  )
}

const globe: CSSProperties = { fontSize: 13, padding: '0 4px 0 7px', lineHeight: '26px' }

const wrap: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2,
  background: 'var(--color-surface)', border: '1px solid #F2E4E8',
  borderRadius: 'var(--radius-full)',
}

function btn(on: boolean): CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 'var(--radius-full)', border: 'none',
    background: on ? 'var(--color-primary)' : 'transparent',
    color: on ? 'var(--color-text)' : 'var(--color-text-sub)',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  }
}
