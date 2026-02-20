import { useState, useEffect } from 'react';
import { useStore, WritingGoal, WritingGoalPreset } from '../store/useStore';
import { CloseIcon, PlusIcon, TrashIcon } from './Icons';
import './WritingGoalModal.css';

export function WritingGoalModal() {
  const {
    isWritingGoalOpen,
    closeWritingGoal,
    activeWritingGoal,
    setActiveWritingGoal,
    writingGoalPresets,
    addWritingGoalPreset,
    removeWritingGoalPreset,
  } = useStore();

  // 폼 상태
  const [purpose, setPurpose] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [targetLength, setTargetLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

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

  // 프리셋 선택 핸들러
  const handlePresetClick = (preset: WritingGoalPreset) => {
    setPurpose(preset.goal.purpose);
    setAudience(preset.goal.audience);
    setTone(preset.goal.tone);
    setTargetLength(preset.goal.targetLength);
    setSelectedPresetId(preset.id);
  };

  // 적용 버튼 핸들러
  const handleApply = () => {
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
    setActiveWritingGoal(null);
    closeWritingGoal();
  };

  // 프리셋 저장 핸들러
  const handleSavePreset = () => {
    const name = prompt('프리셋 이름을 입력하세요:');
    if (!name) return;

    const newPreset: WritingGoalPreset = {
      id: `custom-${Date.now()}`,
      name,
      goal: {
        purpose,
        audience,
        tone,
        targetLength,
      },
    };
    addWritingGoalPreset(newPreset);
    setSelectedPresetId(newPreset.id);
  };

  // 프리셋 삭제 핸들러
  const handleDeletePreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 프리셋을 삭제하시겠습니까?')) {
      removeWritingGoalPreset(presetId);
      if (selectedPresetId === presetId) {
        setSelectedPresetId(null);
      }
    }
  };

  return (
    <div className="writing-goal-overlay" onClick={closeWritingGoal}>
      <div className="writing-goal-modal" onClick={(e) => e.stopPropagation()}>
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
          {/* 프리셋 섹션 */}
          <section className="writing-goal-section">
            <div className="section-header">
              <label>프리셋</label>
              <button type="button" className="btn-ghost-sm" onClick={handleSavePreset}>
                <PlusIcon width={14} height={14} /> <span>저장</span>
              </button>
            </div>
            <div className="preset-chips">
              {writingGoalPresets.map((preset) => (
                <div
                  key={preset.id}
                  className={`preset-chip ${selectedPresetId === preset.id ? 'active' : ''}`}
                  onClick={() => handlePresetClick(preset)}
                >
                  <span className="preset-name">{preset.name}</span>
                  <button
                    type="button"
                    className="preset-delete"
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    aria-label="프리셋 삭제"
                  >
                    <TrashIcon width={12} height={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 커스텀 입력 폼 */}
          <div className="writing-goal-form">
            <div className="form-group">
              <label htmlFor="purpose-input">문서 목적</label>
              <textarea
                id="purpose-input"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="예: 기능 플로우/디자인 요구사항 정리 및 기대 결과 도출"
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
                  placeholder="예: 기술적이고 논리적인, 간결한"
                />
              </div>
            </div>

            <div className="form-group">
              <label>목표 길이</label>
              <div className="segment-control">
                {(['short', 'medium', 'long'] as const).map((len) => (
                  <button
                    key={len}
                    type="button"
                    className={`segment-item ${targetLength === len ? 'active' : ''}`}
                    onClick={() => setTargetLength(len)}
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
          <button type="button" onClick={handleReset} className="btn-ghost">초기화</button>
          <button type="button" onClick={handleApply} className="wg-btn-primary">목표 적용하기</button>
        </div>
      </div>
    </div>
  );
}
