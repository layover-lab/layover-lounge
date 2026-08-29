'use client'

import Script from 'next/script'
import { GA_ID } from '@/lib/analytics'

/* GA4 태그. qa 판정을 인라인 스크립트 안에서 먼저 합니다 —
   page_view 는 config 가 곧바로 쏘기 때문에 그 뒤에 정하면 늦습니다.
   (같은 규칙이 cutie-type 의 index.html 에도 있습니다) */
export default function Analytics() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){ dataLayer.push(arguments); }
        gtag('js', new Date());

        var isQA = false;
        try{
          var qa = /[?&]qa=([01])/.exec(location.search);
          if (qa) localStorage.setItem('layover.qa', qa[1]);
          isQA = localStorage.getItem('layover.qa') === '1';
        }catch(e){}

        gtag('config', '${GA_ID}', isQA ? { traffic_type: 'internal' } : {});
      `}</Script>
    </>
  )
}
