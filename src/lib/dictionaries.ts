/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * L1 사전 (P-2) — 키워드/패턴 기반 1차 태그 추정.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ 설계 제약 (D-7 진영 대칭성) — 이 파일을 수정하기 전에 반드시 읽을 것
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. **실제 인물·정당·진영 이름을 하드코딩하지 않는다.**
 *    아젠다·인물 매칭은 진행자가 등록한 큐시트(LiveIssue.keywords / figures)에서 주입받는다.
 *    이렇게 하면 (a) 특정 진영의 어휘만 사전에 들어가는 비대칭이 구조적으로 불가능해지고,
 *    (b) 채널마다 다른 관심사에 자동으로 맞춰진다.
 *
 * 2. **리스크 패턴은 "형식" 기준이지 "대상" 기준이 아니다.**
 *    누구를 향했는지가 아니라 표현의 형식(욕설·비하 접미사·범죄 단정·미확인 전언)으로만 판정한다.
 *    "이 표현은 명백히 더 심하다"는 직관은 그 자체가 편향의 산물일 수 있으므로 신뢰하지 않는다.
 *
 * 3. **정치적 멸칭(political slur)은 이 파일에 단독으로 추가하지 않는다.**
 *    한쪽 진영을 향한 멸칭만 들어가면 사전이 즉시 비대칭이 된다. 아래 POLITICAL_SLUR_PAIRS에
 *    **반드시 대칭 쌍으로만** 추가하며, 확정은 safety-reviewer와 사용자 판단을 거친다.
 *    판단이 서지 않으면 양쪽 모두 넣지 않는 것이 기본값이다.
 *
 * 4. L1은 **추정**이다. 최종 태깅은 L2(AI)가 하며, 여기서의 오분류는 표본 선정에만 영향을 준다.
 *    단, 리스크·요구 후보는 표본이 아니라 전수로 넘어가므로 재현율(누락 안 함)을 정밀도보다 우선한다.
 *
 * 설계 근거: docs/plans/politics-pivot.md 2절(D-1~D-8) · 3절(6축 37태그) · 4절(L1).
 */

import type { TalkTag } from '../types/liveTalk.js';

/** 태그 추정 규칙 — 위에서부터 먼저 매치되는 것을 채택한다(우선순위 순). */
export interface TagRule {
  tag: TalkTag;
  patterns: RegExp[];
  /** 이 태그가 리스크 후보인가 (표본이 아니라 전수로 AI에 전달) */
  isRiskCandidate?: boolean;
  /** 이 태그가 진행자 응답이 필요한 요구인가 (전수 전달) */
  isRequestCandidate?: boolean;
}

/**
 * 정치적 멸칭 대칭 쌍.
 *
 * 비어 있는 것이 의도된 초기 상태다. 채우려면 **양방향을 동시에** 넣어야 하며,
 * 한쪽만 추가하는 변경은 safety-reviewer가 반려한다.
 * 형식: [{ a: /.../, b: /.../ }] — a와 b는 서로 대응하는 진영의 동급 표현.
 */
export const POLITICAL_SLUR_PAIRS: { a: RegExp; b: RegExp; note: string }[] = [];

/**
 * 리스크 규칙 — 형식 기준.
 * 재현율 우선: 애매하면 후보로 올리고 AI와 사람이 거른다. 놓치는 쪽이 더 비싸다.
 */
