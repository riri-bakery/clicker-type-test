export const AXES = [
  { id: "quiet", label: "조용함", low: "소리가 큼", high: "조용함" },
  { id: "weight", label: "무게감", low: "가벼움", high: "묵직함" },
  { id: "speed", label: "반응성", low: "느리고 안정적", high: "빠르고 즉각적" },
  { id: "tactile", label: "촉각 피드백", low: "걸림 없음", high: "걸림이 강함" },
  { id: "warmth", label: "온도감", low: "차가움", high: "따뜻함" },
  { id: "clarity", label: "선명도", low: "흐리고 먹먹함", high: "선명하고 또렷함" },
  { id: "smoothness", label: "매끄러움", low: "까칠하고 서걱임", high: "매끄럽고 부드러움" },
  { id: "presence", label: "존재감", low: "옅음", high: "강함" }
];

const answer = (id, text, scores, weight = 1) => ({ id, text, scores, weight });

// 점수는 0~100이며, 답변과 무관한 축은 키 자체를 생략합니다.
export const DEFAULT_QUESTIONS = [
  {
    id: "Q1", category: "겉인상", enabled: true, scope: "outer", weight: 1,
    axisWeights: { quiet: 0.05, clarity: 0.06, presence: 0.04 },
    question: "처음 봤을 때 가장 먼저 느껴지는 인상은?",
    answers: [
      answer("A", "존재감이 옅고 조용하다", { quiet: 95, clarity: 25, presence: 10 }),
      answer("B", "조용하지만 자연스럽게 눈길이 간다", { quiet: 80, clarity: 50, presence: 45 }),
      answer("C", "등장하면 주변 분위기가 달라진다", { quiet: 35, clarity: 75, presence: 75 }),
      answer("D", "등장부터 시끄럽고 존재감이 강하다", { quiet: 5, clarity: 95, presence: 95 })
    ]
  },
  {
    id: "Q2", category: "감정 표현", enabled: true, scope: "common", weight: 1,
    axisWeights: { quiet: 0.04, clarity: 0.06, tactile: 0.05, presence: 0.03 },
    question: "감정이 크게 흔들릴 때 어떻게 드러나는 편인가?",
    answers: [
      answer("A", "끝까지 티를 내지 않는다", { quiet: 90, clarity: 20, tactile: 20, presence: 15 }),
      answer("B", "낮고 짧게 선을 긋는다", { quiet: 70, clarity: 75, tactile: 65, presence: 50 }),
      answer("C", "날카롭게 바로 반응한다", { quiet: 25, clarity: 95, tactile: 75, presence: 70 }),
      answer("D", "감정을 크게 터뜨리고 주변까지 휩쓴다", { quiet: 5, clarity: 85, tactile: 90, presence: 100 })
    ]
  },
  {
    id: "Q3", category: "행동 방식", enabled: true, scope: "common", weight: 1,
    axisWeights: { speed: 1, weight: 0.05, smoothness: 0.08, clarity: 0.06 },
    question: "움직임이나 행동 방식에 가장 가까운 것은?",
    answers: [
      answer("A", "부드럽고 유연하게 움직인다", { speed: 55, weight: 35, smoothness: 95, clarity: 55 }),
      answer("B", "느리더라도 안정적으로 움직인다", { speed: 25, weight: 75, smoothness: 65, clarity: 55 }),
      answer("C", "가볍고 통통 튀며 방향 전환이 빠르다", { speed: 90, weight: 20, smoothness: 70, clarity: 70 }),
      answer("D", "빠르고 군더더기 없이 정확하다", { speed: 95, weight: 40, smoothness: 80, clarity: 95 })
    ]
  },
  {
    id: "Q4", category: "대인 태도", enabled: true, scope: "common", weight: 1,
    axisWeights: { warmth: 0.06, smoothness: 0.08, tactile: 0.05, quiet: 0.04 },
    question: "다른 사람을 대하는 태도는?",
    answers: [
      answer("A", "말은 적지만 필요한 것을 챙겨준다", { warmth: 70, smoothness: 80, tactile: 25, quiet: 80 }),
      answer("B", "편안하고 다정하게 받아준다", { warmth: 95, smoothness: 95, tactile: 15, quiet: 65 }),
      answer("C", "가까워지면 은근히 장난을 건다", { warmth: 75, smoothness: 65, tactile: 45, quiet: 45 }),
      answer("D", "가까운 사이에도 까칠하고 선이 분명하다", { warmth: 15, smoothness: 20, tactile: 85, quiet: 55 })
    ]
  },
  {
    id: "Q5", category: "힘의 무게", enabled: true, scope: "common", weight: 1,
    axisWeights: { weight: 1, speed: 0.06, presence: 0.04 },
    question: "캐릭터에게서 느껴지는 힘의 무게는?",
    answers: [
      answer("A", "가볍고 민첩하게 발휘되는 힘", { weight: 8, speed: 90, presence: 50 }),
      answer("B", "크게 치우치지 않은 균형 잡힌 힘", { weight: 40, speed: 50, presence: 50 }),
      answer("C", "묵직하고 안정적으로 받쳐주는 힘", { weight: 55, speed: 30, presence: 70 }),
      answer("D", "한 번 드러나면 주변을 압도하는 힘", { weight: 75, speed: 55, presence: 88 })
    ]
  },
  {
    id: "Q6", category: "속내", enabled: true, scope: "common", weight: 1,
    axisWeights: { clarity: 1, quiet: 0.04, presence: 0.03 },
    question: "속마음이 겉으로 드러나는 정도는?",
    answers: [
      answer("A", "표정과 행동에 그대로 드러난다", { quiet: 25, clarity: 95, presence: 70 }),
      answer("B", "대체로 솔직하지만 전부 보여주지는 않는다", { quiet: 45, clarity: 75, presence: 60 }),
      answer("C", "가끔 보이는 작은 단서로만 짐작할 수 있다", { quiet: 75, clarity: 50, presence: 35 }),
      answer("D", "무슨 생각을 하는지 거의 알 수 없다", { quiet: 95, clarity: 30, presence: 15 })
    ]
  },
  {
    id: "Q7", category: "소리", enabled: true, scope: "common", weight: 1.2,
    axisWeights: { quiet: 1, clarity: 0.75, presence: 0.05, warmth: 0.04 },
    question: "이 캐릭터를 소리로 표현하면 가장 가까운 것은?",
    answers: [
      answer("A", "거의 들리지 않을 만큼 조용한 소리", { quiet: 93, clarity: 30, presence: 15, warmth: 45 }),
      answer("B", "낮고 둥근 도각거리는 소리", { quiet: 75, clarity: 50, presence: 30, warmth: 65 }),
      answer("C", "맑고 또렷하게 들리는 소리", { quiet: 49, clarity: 75, presence: 55, warmth: 45 }),
      answer("D", "크고 시원하게 터지는 클릭음", { quiet: 11, clarity: 95, presence: 88, warmth: 35 })
    ]
  },
  {
    id: "Q8", category: "성격의 촉감", enabled: true, scope: "common", weight: 1,
    axisWeights: { smoothness: 1, tactile: 0.6, warmth: 0.04, clarity: 0.06 },
    question: "이 캐릭터의 성격으로 가까운 것은?",
    answers: [
      answer("A", "시원스럽고 거침없다", { smoothness: 90, tactile: 10, warmth: 55, clarity: 80 }),
      answer("B", "다정하고 상냥하다", { smoothness: 95, tactile: 15, warmth: 95, clarity: 55 }),
      answer("C", "은근히 선을 긋는다", { smoothness: 55, tactile: 65, warmth: 45, clarity: 70 }),
      answer("D", "까칠하고 가까이 하기 어렵다", { smoothness: 15, tactile: 95, warmth: 10, clarity: 90 })
    ]
  },
  {
    id: "Q9", category: "온도", enabled: true, scope: "common", weight: 1,
    axisWeights: { warmth: 1 },
    question: "캐릭터의 전체적인 인상은 어느 온도에 가까운가?",
    answers: [
      answer("A", "얼음처럼 차갑다", { warmth: 10 }),
      answer("B", "서늘하다", { warmth: 35 }),
      answer("C", "온화하고 편안한 생활감이 있다", { warmth: 65 }),
      answer("D", "햇살처럼 따뜻하다", { warmth: 90 })
    ]
  },
  {
    id: "Q10", category: "이야기 속 존재감", enabled: true, scope: "common", weight: 1,
    axisWeights: { presence: 1, weight: 0.05, clarity: 0.1 },
    question: "이야기 안에서 이 캐릭터의 존재감은?",
    answers: [
      answer("A", "앞에 나서기보다 조용히 지켜보거나 돕는다", { presence: 15, weight: 35, clarity: 35 }),
      answer("B", "눈에 띄지는 않아도 꾸준히 중심을 받친다", { presence: 30, weight: 60, clarity: 55 }),
      answer("C", "실력으로 자연스럽게 중심에 선다", { presence: 55, weight: 55, clarity: 75 }),
      answer("D", "등장하면 무대 전체를 장악한다", { presence: 88, weight: 65, clarity: 95 })
    ]
  },
  {
    id: "Q11", category: "숨은 모습", enabled: true, scope: "inner", weight: 1,
    axisWeights: { quiet: 0.04, weight: 0.04, speed: 0.07, tactile: 0.06, warmth: 0.04, clarity: 0.07, smoothness: 0.07, presence: 0.03 },
    question: "오래 본 사람만 아는 모습은?",
    answers: [
      answer("A", "다정하고 주변을 잘 챙긴다", { warmth: 95, tactile: 20, smoothness: 90, speed: 45, weight: 45, quiet: 65, clarity: 60, presence: 45 }),
      answer("B", "선을 분명하게 긋고 냉정하다", { warmth: 10, tactile: 90, smoothness: 25, speed: 55, weight: 75, quiet: 65, clarity: 85, presence: 65 }),
      answer("C", "장난스럽고 감정 표현이 많다", { warmth: 70, tactile: 45, smoothness: 65, speed: 90, weight: 35, quiet: 20, clarity: 80, presence: 85 }),
      answer("D", "여리고 쉽게 마음이 흔들린다", { warmth: 55, tactile: 25, smoothness: 60, speed: 30, weight: 20, quiet: 75, clarity: 25, presence: 20 })
    ]
  },
  {
    id: "Q12", category: "경계 반응", enabled: true, scope: "common", weight: 1,
    axisWeights: { tactile: 1, smoothness: 1 },
    question: "불편하거나 받아들이기 어려운 일을 마주쳤을 때 어떻게 반응하는가?",
    answers: [
      answer("A", "크게 거절하지 않고 자연스럽게 흘려보낸다", { tactile: 6, smoothness: 90 }),
      answer("B", "부드럽게 말하지만 경계는 분명히 전한다", { tactile: 30, smoothness: 75 }),
      answer("C", "짧고 단호하게 선을 긋는다", { tactile: 59, smoothness: 55 }),
      answer("D", "다시 넘지 못하도록 날카롭게 끊어낸다", { tactile: 80, smoothness: 35 })
    ]
  },
  {
    id: "Q13", category: "첫 반응", enabled: true, scope: "common", weight: 1,
    axisWeights: { speed: 1, weight: 0.05, smoothness: 0.5, clarity: 0.16 },
    question: "예상하지 못한 일이 생겼을 때 첫 움직임은?",
    answers: [
      answer("A", "잠시 멈추고 천천히 상황을 파악한다", { speed: 30, weight: 65 }),
      answer("B", "놀라도 흐름을 부드럽게 바꾼다", { speed: 50, smoothness: 90 }),
      answer("C", "통통 튀듯 바로 움직인다", { speed: 75, weight: 25 }),
      answer("D", "망설임 없이 날카롭고 정확하게 대응한다", { speed: 95, clarity: 95 })
    ]
  }
];

export function cloneDefaultQuestions() {
  return JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
}
