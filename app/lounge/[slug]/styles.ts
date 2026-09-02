import type { CSSProperties } from 'react'
import { LINE } from '@/lib/ui'

/* -----------------------------------------------------------
   방 화면의 생김새만 모읍니다.

   page.tsx 가 850줄이 된 주된 이유가 이 상수 서른 개였습니다. 화면이 하는 일
   (입장·실시간·전송·물어보기)과 생김새는 같이 읽을 이유가 없습니다.

   ⚠️ 응원방·드레스룸과 **같은 것**을 쓰게 되면 lib/ui.ts 로 올리세요.
      이 파일은 「방 화면에서만 쓰는 것」 자리입니다.
   ----------------------------------------------------------- */

export const membersBtnStyle: CSSProperties = {
  flex: 'none', background: 'var(--color-surface)', border: '1px solid var(--color-line-strong)',
  borderRadius: 'var(--radius-full)', padding: '6px 12px',
  fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
}

export const memberListStyle: CSSProperties = {
  listStyle: 'none', margin: '12px 0 0', padding: '12px 0 0',
  borderTop: '1px solid var(--color-line-strong)',
  display: 'flex', flexDirection: 'column', gap: 8,
}

export const memberRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, fontSize: 14,
}

export const youTagStyle: CSSProperties = {
  fontSize: 11, padding: '1px 7px', borderRadius: 'var(--radius-full)',
  background: 'var(--color-primary)', color: 'var(--color-text)',
}

export const backStyle: CSSProperties = {
  background: 'none', border: 'none', padding: 0,
  fontSize: 12, color: 'var(--color-text-sub)', cursor: 'pointer',
}

export const bubbleStyle: CSSProperties = {
  display: 'inline-block', background: 'var(--color-surface)',
  border: '1px solid var(--color-line)', borderRadius: 'var(--radius-bubble)',
  padding: '10px 14px', fontSize: 15, maxWidth: '85%', whiteSpace: 'pre-wrap',
}

/* ── 백스테이지 ──────────────────────────────────
   무대는 깅엄·핑크, 백스테이지는 무지·회청색입니다 (기획서 5.4).
   색이 바뀌면 「지금 캐릭터가 아니라 나로 말하는 중」이 설명 없이 읽힙니다 */
export const BACKSTAGE_BG = 'var(--backstage-bg)'

/* 안 본 백스테이지 글이 있다는 표시. 숫자를 세지 않습니다 — 몇 개인지보다 있는지가 중요합니다 */
export const newDotStyle: CSSProperties = {
  display: 'inline-block', width: 6, height: 6, borderRadius: 999,
  background: 'var(--color-primary-strong)', marginLeft: 5, verticalAlign: 'middle',
}

/* 탭 줄 맨 오른쪽. 무대/백스테이지 알약과 같은 높이로 두되 **채우지 않습니다** —
   층을 고르는 탭과 같은 무게로 보이면 안 됩니다 */
export const askMineStyle: CSSProperties = {
  marginLeft: 'auto', flex: 'none', whiteSpace: 'nowrap',
  padding: '8px 12px', borderRadius: 'var(--radius-full)',
  border: `1px solid ${LINE}`, background: 'var(--color-surface)',
  color: 'var(--color-text-sub)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
}

/* 고를 문장 목록. 길어지면 카드가 화면을 다 먹어서 높이를 막습니다 */
export const pickListStyle: CSSProperties = {
  listStyle: 'none', margin: '0 0 12px', padding: 0,
  display: 'flex', flexDirection: 'column', gap: 6,
  maxHeight: 168, overflowY: 'auto',
}
export const pickTextStyle: CSSProperties = {
  flex: 1, textAlign: 'left', overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
export function pickRow(on: boolean, full: boolean): CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 11px', borderRadius: 10, cursor: full ? 'default' : 'pointer',
    border: `1px solid ${on ? 'var(--backstage-strong)' : 'var(--backstage-line-soft)'}`,
    background: on ? 'var(--backstage-tint)' : 'var(--color-surface)',
    color: 'var(--color-text)', fontSize: 13.5,
    opacity: full ? 0.45 : 1,
  }
}

/* 물어본 문장. 인용부호로 「내가 한 말」이 아니라 「내가 물어보는 대상」임을 보입니다 */
export const askQuoteStyle: CSSProperties = {
  display: 'block', fontSize: 15, marginBottom: 6,
}
export const askLineStyle: CSSProperties = {
  display: 'block', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-sub)',
}

