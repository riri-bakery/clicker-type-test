// 공개 화면의 문구·링크·메타데이터는 이 파일에서만 수정합니다.
// 비어 있는 URL과 SDK 설정은 화면에 노출되지 않습니다.
export const brandConfig = Object.freeze({
  serviceName: "캐릭터 클릭 타입 테스트",
  legacyName: "",
  brandName: "꾹꾹이 쿠키 클리커",
  inventoryOwner: "리리 베이커리",
  headline: "내 캐릭터를 손끝으로 표현하면 어떤 느낌일까?",
  introTitle: "내 캐릭터는 어떤 클릭 타입일까?",
  description: "캐릭터의 성격과 분위기를 바탕으로 어울리는 소리와 손끝 감각을 찾아보세요.",
  introDescription: "차분하게 눌리는 타입일까, 통통 튀는 타입일까? 캐릭터의 성격과 분위기를 바탕으로 어울리는 소리와 손끝 감각을 찾아보세요.",
  brandNote: "꾹꾹이 쿠키 클리커의 실제 캐릭터 스위치 매칭 방식을 바탕으로 만든 테스트입니다.",
  privacyNotice: "입력한 이름과 답변은 현재 브라우저에서만 처리됩니다.",
  resultDisclaimer: "이 결과는 리리 베이커리가 현재 보유한 37개 스위치 안에서 추천합니다. 스위치 속성과 캐릭터 해석의 연결은 리리 베이커리의 주관적인 판단이며, 실제 제작 전에는 재고와 직접 확인한 키감을 함께 고려해 주세요.",
  productTitle: "이 클릭감을 실제 쿠키 클리커로 만들어보세요",
  productDescription: "꾹꾹이 쿠키 클리커는 캐릭터의 모습으로 만든 쿠키 안에 스위치를 넣어, 캐릭터에게 어울리는 소리와 키감을 손끝으로 즐기는 커스텀 클리커입니다.",
  productFeatures: [
    "캐릭터 외형을 쿠키로 제작",
    "설정과 분위기에 맞는 스위치 선정",
    "직접 눌러 소리와 키감 감상"
  ],
  urls: {
    productUrl: "",
    processUrl: "",
    scheduleUrl: "",
    applicationUrl: "",
    socialUrl: ""
  },
  assets: {
    productIntroImage: "./public/assets/product-intro.webp",
    productClickVideo: "./public/assets/product-click.mp4",
    representativeImage: "",
    favicon: ""
  },
  share: {
    text: "내 캐릭터는 어떤 클릭 타입일까? 캐릭터에게 어울리는 소리와 손끝 감각을 찾아보세요.",
    xEnabled: true,
    kakaoJavascriptKey: "",
    kakaoShareTemplateId: ""
  },
  meta: {
    pageTitle: "캐릭터 클릭 타입 테스트 by 꾹꾹이 쿠키 클리커",
    pageDescription: "내 캐릭터는 어떤 스위치가 어울릴까? 캐릭터의 성격과 분위기를 바탕으로 어울리는 소리와 촉감을 찾아보세요.",
    ogTitle: "내 캐릭터는 어떤 스위치가 어울릴까?",
    ogDescription: "캐릭터의 설정을 바탕으로 어울리는 소리와 키감을 찾아보세요.",
    twitterCard: "summary"
  }
});

export const termHelp = Object.freeze({
  "작동압": "처음 누를 때 느껴지는 무게",
  "바닥압": "끝까지 눌렀을 때 느껴지는 무게",
  "리니어": "누르는 동안 큰 걸림 없이 부드럽게 내려가는 타입",
  "택타일": "누르는 도중 손끝에 걸림이 느껴지는 타입",
  "클릭키": "손끝의 걸림과 함께 또렷한 클릭음이 나는 타입",
  "저소음": "소리를 줄이도록 설계된 타입"
});

// all 조건을 모두 만족하는 첫 규칙을 사용합니다. contrastMagnitude는 Q1·Q11 변화량입니다.
export const resultTypeRules = Object.freeze([
  {
    id: "quiet-firm",
    all: { quiet: { min: 70 }, tactile: { min: 65 }, weight: { min: 50 } },
    title: "고요한 단단함",
    description: "조용한 첫인상 안에 쉽게 꺾이지 않는 기준이 있는 타입"
  },
  {
    id: "warm-contrast",
    all: { quiet: { min: 60 }, warmth: { min: 65 }, contrastMagnitude: { min: 22 } },
    title: "포근한 반전형",
    description: "차분한 겉모습 뒤에서 따뜻하고 선명한 면이 드러나는 타입"
  },
  {
    id: "soft-warm",
    all: { warmth: { min: 72 }, smoothness: { min: 75 }, tactile: { max: 42 } },
    title: "말랑한 다정함",
    description: "가까이 다가갈수록 부드럽고 따뜻한 결이 느껴지는 타입"
  },
  {
    id: "cold-precise",
    all: { warmth: { max: 35 }, clarity: { min: 75 }, smoothness: { max: 55 } },
    title: "차가운 정밀함",
    description: "서늘한 인상과 군더더기 없는 판단이 또렷하게 남는 타입"
  },
  {
    id: "bright-fast",
    all: { speed: { min: 78 }, clarity: { min: 75 }, presence: { min: 65 } },
    title: "맑고 빠른 직진형",
    description: "반응이 빠르고 마음의 방향이 선명하게 전해지는 타입"
  },
  {
    id: "heavy-guardian",
    all: { weight: { min: 76 }, presence: { min: 55 }, speed: { max: 58 } },
    title: "묵직한 보호자형",
    description: "쉽게 흔들리지 않는 무게로 주변을 단단하게 받치는 타입"
  },
  {
    id: "quiet-center",
    all: { quiet: { min: 72 }, presence: { min: 38, max: 68 }, weight: { min: 45 } },
    title: "고요한 중심형",
    description: "앞에 나서지 않아도 자기 자리를 꾸준히 지키는 타입"
  },
  {
    id: "bright-click",
    all: { quiet: { max: 35 }, speed: { min: 68 }, presence: { min: 75 } },
    title: "밝고 통통 튀는 클릭형",
    description: "경쾌한 반응과 생생한 존재감으로 분위기를 움직이는 타입"
  }
]);
