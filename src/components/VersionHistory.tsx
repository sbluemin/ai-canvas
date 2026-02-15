import { useStore } from '../store/useStore';
import type { CanvasSnapshot } from '../store/useStore';
import './VersionHistory.css';

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return '방금 전';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VersionHistory() {
  const {
    canvasSnapshots,
    activeCanvasFile,
    revertToSnapshot,
    deleteSnapshot,
    closeVersionHistory,
    canvasContent,
  } = useStore();

  const fileSnapshots = canvasSnapshots
    .filter(s => s.fileName === activeCanvasFile)
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="version-history">
      <div className="version-history-header">
        <div className="version-history-title">
          <span className="version-history-icon">🕐</span>
          <span>버전 히스토리</span>
          <span className="version-history-count">{fileSnapshots.length}개</span>
        </div>
        <button
          type="button"
          className="version-history-close"
          onClick={closeVersionHistory}
          title="닫기"
        >
          ✕
        </button>
      </div>

      <div className="version-history-body">
        {/* 현재 버전 */}
        <div className="version-item version-item-current">
          <div className="version-item-marker">
            <div className="version-dot version-dot-current" />
            {fileSnapshots.length > 0 && <div className="version-line" />}
          </div>
          <div className="version-item-content">
            <div className="version-item-label">현재 버전</div>
            <div className="version-item-meta">
              {canvasContent ? `${canvasContent.length}자` : '빈 문서'}
            </div>
          </div>
        </div>

        {/* 스냅샷 목록 */}
        {fileSnapshots.length === 0 ? (
          <div className="version-history-empty">
            <p>아직 버전 기록이 없습니다.</p>
            <p className="version-history-hint">AI가 캔버스를 수정하면 자동으로 이전 버전이 저장됩니다.</p>
          </div>
        ) : (
          fileSnapshots.map((snapshot, index) => (
            <VersionItem
              key={snapshot.id}
              snapshot={snapshot}
              isLast={index === fileSnapshots.length - 1}
              onRevert={() => revertToSnapshot(snapshot.id)}
              onDelete={() => deleteSnapshot(snapshot.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function VersionItem({
  snapshot,
  isLast,
  onRevert,
  onDelete,
}: {
  snapshot: CanvasSnapshot;
  isLast: boolean;
  onRevert: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="version-item">
      <div className="version-item-marker">
        <div className={`version-dot version-dot-${snapshot.trigger}`} />
        {!isLast && <div className="version-line" />}
      </div>
      <div className="version-item-content">
        <div className="version-item-header">
          <span className="version-item-trigger">
            {snapshot.trigger === 'ai' ? '🤖 AI 수정 전' : '📝 수동 저장'}
          </span>
          <span className="version-item-time" title={formatDate(snapshot.timestamp)}>
            {formatTimeAgo(snapshot.timestamp)}
          </span>
        </div>
        {snapshot.description && (
          <div className="version-item-description">{snapshot.description}</div>
        )}
        <div className="version-item-meta">
          {snapshot.content.length}자
        </div>
        <div className="version-item-actions">
          <button
            type="button"
            className="version-btn version-btn-revert"
            onClick={onRevert}
            title="이 버전으로 되돌리기"
          >
            되돌리기
          </button>
          <button
            type="button"
            className="version-btn version-btn-delete"
            onClick={onDelete}
            title="이 버전 삭제"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
