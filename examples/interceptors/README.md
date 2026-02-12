# Interceptor Examples

This directory contains example implementations of interceptors for the Gemini
CLI.

## Available Examples

### 1. Logging Interceptor (`logging-interceptor.ts`)

A simple interceptor that logs all input and output between the user and the
agent.

**Use case**: Debugging, monitoring, analytics

**Features**:

- Logs user input with timestamp and session info
- Logs agent output with event types
- Pretty-prints complex objects
- Non-intrusive (doesn't modify messages)

**Usage**:

```typescript
import { createLoggingInterceptor } from './examples/interceptors/logging-interceptor';

const interceptorManager = config.getInterceptorManager();
interceptorManager.register(createLoggingInterceptor());
```

### 2. Content Filter Interceptor (`content-filter-interceptor.ts`)

An interceptor that detects and blocks/redacts sensitive information like
passwords and API keys.

**Use case**: Security, data protection

**Features**:

- Detects various patterns (passwords, API keys, tokens, secrets)
- Supports blocking or redacting sensitive content
- Configurable for input and/or output
- Pattern-based detection

**Usage**:

```typescript
import { createContentFilterInterceptor } from './examples/interceptors/content-filter-interceptor';

const interceptorManager = config.getInterceptorManager();

// Block sensitive input
interceptorManager.register(createContentFilterInterceptor());

// Or redact instead of blocking
interceptorManager.register(
  createContentFilterInterceptor({
    redactInsteadOfBlock: true,
  }),
);
```

## Creating Your Own Interceptor

To create a custom interceptor:

1. Import the required types:

```typescript
import type {
  InterceptorConfig,
  InputData,
  OutputData,
  InterceptorContext,
} from '@google/gemini-cli-core';
```

2. Create your interceptor configuration:

```typescript
const myInterceptor: InterceptorConfig = {
  id: 'my-interceptor',
  name: 'My Custom Interceptor',
  description: 'What it does',
  priority: 50,

  onInput: async (input, context) => {
    // Process input
    return { message: modifiedMessage };
  },

  onOutput: async (output, context) => {
    // Process output
    return { event: modifiedEvent };
  },
};
```

3. Register it:

```typescript
config.getInterceptorManager().register(myInterceptor);
```

## Best Practices

1. **One responsibility per interceptor**: Keep each interceptor focused on a
   single task
2. **Use appropriate priority**: Higher priority (100+) for validators, lower
   (0-10) for loggers
3. **Handle errors gracefully**: Wrap risky operations in try-catch
4. **Document your code**: Explain what the interceptor does and why
5. **Test thoroughly**: Consider edge cases and error scenarios

## See Also

- [Interceptors Documentation](../docs/interceptors.md) - Complete API reference
- [Core Package](../packages/core/src/interceptor/) - Source implementation
