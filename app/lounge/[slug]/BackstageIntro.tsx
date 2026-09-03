'use client'

import { useState } from 'react'
import type { dict } from '@/lib/i18n'
import { tplCardStyle, tplSendStyle, askCancelStyle, twoWayStyle, twoWayTermStyle, twoWayDescStyle, bsNoteStyle } from './styles'

type Room = ReturnType<typeof dict>['room']

/* -----------------------------------------------------------
   백스테이지가 비었을 때 뜨는 카드.

   빈 채팅창을 주지 않습니다 (5.4). 다만 **설명이 먼저입니다** —
   「답장은 어느 정도 간격으로?」는 이미 멤놀을 해본 사람의 질문입니다.
   처음 온 사람은 백스테이지가 뭔지도 모르는 채로 낯선 사람들에게
   약속 세 개를 던지게 됩니다.

   그렇다고 템플릿을 없애지는 않습니다 — 설명은 읽고 끝나지만 템플릿은
   행동을 만듭니다. 버튼 뒤로 한 칸 물립니다.
   ----------------------------------------------------------- */
export default function BackstageIntro({ t, onSend }: { t: Room; onSend: (body: string) => void }) {
  const [showTpl, setShowTpl] = useState(false)

  if (showTpl) {
    return (
      <div style={tplCardStyle}>
        <b style={{ fontSize: 14 }}>{t.tplTitle}</b>
        <ul style={{ margin: '10px 0 14px', padding: 0, listStyle: 'none', fontSize: 13, lineHeight: 1.9 }}>
          <li>· {t.tplQ1}</li>
          <li>· {t.tplQ2}</li>
          <li>· {t.tplQ3}</li>
        </ul>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onSend([t.tplTitle, '· ' + t.tplQ1, '· ' + t.tplQ2, '· ' + t.tplQ3].join('\n'))}
            style={{ ...tplSendStyle, flex: 1 }}
          >
            {t.tplSend}
          </button>
          <button onClick={() => setShowTpl(false)} style={askCancelStyle}>{t.askCancel}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={tplCardStyle}>
      <b style={{ fontSize: 14 }}>{t.bsTitle}</b>

      {/* 무대와 백스테이지를 **나란히** 놓습니다. 이게 이 제품의 개념 전체이고
          (3.1 — 언제든 나로 돌아올 수 있다), 대비로 보여주는 게 제일 빨리 읽힙니다 */}
      <dl style={twoWayStyle}>
        <dt style={twoWayTermStyle}>🎭 {t.tabStage}</dt>
        <dd style={twoWayDescStyle}>{t.bsStageDesc}</dd>
        <dt style={twoWayTermStyle}>☕ {t.tabBackstage}</dt>
        <dd style={twoWayDescStyle}>{t.bsBackDesc}</dd>
      </dl>

      <ul style={{ margin: '0 0 14px', padding: 0, listStyle: 'none', fontSize: 13, lineHeight: 1.9, textAlign: 'left' }}>
        {/* 세 번째가 새로 필요합니다 — 물어보기가 여기로 온다는 걸 아무도 모릅니다 */}
        <li>· {t.bsUse1}</li>
        <li>· {t.bsUse2}</li>
        <li>· {t.bsUse3}</li>
      </ul>

      {/* 만든 사람이 하는 말입니다. 제품 설명과 **다르게 보여야** 합니다 —
          목록은 「언제 쓰나」이고 이건 「누가 왜 만들었나」라 성격이 다릅니다.
          그리고 이 한 줄이 「서로 봐준다」의 상대가 누구인지를 답합니다 */}
      <p style={bsNoteStyle}>{t.bsNote}</p>

      <button onClick={() => setShowTpl(true)} style={tplSendStyle}>{t.bsPlan}</button>
    </div>
  )
}
