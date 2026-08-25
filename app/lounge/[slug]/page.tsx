'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ko from '@/messages/ko.json'

const ME_KEY = 'layover.me'
const t = ko.room

type Me = { clientId: string; colorKey: string; name: string; role: string; avatar: string }
type Msg = {
  id: string
  body: string
  client_msg_id: string | null
  created_at: string
  participants: { name: string; color_key: string; role: string | null } | null
}

const SELECT = 'id, body, client_msg_id, created_at, participants(name, color_key, role)'

export default function Stage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [room, setRoom] = useState<{ id: string; title: string; situation: string | null } | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function join() {
      const saved = localStorage.getItem(ME_KEY)
      if (!saved) {
        router.push('/lounge')
        return
      }
      const me: Me = JSON.parse(saved)

      const { data: r, error: roomError } = await supabase
        .from('rooms').select('id, title, situation').eq('slug', slug).single()
      if (roomError) {
        console.error('방 조회 실패:', roomError)
        return
      }
      if (!r || cancelled) return
      setRoom(r)

      const { data: existing } = await supabase
        .from('participants').select('id')
        .eq('room_id', r.id).eq('client_id', me.clientId).maybeSingle()

      let pid = existing?.id
      if (!pid) {
        const { data: created } = await supabase.from('participants').insert({
          room_id: r.id,
          client_id: me.clientId,
          name: me.name,
          role: me.role || null,
          color_key: me.colorKey,
          avatar: me.avatar,
        }).select('id').single()
        pid = created?.id
      }
      if (cancelled) return
      setParticipantId(pid ?? null)

      const { data: rows } = await supabase
        .from('messages').select(SELECT)
        .eq('room_id', r.id).eq('layer', 'stage')
        .order('created_at')
      if (cancelled) return
      setMessages((rows as unknown as Msg[]) ?? [])

      channel = supabase
        .channel('room:' + r.id + ':' + crypto.randomUUID())
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: 'room_id=eq.' + r.id },
          async (payload) => {
            const { data } = await supabase
              .from('messages').select(SELECT).eq('id', payload.new.id).single()
            if (!data) return
            const incoming = data as unknown as Msg
            setMessages((prev) =>
              prev.some((m) => m.client_msg_id && m.client_msg_id === incoming.client_msg_id)
                ? prev
                : [...prev, incoming]
            )
          }
        )
        .subscribe()
    }

    join()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [slug, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const body = text.trim()
    if (!body || !room || !participantId) return
    const clientMsgId = crypto.randomUUID()
    const me: Me = JSON.parse(localStorage.getItem(ME_KEY)!)
    setText('')

    setMessages((prev) => [
      ...prev,
      {
        id: clientMsgId,
        body,
        client_msg_id: clientMsgId,
        created_at: new Date().toISOString(),
        participants: { name: me.name, color_key: me.colorKey, role: me.role || null },
      },
    ])

    const { error } = await supabase.from('messages').insert({
      room_id: room.id,
      layer: 'stage',
      participant_id: participantId,
      body,
      client_msg_id: clientMsgId,
    })
    if (error) console.error('메시지 전송 실패:', error)
  }

  if (!room) return <main style={{ padding: 24 }}>...</main>

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#FDE3EE', padding: '14px 16px' }}>
        <button onClick={() => router.push('/lounge')} style={backStyle}>← {t.back}</button>
        <div style={{ fontWeight: 700 }}>{room.title}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-sub)', marginTop: 4 }}>
          📌 {room.situation}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--color-surface-sub)' }}>
        {messages.length === 0 && (
          <p style={{ color: 'var(--color-text-sub)', fontSize: 13, textAlign: 'center' }}>{t.empty}</p>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: 999,
                background: 'var(--role-' + (m.participants?.color_key ?? 'pink') + ')',
                marginRight: 6,
              }} />
              {m.participants?.role && (
                <span style={{ color: 'var(--color-text-sub)', marginRight: 4 }}>
                  {m.participants.role}
                </span>
              )}
              <strong>{m.participants?.name}</strong>
            </div>
            <div style={bubbleStyle}>{m.body}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 12, background: 'var(--color-surface)' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) send()
          }}
          placeholder={t.placeholder}
          maxLength={500}
          style={{ flex: 1, padding: 12, borderRadius: 'var(--radius-full)', border: '1px solid #F2E4E8' }}
        />
        <button onClick={send} style={sendStyle}>{t.send}</button>
      </div>
    </main>
  )
}

const backStyle: CSSProperties = {
  background: 'none', border: 'none', padding: 0, marginBottom: 6,
  fontSize: 12, color: 'var(--color-text-sub)', cursor: 'pointer',
}

const bubbleStyle: CSSProperties = {
  display: 'inline-block', background: 'var(--color-surface)',
  border: '1px solid #F2E4E8', borderRadius: 'var(--radius-bubble)',
  padding: '10px 14px', fontSize: 15, maxWidth: '85%', whiteSpace: 'pre-wrap',
}

const sendStyle: CSSProperties = {
  padding: '0 18px', borderRadius: 'var(--radius-full)', border: 'none',
  background: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer',
}
