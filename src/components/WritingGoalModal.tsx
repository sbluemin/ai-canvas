import { useState, useEffect } from 'react';
import { useStore, WritingGoal } from '../store/useStore';
import { CloseIcon } from './Icons';
import { detectSddPhase } from '../utils/sddDocument';
import './WritingGoalModal.css';

export function WritingGoalModal() {
  const {
    isWritingGoalOpen,
    closeWritingGoal,
    activeWritingGoal,
    setActiveWritingGoal,
    activeCanvasFile,
    canvasContent,
  } = useStore();

  // 폼 상태
  const [purpose, setPurpose] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [targetLength, setTargetLength] = useState<'short' | 'medium' | 'long'>('medium');

  // 활성 목표가 있으면 폼에 자동 채움
  useEffect(() => {
    if (activeWritingGoal) {
      setPurpose(activeWritingGoal.purpose);
      setAudience(activeWritingGoal.audience);
      setTone(activeWritingGoal.tone);
      setTargetLength(activeWritingGoal.targetLength);
    }
  }, [activeWritingGoal]);

  if (!isWritingGoalOpen) return null;

  const isSddSpecialDocumentActive = Boolean(activeCanvasFile && detectSddPhase(activeCanvasFile, canvasContent));

  // 적용 버튼 핸들러
  const handleApply = () => {
    if (isSddSpecialDocumentActive) return;
    const goal: WritingGoal = {
      purpose,
      audience,
      tone,
      targetLength,
    };
    setActiveWritingGoal(goal);
    closeWritingGoal();
  };

  // 초기화 버튼 핸들러
  const handleReset = () => {
    if (isSddSpecialDocumentActive) return;
    setActiveWritingGoal(null);
    closeWritingGoal();
  };

  return (
    <div className="writing-goal-overlay">
      <button type="button" className="writing-goal-backdrop" onClick={closeWritingGoal} aria-label="닫기" />
      <div className="writing-goal-modal" role="dialog" aria-modal="true" aria-label="문서 작성 목표">
        {/* 헤더 */}
        <div className="writing-goal-header">
          <div className="header-title-group">
            <h3>문서 작성 목표</h3>
            {activeWritingGoal && <div className="state-dot active" />}
          </div>
          <button type="button" className="wg-close-button" onClick={closeWritingGoal} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        {/* 스크롤 가능한 콘텐츠 영역 */}
        <div className="writing-goal-content">
          {isSddSpecialDocumentActive && (
            <div className="writing-goal-lock-notice">
              <span className="state-dot locked" aria-hidden="true" />
              <span>SDD 문서에서는 Goal을 편집할 수 없어요. 일반 문서로 전환하면 다시 수정할 수 있습니다.</span>
            </div>
          )}
          {/* 커스텀 입력 폼 */}
          <div className={`writing-goal-form${isSddSpecialDocumentActive ? ' locked' : ''}`}>
            <div className="form-group">
              <label htmlFor="purpose-input">문서 목적</label>
              <textarea
                id="purpose-input"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                readOnly={isSddSpecialDocumentActive}
                placeholder={isSddSpecialDocumentActive && purpose.trim() === ''
                  ? 'SDD 문서에서는 Goal을 설정하지 않습니다.'
                  : '예: 기능 플로우/디자인 요구사항 정리 및 기대 결과 도출'}
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="audience-input">대상 독자</label>
                <input
                  id="audience-input"
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  readOnly={isSddSpecialDocumentActive}
                  placeholder="예: 개발자, PO, 디자이너"
                />
              </div>
              <div className="form-group">
                <label htmlFor="tone-input">어조</label>
                <input
                  id="tone-input"
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  readOnly={isSddSpecialDocumentActive}
                  placeholder="예: 기술적이고 논리적인, 간결한"
                />
              </div>
            </div>

            <div className="form-group">
              <span className="form-label">목표 길이</span>
              <div className="segment-control">
                {(['short', 'medium', 'long'] as const).map((len) => (
                  <button
                    key={len}
                    type="button"
                    className={`segment-item ${targetLength === len ? 'active' : ''}`}
                    onClick={() => setTargetLength(len)}
                    disabled={isSddSpecialDocumentActive}
                  >
                    {len === 'short' ? '짧게' : len === 'medium' ? '중간' : '길게'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="writing-goal-actions">
          <button type="button" onClick={handleReset} className="btn-ghost" disabled={isSddSpecialDocumentActive}>초기화</button>
          <button type="button" onClick={handleApply} className="wg-btn-primary" disabled={isSddSpecialDocumentActive}>목표 적용하기</button>
        </div>
      </div>
    </div>
  );
}
