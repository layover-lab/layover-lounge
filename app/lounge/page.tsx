'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { COLOR_KEYS, type ColorKey } from '@/lib/colors'
import { getClientId } from '@/lib/client-id'
import { dict, field } from '@/lib/i18n'
import { useLang } from '@/lib/use-lang'
import { loadMe, saveMe } from '@/lib/me'
import { KEYS, writeText } from '@/lib/storage'
import LangToggle from '@/components/LangToggle'
import RoomNav from '@/components/RoomNav'
import { LINE } from '@/lib/ui'

/* 상황 하나 = 게이트 여러 개. 목록에는 1번 게이트만 뜹니다 */
type Situation = {
  situation_key: string
  title: string; title_ja: string | null; title_en: string | null
  situation: string | null; situation_ja: string | null; situation_en: string | null
}

export default function LoungeEntry() {
  const router = useRouter()
  const [colorKey, setColorKey] = useState<ColorKey>('yellow')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [openRole, setOpenRole] = useState(false)

  /* 상황 목록 — 운영자가 정한 것만 보여줍니다. 사용자가 방을 만들지 않습니다 (기획서 3.6).
     같은 상황의 게이트가 여러 개라도 목록에는 1번 게이트 한 줄만 나옵니다 */
  const [situations, setSituations] = useState<Situation[]>([])
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [lang, setLang] = useLang()
  const t = dict(lang).entry
  const colorNames = dict(lang).colors as Record<string, string>

  useEffect(() => {
    const me = loadMe()
    if (me) {
      setColorKey((me.colorKey as ColorKey) ?? 'yellow')
      setName(me.name ?? '')
      setRole(me.role ?? '')
      if (me.role) setOpenRole(true)
    }

    /* 테스트에서 넘어오는 다리 (기획서 4.16) — 넘어오는 건 색 하나뿐입니다.
       ⚠️ 이름은 넘어오지 않습니다. 도착 화면에 「○○ 타입이시군요!」가 뜨면
          3.5 의 경계가 무너집니다. 색만 미리 골라둡니다. */
    const c = /[?&]c=([a-z]+)/.exec(window.location.search)?.[1]
    if (c && (COLOR_KEYS as readonly string[]).includes(c)) setColorKey(c as ColorKey)

    /* 어느 테스트가 사람을 보냈나. events 테이블은 10월이라 지금은 들고만 있습니다 */
    const from = /[?&]from=([a-z0-9-]+)/.exec(window.location.search)?.[1]
    if (from) {
      writeText(KEYS.from, from)
    }

    supabase
      .from('rooms')
      .select('situation_key, title, title_ja, title_en, situation, situation_ja, situation_en')
      .eq('world', 'idol').eq('gate_no', 1).eq('is_official', true)
      .order('situation_key')
      .then(({ data }) => setSituations((data as Situation[]) ?? []))
  }, [])

  async function start(situationKey: string) {
    if (!name.trim()) { setNote(t.needName); return }
    setNote('')
    setBusy(situationKey)

    saveMe({
      clientId: getClientId(),
      colorKey,
      name: name.trim(),
      role: role.trim(),
      avatar: 'preset-01',
    })

    /* 방을 고르는 게 아니라 **상황**을 고릅니다. 자리 있는 게이트를 서버가 찾아주고,
       다 찼으면 다음 게이트를 엽니다 (기획서 3.7) */
    const { data: slug, error } = await supabase.rpc('join_gate', {
      p_situation: situationKey,
      p_client_id: getClientId(),
      p_name: name.trim(),
      p_color_key: colorKey,
      p_role: role.trim() || null,
    })
    if (error || !slug) {
      console.error('게이트 배정 실패:', error)
      setBusy('')
      return
    }
    router.push('/lounge/' + slug)
  }

  return (
    <main style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: 24 }}>
      {/* 언어 버튼 — 제목 위 한 줄. 떠 있으면 모바일에서 제목을 덮습니다 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <LangToggle lang={lang} onChange={setLang} />
      </div>


      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>{t.title}</h1>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {COLOR_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setColorKey(key)}
            aria-label={colorNames[key]}
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-full)',
              background: `var(--role-${key})`,
              border:
                colorKey === key
                  ? '3px solid var(--color-text)'
                  : '3px solid transparent',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <label style={{ fontSize: 13, color: 'var(--color-text-sub)' }}>
        {t.nameLabel}
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.namePlaceholder}
        maxLength={12}
        style={inputStyle}
      />

      <button onClick={() => setOpenRole(!openRole)} style={toggleStyle}>
        {t.roleToggle}
        <span style={{ fontSize: 17, lineHeight: 1 }}>{openRole ? '▴' : '▾'}</span>
      </button>

      {openRole && (
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder={t.rolePlaceholder}
          maxLength={12}
          style={inputStyle}
        />
      )}

      <p style={{ fontSize: 12, color: 'var(--color-text-sub)', margin: '16px 0' }}>
        {t.realPersonWarning}
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 10px' }}>{t.situations}</h2>
      {note && <p style={{ fontSize: 12.5, color: 'var(--color-primary-strong)', margin: '0 0 10px' }}>{note}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {situations.map((s) => (
          <button key={s.situation_key} onClick={() => start(s.situation_key)}
                  disabled={!!busy} style={cardStyle}>
            <b style={{ fontSize: 15 }}>{field(s, 'title', lang)}</b>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-sub)' }}>
              {busy === s.situation_key ? t.joining : field(s, 'situation', lang)}
            </span>
          </button>
        ))}
      </div>

      <RoomNav lang={lang} here="lounge" />
    </main>
  )
}

const cardStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left',
  padding: '14px 16px', borderRadius: 'var(--radius-card)',
  background: 'var(--color-surface)', border: `1px solid ${LINE}`,
  color: 'var(--color-text)', cursor: 'pointer',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: 12,
  fontSize: 15,
  borderRadius: 'var(--radius-card)',
  border: '1px solid #F2E4E8',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  marginTop: 6,
}

/* 학생 피드백 2026-08-28 — "이 버튼이 눌러질 수 있는건지 처음에 잘 몰랐습니다 (모바일)"
   테두리를 주고 화살표를 키워서 누를 수 있게 생기게 했습니다 */
const toggleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 10,
  background: 'var(--color-surface)',
  border: '1px solid var(--color-primary)',
  borderRadius: 'var(--radius-full)',
  color: 'var(--color-text)',
  fontSize: 14,
  fontWeight: 500,
  padding: '10px 16px',
  cursor: 'pointer',
}
