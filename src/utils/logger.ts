type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = 'info';

  constructor() {
    // In development mode, we default to debug logging
    if ((import.meta as any).env?.DEV) {
      this.level = 'debug';
    }
  }

  /**
   * Sets the minimum log level
   */
  setLevel(level: LogLevel) {
    this.level = level;
  }

  /**
   * Logs a debug message
   */
  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug(message, ...args);
    }
  }

  /**
   * Logs an info message
   */
  info(message: string, ...args: unknown[]) {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(message, ...args);
    }
  }

  /**
   * Logs a warning message
   */
  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(message, ...args);
    }
  }

  /**
   * Logs an error message
   */
  error(message: string, ...args: unknown[]) {
    if (this.shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(message, ...args);
    }
  }

  private shouldLog(targetLevel: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(targetLevel) >= levels.indexOf(this.level);
  }
}

export const logger = new Logger();
