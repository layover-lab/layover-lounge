'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { dict, type Lang } from '@/lib/i18n'

export type Room = 'lounge' | 'cheer' | 'dressroom'

/* ─────────────────────────────────────────────────────────
   화면 사이 이동

   셋이 서로 고립돼 있으면 만든 걸 아무도 못 찾습니다 — 드레스룸은
   주소를 직접 쳐야만 들어가는 상태였습니다.
   기획서 7장(잇기)은 10월이지만, 그때까지는 이 줄이 유일한 이동 수단입니다.

   ⚠️ 채팅방 안(`/lounge/[slug]`)에는 넣지 않습니다. 대화 중에 나가는 링크가
      보이면 몰입이 끊깁니다 — 거기는 뒤로 가기가 이미 있습니다.
   ───────────────────────────────────────────────────────── */
export default function RoomNav({ lang, here }: { lang: Lang; here: Room }) {
  const t = dict(lang).nav
  const all: { key: Room; href: string; label: string }[] = [
    { key: 'lounge', href: '/lounge', label: t.lounge },
    { key: 'cheer', href: '/cheer', label: t.cheer },
    { key: 'dressroom', href: '/dressroom', label: t.dressroom },
  ]
  return (
    <nav style={wrap}>
      {all.filter((r) => r.key !== here).map((r) => (
        <Link key={r.key} href={r.href} style={pill}>{r.label}</Link>
      ))}
    </nav>
  )
}

const wrap: CSSProperties = {
  display: 'flex', justifyContent: 'center', gap: 8,
  marginTop: 28, paddingTop: 18, borderTop: '1px solid #F7EDF1',
}
const pill: CSSProperties = {
  padding: '9px 16px', borderRadius: 'var(--radius-full)',
  background: 'var(--color-surface)', border: '1px solid #F2E4E8',
  color: 'var(--color-text)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
}
