'use client'

import { KEYS, readJson, writeJson } from '@/lib/storage'

/* 「나」 — 이름·색을 기억하는 한 칸.
   입장 화면 · 채팅방 · 응원방이 **같은 칸**을 씁니다. 한 번 정하면 다시 안 물어봅니다 */

export type Me = {
  clientId: string
  colorKey: string
  name: string
  role: string
  avatar: string
}

export function loadMe(): Me | null {
  return readJson<Me | null>(KEYS.me, null)
}

export function saveMe(me: Me) {
  writeJson(KEYS.me, me)
}
