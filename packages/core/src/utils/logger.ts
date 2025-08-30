// Logger service for Shell AI
// Captures logs and errors for display in the UI instead of direct console output

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source?: string;
  details?: any;
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  addListener(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  private addLog(level: LogEntry['level'], message: string, source?: string, details?: any): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      source,
      details,
    };

    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.notify();
  }

  info(message: string, source?: string, details?: any): void {
    this.addLog('info', message, source, details);
  }

  warn(message: string, source?: string, details?: any): void {
    this.addLog('warn', message, source, details);
  }

  error(message: string, source?: string, details?: any): void {
    this.addLog('error', message, source, details);
  }

  debug(message: string, source?: string, details?: any): void {
    this.addLog('debug', message, source, details);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
    this.notify();
  }

  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  getErrorCount(): number {
    return this.logs.filter(log => log.level === 'error').length;
  }

  getWarningCount(): number {
    return this.logs.filter(log => log.level === 'warn').length;
  }

  hasRecentErrors(timeWindowMs = 60000): boolean {
    const now = new Date();
    return this.logs.some(
      log => log.level === 'error' && now.getTime() - log.timestamp.getTime() < timeWindowMs
    );
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