export const RISK_RULES: TagRule[] = [
  {
    tag: 'hate_slur',
    isRiskCandidate: true,
    patterns: [
      // 비하 접미사 (형식 기준 — 대상 무관)
      /[가-힣]{1,4}충\b/,
      /[가-힣]{1,4}(?:놈|년|새끼|색기|시키)\b/,
      // 일반 욕설 어간
      /(?:씨발|시발|ㅅㅂ|병신|ㅂㅅ|지랄|개소리|미친놈|미친년|꺼져|죽어라)/,
      // 집단 비하 형식
      /(?:종자|짐승|벌레)\s*(?:들)?\s*(?:같|이야|네)/,
    ],
  },
  {
    tag: 'defamation_risk',
    isRiskCandidate: true,
    patterns: [
      // 범죄 단정 — "~는 범죄자다" 형태. 의혹 제기가 아니라 단정 어미가 핵심
      /(?:범죄자|사기꾼|도둑놈?|살인자|간첩|매국노|반역자)(?:다|야|임|입니다|네)?\b/,
      /(?:횡령|뇌물|불법자금|비자금|탈세)\s*(?:했|받았|먹었|챙겼)/,
      /(?:구속|감옥|교도소|감방)\s*(?:감이다|가야|보내야|처넣)/,
      // 단정적 유죄 선언
      /(?:빼박|명백한)\s*(?:범죄|유죄)/,
    ],
  },
  {
    tag: 'misinfo_suspect',
    isRiskCandidate: true,
    patterns: [
      // 미확인 전언 형식 — 진위가 아니라 "출처 없는 전달" 형식을 잡는다
      /(?:카톡|단톡|지라시|찌라시)\s*(?:으로|로)?\s*(?:받았|돌|왔)/,
      /(?:소식통|관계자)\s*(?:에\s*따르면|말로는|얘기로는)/,
      /(?:아는\s*(?:사람|분|기자)|지인)\s*(?:이|가|한테)?\s*(?:그러는데|들었는데|말하길)/,
      /(?:라던데|라더라|카더라|답디다)\b/,
      /(?:확인)\s*(?:안\s*된|되지\s*않은)/,
    ],
  },
  {
    tag: 'election_law_watch',
    isRiskCandidate: true,
    patterns: [
      // 특정 기호 지목·투표 독려 형식 (위법 판정 아님 — 주의 신호)
      /\d\s*번\s*(?:찍|뽑|투표)/,
      /(?:투표)\s*(?:하지\s*마|거부|보이콧)/,
      /(?:사전투표|부정선거|개표\s*조작|투표\s*조작)/,
      /(?:기표|투표용지)\s*(?:인증|공개)/,
    ],
  },
  {
    tag: 'stream_issue',
    isRiskCandidate: false,
    patterns: [
      /(?:소리|음향|마이크|볼륨)\s*(?:안|잘\s*안|이상|작)/,
      /(?:안\s*들려|안들려|안\s*보여|안보여)/,
      /(?:화면|영상|화질)\s*(?:멈|끊|깨|이상)/,
      /(?:끊겨|끊김|버퍼링|먹통|렉\s*걸)/,
    ],
  },
];

/** 질문·요구 규칙 — 미응답 큐 후보. 전수로 AI에 전달된다. */
export const INQUIRY_RULES: TagRule[] = [
  {
    tag: 'host_question_direct',
    isRequestCandidate: true,
    patterns: [/(?:기자|대표|박사|교수|변호사|앵커|선생)님[,\s]/, /(?:형님|사장)님\s*(?:이거|이건|질문)/],
  },
  {
    tag: 'source_request',
    isRequestCandidate: true,
    patterns: [
      // 요청 어휘와 동사 사이에 다른 말이 끼는 경우가 흔하다
      // ("자료 좀 화면에 띄워주세요") — 짧은 간격을 허용해 재현율을 확보한다
      /(?:자료|근거|출처|원문|기사|링크|화면|자막)[^.!?\n]{0,12}(?:보여|올려|공유|띄워|주세요|주실|부탁|첨부)/,
      /(?:어디서|출처가)\s*(?:나온|확인)/,
    ],
  },
  {
    tag: 'explain_request',
    isRequestCandidate: true,
    patterns: [
      /(?:쉽게|자세히|천천히)\s*(?:설명|알려|풀어)/,
      /(?:무슨\s*(?:뜻|말)|어떤\s*의미)(?:인가요|이죠|이에요|\?)/,
      /(?:이해가|모르겠)\s*(?:안|어요|네요|습니다)/,
    ],
  },
  {
    tag: 'opinion_request',
    isRequestCandidate: true,
    patterns: [
      /(?:어떻게\s*(?:생각|보시|보세))/,
      /(?:견해|의견|입장)(?:이|은)?\s*(?:어떻|뭔가|궁금)/,
    ],
  },
  {
    tag: 'rerun_request',
    isRequestCandidate: true,
    patterns: [
      /(?:다시\s*보기|다시보기|풀영상|풀\s*버전|편집본)/,
      /(?:몇\s*분|타임스탬프|몇\s*시부터)/,
    ],
  },
  {
    tag: 'how_to_act',
    isRequestCandidate: true,
    patterns: [
      /(?:뭘|무엇을|어떻게)\s*(?:해야|하면)\s*(?:되|하)/,
      /(?:우리가|국민이|시민이)\s*(?:할\s*수\s*있는|해야)/,
    ],
  },
];

