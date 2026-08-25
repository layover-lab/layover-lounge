'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { COLOR_KEYS, type ColorKey } from '@/lib/colors'
import { getClientId } from '@/lib/client-id'
import ko from '@/messages/ko.json'

const ME_KEY = 'layover.me'
const t = ko.entry

export default function LoungeEntry() {
  const router = useRouter()
  const [colorKey, setColorKey] = useState<ColorKey>('yellow')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [openRole, setOpenRole] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(ME_KEY)
    if (!saved) return
    const me = JSON.parse(saved)
    setColorKey(me.colorKey ?? 'yellow')
    setName(me.name ?? '')
    setRole(me.role ?? '')
    if (me.role) setOpenRole(true)
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
    <main style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>{t.title}</h1>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {COLOR_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setColorKey(key)}
            aria-label={ko.colors[key]}
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
        {t.roleToggle} {openRole ? '▴' : '▾'}
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

const toggleStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-sub)',
  fontSize: 13,
  padding: '12px 0',
  cursor: 'pointer',
}
