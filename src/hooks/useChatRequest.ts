import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../api';
import { extractJSON } from '../utils/parser';
import { validatePhase1Response, validatePhase2Response } from '../prompts/types';

export interface SelectionContext {
  text: string;
  before: string;
  after: string;
}

export interface ChatRequestOptions {
  selection?: SelectionContext;
}

export function useChatRequest() {
  const {
    messages,
    canvasContent,
    addMessage,
    updateLastMessage,
    setCanvasContent,
    setIsLoading,
    startAiRun,
    setAiPhase,
    setAiRunResult,
    saveCanvasSnapshot,
    clearAiRun,
  } = useStore();

  const runPhase2 = useCallback(
    async (userRequest: string, updatePlan: string) => {
      console.log('[runPhase2] Starting Phase 2');
      setAiPhase('updating');
      saveCanvasSnapshot();

      let fullResponse = '';
      const currentCanvasContent = useStore.getState().canvasContent;

      await api.chatPhase2(
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
            console.error('[runPhase2] Error:', error);
            setAiRunResult({ error: { phase: 'updating', message: error } });
            setAiPhase('failed');
            setIsLoading(false);
          },
          onDone: () => {
            console.log('[runPhase2] onDone called, fullResponse length:', fullResponse.length);
            const jsonText = extractJSON(fullResponse);
            console.log('[runPhase2] Extracted JSON:', jsonText?.slice(0, 200));
            if (!jsonText) {
              console.error('[runPhase2] No JSON found in response');
              setAiPhase('failed');
              clearAiRun();
              setIsLoading(false);
              return;
            }

            try {
              const parsed = JSON.parse(jsonText);
              const phase2Result = validatePhase2Response(parsed);

              if (phase2Result) {
                console.log('[runPhase2] Phase 2 succeeded');
                updateLastMessage('\n\n' + phase2Result.message);
                setCanvasContent(phase2Result.canvasContent);
                setAiPhase('succeeded');
              } else {
                console.error('[runPhase2] Invalid Phase 2 response');
                setAiPhase('failed');
              }
            } catch (e) {
              console.error('[runPhase2] JSON parse error:', e);
              setAiPhase('failed');
            }

            clearAiRun();
            setIsLoading(false);
          },
        }
      );
      console.log('[runPhase2] api.chatPhase2 completed');
    },
    [setAiPhase, saveCanvasSnapshot, setAiRunResult, setIsLoading, clearAiRun, updateLastMessage, setCanvasContent]
  );

  const sendMessage = useCallback(
    async (prompt: string, options?: ChatRequestOptions) => {
      if (!prompt.trim()) return;

      addMessage('user', prompt);
      setIsLoading(true);
      startAiRun();

      const history = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      let fullResponse = '';

      await api.chat(
        prompt,
        {
          onText: (text) => {
            fullResponse = text;
          },
          onError: (error) => {
            addMessage('assistant', `오류가 발생했습니다: ${error}`);
            setAiRunResult({ error: { phase: 'evaluating', message: error } });
            setAiPhase('failed');
            setIsLoading(false);
            clearAiRun();
          },
          onDone: async () => {
            console.log('[sendMessage] onDone called, fullResponse length:', fullResponse.length);
            const jsonText = extractJSON(fullResponse);
            console.log('[sendMessage] Extracted JSON:', jsonText?.slice(0, 200));
            if (!jsonText) {
              console.log('[sendMessage] No JSON found, showing raw response');
              addMessage('assistant', fullResponse);
              setIsLoading(false);
              clearAiRun();
              return;
            }

            try {
              const parsed = JSON.parse(jsonText);
              const phase1Result = validatePhase1Response(parsed);
              console.log('[sendMessage] Phase 1 result:', phase1Result);

              if (phase1Result) {
                setAiRunResult({
                  message: phase1Result.message,
                  needsCanvasUpdate: phase1Result.needsCanvasUpdate,
                  updatePlan: phase1Result.updatePlan,
                });

                if (phase1Result.needsCanvasUpdate && phase1Result.updatePlan) {
                  console.log('[sendMessage] Starting Phase 2...');
                  addMessage('assistant', phase1Result.message);
                  await runPhase2(prompt, phase1Result.updatePlan);
                  console.log('[sendMessage] Phase 2 completed');
                } else {
                  addMessage('assistant', phase1Result.message);
                  setAiPhase('succeeded');
                  clearAiRun();
                  setIsLoading(false);
                }
              } else {
                const messageOnly = parsed?.message || fullResponse;
                addMessage('assistant', messageOnly);
                clearAiRun();
                setIsLoading(false);
              }
            } catch (e) {
              console.error('[sendMessage] Error processing response:', e);
              try {
                const parsed = JSON.parse(jsonText);
                const messageOnly = parsed?.message || fullResponse;
                addMessage('assistant', messageOnly);
              } catch {
                addMessage('assistant', fullResponse);
              }
              clearAiRun();
              setIsLoading(false);
            }
          },
        },
        history,
        {
          canvasContent,
          selection: options?.selection,
        }
      );
    },
    [
      messages,
      canvasContent,
      addMessage,
      setIsLoading,
      startAiRun,
      setAiRunResult,
      setAiPhase,
      clearAiRun,
      runPhase2,
    ]
  );

  return { sendMessage };
}
