export interface ErrorMapping {
  pattern: string | RegExp;
  message: string;
  suggestion?: string;
}

export interface UserFriendlyError {
  message: string;
  suggestion?: string;
  original: string;
}

const DEFAULT_MAPPINGS: ErrorMapping[] = [
  {
    pattern: 'FileNotFoundError',
    message: 'The specified file could not be found.',
    suggestion: 'Check that the file path is correct and the file exists.',
  },
  {
    pattern: 'PermissionError',
    message: 'Permission denied.',
    suggestion: 'Check file permissions or try running with elevated privileges.',
  },
  {
    pattern: /subprocess\.CalledProcessError/,
    message: 'An external tool failed to execute.',
    suggestion: 'Make sure required tools (ffmpeg, etc.) are installed.',
  },
  {
    pattern: 'ModuleNotFoundError',
    message: 'A required Python module is missing.',
    suggestion: 'Run pip install -r requirements.txt in the worker directory.',
  },
  {
    pattern: 'JSONDecodeError',
    message: 'Failed to parse data.',
    suggestion: 'The input data may be corrupted or in an unexpected format.',
  },
  {
    pattern: /MemoryError|OutOfMemory/i,
    message: 'Not enough memory to complete the operation.',
    suggestion: 'Try processing smaller files or closing other applications.',
  },
  {
    pattern: 'TimeoutError',
    message: 'The operation timed out.',
    suggestion: 'Try again or increase the timeout in settings.',
  },
  {
    pattern: /Worker timed out/,
    message: 'The worker process took too long to respond.',
    suggestion: 'The task may be too complex. Try with simpler input or increase timeout.',
  },
  {
    pattern: /Worker exited with code/,
    message: 'The worker process crashed unexpectedly.',
    suggestion: 'Check the log console for details. The Python worker may have an unhandled error.',
  },
  {
    pattern: /Unknown action/,
    message: 'The requested action is not available.',
    suggestion: 'Make sure the action is registered in the Python worker.',
  },
];

export interface ErrorMapper {
  map(rawError: string): UserFriendlyError;
  addMapping(mapping: ErrorMapping): void;
}

export function createErrorMapper(extraMappings?: ErrorMapping[]): ErrorMapper {
  const mappings = [...DEFAULT_MAPPINGS, ...(extraMappings ?? [])];

  return {
    map(rawError: string): UserFriendlyError {
      for (const mapping of mappings) {
        const matches =
          typeof mapping.pattern === 'string'
            ? rawError.includes(mapping.pattern)
            : mapping.pattern.test(rawError);

        if (matches) {
          return {
            message: mapping.message,
            suggestion: mapping.suggestion,
            original: rawError,
          };
        }
      }

      return {
        message: 'An unexpected error occurred.',
        suggestion: 'Check the log console for more details.',
        original: rawError,
      };
    },

    addMapping(mapping: ErrorMapping) {
      mappings.push(mapping);
    },
  };
}
