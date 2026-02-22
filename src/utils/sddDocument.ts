import type { WritingGoal } from '../types/chat';

export type SddPhase = 'specify' | 'ideate' | 'plan' | 'decompose' | 'implement-scope' | 'validate';

const SDD_PHASES: SddPhase[] = ['specify', 'ideate', 'plan', 'decompose', 'implement-scope', 'validate'];

const SDD_PHASE_TITLES: Record<SddPhase, string> = {
  specify: 'Specify',
  ideate: 'Ideate',
  plan: 'Plan',
  decompose: 'Decompose',
  'implement-scope': 'Implement Scope',
  validate: 'Validate',
};

const SDD_PHASE_GOALS: Record<SddPhase, WritingGoal> = {
  specify: {
    purpose: `[SDD: Specify]\n목표: 사용자 기능 요청을 PRD-lite 문서로 구체화한다.\n포함: 기능 범위, 사용자 플로우, 화면/상태, 기대 결과, 엣지케이스/오류 처리, 비범위, 오픈 퀘스천.\n제외: 일정, 구현 상세(코드/파일/함수/아키텍처).`,
    audience: 'PO/디자이너/엔지니어',
    tone: '명확하고 간결하게, 관찰 가능한 결과 중심',
    targetLength: 'long',
  },
  ideate: {
    purpose: `[SDD: Ideate]\n목표: 초기 기능 아이디어를 제품 관점의 구체적 방향성 제안으로 발전시킨다.\n과정: 현행 구조 요약, 의도/미결정사항 추출, 사용자 워크플로우·상태 전이·엣지케이스 정리, 3가지 대안 비교.\n제외: 코드/파일/함수/아키텍처 상세, 일정, 기술 스택 선정.`,
    audience: 'PO/Product Designer/개발 리드',
    tone: '제품/UX 의사결정 중심, 비교 가능한 구조로 명확하게',
    targetLength: 'long',
  },
  plan: {
    purpose: `[SDD: Plan]\n목표: Specify 문서를 실행 가능한 계획으로 변환한다.\n포함: 단계/순서, 작업 항목, 의존성, 리스크, 완료 조건.\n제외: 코드/함수/파일 단위 구현 상세.`,
    audience: 'PO/Tech Lead/개발자',
    tone: '실행 계획 중심, 짧은 불릿 위주',
    targetLength: 'medium',
  },
  decompose: {
    purpose: `[SDD: Decompose]\n목표: Plan을 티켓 단위로 분해해 바로 착수 가능한 backlog를 만든다.\n각 티켓은 목적/산출물/수락 기준을 명확히 포함한다.`,
    audience: '개발자/PM',
    tone: '티켓은 짧고 명확하게',
    targetLength: 'long',
  },
  'implement-scope': {
    purpose: `[SDD: Implement Scope]\n목표: 실제 코드를 작성하지 않고 구현 터치포인트와 작업 범위를 산출한다.\n허용: 파일/모듈/IPC/상태/테스트 위치와 작업량 추정.`,
    audience: 'Tech Lead/개발자',
    tone: '구체적으로 작성하되 코드 블록은 제외',
    targetLength: 'medium',
  },
  validate: {
    purpose: `[SDD: Validate]\n목표: Spec 기준 동작 검증을 위한 수락 기준과 테스트 플랜을 정의한다.\n포함: 시나리오(정상/엣지/오류/회귀), 전제조건, 릴리즈 체크리스트.`,
    audience: 'PO/QA/개발자',
    tone: '체크리스트/시나리오 중심',
    targetLength: 'medium',
  },
};

