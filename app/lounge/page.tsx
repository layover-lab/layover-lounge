'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { COLOR_KEYS, type ColorKey } from '@/lib/colors'
import { getClientId } from '@/lib/client-id'
import { pickLang, dict, type Lang } from '@/lib/i18n'
import LangToggle from '@/components/LangToggle'

const ME_KEY = 'layover.me'

export default function LoungeEntry() {
  const router = useRouter()
  const [colorKey, setColorKey] = useState<ColorKey>('yellow')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [openRole, setOpenRole] = useState(false)
  const [lang, setLang] = useState<Lang>('ja')
  const t = dict(lang).entry
  const colorNames = dict(lang).colors as Record<string, string>

  useEffect(() => {
    const picked = pickLang()
    setLang(picked)
    document.documentElement.lang = picked   /* 안 맞추면 크롬이 번역을 걸어 글자가 뭉갭니다 */

    const saved = localStorage.getItem(ME_KEY)
    if (saved) {
      const me = JSON.parse(saved)
      setColorKey(me.colorKey ?? 'yellow')
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
      try { localStorage.setItem('layover.from', from) } catch {}
    }
  }, [])

  function start() {
    if (!name.trim()) return
    localStorage.setItem(
      ME_KEY,
      JSON.stringify({
        clientId: getClientId(),
        colorKey,
        name: name.trim(),
        role: role.trim(),
        avatar: 'preset-01',
      })
    )
    router.push('/lounge/japan-trip')
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

      <button
        onClick={start}
        disabled={!name.trim()}
        style={{
          width: '100%',
          padding: 14,
          borderRadius: 'var(--radius-full)',
          border: 'none',
          background: name.trim() ? 'var(--color-primary)' : 'var(--color-neutral)',
          color: 'var(--color-text)',
          fontSize: 15,
          fontWeight: 600,
          cursor: name.trim() ? 'pointer' : 'default',
        }}
      >
        {t.submit}
      </button>
    </main>
  )
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
