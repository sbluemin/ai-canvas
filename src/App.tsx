import { useState, useEffect, useLayoutEffect } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { CommandBar } from './components/CommandBar';
import { ChatPanel } from './components/ChatPanel';
import { CanvasPanel } from './components/CanvasPanel';
import { ErrorPopup } from './components/ErrorPopup';
import { useStore } from './store/useStore';
import './App.css';

const DESKTOP_BREAKPOINT = 1024;

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < DESKTOP_BREAKPOINT);
  const { isDrawerOpen, toggleDrawer, closeDrawer } = useStore();

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
      if (!mobile && isDrawerOpen) {
        closeDrawer();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDrawerOpen, closeDrawer]);

  if (isMobile) {
    return (
      <div className="app-container mobile">
        <button 
          className="drawer-toggle-btn" 
          onClick={toggleDrawer}
          aria-label="Toggle chat"
        >
          <span className="hamburger-icon" />
        </button>
        
        <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={closeDrawer} />
        
        <div className={`drawer ${isDrawerOpen ? 'open' : ''}`}>
          <ChatPanel />
        </div>
        
        <div className="mobile-canvas">
          <CanvasPanel />
        </div>
        <ErrorPopup />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-layout">
        <CommandBar />
        <div className="content-split">
          <Allotment>
            <Allotment.Pane minSize={320} maxSize={480} preferredSize="35%">
              <ChatPanel />
            </Allotment.Pane>
            <Allotment.Pane minSize={500}>
              <CanvasPanel />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
      <ErrorPopup />
    </div>
  );
}

export default App;
