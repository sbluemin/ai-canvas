import { useCallback } from 'react';
import { useStore, type CanvasProvider } from '../store/useStore';
import { api } from '../api';
import { extractJSON } from '../utils/parser';
import { validatePhase1Response, validatePhase2Response } from '../prompts/types';
import type { ChatHistory } from '../types';

export interface SelectionContext {
  text: string;
  before: string;
  after: string;
}

export interface ChatRequestOptions {
  selection?: SelectionContext;
  updateAllProviders?: boolean;
  targetProvider?: CanvasProvider;
}

export function useChatRequest() {
  const {
    messages,
    addMessage,
    updateLastMessage,
    setProviderCanvasContent,
    setIsLoading,
    startAiRun,
    setAiPhase,
    saveCanvasSnapshot,
    clearAiRun,
    isAuthenticated,
    isCodexAuthenticated,
    startProviderAiRun,
    setProviderAiPhase,
    clearProviderAiRun,
  } = useStore();

  const runPhase2ForProvider = useCallback(
    async (
      provider: CanvasProvider,
      userRequest: string,
      updatePlan: string
    ) => {
      console.log(`[runPhase2] Starting Phase 2 for ${provider}`);
      
      const state = useStore.getState();
      const currentCanvasContent = provider === 'gemini' 
        ? state.geminiCanvasContent 
        : state.codexCanvasContent;

      let fullResponse = '';

      await api.chatPhase2WithProvider(
        provider,
        {
          userRequest,
          canvasContent: currentCanvasContent,
          updatePlan,
        },
        {
          onText: (text) => {
            fullResponse = text;
          },
          onError: (error) => {
            console.error(`[runPhase2] Error for ${provider}:`, error);
            updateLastMessage(`\n\n❌ 캔버스 업데이트 실패: ${error}`, provider);
          },
          onDone: () => {
            console.log(`[runPhase2] onDone for ${provider}, response length:`, fullResponse.length);
            const jsonText = extractJSON(fullResponse);
            if (!jsonText) {
              console.error(`[runPhase2] No JSON found for ${provider}`);
              return;
            }

            try {
              const parsed = JSON.parse(jsonText);
              const phase2Result = validatePhase2Response(parsed);

              if (phase2Result) {
                console.log(`[runPhase2] Phase 2 succeeded for ${provider}`);
                updateLastMessage('\n\n' + phase2Result.message, provider);
                setProviderCanvasContent(provider, phase2Result.canvasContent);
              }
            } catch (e) {
              console.error(`[runPhase2] JSON parse error for ${provider}:`, e);
            }
          },
        }
      );
    },
    [updateLastMessage, setProviderCanvasContent]
  );

  const sendMessageToProvider = useCallback(
    async (
      provider: CanvasProvider,
      prompt: string,
      history: ChatHistory[],
      options?: ChatRequestOptions
    ) => {
      const state = useStore.getState();
      const providerCanvasContent = provider === 'gemini'
        ? state.geminiCanvasContent
        : state.codexCanvasContent;

      startProviderAiRun(provider);
      addMessage('assistant', '', provider);

      let fullResponse = '';

      await api.chatWithProvider(
        provider,
        prompt,
        {
          onText: (text) => {
            fullResponse = text;
          },
          onError: (error) => {
            updateLastMessage(`오류가 발생했습니다: ${error}`, provider);
            clearProviderAiRun(provider);
          },
          onDone: async () => {
            console.log(`[sendMessage] onDone for ${provider}, response length:`, fullResponse.length);
            const jsonText = extractJSON(fullResponse);
            
            if (!jsonText) {
              console.log(`[sendMessage] No JSON found for ${provider}, showing raw response`);
              updateLastMessage(fullResponse || '응답 없음', provider);
              clearProviderAiRun(provider);
              return;
            }

            try {
              const parsed = JSON.parse(jsonText);
              const phase1Result = validatePhase1Response(parsed);

              if (phase1Result) {
                updateLastMessage(phase1Result.message, provider);

                if (phase1Result.needsCanvasUpdate && phase1Result.updatePlan) {
                  console.log(`[sendMessage] Starting Phase 2 for ${provider}...`);
                  setProviderAiPhase(provider, 'updating');
                  await runPhase2ForProvider(provider, prompt, phase1Result.updatePlan);
                }
              } else {
                const messageOnly = parsed?.message || fullResponse;
                updateLastMessage(messageOnly, provider);
              }
            } catch (e) {
              console.error(`[sendMessage] Error processing response for ${provider}:`, e);
              try {
                const parsed = JSON.parse(jsonText);
                const messageOnly = parsed?.message || fullResponse;
                updateLastMessage(messageOnly, provider);
              } catch {
                updateLastMessage(fullResponse, provider);
              }
            } finally {
              setProviderAiPhase(provider, 'succeeded');
              clearProviderAiRun(provider);
            }
          },
        },
        history,
        {
          canvasContent: providerCanvasContent,
          selection: options?.selection,
        }
      );
    },
    [addMessage, updateLastMessage, runPhase2ForProvider, startProviderAiRun, setProviderAiPhase, clearProviderAiRun]
  );

  const sendMessage = useCallback(
    async (prompt: string, options?: ChatRequestOptions) => {
      if (!prompt.trim()) return;

      const activeProviders: CanvasProvider[] = [];
      
      if (options?.targetProvider) {
        const target = options.targetProvider;
        const isTargetAuthenticated = target === 'gemini' ? isAuthenticated : isCodexAuthenticated;
        if (isTargetAuthenticated) {
          activeProviders.push(target);
        }
      } else {
        if (isAuthenticated) activeProviders.push('gemini');
        if (isCodexAuthenticated) activeProviders.push('codex');
      }

      if (activeProviders.length === 0) {
        addMessage('assistant', '로그인된 AI 프로바이더가 없습니다. Gemini 또는 Codex에 로그인해주세요.');
        return;
      }

      if (options?.targetProvider) {
        addMessage('user', prompt, options.targetProvider);
      } else {
        addMessage('user', prompt);
      }

      setIsLoading(true);
      startAiRun();
      setAiPhase('evaluating');
      saveCanvasSnapshot();

      const history = messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      try {
        await Promise.all(
          activeProviders.map((provider) =>
            sendMessageToProvider(provider, prompt, history, options)
          )
        );
      } finally {
        setAiPhase('succeeded');
        clearAiRun();
        setIsLoading(false);
      }
    },
    [
      messages,
      addMessage,
      setIsLoading,
      startAiRun,
      setAiPhase,
      saveCanvasSnapshot,
      clearAiRun,
      isAuthenticated,
      isCodexAuthenticated,
      sendMessageToProvider,
    ]
  );

  return { sendMessage };
}
