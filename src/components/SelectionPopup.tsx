import { useState } from 'react';
import './SelectionPopup.css';

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z" fill="url(#sparkle-gradient)" />
      <defs>
        <linearGradient id="sparkle-gradient" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#4285f4" />
          <stop offset="0.5" stopColor="#9b72cb" />
          <stop offset="1" stopColor="#d96570" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface SelectionPopupProps {
  selectedText?: string;
  isVisible?: boolean;
}

export function SelectionPopup({ 
  selectedText = "", 
  isVisible = true 
}: SelectionPopupProps) {
  const [inputValue, setInputValue] = useState('');

  if (!isVisible || !selectedText) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('AI 질문 제출:', inputValue, '선택된 텍스트:', selectedText);
  };

  const handleInputMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const truncatedText = selectedText.length > 50 
    ? selectedText.substring(0, 50) + '...' 
    : selectedText;

  return (
    <div className="selection-popup-container">
      <form className="selection-popup" onSubmit={handleSubmit}>
        <div className="popup-icon">
          <SparkleIcon />
        </div>
        <input
          type="text"
          className="popup-input"
          placeholder={`"${truncatedText}" 에 대해 물어보기`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onMouseDown={handleInputMouseDown}
        />
      </form>
    </div>
  );
}