/**
 * 사실 확인 질문 — **가장 넓은 catch-all**이므로 다른 요청 규칙보다 뒤에 평가한다.
 *
 * "지난주에 다루신 그 건은 어떻게 됐나요?"는 문장 끝의 "나요?"만 보면 factual_question이지만,
 * 진행자에게 더 쓸모 있는 정보는 **후속 요청**이라는 사실이다. 넓은 규칙을 앞에 두면
 * 구체적인 아젠다 신호가 전부 이 규칙에 흡수된다.
 */
export const FACTUAL_QUESTION_RULE: TagRule = {
  tag: 'factual_question',
  isRequestCandidate: true,
  patterns: [
    /(?:언제|어디서|누가|얼마|몇\s*명|무슨\s*일)/,
    /(?:인가요|나요|습니까|맞나요|맞습니까|일까요)\s*\??$/,
  ],
};

/** 아젠다 규칙 — 이슈 관련 요청. topic/followup/guest/breaking */
export const AGENDA_RULES: TagRule[] = [
  {
    tag: 'topic_request',
    isRequestCandidate: true,
    patterns: [/(?:다뤄|다뤄주|다루어|해주세요|해주시죠|짚어)\s*(?:주세요|주시|줘)?/, /(?:주제|소재)로\s*(?:한번|다뤄)/],
  },
  {
    tag: 'followup_request',
    isRequestCandidate: true,
    patterns: [/(?:지난\s*(?:번|방송|주)|저번\s*(?:방송|에)|어제\s*방송)/, /(?:후속|그\s*이후|그거\s*어떻게\s*됐)/],
  },
  {
    tag: 'guest_request',
    isRequestCandidate: true,
    patterns: [/(?:초대|모셔|섭외)\s*(?:해|좀|주세요|하시죠)/],
  },
  {
    tag: 'breaking_tip',
    patterns: [/(?:속보|방금\s*(?:떴|나왔|들어왔)|제보|단독)/],
  },
];

/** 참여·후원 규칙 */
export const LOYALTY_RULES: TagRule[] = [
  { tag: 'superchat', patterns: [/(?:슈퍼챗|후원|커피\s*값|치킨\s*값|보냅니다|쐈)/] },
  { tag: 'membership', patterns: [/(?:멤버십|멤버\s*가입|가입했|갱신했)/] },
  { tag: 'subscribe_share', patterns: [/(?:구독|좋아요|알림\s*설정|공유했|추천했)/] },
  {
    tag: 'attendance',
    patterns: [/(?:출석|출근|퇴근)\s*(?:합니다|했습니다|도장|체크)?/, /(?:오늘도|매일)\s*(?:왔|보러|함께)/, /^\s*(?:1빠|일빠|첫\s*번째)/],
  },
  { tag: 'petition_action', patterns: [/(?:청원|서명|집회|시위|참여합시다|나갑시다)/] },
  { tag: 'community_bond', patterns: [/(?:화이팅|파이팅|응원합니다|고생\s*(?:많|하)|감사합니다)/] },
];

