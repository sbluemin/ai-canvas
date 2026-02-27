import { SIGNAL_CANVAS_OPEN, SIGNAL_CANVAS_CLOSE } from './ai-prompts';
import type { ChatResult } from './ai-types';

// ─── 시그널 토큰 상수 ──────────────────────────────────────────

const ALL_SIGNALS = [SIGNAL_CANVAS_OPEN, SIGNAL_CANVAS_CLOSE] as const;
const MAX_SIGNAL_LEN = Math.max(...ALL_SIGNALS.map((s) => s.length));

// ─── SignalScanner ─────────────────────────────────────────────

export type ScannerState = 'message' | 'canvas' | 'done';

export interface ScanResult {
  /** 즉시 소비 가능한 텍스트 (message 또는 canvas 영역) */
  text: string;
  /** 감지된 시그널 목록 */
  signals: string[];
  /** 현재 스캐너 상태 */
  state: ScannerState;
}

/**
 * 스트리밍 chunk에서 시그널 토큰을 감지하는 incremental scanner.
 *
 * - 시그널이 chunk 경계에 걸쳐 도착할 수 있으므로,
 *   MAX_SIGNAL_LEN만큼의 look-ahead 버퍼를 유지한다.
 * - feed()를 호출할 때마다 안전하게 소비할 수 있는 텍스트와
 *   감지된 시그널을 반환한다.
 */
export class SignalScanner {
  private buffer = '';
  private _state: ScannerState = 'message';

  get state(): ScannerState {
    return this._state;
  }

  /**
   * 새 chunk를 버퍼에 추가하고, 안전한 텍스트와 감지된 시그널을 반환한다.
   */
  feed(chunk: string): ScanResult {
    this.buffer += chunk;
    const signals: string[] = [];
    let text = '';

    // 반복적으로 시그널을 찾아 처리
    let changed = true;
    while (changed) {
      changed = false;

      if (this._state === 'done') {
        break;
      }

      // 현재 상태에서 찾아야 할 시그널
      const targetSignal = this._state === 'message' ? SIGNAL_CANVAS_OPEN : SIGNAL_CANVAS_CLOSE;
      const idx = this.buffer.indexOf(targetSignal);

      if (idx !== -1) {
        // 시그널 이전 텍스트를 안전하게 추출
        text += this.buffer.slice(0, idx);
        // 시그널 이후로 버퍼 이동
        this.buffer = this.buffer.slice(idx + targetSignal.length);
        signals.push(targetSignal);

        // 상태 전환
        if (targetSignal === SIGNAL_CANVAS_OPEN) {
          this._state = 'canvas';
        } else {
          this._state = 'done';
        }

        changed = true;
      }
    }

    // 시그널이 chunk 경계에 걸쳐 있을 수 있으므로 마지막 MAX_SIGNAL_LEN만큼 보류
    if (this._state !== 'done') {
      const safeEnd = Math.max(0, this.buffer.length - MAX_SIGNAL_LEN);
      text += this.buffer.slice(0, safeEnd);
      this.buffer = this.buffer.slice(safeEnd);
    } else {
      // done 상태: ⟨/CANVAS⟩ 이후 텍스트(Done 메시지)를 방출
      text += this.buffer;
      this.buffer = '';
    }

    return { text, signals, state: this._state };
  }

  /**
   * 스트림 종료 시 버퍼에 남은 텍스트를 모두 방출한다.
   */
  flush(): ScanResult {
    const remaining = this.buffer;
    this.buffer = '';

    return {
      text: remaining,
      signals: [],
      state: this._state,
    };
  }

  /**
   * 스캐너 상태를 초기화한다.
   */
  reset(): void {
    this.buffer = '';
    this._state = 'message';
  }
}

// ─── 최종 응답 파서 ────────────────────────────────────────────

/**
 * 완성된 전체 AI 응답 텍스트에서 message와 canvasContent를 분리한다.
 *
 * - ⟨CANVAS⟩...⟨/CANVAS⟩ 시그널이 있으면 canvasContent 포함
 * - 시그널이 없으면 message만 반환 (캔버스 업데이트 불필요)
 */
export function parseChatResponse(rawText: string): ChatResult {
  const openIdx = rawText.indexOf(SIGNAL_CANVAS_OPEN);

  // 시그널 없음 → 메시지만 반환
  if (openIdx === -1) {
    return { message: rawText.trim() };
  }

  const message = rawText.slice(0, openIdx).trim();
  const afterOpen = rawText.slice(openIdx + SIGNAL_CANVAS_OPEN.length);

  const closeIdx = afterOpen.indexOf(SIGNAL_CANVAS_CLOSE);

  if (closeIdx === -1) {
    // ⟨CANVAS⟩는 있지만 ⟨/CANVAS⟩가 없음 → 전체를 canvasContent로 간주
    return {
      message,
      canvasContent: afterOpen.trim(),
    };
  }

  const doneMessage = afterOpen.slice(closeIdx + SIGNAL_CANVAS_CLOSE.length).trim();

  return {
    message,
    canvasContent: afterOpen.slice(0, closeIdx).trim(),
    ...(doneMessage.length > 0 ? { doneMessage } : {}),
  };
}
