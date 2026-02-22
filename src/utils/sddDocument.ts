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
    purpose: `[SDD: Specify]\nGoal: turn the feature request into a PRD-lite document.\nInclude: scope, user flows, UI/state expectations, outcomes, edge cases/error handling, non-goals, and open questions.\nExclude: schedule and implementation-level details (code/files/functions/architecture).`,
    audience: 'PO/Designer/Engineer',
    tone: 'Clear and concise, focused on observable outcomes',
    targetLength: 'long',
  },
  ideate: {
    purpose: `[SDD: Ideate]\nGoal: evolve rough feature ideas into concrete product-direction proposals.\nProcess: summarize current structure, extract intent and gaps, define user workflow/state transitions/edge cases, compare at least three alternatives.\nExclude: code/file/function/architecture details, schedule, and tech stack selection.`,
    audience: 'PO/Product Designer/Engineering Lead',
    tone: 'Product and UX decision-oriented, structured for side-by-side comparison',
    targetLength: 'long',
  },
  plan: {
    purpose: `[SDD: Plan]\nGoal: convert the Specify document into an executable plan.\nInclude: sequence, work items, dependencies, risks, and definition of done.\nExclude: code/function/file-level implementation details.`,
    audience: 'PO/Tech Lead/Developer',
    tone: 'Execution-plan oriented, concise bullet points',
    targetLength: 'medium',
  },
  decompose: {
    purpose: `[SDD: Decompose]\nGoal: break the Plan into immediately actionable tickets.\nEach ticket should clearly include objective, deliverable, and acceptance criteria.`,
    audience: 'Developer/PM',
    tone: 'Short and explicit ticket language',
    targetLength: 'long',
  },
  'implement-scope': {
    purpose: `[SDD: Implement Scope]\nGoal: define implementation touchpoints and scope without writing production code.\nAllowed: files/modules/IPC/state/test locations and rough effort estimation.`,
    audience: 'Tech Lead/Developer',
    tone: 'Specific and actionable, without code blocks',
    targetLength: 'medium',
  },
  validate: {
    purpose: `[SDD: Validate]\nGoal: define acceptance criteria and a test plan against the specification.\nInclude: happy-path/edge/error/regression scenarios, preconditions, and release checklist.`,
    audience: 'PO/QA/Developer',
    tone: 'Checklist and scenario driven',
    targetLength: 'medium',
  },
};

const SDD_PHASE_TEMPLATES: Record<SddPhase, string> = {
  specify: `## Summary\n\n## Problem / Background\n\n## Target Users / Scenarios\n\n## Requirements (MUST/SHOULD/COULD)\n\n## User Flow\n\n## UI / State\n\n## Expected Outcomes\n\n## Edge Cases / Error Handling\n\n## Non-goals\n\n## Open Questions\n`,
  ideate: `## Current Structure Summary\n\n## Original Idea Analysis (Intent + Gaps)\n\n## Direction A\n### Core Concept\n### Workflow\n### Pros\n### Cons\n\n## Direction B\n### Core Concept\n### Workflow\n### Pros\n### Cons\n\n## Direction C\n### Core Concept\n### Workflow\n### Pros\n### Cons\n\n## Comparison Matrix\n\n## Recommendation and Roadmap\n`,
  plan: `## Plan Summary\n\n## Milestones / Sequence\n\n## Work Items\n\n## Dependencies\n\n## Risks & Mitigations\n\n## Definition of Done\n\n## Open Questions / Assumptions\n`,
  decompose: `## Ticket Breakdown\n\n### Ticket 1\n- Title:\n- Objective / Deliverable:\n- Scope:\n- Acceptance Criteria:\n- Dependencies:\n- Difficulty:\n\n### Ticket 2\n- Title:\n- Objective / Deliverable:\n- Scope:\n- Acceptance Criteria:\n- Dependencies:\n- Difficulty:\n`,
  'implement-scope': `## Touchpoints\n\n## Expected File / Module Changes\n\n## Work Breakdown (Sequence)\n\n## Risk / Regression Points\n\n## Rough Estimate\n`,
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
