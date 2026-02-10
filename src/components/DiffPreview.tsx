import { useStore } from '../store/useStore';
import type { DiffChunk } from '../store/useStore';
import './DiffPreview.css';

export function DiffPreview() {
  const {
    pendingCanvasPatch,
    toggleChunkSelection,
    selectAllChunks,
    deselectAllChunks,
    applyPendingPatch,
    discardPendingPatch,
  } = useStore();

  if (!pendingCanvasPatch) return null;

  const { chunks } = pendingCanvasPatch;
  const changeChunks = chunks.filter(c => c.type !== 'equal');
  const selectedCount = changeChunks.filter(c => c.selected).length;
  const allSelected = selectedCount === changeChunks.length;
  const noneSelected = selectedCount === 0;

  return (
    <div className="diff-preview">
      {/* 상단 헤더 */}
      <div className="diff-preview-header">
        <div className="diff-preview-title">
          <span className="diff-preview-icon">📝</span>
          <span>AI 수정안 미리보기</span>
          <span className="diff-preview-count">{selectedCount}/{changeChunks.length}개 선택</span>
        </div>
        <div className="diff-preview-actions">
          <button
            className="diff-btn diff-btn-select-all"
            onClick={allSelected ? deselectAllChunks : selectAllChunks}
            type="button"
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
          <button
            className="diff-btn diff-btn-discard"
            onClick={discardPendingPatch}
            type="button"
          >
            취소
          </button>
          <button
            className="diff-btn diff-btn-apply"
            onClick={applyPendingPatch}
            disabled={noneSelected}
            type="button"
          >
            선택 적용 ({selectedCount})
          </button>
        </div>
      </div>

      {/* Diff 청크 목록 */}
      <div className="diff-preview-body">
        {chunks.map((chunk) => (
          <DiffChunkView
            key={chunk.id}
            chunk={chunk}
            onToggle={() => toggleChunkSelection(chunk.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DiffChunkView({ chunk, onToggle }: { chunk: DiffChunk; onToggle: () => void }) {
  if (chunk.type === 'equal') {
    // 동일 블록: 3줄 이상이면 접기
    const lines = chunk.value.split('\n');
    if (lines.length > 6) {
      return (
        <div className="diff-chunk diff-chunk-equal diff-chunk-collapsed">
          <div className="diff-chunk-content">
            <span className="diff-collapsed-label">
              ⋯ {lines.length}줄 동일
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className="diff-chunk diff-chunk-equal">
        <div className="diff-chunk-content">
          <pre>{chunk.value}</pre>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`diff-chunk diff-chunk-${chunk.type} ${chunk.selected ? 'diff-chunk-selected' : 'diff-chunk-deselected'}`}
      onClick={onToggle}
    >
      <div className="diff-chunk-checkbox">
        <input
          type="checkbox"
          checked={chunk.selected}
          readOnly
          aria-label={`${chunk.type === 'add' ? '추가' : '삭제'} 블록 선택`}
        />
      </div>
      <div className="diff-chunk-marker">
        {chunk.type === 'add' ? '+' : '-'}
      </div>
      <div className="diff-chunk-content">
        <pre>{chunk.value}</pre>
      </div>
    </div>
  );
}
