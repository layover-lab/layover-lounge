import type { CSSProperties } from 'react'

/* ─────────────────────────────────────────────────────────
   화면 공통 조각

   값은 **응원방(/cheer) 기준**입니다. 화면마다 같은 이름으로 조금씩 다른
   값을 두면 나중에 어느 쪽이 맞는지 아무도 모르게 됩니다.

   ⚠️ 색은 선·점·테두리에만. 넓은 면을 칠하지 않습니다 (기획서 17장)
   ⚠️ 특정 화면에서만 쓰는 조각은 여기 올리지 말고 그 파일에 두세요.
   ───────────────────────────────────────────────────────── */

/** 카드·입력칸 테두리 */
export const LINE = '#F2E4E8'

export const wrap: CSSProperties = {
  width: '100%', maxWidth: 480, margin: '0 auto', padding: '28px 18px 60px',
}

export const box: CSSProperties = {
  background: 'var(--color-surface)', border: `1px solid ${LINE}`,
  borderRadius: 'var(--radius-card)', padding: 18,
}

/* 두 버튼은 글꼴·크기·높이를 같게 두고, 위계는 채움 여부로만 만듭니다 */
const ctaBase: CSSProperties = {
  display: 'block', padding: '14px 18px', borderRadius: 'var(--radius-full)',
  color: 'var(--color-text)', fontSize: 16, fontWeight: 700,
  textDecoration: 'none', textAlign: 'center', cursor: 'pointer',
}

export const ctaBtn: CSSProperties = {
  ...ctaBase,
  background: 'var(--color-primary)', border: '1.5px solid var(--color-primary)',
}

/* 회색 글씨로 두면 「지금 못 누르는 버튼」처럼 보입니다 — 테두리만 남깁니다.
   위아래로 쌓을 때는 부르는 쪽에서 marginTop 을 줍니다 */
export const ctaGhost: CSSProperties = {
  ...ctaBase,
  background: 'var(--color-surface)', border: '1.5px solid var(--color-primary)',
}

/** 밑줄 텍스트 버튼 — 주 버튼과 경쟁하면 안 되는 자리 */
export const linkBtn: CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontSize: 12, color: 'var(--color-text-sub)', textDecoration: 'underline',
}

/** 역할 색 점 */
export function dot(k?: string): CSSProperties {
  return {
    display: 'inline-block', width: 9, height: 9, borderRadius: 999,
    background: `var(--role-${k ?? 'pink'})`,
  }
}

/** 알약형 탭 — 카테고리·층·화면 이동에 공통으로 씁니다 */
export function tab(on: boolean): CSSProperties {
  return {
    flex: 'none', whiteSpace: 'nowrap',
    padding: '8px 14px', borderRadius: 'var(--radius-full)',
    border: on ? '1px solid var(--color-text)' : `1px solid ${LINE}`,
    background: on ? 'var(--color-primary)' : 'var(--color-surface)',
    color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
    textDecoration: 'none', cursor: 'pointer',
  }
}
