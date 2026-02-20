export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

function findCodeBlockBoundaries(content: string): Array<{ start: number; end: number }> {
  const boundaries: Array<{ start: number; end: number }> = [];
  const codeBlockRegex = /```[\s\S]*?```/g;

  for (const match of content.matchAll(codeBlockRegex)) {
    const start = match.index;
    if (start === undefined) {
      continue;
    }
    boundaries.push({
      start,
      end: start + match[0].length,
    });
  }

  return boundaries;
}

function parseHeaders(content: string): Array<{
  level: number;
  title: string;
  startIndex: number;
  endIndex: number;
  bodyStartIndex: number;
}> {
  const headers: Array<{
    level: number;
    title: string;
    startIndex: number;
    endIndex: number;
    bodyStartIndex: number;
  }> = [];

  const lines = content.split('\n');
  let currentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();
      const startIndex = currentIndex;
      const endIndex = currentIndex + line.length;
      const bodyStartIndex = endIndex + 1;

      headers.push({
        level,
        title,
        startIndex,
        endIndex,
        bodyStartIndex,
      });
    }

    currentIndex += line.length + 1;
  }

  return headers;
}

function truncateSection(
  content: string,
  sectionStart: number,
  sectionEnd: number,
  maxSectionLength: number
): string {
  const sectionContent = content.slice(sectionStart, sectionEnd);

  if (sectionContent.length <= maxSectionLength) {
    return sectionContent;
  }

  const lines = sectionContent.split('\n');
  const headerLine = lines[0];
  const bodyContent = lines.slice(1).join('\n');

  if (!bodyContent.trim()) {
    return headerLine;
  }

  const availableLength = maxSectionLength - headerLine.length - '\n[... content truncated ...]'.length;

  if (availableLength <= 0) {
    return headerLine + '\n[... content truncated ...]';
  }

  let truncatedBody = '';
  let currentLength = 0;
  let inCodeBlock = false;
  let codeBlockBuffer = '';

  const bodyLines = bodyContent.split('\n');

  for (const line of bodyLines) {
    const lineLength = line.length + 1;

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        if (currentLength + lineLength > availableLength) {
          break;
        }
        inCodeBlock = true;
        codeBlockBuffer = line + '\n';
      } else {
        codeBlockBuffer += line;
        if (currentLength + codeBlockBuffer.length <= availableLength) {
          truncatedBody += codeBlockBuffer;
          currentLength += codeBlockBuffer.length;
        }
        inCodeBlock = false;
        codeBlockBuffer = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer += line + '\n';
    } else {
      if (currentLength + lineLength > availableLength) {
        break;
      }
      truncatedBody += line + '\n';
      currentLength += lineLength;
    }
  }

  if (inCodeBlock) {
    truncatedBody += '\n[code block truncated]\n```';
  }

  truncatedBody = truncatedBody.replace(/\n$/, '');

  return headerLine + '\n' + truncatedBody + '\n[... content truncated ...]';
}

export function truncateToFit(content: string, maxTokens: number): string {
  if (!content || content.length === 0) {
    return '';
  }

  const maxCharacters = maxTokens * 4;

  if (content.length <= maxCharacters) {
    return content;
  }

  const codeBlockBoundaries = findCodeBlockBoundaries(content);
  const headers = parseHeaders(content);

  if (headers.length === 0) {
    return simpleTruncate(content, maxCharacters, codeBlockBoundaries);
  }

  const truncatedSections: string[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const sectionStart = header.startIndex;
    const sectionEnd = i < headers.length - 1 ? headers[i + 1].startIndex : content.length;

    const sectionContent = content.slice(sectionStart, sectionEnd);
    const estimatedSectionTokens = estimateTokens(sectionContent);

    const processedTokens = estimateTokens(truncatedSections.join('\n\n'));
    const remainingTokens = maxTokens - processedTokens;

    if (remainingTokens <= 50) {
      truncatedSections.push(`${'#'.repeat(header.level)} ${header.title}\n[section truncated]`);
    } else if (estimatedSectionTokens > remainingTokens) {
      const truncatedSection = truncateSection(content, sectionStart, sectionEnd, remainingTokens * 4);
      truncatedSections.push(truncatedSection);
    } else {
      truncatedSections.push(sectionContent);
    }
  }

  return truncatedSections.join('\n\n');
}

function simpleTruncate(
  content: string,
  maxCharacters: number,
  codeBlockBoundaries: Array<{ start: number; end: number }>
): string {
  if (content.length <= maxCharacters) {
    return content;
  }

  void codeBlockBoundaries;

  let result = '';
  let currentLength = 0;
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockBuffer = '';

  for (const line of lines) {
    const lineWithNewline = line + '\n';

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        if (currentLength + lineWithNewline.length > maxCharacters - 100) {
          break;
        }
        inCodeBlock = true;
        codeBlockBuffer = lineWithNewline;
      } else {
        codeBlockBuffer += line;
        if (currentLength + codeBlockBuffer.length <= maxCharacters - 50) {
          result += codeBlockBuffer;
          currentLength += codeBlockBuffer.length;
        }
        inCodeBlock = false;
        codeBlockBuffer = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer += lineWithNewline;
    } else {
      if (currentLength + lineWithNewline.length > maxCharacters - 50) {
        break;
      }
      result += lineWithNewline;
      currentLength += lineWithNewline.length;
    }
  }

  if (inCodeBlock) {
    result += '\n[code block truncated]\n```';
  }

  result = result.replace(/\n$/, '');
  return result + '\n\n[... content truncated ...]';
}
