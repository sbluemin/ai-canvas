export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
}

export function isValidMarkdownFilename(filename: string): boolean {
  return /^[\w가-힣._-]+\.md$/i.test(filename);
}
