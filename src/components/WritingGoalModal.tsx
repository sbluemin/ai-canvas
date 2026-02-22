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

  // Form state
  const [purpose, setPurpose] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [targetLength, setTargetLength] = useState<'short' | 'medium' | 'long'>('medium');

  // Keep local form synced with active goal
  useEffect(() => {
    if (activeWritingGoal) {
      setPurpose(activeWritingGoal.purpose);
      setAudience(activeWritingGoal.audience);
      setTone(activeWritingGoal.tone);
      setTargetLength(activeWritingGoal.targetLength);
      return;
    }

    setPurpose('');
    setAudience('');
    setTone('');
    setTargetLength('medium');
  }, [activeWritingGoal]);

  if (!isWritingGoalOpen) return null;

  const isSddSpecialDocumentActive = Boolean(activeCanvasFile && detectSddPhase(activeCanvasFile, canvasContent));

  // Apply button handler
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

  // Reset button handler
  const handleReset = () => {
    if (isSddSpecialDocumentActive) return;
    setActiveWritingGoal(null);
    closeWritingGoal();
  };

  return (
    <div className="writing-goal-overlay">
      <button type="button" className="writing-goal-backdrop" onClick={closeWritingGoal} aria-label="Close" />
      <div className="writing-goal-modal" role="dialog" aria-modal="true" aria-label="Writing Goal">
        {/* 헤더 */}
        <div className="writing-goal-header">
          <div className="header-title-group">
            <h3>Writing Goal</h3>
            {activeWritingGoal && <div className="state-dot active" />}
          </div>
          <button type="button" className="wg-close-button" onClick={closeWritingGoal} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* 스크롤 가능한 콘텐츠 영역 */}
        <div className="writing-goal-content">
          {isSddSpecialDocumentActive && (
            <div className="writing-goal-lock-notice">
              <span className="state-dot locked" aria-hidden="true" />
              <span>Goals cannot be edited in SDD documents. Switch to a regular document to modify.</span>
            </div>
          )}
          {/* 커스텀 입력 폼 */}
          <div className={`writing-goal-form${isSddSpecialDocumentActive ? ' locked' : ''}`}>
            <div className="form-group">
              <label htmlFor="purpose-input">Purpose</label>
              <textarea
                id="purpose-input"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                readOnly={isSddSpecialDocumentActive}
                placeholder={isSddSpecialDocumentActive && purpose.trim() === ''
                  ? 'Goals are not configured in SDD documents.'
                  : 'e.g., Organize feature flow/design requirements and derive expected outcomes'}
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="audience-input">Audience</label>
                <input
                  id="audience-input"
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  readOnly={isSddSpecialDocumentActive}
                  placeholder="e.g., Developers, PO, Designers"
                />
              </div>
              <div className="form-group">
                <label htmlFor="tone-input">Tone</label>
                <input
                  id="tone-input"
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  readOnly={isSddSpecialDocumentActive}
                  placeholder="e.g., Technical, logical, concise"
                />
              </div>
            </div>

            <div className="form-group">
              <span className="form-label">Target Length</span>
              <div className="segment-control">
                {(['short', 'medium', 'long'] as const).map((len) => (
                  <button
                    key={len}
                    type="button"
                    className={`segment-item ${targetLength === len ? 'active' : ''}`}
                    onClick={() => setTargetLength(len)}
                    disabled={isSddSpecialDocumentActive}
                  >
                    {len === 'short' ? 'Short' : len === 'medium' ? 'Medium' : 'Long'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="writing-goal-actions">
          <button type="button" onClick={handleReset} className="btn-ghost" disabled={isSddSpecialDocumentActive}>Reset</button>
          <button type="button" onClick={handleApply} className="wg-btn-primary" disabled={isSddSpecialDocumentActive}>Apply Goal</button>
        </div>
      </div>
    </div>
  );
}