/* 보내기 전 확인 카드 — 백스테이지 색(무지·회청)을 씁니다 */
export const askCardStyle: CSSProperties = {
  margin: '0 12px', padding: 14,
  background: 'var(--color-surface)', border: '1px solid var(--backstage-line)',
  borderRadius: 'var(--radius-card)',
}
export const askCancelStyle: CSSProperties = {
  flex: 'none', padding: '11px 16px', borderRadius: 'var(--radius-full)',
  border: '1px solid var(--backstage-line)', background: 'var(--color-surface)',
  color: 'var(--color-text-sub)', fontSize: 14, cursor: 'pointer',
}

export const moreStyle: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--color-text-sub)', fontSize: 15, lineHeight: 1, padding: '0 6px',
}
export const menuStyle: CSSProperties = {
  display: 'flex', gap: 6, marginTop: 6,
}
export const menuItemStyle: CSSProperties = {
  padding: '6px 12px', borderRadius: 'var(--radius-full)',
  border: `1px solid ${LINE}`, background: 'var(--color-surface)',
  color: 'var(--color-text)', fontSize: 12, cursor: 'pointer',
}
export const hiddenBarStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  padding: '8px 16px', background: 'var(--color-neutral)',
  fontSize: 12, color: 'var(--color-text-sub)',
}
export const noteStyle: CSSProperties = {
  margin: 0, padding: '8px 16px', background: 'var(--color-primary-tint)',
  fontSize: 12.5, color: 'var(--color-text)',
}

export const tabBarStyle: CSSProperties = {
  display: 'flex', gap: 6, padding: '10px 16px 0', background: 'var(--color-surface)',
}
export const backstageLeadStyle: CSSProperties = {
  margin: 0, padding: '8px 16px', background: BACKSTAGE_BG,
  fontSize: 12, color: 'var(--color-text-sub)',
}
export const tplCardStyle: CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--backstage-line)',
  borderRadius: 'var(--radius-card)', padding: 16, textAlign: 'center',
}
/* 두 층을 나란히. 용어(무대/백스테이지)는 **탭 라벨을 그대로** 씁니다 —
   같은 것을 두 이름으로 부르면 처음 온 사람이 다른 물건으로 봅니다 */
export const twoWayStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'auto 1fr',
  columnGap: 12, rowGap: 4, margin: '12px 0 14px',
  textAlign: 'left', fontSize: 13,
}
export const twoWayTermStyle: CSSProperties = {
  fontWeight: 700, whiteSpace: 'nowrap',
}
export const twoWayDescStyle: CSSProperties = {
  margin: 0, color: 'var(--color-text-sub)',
}

export const tplSendStyle: CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-full)',
  border: '1px solid var(--backstage-strong)', background: 'var(--backstage-tint)',
  color: 'var(--color-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}
export const backBubbleStyle: CSSProperties = {
  display: 'inline-block', background: 'var(--color-surface)',
  border: '1px solid var(--backstage-line)', borderRadius: 'var(--radius-bubble)',
  padding: '10px 14px', fontSize: 15, maxWidth: '85%', whiteSpace: 'pre-wrap',
}
export const myBackBubbleStyle: CSSProperties = {
  ...backBubbleStyle, background: 'var(--backstage-tint)', border: '1px solid var(--backstage-strong)',
}
export function bubbleFor(layer: 'stage' | 'backstage', mine: boolean): CSSProperties {
  if (layer === 'backstage') return mine ? myBackBubbleStyle : backBubbleStyle
  return mine ? myBubbleStyle : bubbleStyle
}

/* 내 말풍선 — 핑크 틴트. 글자는 --color-text 라 대비가 유지됩니다 */
export const myBubbleStyle: CSSProperties = {
  ...bubbleStyle,
  background: 'var(--color-primary-tint)',
  border: '1px solid var(--color-primary)',
}

/* 위를 읽는 사람을 끌어내리지 않습니다 — 내려갈지는 본인이 정합니다 (기획서 5.12 ③) */
export const newMsgStyle: CSSProperties = {
  position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)',
  padding: '8px 16px', borderRadius: 'var(--radius-full)',
  border: '1px solid var(--color-primary)', background: 'var(--color-surface)',
  color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
  boxShadow: '0 2px 8px rgba(43, 34, 38, .12)', cursor: 'pointer', whiteSpace: 'nowrap',
}

export const sendStyle: CSSProperties = {
  padding: '0 18px', borderRadius: 'var(--radius-full)', border: 'none',
  background: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer',
}
