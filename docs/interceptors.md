# Interceptors

Interceptors provide a powerful way to hook into the input/output flow between
the terminal and the Gemini agent. They allow you to inspect, modify, or block
messages in both directions.

## Overview

The interceptor system consists of:

- **Input Interceptors**: Execute before user input is sent to the agent
- **Output Interceptors**: Execute before agent responses are displayed to the
  user

## Use Cases

Interceptors can be used for:

- **Logging and Monitoring**: Track all interactions for debugging or analytics
- **Content Filtering**: Block sensitive information from being sent or
  displayed
- **Message Transformation**: Modify messages before they're sent or received
- **Security Checks**: Validate messages against security policies
- **Custom Processing**: Add custom logic to the communication flow

## API Reference

### Types

#### `InterceptorConfig`

Configuration for an interceptor:

```typescript
interface InterceptorConfig {
  id: string; // Unique identifier
  name: string; // Human-readable name
  description?: string; // Optional description
  onInput?: InputInterceptor; // Input handler
  onOutput?: OutputInterceptor; // Output handler
  enabled?: boolean; // Whether enabled (default: true)
  priority?: number; // Execution priority (higher = earlier)
}
```

#### `InputInterceptor`

Function signature for input interceptors:

```typescript
type InputInterceptor = (
  input: InputData,
  context: InterceptorContext,
) => Promise<InputInterceptorResult | void> | InputInterceptorResult | void;

interface InputData {
  message: PartListUnion; // User's input message
  isRetry?: boolean; // Whether this is a retry
}

interface InputInterceptorResult {
  message?: PartListUnion; // Modified message (optional)
  blocked?: boolean; // Block the input
  blockReason?: string; // Reason for blocking
  metadata?: Record<string, unknown>; // Pass data to next interceptor
}
```

#### `OutputInterceptor`

Function signature for output interceptors:

```typescript
type OutputInterceptor = (
  output: OutputData,
  context: InterceptorContext,
) => Promise<OutputInterceptorResult | void> | OutputInterceptorResult | void;

interface OutputData {
  event: ServerGeminiStreamEvent; // Agent's output event
}

interface OutputInterceptorResult {
  event?: ServerGeminiStreamEvent; // Modified event (optional)
  blocked?: boolean; // Block the output
  metadata?: Record<string, unknown>; // Pass data to next interceptor
}
```

#### `InterceptorContext`

Context information provided to all interceptors:

```typescript
interface InterceptorContext {
  sessionId: string; // Current session ID
  timestamp: Date; // When interception occurred
  model?: string; // Current model name
  metadata?: Record<string, unknown>; // Shared metadata
}
```

## Usage

### Registering an Interceptor

```typescript
import type { Config, InterceptorConfig } from '@google/gemini-cli-core';

// Get the interceptor manager from config
const config: Config = /* your config instance */;
const interceptorManager = config.getInterceptorManager();

// Define your interceptor
const loggingInterceptor: InterceptorConfig = {
  id: 'logging-interceptor',
  name: 'Logging Interceptor',
  description: 'Logs all input/output for debugging',

  onInput: async (input, context) => {
    console.log(`[${context.timestamp}] User input:`, input.message);
    // Return nothing to pass through unchanged
  },

  onOutput: async (output, context) => {
    console.log(`[${context.timestamp}] Agent output:`, output.event);
    // Return nothing to pass through unchanged
  },

  priority: 10,  // Higher priority = executes earlier
};

// Register the interceptor
interceptorManager.register(loggingInterceptor);
```

### Input Modification

```typescript
const prefixInterceptor: InterceptorConfig = {
  id: 'prefix-interceptor',
  name: 'Prefix Interceptor',

  onInput: async (input, context) => {
    // Add a prefix to all user messages
    if (typeof input.message === 'string') {
      return {
        message: `[User ${context.sessionId}]: ${input.message}`,
      };
    }
  },
};

interceptorManager.register(prefixInterceptor);
```

### Content Filtering

```typescript
const contentFilterInterceptor: InterceptorConfig = {
  id: 'content-filter',
  name: 'Content Filter',

  onInput: async (input, context) => {
    const message =
      typeof input.message === 'string'
        ? input.message
        : JSON.stringify(input.message);

    // Block messages containing sensitive patterns
    const sensitivePatterns = /password|secret|api[_-]?key/i;

    if (sensitivePatterns.test(message)) {
      return {
        blocked: true,
        blockReason: 'Message contains sensitive information',
      };
    }
  },

  onOutput: async (output, context) => {
    // Filter output as well
    if (output.event.type === 'content') {
      const content = output.event.value;
      if (typeof content === 'string' && /CONFIDENTIAL/i.test(content)) {
        return {
          blocked: true,
        };
      }
    }
  },
};

interceptorManager.register(contentFilterInterceptor);
```

