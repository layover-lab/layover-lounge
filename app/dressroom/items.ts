/* ══════════════════════════════════════════════════════════
   아이템 목록  —  드레스룸의 재료

   ⚠️ 지금 들어 있는 것은 전부 샘플입니다.
      그림은 회색 도형, 코드 이름은 임시입니다.
      9월 초에 실물 상품 코드로 통째로 교체됩니다.
      그때 바뀌는 건 이 파일과 그림 18장뿐이고,
      여러분이 짠 화면 코드는 한 줄도 안 바뀝니다.

   ⚠️ code 를 마음대로 만들지 마세요.
      이 값이 실물 상품 코드와 같은 값이고,
      "어떤 아이템을 몇 명이 입어봤나"를 세는 열쇠입니다.
      표기가 갈리면 집계가 갈리고, 그 숫자로 생산 수량을 정합니다.
      새 아이템이 필요하면 대표에게 물어보세요.
   ══════════════════════════════════════════════════════════ */

/** 역할 색 8종. 이름 변경 금지 (기획서 3.3) */
export type ColorName =
  | 'yellow'
  | 'red'
  | 'green'
  | 'blue'
  | 'orange'
  | 'lightblue'
  | 'purple'
  | 'pink';

/** 갈아입을 수 있는 아이템의 분류 */
export type Category = 'dress' | 'blouse' | 'head' | 'accessory';

export type Item = {
  /** 파일명과 같은 값. 소문자와 하이픈만 */
  code: string;
  category: Category;
  /** 겹치는 순서 (기획서 14.3). 숫자가 클수록 위 */
  z: number;
  /** 이 아이템이 담당하는 색. 없으면 null */
  colorKey: ColorName | null;
  nameKo: string;
  /** 비어 있으면 nameKo 를 씁니다 */
  nameJa: string;
  /** 비어 있으면 nameKo 를 씁니다 */
  nameEn: string;
};

/** 그림이 있는 곳. 파일명 = code + 확장자 */
export const ITEM_IMAGE_DIR = '/dressroom/items';

/** 지금은 플레이스홀더라 .svg, 진짜 그림이 오면 .webp 로 바뀝니다 */
export const ITEM_IMAGE_EXT = '.svg';

/** 카테고리 탭 이름 */
export const CATEGORIES: { key: Category; nameKo: string; nameJa: string; nameEn: string }[] = [
  { key: 'dress', nameKo: '드레스', nameJa: 'ドレス', nameEn: 'Dresses' },
  { key: 'blouse', nameKo: '블라우스', nameJa: 'ブラウス', nameEn: 'Blouses' },
  { key: 'head', nameKo: '헤드', nameJa: 'ヘッド', nameEn: 'Headwear' },
  { key: 'accessory', nameKo: '소품', nameJa: 'こもの', nameEn: 'Accessories' },
];

/* ──────────────────────────────────────────────────────────
   항상 깔리는 레이어 — 고를 수 없고, 언제나 그려집니다

   ★ pannier-standard 의 z 는 40 이고, 드레스(50)보다 아래입니다.
     로리타 실루엣은 파니에가 드레스를 부풀려서 나옵니다.
     순서를 바꾸면 실루엣이 죽습니다. 일반 아바타 게임과 다른 지점입니다.
     플레이스홀더는 파니에를 드레스보다 넓게 그려놨습니다 —
     순서가 틀리면 화면 모양이 눈에 띄게 달라져서 바로 알 수 있습니다.
   ────────────────────────────────────────────────────────── */
export const BASE_LAYERS: { code: string; z: number; nameKo: string }[] = [
  { code: 'body-01', z: 10, nameKo: '몸 · 얼굴' },
  { code: 'hair-a-back', z: 20, nameKo: '헤어 (뒤)' },
  { code: 'pannier-standard', z: 40, nameKo: '파니에' },
  { code: 'hair-a-front', z: 80, nameKo: '헤어 (앞)' },
];

/* ──────────────────────────────────────────────────────────
   갈아입는 아이템 14개
   ────────────────────────────────────────────────────────── */
export const ITEMS: Item[] = [
  // ── 블라우스 (z 30) — 드레스보다 아래
  { code: 'white-blouse-01',   category: 'blouse', z: 30, colorKey: null, nameKo: '화이트 블라우스',      nameJa: 'ホワイトブラウス', nameEn: 'White Blouse' },
  { code: 'frill-blouse-cream',category: 'blouse', z: 30, colorKey: null, nameKo: '프릴 블라우스 · 크림', nameJa: 'フリルブラウス・クリーム', nameEn: 'Frill Blouse · Cream' },

  // ── 드레스 (z 50) — 색은 드레스가 아니라 소품이 냅니다 (기획서 9.6)
  { code: 'rose-jsk-ivory',    category: 'dress',  z: 50, colorKey: null, nameKo: '로즈 JSK · 아이보리',  nameJa: 'ローズJSK・アイボリー', nameEn: 'Rose JSK · Ivory' },
  { code: 'rose-op-cream',     category: 'dress',  z: 50, colorKey: null, nameKo: '로즈 OP · 크림',       nameJa: 'ローズOP・クリーム', nameEn: 'Rose OP · Cream' },

  // ── 헤드웨어 (z 85)
  { code: 'rose-bonnet-ivory', category: 'head',   z: 85, colorKey: null, nameKo: '로즈 보닛 · 아이보리', nameJa: 'ローズボンネット・アイボリー', nameEn: 'Rose Bonnet · Ivory' },
  { code: 'katyusha-lace',     category: 'head',   z: 85, colorKey: null, nameKo: '레이스 카츄샤',        nameJa: 'レースカチューシャ', nameEn: 'Lace Headband' },

  // ── 소품 (z 90) — 8색을 하나씩 담당합니다
  //    캐릭터가 색을 고르면 그 색 소품이 먼저 보입니다.
  //    소품 착용 데이터가 곧 굿즈 신청 라인업이 됩니다.
  { code: 'lemon-charm',       category: 'accessory', z: 90, colorKey: 'yellow',    nameKo: '레몬 참',        nameJa: 'レモンチャーム', nameEn: 'Lemon Charm' },
  { code: 'cherry-brooch',     category: 'accessory', z: 90, colorKey: 'red',       nameKo: '체리 브로치',    nameJa: 'チェリーブローチ', nameEn: 'Cherry Brooch' },
  { code: 'clover-pin',        category: 'accessory', z: 90, colorKey: 'green',     nameKo: '클로버 핀',      nameJa: 'クローバーピン', nameEn: 'Clover Pin' },
  { code: 'bluebell-corsage',  category: 'accessory', z: 90, colorKey: 'blue',      nameKo: '블루벨 코사지',  nameJa: 'ブルーベルコサージュ', nameEn: 'Bluebell Corsage' },
  { code: 'apricot-ribbon',    category: 'accessory', z: 90, colorKey: 'orange',    nameKo: '살구 리본',      nameJa: 'アプリコットリボン', nameEn: 'Apricot Ribbon' },
  { code: 'soda-charm',        category: 'accessory', z: 90, colorKey: 'lightblue', nameKo: '소다 참',        nameJa: 'ソーダチャーム', nameEn: 'Soda Charm' },
  { code: 'lavender-ribbon',   category: 'accessory', z: 90, colorKey: 'purple',    nameKo: '라벤더 리본',    nameJa: 'ラベンダーリボン', nameEn: 'Lavender Ribbon' },
  { code: 'peach-bow',         category: 'accessory', z: 90, colorKey: 'pink',      nameKo: '피치 보우',      nameJa: 'ピーチリボン', nameEn: 'Peach Bow' },
];
