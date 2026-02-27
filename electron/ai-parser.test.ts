import { describe, it, expect } from 'vitest';
import { SignalScanner, parseChatResponse } from './ai-parser';
import { SIGNAL_CANVAS_OPEN, SIGNAL_CANVAS_CLOSE } from './ai-prompts';

// ─── parseChatResponse ─────────────────────────────────────────

describe('parseChatResponse', () => {
  it('시그널 없는 자연어 → message만 반환', () => {
    const result = parseChatResponse('현재 문서 구조가 잘 잡혀있네요.');
    expect(result).toEqual({
      message: '현재 문서 구조가 잘 잡혀있네요.',
    });
  });

  it('시그널 포함 → message + canvasContent 분리', () => {
    const raw = `개요를 추가하겠습니다.\n\n${SIGNAL_CANVAS_OPEN}\n# 제목\n\n본문입니다.\n${SIGNAL_CANVAS_CLOSE}`;
    const result = parseChatResponse(raw);
    expect(result).toEqual({
      message: '개요를 추가하겠습니다.',
      canvasContent: '# 제목\n\n본문입니다.',
    });
  });

  it('빈 문자열 → 빈 message', () => {
    const result = parseChatResponse('');
    expect(result).toEqual({ message: '' });
  });

  it('시그널만 있고 메시지 없음 → 빈 message + canvasContent', () => {
    const raw = `${SIGNAL_CANVAS_OPEN}\n# 콘텐츠\n${SIGNAL_CANVAS_CLOSE}`;
    const result = parseChatResponse(raw);
    expect(result).toEqual({
      message: '',
      canvasContent: '# 콘텐츠',
    });
  });

  it('닫는 시그널 누락 시 → ⟨CANVAS⟩ 이후 전체를 canvasContent로', () => {
    const raw = `메시지\n${SIGNAL_CANVAS_OPEN}\n미완성 콘텐츠`;
    const result = parseChatResponse(raw);
    expect(result).toEqual({
      message: '메시지',
      canvasContent: '미완성 콘텐츠',
    });
  });

  it('canvasContent 내부 마크다운이 보존됨', () => {
    const canvas = '# 타이틀\n\n## 섹션\n\n- 항목1\n- 항목2\n\n```js\nconsole.log("hello");\n```';
    const raw = `변경 완료.\n\n${SIGNAL_CANVAS_OPEN}\n${canvas}\n${SIGNAL_CANVAS_CLOSE}`;
    const result = parseChatResponse(raw);
    expect(result.canvasContent).toBe(canvas);
  });

  it('닫는 시그널 이후 텍스트 → doneMessage로 캡처', () => {
    const raw = `메시지\n${SIGNAL_CANVAS_OPEN}\n콘텐츠\n${SIGNAL_CANVAS_CLOSE}\n완료했습니다.`;
    const result = parseChatResponse(raw);
    expect(result).toEqual({
      message: '메시지',
      canvasContent: '콘텐츠',
      doneMessage: '완료했습니다.',
    });
  });

  it('3단계 흐름: Do → Canvas → Done', () => {
    const raw = `목차를 추가하겠습니다.\n\n${SIGNAL_CANVAS_OPEN}\n# 타이틀\n## 목차\n1. 개요\n${SIGNAL_CANVAS_CLOSE}\n\n목차 추가를 완료했습니다.`;
    const result = parseChatResponse(raw);
    expect(result.message).toBe('목차를 추가하겠습니다.');
    expect(result.canvasContent).toBe('# 타이틀\n## 목차\n1. 개요');
    expect(result.doneMessage).toBe('목차 추가를 완료했습니다.');
  });

  it('닫는 시그널 이후 텍스트 없음 → doneMessage 없음', () => {
    const raw = `메시지\n${SIGNAL_CANVAS_OPEN}\n콘텐츠\n${SIGNAL_CANVAS_CLOSE}`;
    const result = parseChatResponse(raw);
    expect(result.doneMessage).toBeUndefined();
  });
});

// ─── SignalScanner (스트리밍) ───────────────────────────────────

describe('SignalScanner', () => {
  it('시그널 없는 스트리밍 → message 텍스트만 반환', () => {
    const scanner = new SignalScanner();
    const r1 = scanner.feed('안녕하세요 ');
    const r2 = scanner.feed('테스트입니다.');
    const r3 = scanner.flush();

    const combined = r1.text + r2.text + r3.text;
    expect(combined).toBe('안녕하세요 테스트입니다.');
    expect(scanner.state).toBe('message');
  });

  it('시그널 한 chunk에 완전히 포함 → 상태 전환', () => {
    const scanner = new SignalScanner();

    const r1 = scanner.feed(`메시지입니다.\n${SIGNAL_CANVAS_OPEN}\n# 캔버스`);
    expect(r1.signals).toContain(SIGNAL_CANVAS_OPEN);
    expect(scanner.state).toBe('canvas');

    const r2 = scanner.feed(`\n본문\n${SIGNAL_CANVAS_CLOSE}`);
    expect(r2.signals).toContain(SIGNAL_CANVAS_CLOSE);
    expect(scanner.state).toBe('done');
  });

  it('시그널이 chunk 경계를 걸치는 경우 처리', () => {
    const scanner = new SignalScanner();

    // ⟨CANVAS⟩ (8자)를 두 chunk로 분할
    const signal = SIGNAL_CANVAS_OPEN;
    const half = Math.floor(signal.length / 2);

    scanner.feed('메시지\n');
    scanner.feed(signal.slice(0, half));

    // 아직 시그널 감지 안됨 (불완전)
    expect(scanner.state).toBe('message');

    const result = scanner.feed(signal.slice(half) + '\n캔버스 콘텐츠');
    expect(result.signals).toContain(SIGNAL_CANVAS_OPEN);
    expect(scanner.state).toBe('canvas');
  });

  it('전체 흐름: message → canvas → done', () => {
    const scanner = new SignalScanner();
    const messageChunks: string[] = [];
    const canvasChunks: string[] = [];

    const feed = (chunk: string) => {
      const result = scanner.feed(chunk);
      // 현재 상태에 따라 텍스트 분류 — 시그널 전환 전의 텍스트도 포함
      if (result.signals.includes(SIGNAL_CANVAS_OPEN)) {
        // 시그널 전 텍스트는 message, 시그널 후 텍스트는 canvas
        // feed()는 시그널 전까지를 text로 반환하고 시그널 후는 버퍼에 유지
        messageChunks.push(result.text);
      } else if (scanner.state === 'message') {
        messageChunks.push(result.text);
      } else {
        canvasChunks.push(result.text);
      }
    };

    feed('프로젝트 배경을 ');
    feed('추가하겠습니다.\n\n');
    feed(SIGNAL_CANVAS_OPEN + '\n');
    feed('# 제목\n');
    feed('## 배경\n본문');
    feed('\n' + SIGNAL_CANVAS_CLOSE);

    const flushed = scanner.flush();
    canvasChunks.push(flushed.text);

    const message = messageChunks.join('').trim();
    const canvas = canvasChunks.join('').trim();

    expect(message).toBe('프로젝트 배경을 추가하겠습니다.');
    expect(canvas).toBe('# 제목\n## 배경\n본문');
  });

  it('reset() → 초기 상태로 복원', () => {
    const scanner = new SignalScanner();
    scanner.feed(`${SIGNAL_CANVAS_OPEN}\n콘텐츠`);
    expect(scanner.state).toBe('canvas');

    scanner.reset();
    expect(scanner.state).toBe('message');
  });
});
