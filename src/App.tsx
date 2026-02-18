import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { CommandBar } from './components/CommandBar';
import { ChatPanel } from './components/ChatPanel';
import { CanvasPanel } from './components/CanvasPanel';
import { ErrorPopup } from './components/ErrorPopup';
import { ToastContainer } from './components/ToastContainer';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { WritingGoalModal } from './components/WritingGoalModal';
import { useStore } from './store/useStore';
import { api } from './api';
import { AUTOSAVE_DELAY, logger } from './utils';
import './App.css';

const DESKTOP_BREAKPOINT = 1024;

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < DESKTOP_BREAKPOINT);
  const {
    isDrawerOpen,
    toggleDrawer,
    closeDrawer,
    setAvailableModels,
    setModelsLoading,
    settings,
    setTheme,
    toggleSettings,
    addToast,
    projectPath,
    features,
    activeFeatureId,
    activeCanvasFile,
    canvasContent,
    conversations,
    activeConversationId,
    canvasFiles,
    autosaveStatus,
    selectedModels,
    selectedVariant,
    activeWritingGoal,
  } = useStore();
  const isThemeHydratedRef = useRef(false);

  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
    if (!isElectron) return;

    setModelsLoading(true);
    window.electronAPI.ai.fetchModels()
      .then((result) => {
        if (result.success && result.models) {
          setAvailableModels(result.models);
        }
      })
      .catch((error) => logger.error('Auto-fetch models failed:', error))
      .finally(() => setModelsLoading(false));
  }, [setAvailableModels, setModelsLoading]);

  useLayoutEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.classList.add('ready');
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    
    const applyTheme = () => {
      if (settings.theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.dataset.theme = isDark ? 'dark' : 'light';
      } else {
        root.dataset.theme = settings.theme;
      }
    };

    applyTheme();

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.theme]);

  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
    if (!isElectron) {
      isThemeHydratedRef.current = true;
      return;
    }

    api.readAppSettings()
      .then((result) => {
        if (result.success && result.settings?.theme) {
          setTheme(result.settings.theme);
        }
      })
      .finally(() => {
        isThemeHydratedRef.current = true;
      });
  }, [setTheme]);

  useEffect(() => {
    if (!isThemeHydratedRef.current) return;
    api.writeAppSettings({ theme: settings.theme }).catch((error: unknown) => {
      logger.error('App settings save failed:', error);
    });
  }, [settings.theme]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key === ',') {
        e.preventDefault();
        toggleSettings();
        return;
      }

      if (e.key.toLowerCase() === 's') {
        if (!projectPath || !activeCanvasFile) return;
        e.preventDefault();
        api.writeCanvasFile(projectPath, activeCanvasFile, canvasContent)
          .then((result) => {
            if (result.success) {
              addToast('success', `${activeCanvasFile} saved`);
            } else {
              addToast('error', `Save failed: ${result.error ?? 'Unknown error'}`);
            }
          })
          .catch((error: unknown) => {
            addToast('error', `Save failed: ${String(error)}`);
          });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCanvasFile, addToast, canvasContent, projectPath, toggleSettings]);

  useEffect(() => {
    if (!projectPath) return;
    const timer = window.setTimeout(async () => {
      const workspaceResult = await api.readWorkspace(projectPath);
      const baseWorkspace = workspaceResult.success && workspaceResult.workspace && typeof workspaceResult.workspace === 'object'
        ? workspaceResult.workspace as Record<string, unknown>
        : {};

      const workspace = {
        ...baseWorkspace,
        featureOrder: features.map((feature) => feature.id),
        activeFeatureId,
        featureConversations: {
          ...(baseWorkspace.featureConversations && typeof baseWorkspace.featureConversations === 'object'
            ? baseWorkspace.featureConversations as Record<string, unknown>
            : {}),
          ...(activeFeatureId
            ? {
                [activeFeatureId]: conversations.map((conv) => ({
                  ...conv,
                  messages: conv.messages.map((msg) => ({
                    ...msg,
                    timestamp: msg.timestamp.toISOString(),
                  })),
                })),
              }
            : {}),
        },
        featureActiveConversationIds: {
          ...(baseWorkspace.featureActiveConversationIds && typeof baseWorkspace.featureActiveConversationIds === 'object'
            ? baseWorkspace.featureActiveConversationIds as Record<string, unknown>
            : {}),
          ...(activeFeatureId ? { [activeFeatureId]: activeConversationId } : {}),
        },
        canvasOrder: canvasFiles,
        autosaveStatus,
        selectedModels,
        selectedVariant,
      };

      api.writeWorkspace(projectPath, workspace).catch((error: unknown) => {
        logger.error('Workspace save failed:', error);
      });
    }, AUTOSAVE_DELAY);

    return () => window.clearTimeout(timer);
  }, [projectPath, features, activeFeatureId, conversations, activeConversationId, canvasFiles, autosaveStatus, selectedModels, selectedVariant]);

  useEffect(() => {
    if (!projectPath || !activeFeatureId) return;

    const timer = window.setTimeout(async () => {
      const metaResult = await api.readFeatureMeta(projectPath, activeFeatureId);
      const baseMeta = metaResult.success && metaResult.meta && typeof metaResult.meta === 'object'
        ? metaResult.meta as Record<string, unknown>
        : {};
      const nextMeta = {
        ...baseMeta,
        writingGoal: activeWritingGoal,
        updatedAt: new Date().toISOString(),
      };
      api.writeFeatureMeta(projectPath, activeFeatureId, nextMeta).catch((error: unknown) => {
        logger.error('Feature meta save failed:', error);
      });
    }, AUTOSAVE_DELAY);

    return () => window.clearTimeout(timer);
  }, [projectPath, activeFeatureId, activeWritingGoal]);

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
        <SettingsModal />
        <WritingGoalModal />
        <ExportModal />
        <ToastContainer />
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
      <SettingsModal />
      <WritingGoalModal />
      <ExportModal />
      <ToastContainer />
      <ErrorPopup />
    </div>
  );
}

export default App;
