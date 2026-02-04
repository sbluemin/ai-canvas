import { useState, useEffect, useLayoutEffect } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { CommandBar } from './components/CommandBar';
import { CanvasPanel } from './components/CanvasPanel';
import { FloatingChatButton } from './components/FloatingChatButton';
import { ChatPopup } from './components/ChatPopup';
import './App.css';

const DESKTOP_BREAKPOINT = 1024;

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < DESKTOP_BREAKPOINT);

  useLayoutEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.classList.add('ready');
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < DESKTOP_BREAKPOINT;
      setIsMobile(mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
      <div className="app-container mobile">
        <div className="mobile-canvas">
          <CanvasPanel provider="gemini" />
        </div>
        <FloatingChatButton />
        <ChatPopup />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-layout">
        <CommandBar />
        <div className="content-split">
          <Allotment>
            <Allotment.Pane minSize={400}>
              <CanvasPanel provider="gemini" />
            </Allotment.Pane>
            <Allotment.Pane minSize={400}>
              <CanvasPanel provider="codex" />
            </Allotment.Pane>
          </Allotment>
        </div>
        <FloatingChatButton />
        <ChatPopup />
      </div>
    </div>
  );
}

export default App;
