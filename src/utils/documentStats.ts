export interface DocumentStats {
  words: number;
  characters: number;
  readingTimeMinutes: number;
}

/**
 * Strips markdown syntax to extract plain text for accurate counting.
 */
function stripMarkdown(markdown: string): string {
  let result = markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`[^`]*`/g, '')
    // Remove images
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove links but keep text
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
    // Remove headings markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Remove blockquote markers
    .replace(/^>\s+/gm, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove HTML tags iteratively to handle nested patterns
  let prev = '';
  while (prev !== result) {
    prev = result;
    result = result.replace(/<[^>]+>/g, '');
  }

  return result;
}

/**
 * Counts the number of words in a text string.
 * Handles CJK (Chinese, Japanese, Korean) characters as individual words.
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  // CJK character ranges
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkMatches = trimmed.match(cjkRegex);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Remove CJK characters, then count space-separated words
  const withoutCjk = trimmed.replace(cjkRegex, ' ');
  const latinWords = withoutCjk.split(/\s+/).filter((w) => w.length > 0);

  return latinWords.length + cjkCount;
}

const WORDS_PER_MINUTE = 200;

/**
 * Calculates document statistics from markdown content.
 */
export function calculateDocumentStats(markdown: string): DocumentStats {
  const plainText = stripMarkdown(markdown);
  const characters = plainText.replace(/\s/g, '').length;
  const words = countWords(plainText);
  const readingTimeMinutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));

  return { words, characters, readingTimeMinutes };
}
