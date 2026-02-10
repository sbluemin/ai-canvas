import { useState, useEffect } from 'react';
import { useStore, WritingGoal, WritingGoalPreset } from '../store/useStore';
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
        <div className="writing-goal-header">
          <h3>문서 작성 목표 설정</h3>
          <button type="button" onClick={closeWritingGoal} aria-label="닫기">
            닫기
          </button>
        </div>

        {/* 프리셋 선택 영역 */}
        <div className="writing-goal-presets">
          <label>프리셋</label>
          <div className="preset-chips">
            {writingGoalPresets.map((preset) => (
              <div
                key={preset.id}
                className={`preset-chip ${selectedPresetId === preset.id ? 'active' : ''}`}
                onClick={() => handlePresetClick(preset)}
              >
                <span>{preset.name}</span>
                <button
                  type="button"
                  className="preset-delete"
                  onClick={(e) => handleDeletePreset(preset.id, e)}
                  aria-label="프리셋 삭제"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 커스텀 입력 영역 */}
        <div className="writing-goal-form">
          <label htmlFor="purpose-input">문서 목적</label>
          <textarea
            id="purpose-input"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="예: 회의 내용 정리 및 결정사항 기록"
            rows={3}
          />

          <label htmlFor="audience-input">대상 독자</label>
          <input
            id="audience-input"
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="예: 팀원, 경영진, 일반 독자"
          />

          <label htmlFor="tone-input">어조</label>
          <input
            id="tone-input"
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="예: 간결하고 명확한, 격식체, 친근한"
          />

          <label htmlFor="length-select">목표 길이</label>
          <select
            id="length-select"
            value={targetLength}
            onChange={(e) => setTargetLength(e.target.value as 'short' | 'medium' | 'long')}
          >
            <option value="short">짧게 (1-2 페이지)</option>
            <option value="medium">중간 (3-5 페이지)</option>
            <option value="long">길게 (5+ 페이지)</option>
          </select>
        </div>

        {/* 하단 버튼 그룹 */}
        <div className="writing-goal-actions">
          <button type="button" onClick={handleSavePreset} className="btn-secondary">
            프리셋 저장
          </button>
          <div className="action-buttons-right">
            <button type="button" onClick={handleReset} className="btn-reset">
              초기화
            </button>
            <button type="button" onClick={handleApply} className="btn-primary">
              적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
