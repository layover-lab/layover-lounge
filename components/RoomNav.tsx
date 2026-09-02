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

   딱지는 방마다 다릅니다. **둘을 같은 말로 부르지 마세요** —
   드레스룸은 아직 드레스 두 벌에 임시 실루엣이라 못 쓰는 상태(「만드는 중」)이고,
   멤놀방은 들어가서 놀 수 있는데 사람이 적을 뿐인 상태(「가오픈」)입니다.
   같은 딱지를 붙이면 멤놀방을 못 들어가는 곳으로 읽습니다.

   숨기는 것보다 낫습니다 — 만들고 있다는 게 보이면 다음에 다시 옵니다.
   ⚠️ 학생팀 결과물이 들어오면 드레스룸 딱지를, 9월 정식 오픈에 멤놀방 딱지를
      지우세요 (기획서 2.3 · 6장).

   ⚠️ 채팅방 안(`/lounge/[slug]`)에는 넣지 않습니다. 대화 중에 나가는 링크가
      보이면 몰입이 끊깁니다 — 거기는 뒤로 가기가 이미 있습니다.
   ───────────────────────────────────────────────────────── */
export default function RoomNav({ lang, here }: { lang: Mode; here: Room }) {
  const t = dict(lang).nav
  const all: { key: Room; href: string; label: string; badge?: string }[] = [
    { key: 'lounge', href: '/lounge', label: t.lounge, badge: t.preview },
    { key: 'cheer', href: '/cheer', label: t.cheer },
    { key: 'dressroom', href: '/dressroom', label: t.dressroom, badge: t.soon },
  ]
  return (
    <nav style={wrap}>
      {all.filter((r) => r.key !== here).map((r) => (
        <Link key={r.key} href={r.href} style={{ ...tab(false), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {r.label}
          {r.badge && <span style={badgeStyle}>{r.badge}</span>}
        </Link>
      ))}
    </nav>
  )
}

/* 알약 안의 작은 딱지. 회색으로 두면 「못 누르는 것」처럼 보여서
   눌러도 되는 색(핑크)으로 둡니다 — 들어갈 수는 있는 방입니다 */
const badgeStyle: CSSProperties = {
  fontSize: 11, fontWeight: 600, lineHeight: 1,
  padding: '3px 6px', borderRadius: 'var(--radius-full)',
  background: 'var(--color-primary-tint)', color: 'var(--color-primary-strong)',
}

const wrap: CSSProperties = {
  display: 'flex', justifyContent: 'center', gap: 8,
  marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--color-line-soft)',
}