/** 반응·의견 규칙 — 집계 전용 (D-3). 개인 성향 라벨이 아니다. */
export const STANCE_RULES: TagRule[] = [
  {
    tag: 'whataboutism',
    // "똑같" 단독은 너무 넓다 — "똑같은 얘기 지겹다"(피로)까지 삼킨다.
    // 맞불 프레임은 "비교 대상 + 동일시"가 함께 나타나는 형태로만 잡는다.
    patterns: [
      /(?:그럼|그러면|근데)\s*(?:저쪽|반대쪽|그쪽|저기)(?:은|는|도)?/,
      /(?:저쪽|반대쪽|그쪽|남)(?:은|는|도)?\s*(?:안|더)?\s*(?:그랬|똑같|마찬가지|안\s*그러)/,
      /(?:피차일반|남\s*얘기\s*할|누워서\s*침)/,
    ],
  },
  { tag: 'doubt_verify', patterns: [/(?:진짜|정말)\s*(?:인가|맞나|맞아|일까)/, /(?:확인|검증|팩트\s*체크)\s*(?:해|필요|좀)/, /(?:믿기|믿을\s*수)\s*(?:어렵|힘들|없)/] },
  { tag: 'disagree_object', patterns: [/(?:그건|그것은|이건)\s*(?:아니|틀렸)/, /(?:동의|공감)\s*(?:못|안|하기\s*어)/, /(?:반대|반박|이견)(?:합니다|입니다|이요)?/] },
  { tag: 'mixed_nuance', patterns: [/(?:하지만|다만|그런데도|일리는|한편으로)/] },
  { tag: 'agree_support', patterns: [/(?:맞습니다|맞아요|맞네|동감|공감|옳은\s*말|정확합니다|백번)/] },
];

/** 정서 규칙 */
export const EMOTION_RULES: TagRule[] = [
  { tag: 'outrage', patterns: [/(?:화가|열받|빡치|분노|어이가?\s*없|기가\s*막)/, /(?:너무|정말)\s*(?:심하|하다\s*하다)/] },
  { tag: 'anxiety', patterns: [/(?:걱정|불안|무섭|두렵|우려)/] },
  { tag: 'despair', patterns: [/(?:실망|포기|답이\s*없|절망|체념|바뀌지\s*않)/] },
  { tag: 'fatigue_disengage', patterns: [/(?:지겹|지루|똑같은\s*(?:얘기|말)|그만|피곤|재미없|나갈|끕니다)/] },
  { tag: 'ridicule', patterns: [/(?:웃기네|웃긴다|코미디|개그|역시나|어련히)/] },
  { tag: 'hope_cheer', patterns: [/(?:기대|희망|잘\s*(?:하시|되길)|응원|믿습니다)/] },
];

/**
 * 전체 규칙의 평가 순서 — 위에서부터 첫 매치를 채택하므로 **구체적인 것이 앞**에 온다.
 *
 * 리스크를 가장 먼저 평가하는 이유: 리스크 후보는 전수로 AI에 전달되므로 누락 비용이 크다.
 * 요구(inquiry/agenda)를 그 다음에 두는 이유: 미응답 큐의 재현율이 제품 가치와 직결된다.
 * factual_question은 catch-all이라 아젠다 규칙 **뒤에** 둔다 (앞에 두면 후속·주제 요청을 전부 삼킨다).
 * 정서·반응은 집계용이므로 마지막이다.
 */
export const RULE_ORDER: TagRule[] = [
  ...RISK_RULES,
  ...INQUIRY_RULES,   // 구체적 요청 (설명·견해·지목·다시보기·행동)
  ...AGENDA_RULES,    // 아젠다 요청 (주제·후속·초대·제보)
  FACTUAL_QUESTION_RULE, // catch-all 질문 — 위 규칙들이 먼저 잡을 기회를 준다
  ...LOYALTY_RULES,
  ...STANCE_RULES,
  ...EMOTION_RULES,
];

/** 사전 규모 — 진단·리포트용 */
export function dictionaryStats(): { rules: number; patterns: number; slurPairs: number } {
  return {
    rules: RULE_ORDER.length,
    patterns: RULE_ORDER.reduce((sum, r) => sum + r.patterns.length, 0),
    slurPairs: POLITICAL_SLUR_PAIRS.length,
  };
}
