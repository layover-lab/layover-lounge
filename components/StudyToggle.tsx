'use client'

import type { CSSProperties } from 'react'
import { dict, type Mode } from '@/lib/i18n'
import { tab } from '@/lib/ui'

/* 한국어 모드에서는 띄우지 않습니다 — 이미 한국어라 켤 이유가 없습니다 */
export default function StudyToggle({
  lang, study, onToggle,
}: {
  lang: Mode
  study: boolean
  onToggle: () => void
}) {
  if (lang === 'ko') return null
  const t = dict(lang).common
  return (
    <button onClick={onToggle} aria-pressed={study} style={{ ...tab(study), ...extra }}>
      🇰🇷 {t.study}
    </button>
  )
}

const extra: CSSProperties = { fontSize: 12, padding: '7px 12px' }
