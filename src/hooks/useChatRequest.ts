import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../shared/api';
import { extractJSON } from '../shared/ai/parser';
import { validatePhase1Response, validatePhase2Response } from '../shared/prompts/types';

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
            fullResponse += text;
          },
          onError: (error) => {
            setAiRunResult({ error: { phase: 'updating', message: error } });
            setAiPhase('failed');
            setIsLoading(false);
          },
          onDone: () => {
            const jsonText = extractJSON(fullResponse);
            if (!jsonText) {
              setAiPhase('failed');
              clearAiRun();
              setIsLoading(false);
              return;
            }

            try {
              const parsed = JSON.parse(jsonText);
              const phase2Result = validatePhase2Response(parsed);

              if (phase2Result) {
                updateLastMessage('\n\n' + phase2Result.message);
                setCanvasContent(phase2Result.canvasContent);
                setAiPhase('succeeded');
              } else {
                setAiPhase('failed');
              }
            } catch {
              setAiPhase('failed');
            }

            clearAiRun();
            setIsLoading(false);
          },
        }
      );
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
            fullResponse += text;
          },
          onError: (error) => {
            addMessage('assistant', `오류가 발생했습니다: ${error}`);
            setAiRunResult({ error: { phase: 'evaluating', message: error } });
            setAiPhase('failed');
            setIsLoading(false);
            clearAiRun();
          },
          onDone: async () => {
            const jsonText = extractJSON(fullResponse);
            if (!jsonText) {
              addMessage('assistant', fullResponse);
              setIsLoading(false);
              clearAiRun();
              return;
            }

            try {
              const parsed = JSON.parse(jsonText);
              const phase1Result = validatePhase1Response(parsed);

              if (phase1Result) {
                setAiRunResult({
                  message: phase1Result.message,
                  needsCanvasUpdate: phase1Result.needsCanvasUpdate,
                  updatePlan: phase1Result.updatePlan,
                });

                if (phase1Result.needsCanvasUpdate && phase1Result.updatePlan) {
                  addMessage('assistant', phase1Result.message);
                  await runPhase2(prompt, phase1Result.updatePlan);
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
            } catch {
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
