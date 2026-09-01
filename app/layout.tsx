import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/components/Analytics";

/* 웹폰트를 쓰지 않습니다.
   create-next-app 이 넣어준 Geist 두 벌을 매 방문마다 받고 있었는데, 정작 본문 글꼴은
   globals.css 의 `system-ui` 였습니다 — 받아만 놓고 한 글자도 안 쓰던 셈입니다.

   다시 넣을 생각이라면 그 전에 이걸 보세요: 방문자의 95%가 일본어 사용자인데(기획서 4.9)
   Geist 에는 가나·한자가 없습니다. 결국 일본어 화면은 기기 기본 글꼴로 떨어지고,
   글꼴 파일만 두 개 더 받게 됩니다. 기기 기본 고딕(ヒラギノ·游ゴシック)이 제일 잘 읽힙니다. */

export const metadata: Metadata = {
  title: "Layover",
  description: "日常と恋愛ファンタジーのあいだ、立ち寄る可愛い遊び場",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
