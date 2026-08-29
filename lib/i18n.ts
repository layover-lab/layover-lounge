'use client'

import ko from '@/messages/ko.json'
import ja from '@/messages/ja.json'

/* 기본 언어는 일본어입니다 — 방문자의 95%가 일본어 사용자입니다 (기획서 4.9).
   순서: ?lang= → 저장된 선택 → 브라우저 언어(ko 만 예외) */

export type Lang = 'ja' | 'ko'

const KEY = 'layover.lang'

export function pickLang(search?: string): Lang {
  if (typeof window === 'undefined') return 'ja'

  const m = /[?&]lang=(ja|ko)/.exec(search ?? window.location.search)
  if (m) {
    try { localStorage.setItem(KEY, m[1]) } catch {}
    return m[1] as Lang
  }
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'ja' || saved === 'ko') return saved
  } catch {}

  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'ja'
}

export function saveLang(lang: Lang) {
  try { localStorage.setItem(KEY, lang) } catch {}
}

export function dict(lang: Lang) {
  return lang === 'ko' ? ko : ja
}