const SDD_PHASE_TEMPLATES: Record<SddPhase, string> = {
  specify: `## 요약\n\n## 문제/배경\n\n## 대상 사용자/시나리오\n\n## 요구사항 (MUST/SHOULD/COULD)\n\n## 사용자 플로우\n\n## 화면/상태\n\n## 기대 결과\n\n## 엣지케이스/오류 처리\n\n## 비범위 (Non-goals)\n\n## 오픈 퀘스천\n`,
  ideate: `## 현행 구조 요약\n\n## 사용자 원안 분석 (의도 + Gap)\n\n## 방향성 A\n### 핵심 콘셉트\n### 워크플로우\n### 장점\n### 단점\n\n## 방향성 B\n### 핵심 콘셉트\n### 워크플로우\n### 장점\n### 단점\n\n## 방향성 C\n### 핵심 콘셉트\n### 워크플로우\n### 장점\n### 단점\n\n## 비교 매트릭스\n\n## 권장 의견 및 로드맵\n`,
  plan: `## Plan Summary\n\n## Milestones / Sequence\n\n## Work Items\n\n## Dependencies\n\n## Risks & Mitigations\n\n## Definition of Done\n\n## Open Questions / Assumptions\n`,
  decompose: `## Ticket Breakdown\n\n### Ticket 1\n- 제목:\n- 목적/산출물:\n- 범위:\n- 수락 기준:\n- 의존성:\n- 난이도:\n\n### Ticket 2\n- 제목:\n- 목적/산출물:\n- 범위:\n- 수락 기준:\n- 의존성:\n- 난이도:\n`,
  'implement-scope': `## Touchpoints\n\n## 예상 변경 파일/모듈\n\n## 작업 분해 (순서)\n\n## 리스크/회귀 포인트\n\n## Rough Estimate\n`,
  validate: `## Acceptance Criteria\n\n## Test Matrix\n\n## Preconditions\n\n## Regression Checklist\n\n## Release/Rollback Notes\n`,
};

const LEADING_FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function getSddPhases(): SddPhase[] {
  return [...SDD_PHASES];
}

export function getSddPhaseTitle(phase: SddPhase): string {
  return SDD_PHASE_TITLES[phase];
}

export function getSddWritingGoal(phase: SddPhase): WritingGoal {
  return SDD_PHASE_GOALS[phase];
}

export function getSddPhaseFromFilePath(filePath: string): SddPhase | null {
  const match = filePath.match(/_sdd-(specify|ideate|plan|decompose|implement-scope|validate)\.md$/);
  if (!match) return null;
  return match[1] as SddPhase;
}

export function splitLeadingFrontmatter(content: string): { frontmatter: string | null; body: string } {
  const match = content.match(LEADING_FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: null, body: content };
  }

  return {
    frontmatter: match[0],
    body: content.slice(match[0].length),
  };
}

export function stripLeadingFrontmatter(content: string): string {
  return splitLeadingFrontmatter(content).body;
}

function parseYamlValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function parseFrontmatter(content: string): Record<string, string> | null {
  const { frontmatter } = splitLeadingFrontmatter(content);
  if (!frontmatter) return null;

  const result: Record<string, string> = {};
  const yamlBody = frontmatter.replace(/^---\r?\n/, '').replace(/\r?\n---\r?\n?$/, '');
  const lines = yamlBody.split(/\r?\n/);
  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = parseYamlValue(line.slice(separatorIndex + 1));
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

export function detectSddPhase(filePath: string, content: string): SddPhase | null {
  const frontmatter = parseFrontmatter(content);
  if (frontmatter?.type === 'sdd' && frontmatter.phase && SDD_PHASES.includes(frontmatter.phase as SddPhase)) {
    return frontmatter.phase as SddPhase;
  }
  return getSddPhaseFromFilePath(filePath);
}

export function stripSddFrontmatterForEditor(filePath: string, content: string): string {
  const sddPhase = detectSddPhase(filePath, content);
  if (!sddPhase) {
    return content;
  }

  return stripLeadingFrontmatter(content);
}

export function composeSddContentForSave(phase: SddPhase, editorContent: string): string {
  const bodyWithoutFrontmatter = stripLeadingFrontmatter(editorContent).replace(/^\r?\n/, '');
  return `---\ntype: sdd\nphase: ${phase}\n---\n\n${bodyWithoutFrontmatter}`;
}

export function buildSddDocumentFileName(phase: SddPhase): string {
  return `_sdd-${phase}.md`;
}

export function buildSddDocumentContent(phase: SddPhase): string {
  const title = getSddPhaseTitle(phase);
  return `---\ntype: sdd\nphase: ${phase}\n---\n\n# ${title}\n\n${SDD_PHASE_TEMPLATES[phase]}`;
}
