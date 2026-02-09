import { test, expect } from '@playwright/test';
import { parseAIResponse, extractJSON } from '../src/utils/parser';

test.describe('JSON Extraction (extractJSON)', () => {
  test('should extract simple JSON from text', () => {
    const text = 'Some text {"message": "hello"} more text';
    expect(extractJSON(text)).toBe('{"message": "hello"}');
  });

  test('should extract JSON from code blocks', () => {
    const text = 'Here is the result:\n```json\n{"message": "hello"}\n```';
    expect(extractJSON(text)).toBe('{"message": "hello"}');
  });

  test('should extract JSON from code blocks without language tag', () => {
    const text = 'Here is the result:\n```\n{"message": "hello"}\n```';
    expect(extractJSON(text)).toBe('{"message": "hello"}');
  });

  test('should handle nested objects', () => {
    const text = '{"a": {"b": 1}}';
    expect(extractJSON(text)).toBe('{"a": {"b": 1}}');
  });

  test('should ignore braces in strings', () => {
    const text = '{"message": "contains { braces }"}';
    expect(extractJSON(text)).toBe('{"message": "contains { braces }"}');
  });

  test('should handle escaped quotes in strings', () => {
    const text = '{"message": "contains \\"quoted\\" text"}';
    expect(extractJSON(text)).toBe('{"message": "contains \\"quoted\\" text"}');
  });

  test('should return null if no JSON found', () => {
    expect(extractJSON('no json here')).toBeNull();
  });

  test('should return null for empty input', () => {
    expect(extractJSON('')).toBeNull();
  });
});

test.describe('parseAIResponse', () => {
  test('should successfully parse valid AI response', () => {
    const rawText = '{"message": "Hello world", "canvasContent": "# Title"}';
    const result = parseAIResponse(rawText);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      message: 'Hello world',
      canvasContent: '# Title'
    });
    expect(result.fallback).toBeUndefined();
  });

  test('should handle valid AI response with only required fields', () => {
    const rawText = '{"message": "Only message"}';
    const result = parseAIResponse(rawText);
    expect(result.success).toBe(true);
    expect(result.data?.message).toBe('Only message');
  });

  test('should return fallback when no JSON is found', () => {
    const rawText = 'This is just a plain message from AI.';
    const result = parseAIResponse(rawText);
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.data?.message).toBe(rawText);
    expect(result.error).toBe('No JSON found in response');
  });

  test('should return fallback when JSON is malformed', () => {
    const rawText = '{"message": "oops", }'; // Trailing comma
    const result = parseAIResponse(rawText);
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.data?.message).toBe(rawText);
  });

  test('should return fallback when validation fails (missing message)', () => {
    const rawText = '{"canvasContent": "missing message field"}';
    const result = parseAIResponse(rawText);
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.error).toContain('Required');
    expect(result.data?.message).toBe(rawText);
  });

  test('should return fallback when validation fails (wrong type)', () => {
    const rawText = '{"message": 123}'; // message should be string
    const result = parseAIResponse(rawText);
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.error).toContain('Expected string, received number');
    expect(result.data?.message).toBe(rawText);
  });
});