### Metadata Passing

Interceptors can pass metadata to subsequent interceptors:

```typescript
const analyzerInterceptor: InterceptorConfig = {
  id: 'analyzer',
  name: 'Input Analyzer',
  priority: 20, // Execute first

  onInput: async (input, context) => {
    const messageLength =
      typeof input.message === 'string'
        ? input.message.length
        : JSON.stringify(input.message).length;

    return {
      metadata: {
        inputLength: messageLength,
        analyzedAt: Date.now(),
      },
    };
  },
};

const validatorInterceptor: InterceptorConfig = {
  id: 'validator',
  name: 'Input Validator',
  priority: 10, // Execute second

  onInput: async (input, context) => {
    // Access metadata from previous interceptor
    const inputLength = context.metadata?.inputLength as number;

    if (inputLength > 10000) {
      return {
        blocked: true,
        blockReason: 'Input exceeds maximum length',
      };
    }
  },
};

interceptorManager.register(analyzerInterceptor);
interceptorManager.register(validatorInterceptor);
```

### Managing Interceptors

```typescript
// Get all registered interceptors
const all = interceptorManager.getAll();

// Get specific interceptor
const interceptor = interceptorManager.get('logging-interceptor');

// Unregister an interceptor
interceptorManager.unregister('logging-interceptor');

// Clear all interceptors
interceptorManager.clear();
```

## Execution Order

Interceptors execute in priority order (highest to lowest):

1. **Higher priority first**: Interceptors with higher priority values execute
   before those with lower values
2. **Default priority is 0**: If no priority is specified, it defaults to 0
3. **Chain execution**: Each interceptor receives the output of the previous one
4. **Early termination**: If any interceptor blocks the message, subsequent
   interceptors are skipped

Example execution order:

```typescript
// These interceptors execute in this order:
interceptorManager.register({ id: 'first', priority: 100, ... });   // 1st
interceptorManager.register({ id: 'second', priority: 50, ... });   // 2nd
interceptorManager.register({ id: 'third', priority: 10, ... });    // 3rd
interceptorManager.register({ id: 'fourth', ... });                 // 4th (default priority 0)
```

## Error Handling

If an interceptor throws an error:

- The error is logged using `debugLogger`
- Execution continues with the next interceptor
- The original message/event is used (not the failed interceptor's result)

```typescript
const riskyInterceptor: InterceptorConfig = {
  id: 'risky',
  name: 'Risky Interceptor',

  onInput: async (input, context) => {
    try {
      // Risky operation
      const result = await someRiskyOperation(input);
      return { message: result };
    } catch (error) {
      // Error is caught and logged by the system
      // Original input passes through unchanged
      console.error('Interceptor failed:', error);
    }
  },
};
```

## Best Practices

1. **Keep interceptors focused**: Each interceptor should do one thing well
2. **Use priority wisely**: Higher priority for validators, lower for loggers
3. **Handle errors gracefully**: Don't let errors break the entire flow
4. **Be mindful of performance**: Interceptors run on every message
5. **Use metadata for coordination**: Pass data between related interceptors
6. **Document your interceptors**: Clear descriptions help maintainability

## Examples

See the `examples/` directory for complete examples:

- `examples/logging-interceptor.ts` - Basic logging interceptor
- `examples/content-filter-interceptor.ts` - Content filtering
- `examples/rate-limiting-interceptor.ts` - Rate limiting implementation

## Advanced Topics

### Async vs Sync Interceptors

Both synchronous and asynchronous interceptors are supported:

```typescript
// Synchronous
onInput: (input, context) => {
  return { message: transform(input.message) };
};

// Asynchronous
onInput: async (input, context) => {
  const transformed = await asyncTransform(input.message);
  return { message: transformed };
};
```

### Conditional Execution

```typescript
onInput: async (input, context) => {
  // Only process on certain conditions
  if (context.model?.includes('flash')) {
    return { message: optimizeForFlash(input.message) };
  }
  // Return nothing to pass through unchanged
};
```

### Integration with Extensions

Extensions can register interceptors during initialization. See the Extensions
documentation for details.

## Troubleshooting

### Interceptor not executing

- Check that it's registered: `interceptorManager.get('your-id')`
- Verify `enabled` is not `false`
- Check for handler: Ensure `onInput` or `onOutput` is defined

### Messages being blocked unexpectedly

- Review interceptor priorities
- Check block reasons in logs
- Verify interceptor logic

### Performance issues

- Profile interceptor execution time
- Consider caching expensive operations
- Use conditional execution to skip unnecessary work
