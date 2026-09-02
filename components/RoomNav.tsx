'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { dict, type Mode } from '@/lib/i18n'
import { tab } from '@/lib/ui'

export type Room = 'lounge' | 'cheer' | 'dressroom'

/* ─────────────────────────────────────────────────────────
   화면 사이 이동

   셋이 서로 고립돼 있으면 만든 걸 아무도 못 찾습니다 — 드레스룸은
   주소를 직접 쳐야만 들어가는 상태였습니다.
   기획서 7장(잇기)은 10월이지만, 그때까지는 이 줄이 유일한 이동 수단입니다.

   드레스룸은 아직 드레스 두 벌에 임시 실루엣이라 「만드는 중」을 답니다.
   숨기는 것보다 낫습니다 — 만들고 있다는 게 보이면 다음에 다시 옵니다.
   ⚠️ 학생팀 결과물이 들어오면 `soon` 을 지우세요 (기획서 2.3 · 6장).

   ⚠️ 채팅방 안(`/lounge/[slug]`)에는 넣지 않습니다. 대화 중에 나가는 링크가
      보이면 몰입이 끊깁니다 — 거기는 뒤로 가기가 이미 있습니다.
   ───────────────────────────────────────────────────────── */
export default function RoomNav({ lang, here }: { lang: Mode; here: Room }) {
  const t = dict(lang).nav
  const all: { key: Room; href: string; label: string; soon?: boolean }[] = [
    { key: 'lounge', href: '/lounge', label: t.lounge },
    { key: 'cheer', href: '/cheer', label: t.cheer },
    { key: 'dressroom', href: '/dressroom', label: t.dressroom, soon: true },
  ]
  return (
    <nav style={wrap}>
      {all.filter((r) => r.key !== here).map((r) => (
        <Link key={r.key} href={r.href} style={{ ...tab(false), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {r.label}
          {r.soon && <span style={soonStyle}>{t.soon}</span>}
        </Link>
      ))}
    </nav>
  )
}

/* 알약 안의 작은 딱지. 회색으로 두면 「못 누르는 것」처럼 보여서
   눌러도 되는 색(핑크)으로 둡니다 — 들어갈 수는 있는 방입니다 */
const soonStyle: CSSProperties = {
  fontSize: 11, fontWeight: 600, lineHeight: 1,
  padding: '3px 6px', borderRadius: 'var(--radius-full)',
  background: 'var(--color-primary-tint)', color: 'var(--color-primary-strong)',
}

const wrap: CSSProperties = {
  display: 'flex', justifyContent: 'center', gap: 8,
  marginTop: 28, paddingTop: 18, borderTop: '1px solid #F7EDF1',
}
