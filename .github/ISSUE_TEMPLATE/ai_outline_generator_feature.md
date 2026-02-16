---
name: 기능 제안 - AI 문서 개요 자동 생성
about: 문서 작성 시작을 돕는 개요 자동 생성 기능 제안
title: "기능 제안: AI 문서 개요 자동 생성 (AI Outline Generator)"
labels:
  - enhancement
---

## 개요
현재는 사용자가 빈 캔버스에서 문서 구조를 처음부터 직접 설계해야 해서 시작 장벽이 큽니다.  
특히 목표(목적/독자/톤)가 정해져 있어도 섹션 구성까지 수동으로 만드는 데 시간이 많이 소요됩니다.  
따라서 목표와 대화 맥락을 기반으로 초기 목차/개요를 자동 제안하는 기능이 필요합니다.

## 제안 기능
- CommandBar 또는 캔버스 툴바에서 "개요 생성" 액션 제공
- activeWritingGoal, 최근 대화, 현재 캔버스 내용을 기반으로 섹션 트리 생성
- 생성된 개요를 미리보기 모달에서 항목별 선택/해제 후 적용
- 적용 시 캔버스에 마크다운 헤더 구조(`#`, `##`)로 삽입
- 기존 DiffPreview와 동일하게 적용 전/후 비교 제공

## 구현 방향 - 상태 구조 확장
```typescript
type ISODateString = string;

interface OutlineSection {
  title: string;
  children?: OutlineSection[];
}

interface OutlineDraft {
  id: string;                 // 초안 식별자 (generateId 사용)
  title: string;              // 개요 제목
  sections: OutlineSection[]; // 계층형 섹션 구조
  createdAt: ISODateString;   // ISO 8601 타임스탬프
}

interface AppState {
  pendingOutlineDraft: OutlineDraft | null;
  isOutlinePreviewOpen: boolean;
}
```

## 구현 방향 - 주요 작업
- [ ] Phase 1 프롬프트에 "개요 생성" 모드 추가
- [ ] 개요 응답 스키마(Zod) 및 파서 확장
- [ ] Zustand에 pendingOutlineDraft / preview open 상태 추가
- [ ] 개요 미리보기 UI(선택 적용) 추가
- [ ] 선택된 개요를 마크다운 헤더로 캔버스에 반영하는 액션 구현
- [ ] 개요 생성/적용 시나리오 테스트 추가

## 기대 효과
- 문서 작성 시작 시간을 줄여 초기 생산성을 높일 수 있습니다.
- 목표 기반(독자/톤/길이) 문서 구조 일관성이 향상됩니다.
- 초보 사용자도 구조화된 문서를 더 쉽게 작성할 수 있습니다.
