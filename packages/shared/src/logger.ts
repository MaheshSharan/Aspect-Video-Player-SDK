/**
 * Log level enumeration.
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SILENT: 4,
} as const;

export type LogLevelValue = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Logger configuration.
 */
export interface LoggerConfig {
    /** Minimum level to log */
    level: LogLevelValue;
    /** Whether to include timestamps */
    timestamp: boolean;
    /** Custom log handler */
    handler?: LogHandler;
}

/**
 * Log entry structure.
 */
export interface LogEntry {
    level: LogLevelValue;
    namespace: string;
    message: string;
    args: unknown[];
    timestamp: number;
}

/**
 * Custom log handler function.
 */
export type LogHandler = (entry: LogEntry) => void;

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: LoggerConfig = {
    level: LogLevel.WARN,
    timestamp: true,
};

/**
 * Global configuration shared across all logger instances.
 */
let globalConfig: LoggerConfig = { ...DEFAULT_CONFIG };

/**
 * Level names for console output.
 */
const LEVEL_NAMES: Record<LogLevelValue, string> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.SILENT]: 'SILENT',
};

/**
 * Console methods for each level.
 */
const LEVEL_METHODS: Record<LogLevelValue, 'log' | 'info' | 'warn' | 'error'> = {
    [LogLevel.DEBUG]: 'log',
    [LogLevel.INFO]: 'info',
    [LogLevel.WARN]: 'warn',
    [LogLevel.ERROR]: 'error',
    [LogLevel.SILENT]: 'log',
};

/**
 * Logger class with namespace support and configurable output.
 * Production-safe: respects log level configuration.
 */
export class Logger {
    private readonly namespace: string;

    constructor(namespace: string) {
        this.namespace = namespace;
    }

    /**
     * Configure all logger instances.
     */
    static configure(config: Partial<LoggerConfig>): void {
        globalConfig = { ...globalConfig, ...config };
    }

    /**
     * Reset configuration to defaults.
     */
    static reset(): void {
        globalConfig = { ...DEFAULT_CONFIG };
    }

    /**
     * Get current configuration.
     */
    static getConfig(): Readonly<LoggerConfig> {
        return globalConfig;
    }

    /**
     * Create a child logger with a sub-namespace.
     */
    child(subNamespace: string): Logger {
        return new Logger(`${this.namespace}:${subNamespace}`);
    }

    /**
     * Log at DEBUG level.
     */
    debug(message: string, ...args: unknown[]): void {
        this.log(LogLevel.DEBUG, message, args);
    }

    /**
     * Log at INFO level.
     */
    info(message: string, ...args: unknown[]): void {
        this.log(LogLevel.INFO, message, args);
    }

    /**
     * Log at WARN level.
     */
    warn(message: string, ...args: unknown[]): void {
        this.log(LogLevel.WARN, message, args);
    }

    /**
     * Log at ERROR level.
     */
    error(message: string, ...args: unknown[]): void {
        this.log(LogLevel.ERROR, message, args);
    }

    private log(level: LogLevelValue, message: string, args: unknown[]): void {
        if (level < globalConfig.level) {
            return;
        }

        const entry: LogEntry = {
            level,
            namespace: this.namespace,
            message,
            args,
            timestamp: Date.now(),
        };

        if (globalConfig.handler !== undefined) {
            globalConfig.handler(entry);
            return;
        }

        this.defaultOutput(entry);
    }

    private defaultOutput(entry: LogEntry): void {
        const parts: string[] = [];

        if (globalConfig.timestamp) {
            const date = new Date(entry.timestamp);
            parts.push(`[${date.toISOString()}]`);
        }

        parts.push(`[${LEVEL_NAMES[entry.level]}]`);
        parts.push(`[${entry.namespace}]`);
        parts.push(entry.message);

        const method = LEVEL_METHODS[entry.level];
        const prefix = parts.join(' ');

        if (entry.args.length > 0) {
            console[method](prefix, ...entry.args);
        } else {
            console[method](prefix);
        }
    }
}

/**
 * Create a logger instance with the given namespace.
 *
 * @param namespace - Logger namespace (e.g., 'player-core', 'hls-adapter')
 * @returns Logger instance
 */
export function createLogger(namespace: string): Logger {
    return new Logger(namespace);
}
