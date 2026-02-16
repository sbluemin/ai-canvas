import { describe, test, expect } from 'vitest';
import { calculateDocumentStats } from './documentStats';

describe('calculateDocumentStats', () => {
  test('should return zeros for empty content', () => {
    const stats = calculateDocumentStats('');
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.readingTimeMinutes).toBe(1);
  });

  test('should count words in plain text', () => {
    const stats = calculateDocumentStats('Hello world foo bar');
    expect(stats.words).toBe(4);
  });

  test('should count characters excluding whitespace', () => {
    const stats = calculateDocumentStats('ab cd');
    expect(stats.characters).toBe(4);
  });

  test('should strip markdown headings', () => {
    const stats = calculateDocumentStats('# Title\n\nSome text here.');
    expect(stats.words).toBe(4);
  });

  test('should strip bold and italic markers', () => {
    const stats = calculateDocumentStats('This is **bold** and *italic* text.');
    expect(stats.words).toBe(6);
  });

  test('should strip markdown links but keep link text', () => {
    const stats = calculateDocumentStats('Click [here](https://example.com) now.');
    expect(stats.words).toBe(3);
  });

  test('should strip code blocks', () => {
    const md = 'Before\n\n```js\nconst x = 1;\n```\n\nAfter';
    const stats = calculateDocumentStats(md);
    expect(stats.words).toBe(2);
  });

  test('should strip inline code', () => {
    const stats = calculateDocumentStats('Use `console.log` here.');
    expect(stats.words).toBe(2);
  });

  test('should strip images', () => {
    const stats = calculateDocumentStats('Look at this ![alt](img.png) image.');
    expect(stats.words).toBe(4);
  });

  test('should handle CJK characters as individual words', () => {
    const stats = calculateDocumentStats('한글 테스트');
    expect(stats.words).toBe(5);
  });

  test('should handle mixed CJK and Latin text', () => {
    const stats = calculateDocumentStats('Hello 세계');
    expect(stats.words).toBe(3);
  });

  test('should calculate reading time (minimum 1 min)', () => {
    const stats = calculateDocumentStats('Short.');
    expect(stats.readingTimeMinutes).toBe(1);
  });

  test('should calculate reading time for longer text', () => {
    const words = Array(400).fill('word').join(' ');
    const stats = calculateDocumentStats(words);
    expect(stats.readingTimeMinutes).toBe(2);
  });

  test('should strip blockquotes', () => {
    const stats = calculateDocumentStats('> Quoted text here');
    expect(stats.words).toBe(3);
  });

  test('should strip list markers', () => {
    const stats = calculateDocumentStats('- Item one\n- Item two\n1. Item three');
    expect(stats.words).toBe(6);
  });
});
