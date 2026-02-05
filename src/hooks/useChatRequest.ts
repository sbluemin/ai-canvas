import { useCallback } from 'react';
import { useStore, ErrorInfo } from '../store/useStore';
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

const ERROR_TYPE_MESSAGES: Record<string, { title: string; message: string }> = {
  rate_limit_error: {
    title: '요청 한도 초과',
    message: '계정의 API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.',
  },
  authentication_error: {
    title: '인증 오류',
    message: '인증에 문제가 있습니다. 다시 로그인해주세요.',
  },
  invalid_api_key: {
    title: '잘못된 API 키',
    message: 'API 키가 유효하지 않습니다. 인증 정보를 확인해주세요.',
  },
  overloaded_error: {
    title: '서버 과부하',
    message: 'AI 서버가 현재 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
  },
  insufficient_quota: {
    title: '크레딧 부족',
    message: '계정의 크레딧이 부족합니다. 요금제를 확인해주세요.',
  },
};

const HTTP_STATUS_MESSAGES: Record<number, { title: string; message: string }> = {
  401: { title: '인증 오류', message: '인증에 실패했습니다. 다시 로그인해주세요.' },
  403: { title: '접근 거부', message: '이 요청에 대한 권한이 없습니다.' },
  429: { title: '요청 한도 초과', message: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.' },
  500: { title: '서버 오류', message: 'AI 서버에 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
  502: { title: '서버 연결 실패', message: 'AI 서버에 연결할 수 없습니다.' },
  503: { title: '서비스 이용 불가', message: 'AI 서비스가 일시적으로 이용 불가합니다.' },
};

function parseApiError(error: string): ErrorInfo {
  const jsonMatch = error.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const errorType = parsed.error?.type || 'unknown_error';
      const message = parsed.error?.message || error;
      
      const friendlyError = ERROR_TYPE_MESSAGES[errorType] || {
        title: 'AI 요청 실패',
        message: message,
      };
      
      return {
        title: friendlyError.title,
        message: friendlyError.message,
        details: JSON.stringify(parsed, null, 2),
      };
    } catch {
    }
  }
  
  const statusMatch = error.match(/\((\d{3})\)/);
  const statusCode = statusMatch ? parseInt(statusMatch[1]) : null;
  
  if (statusCode) {
    const statusError = HTTP_STATUS_MESSAGES[statusCode];
    if (statusError) {
      return { ...statusError, details: error };
    }
  }
  
  return {
    title: 'AI 요청 실패',
    message: '요청 처리 중 오류가 발생했습니다.',
    details: error,
  };
}

export function useChatRequest() {
  const {
    messages,
    canvasContent,
    addMessage,
    removeLastUserMessage,
    removeLastAssistantMessage,
    updateLastMessage,
    setCanvasContent,
    setIsLoading,
    startAiRun,
    setAiPhase,
    setAiRunResult,
    saveCanvasSnapshot,
    clearAiRun,
    activeProvider,
    showError,
  } = useStore();

  const runPhase2 = useCallback(
    async (userRequest: string, updatePlan: string) => {
      setAiPhase('updating');
      saveCanvasSnapshot();

      let hasError = false;
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
            hasError = true;
            removeLastAssistantMessage();
            removeLastUserMessage();
            showError(parseApiError(error));
            setAiRunResult({ error: { phase: 'updating', message: error } });
            setAiPhase('failed');
            setIsLoading(false);
            clearAiRun();
          },
          onDone: () => {
            if (hasError) return;
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
        },
        activeProvider
      );
    },
    [setAiPhase, saveCanvasSnapshot, setAiRunResult, setIsLoading, clearAiRun, updateLastMessage, setCanvasContent, activeProvider, showError, removeLastAssistantMessage, removeLastUserMessage]
  );

  const sendMessage = useCallback(
    async (prompt: string, options?: ChatRequestOptions) => {
      if (!prompt.trim()) return;

      addMessage('user', prompt);
      setIsLoading(true);
      startAiRun();

      const history = messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      let hasError = false;
      let fullResponse = '';

      await api.chat(
        prompt,
        {
          onText: (text) => {
            fullResponse = text;
          },
          onError: (error) => {
            hasError = true;
            removeLastUserMessage();
            showError(parseApiError(error));
            setAiRunResult({ error: { phase: 'evaluating', message: error } });
            setAiPhase('failed');
            setIsLoading(false);
            clearAiRun();
          },
          onDone: async () => {
            if (hasError) return;
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
        },
        activeProvider
      );
    },
    [
      messages,
      canvasContent,
      addMessage,
      removeLastUserMessage,
      setIsLoading,
      startAiRun,
      setAiRunResult,
      setAiPhase,
      clearAiRun,
      runPhase2,
      activeProvider,
      showError,
    ]
  );

  return { sendMessage };
}
