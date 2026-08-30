'use client'

import ko from '@/messages/ko.json'
import ja from '@/messages/ja.json'

/* ─────────────────────────────────────────────────────────
   기본 언어는 일본어입니다 — 방문자의 95%가 일본어 사용자입니다 (기획서 4.9).
   순서: ?lang= → 저장된 선택 → 브라우저 언어(ko 만 예외)

   세 번째 모드 **`study`** 가 있습니다 (기획서 15.9 — 한국어 공부 모드).
   주 타깃이 「한국어를 배우는 일본인」이라, 두 언어를 같이 보여주는 건
   번역 기능이 아니라 제품 차별점입니다.
   ───────────────────────────────────────────────────────── */

export type Lang = 'ja' | 'ko'
export type Mode = Lang | 'study'

const KEY = 'layover.lang'
const MODES: Mode[] = ['ja', 'ko', 'study']

export function pickLang(search?: string): Mode {
  if (typeof window === 'undefined') return 'ja'

  const m = /[?&]lang=(ja|ko|study)/.exec(search ?? window.location.search)
  if (m) {
    try { localStorage.setItem(KEY, m[1]) } catch {}
    return m[1] as Mode
  }
  try {
    const saved = localStorage.getItem(KEY) as Mode | null
    if (saved && MODES.includes(saved)) return saved
  } catch {}

  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'ja'
}

export function saveLang(mode: Mode) {
  try { localStorage.setItem(KEY, mode) } catch {}
}

/** `<html lang>` 에 넣을 실제 언어. 공부 모드의 본문은 한국어 기준입니다 */
export function htmlLang(mode: Mode): Lang {
  return mode === 'ja' ? 'ja' : 'ko'
}

/* 공부 모드 사전 — 한국어 뒤에 일본어를 붙입니다.
   ⚠️ 줄바꿈이 아니라 가운뎃점입니다. 버튼·입력칸 placeholder 에도 같은 문자열이
      들어가는데, 거기서는 줄바꿈이 안 보이고 높이만 망가집니다. */
function merge(k: unknown, j: unknown): unknown {
  if (typeof k === 'string') {
    const other = typeof j === 'string' ? j : ''
    return other && other !== k ? `${k} · ${other}` : k
  }
  if (k && typeof k === 'object') {
    const out: Record<string, unknown> = {}
    const src = k as Record<string, unknown>
    const alt = (j ?? {}) as Record<string, unknown>
    for (const key of Object.keys(src)) out[key] = merge(src[key], alt[key])
    return out
  }
  return k
}

const study = merge(ko, ja) as typeof ko

export function dict(mode: Mode) {
  if (mode === 'ko') return ko
  if (mode === 'study') return study
  return ja as typeof ko
}
