'use client'

import ko from '@/messages/ko.json'
import ja from '@/messages/ja.json'
import en from '@/messages/en.json'

/* ─────────────────────────────────────────────────────────
   기본 언어는 일본어입니다 — 방문자의 95%가 일본어 사용자입니다 (기획서 4.9).
   순서: ?lang= → 저장된 선택 → 브라우저 언어(ko 만 예외)

   ⚠️ 문구를 하나 추가할 때마다 **세 파일을 같이 고쳐야 합니다** (ko · ja · en).
      한쪽이 빠지면 그 자리만 다른 언어로 뜹니다. 키 이름은 세 파일이 동일해야 합니다.
   ───────────────────────────────────────────────────────── */

export type Lang = 'ja' | 'ko' | 'en'
export type Mode = Lang

const KEY = 'layover.lang'
const MODES: Mode[] = ['ja', 'ko', 'en']

export function pickLang(search?: string): Mode {
  if (typeof window === 'undefined') return 'ja'

  const m = /[?&]lang=(ja|ko|en)/.exec(search ?? window.location.search)
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

/** `<html lang>` 에 넣을 값. 안 맞추면 크롬이 번역을 겁니다 */
export function htmlLang(mode: Mode): Lang {
  return mode
}

export function dict(mode: Mode) {
  if (mode === 'ko') return ko
  if (mode === 'en') return en as typeof ko
  return ja as typeof ko
}
