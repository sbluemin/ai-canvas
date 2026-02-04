import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import './FloatingChatButton.css';

type AnimationPhase = 'idle' | 'moving-to-center' | 'expanding' | 'open' | 'contracting' | 'returning';

const TIMING = {
  MOVE_TO_CENTER: 300,
  EXPAND: 400,
  CONTRACT: 300,
  RETURN: 300,
} as const;

export function FloatingChatButton() {
  const { isClosingChatPopup, shouldTriggerChatOpen, openChatPopup, finishCloseChatPopup, clearChatOpenTrigger } = useStore();
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [isVisible, setIsVisible] = useState(true);

  const runOpenSequence = useCallback(() => {
    if (animationPhase !== 'idle') return;
    
    setAnimationPhase('moving-to-center');
    
    setTimeout(() => {
      setAnimationPhase('expanding');
      
      setTimeout(() => {
        setAnimationPhase('open');
        setIsVisible(false);
        openChatPopup();
      }, TIMING.EXPAND);
    }, TIMING.MOVE_TO_CENTER);
  }, [animationPhase, openChatPopup]);

  const runCloseSequence = useCallback(() => {
    setIsVisible(true);
    setAnimationPhase('contracting');
    
    setTimeout(() => {
      setAnimationPhase('returning');
      finishCloseChatPopup();
      
      setTimeout(() => {
        setAnimationPhase('idle');
      }, TIMING.RETURN);
    }, TIMING.CONTRACT);
  }, [finishCloseChatPopup]);

  useEffect(() => {
    if (isClosingChatPopup && animationPhase === 'open') {
      runCloseSequence();
    }
  }, [isClosingChatPopup, animationPhase, runCloseSequence]);

  useEffect(() => {
    if (shouldTriggerChatOpen && animationPhase === 'idle') {
      clearChatOpenTrigger();
      runOpenSequence();
    }
  }, [shouldTriggerChatOpen, animationPhase, clearChatOpenTrigger, runOpenSequence]);

  const handleClick = () => {
    if (animationPhase === 'idle') {
      runOpenSequence();
    }
  };

  const buttonClasses = [
    'floating-chat-btn',
    animationPhase !== 'idle' ? `phase-${animationPhase}` : '',
    !isVisible ? 'hidden' : '',
  ].filter(Boolean).join(' ');

  return (
    <button 
      className={buttonClasses}
      onClick={handleClick}
      aria-label="Toggle chat"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

export { type AnimationPhase };
