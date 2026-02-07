import { useCallback, useEffect, useRef } from 'react';
import { useStore, ErrorInfo } from '../store/useStore';
import { api } from '../api';

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
    setLastMessageContent,
    setCanvasContent,
    setIsLoading,
    startAiRun,
    setAiPhase,
    setAiRunResult,
    saveCanvasSnapshot,
    clearAiRun,
    activeProvider,
    selectedModels,
    showError,
  } = useStore();

  const currentRunIdRef = useRef<string | null>(null);
  const hasStreamingAssistantRef = useRef(false);
  const streamedPhase1MessageRef = useRef('');
  const streamedPhase2MessageRef = useRef('');
  const phase2FinalMessageRef = useRef('');
  const hasPhase2StreamEventRef = useRef(false);

  useEffect(() => {
    if (!api.isElectron) return;

    const unsubscribe = api.onChatEvent((event) => {
      if (event.runId !== currentRunIdRef.current) {
        return;
      }

        switch (event.type) {
          case 'phase_message_stream': {
            if (!hasStreamingAssistantRef.current) {
              addMessage('assistant', '', activeProvider);
              hasStreamingAssistantRef.current = true;
            }

            if (event.phase === 'evaluating') {
              streamedPhase1MessageRef.current = event.message;
              setLastMessageContent(event.message);
            } else {
              hasPhase2StreamEventRef.current = true;
              streamedPhase2MessageRef.current = event.message;
              const combined = streamedPhase1MessageRef.current
                ? `${streamedPhase1MessageRef.current}\n\n${event.message}`
                : event.message;
              setLastMessageContent(combined);
            }
            break;
          }

          case 'phase':
            setAiPhase(event.phase === 'evaluating' ? 'evaluating' : 'updating');
            if (event.phase === 'updating') {
              saveCanvasSnapshot();
            }
            break;

          case 'phase1_result':
            setAiRunResult({
              message: event.message,
              needsCanvasUpdate: event.needsCanvasUpdate,
              updatePlan: event.updatePlan,
            });
            streamedPhase1MessageRef.current = event.message;
            if (hasStreamingAssistantRef.current) {
              setLastMessageContent(event.message);
            } else {
              addMessage('assistant', event.message, activeProvider);
              hasStreamingAssistantRef.current = true;
            }
            break;

          case 'phase2_result':
            phase2FinalMessageRef.current = event.message;
            streamedPhase2MessageRef.current = '';
            hasPhase2StreamEventRef.current = false;
            setCanvasContent(event.canvasContent);
            if (streamedPhase1MessageRef.current) {
              setLastMessageContent(streamedPhase1MessageRef.current);
            }
            break;

          case 'error':
          if (event.phase === 'evaluating') {
            removeLastUserMessage();
          } else {
            removeLastAssistantMessage();
            removeLastUserMessage();
          }
          showError(parseApiError(event.error));
          setAiRunResult({ error: { phase: event.phase, message: event.error } });
          setAiPhase('failed');
          setIsLoading(false);
            clearAiRun();
            currentRunIdRef.current = null;
            hasStreamingAssistantRef.current = false;
            streamedPhase1MessageRef.current = '';
            streamedPhase2MessageRef.current = '';
            phase2FinalMessageRef.current = '';
            hasPhase2StreamEventRef.current = false;
            break;

          case 'done':
            if (phase2FinalMessageRef.current) {
              const finalCombined = streamedPhase1MessageRef.current
                ? `${streamedPhase1MessageRef.current}\n\n${phase2FinalMessageRef.current}`
                : phase2FinalMessageRef.current;
              if (!hasPhase2StreamEventRef.current || streamedPhase2MessageRef.current !== phase2FinalMessageRef.current) {
                setLastMessageContent(finalCombined);
              }
            }
            setIsLoading(false);
            clearAiRun();
            currentRunIdRef.current = null;
            hasStreamingAssistantRef.current = false;
            streamedPhase1MessageRef.current = '';
            streamedPhase2MessageRef.current = '';
            phase2FinalMessageRef.current = '';
            hasPhase2StreamEventRef.current = false;
            break;
        }
    });

    return unsubscribe;
  }, [
    addMessage,
    setLastMessageContent,
    setCanvasContent,
    setAiPhase,
    setAiRunResult,
    saveCanvasSnapshot,
    clearAiRun,
    setIsLoading,
    activeProvider,
    showError,
    removeLastUserMessage,
    removeLastAssistantMessage,
  ]);

  const sendMessage = useCallback(
    async (prompt: string, options?: ChatRequestOptions) => {
      if (!prompt.trim()) return;

      addMessage('user', prompt);
      setIsLoading(true);
      const runId = startAiRun();
      currentRunIdRef.current = runId;
      hasStreamingAssistantRef.current = false;
      streamedPhase1MessageRef.current = '';
      streamedPhase2MessageRef.current = '';
      phase2FinalMessageRef.current = '';
      hasPhase2StreamEventRef.current = false;

      const history = messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        ...(msg.provider ? { provider: msg.provider } : {}),
      }));

      const modelId = selectedModels[activeProvider] ?? undefined;
      const result = await api.chat(
        runId,
        prompt,
        history,
        canvasContent,
        activeProvider,
        { ...options, modelId }
      );

      if (!result.success && result.error) {
        removeLastUserMessage();
        showError(parseApiError(result.error));
        setAiRunResult({ error: { phase: 'evaluating', message: result.error } });
        setAiPhase('failed');
        setIsLoading(false);
        clearAiRun();
        currentRunIdRef.current = null;
        hasStreamingAssistantRef.current = false;
        streamedPhase1MessageRef.current = '';
        streamedPhase2MessageRef.current = '';
        phase2FinalMessageRef.current = '';
        hasPhase2StreamEventRef.current = false;
      }
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
      activeProvider,
      selectedModels,
      showError,
    ]
  );

  return { sendMessage };
}
