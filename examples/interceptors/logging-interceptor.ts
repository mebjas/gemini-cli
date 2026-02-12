/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Example: Logging Interceptor
 *
 * This example demonstrates how to create a simple logging interceptor
 * that tracks all input and output between the user and the agent.
 *
 * Usage:
 * 1. Import this interceptor in your application
 * 2. Register it with the interceptor manager
 * 3. All interactions will be logged to the console
 */

import type {
  InterceptorConfig,
  InputData,
  OutputData,
  InterceptorContext,
} from '@google/gemini-cli-core';
import { GeminiEventType } from '@google/gemini-cli-core';

/**
 * Creates a logging interceptor that logs all input/output
 */
export function createLoggingInterceptor(): InterceptorConfig {
  return {
    id: 'logging-interceptor',
    name: 'Logging Interceptor',
    description: 'Logs all input and output for debugging purposes',
    priority: 0, // Low priority - log after other interceptors

    onInput: async (input: InputData, context: InterceptorContext) => {
      const timestamp = context.timestamp.toISOString();
      const message =
        typeof input.message === 'string'
          ? input.message
          : JSON.stringify(input.message, null, 2);

      console.log('\n' + '='.repeat(80));
      console.log(`[${timestamp}] USER INPUT`);
      console.log('Session:', context.sessionId);
      console.log('Model:', context.model || 'unknown');
      console.log('Is Retry:', input.isRetry || false);
      console.log('-'.repeat(80));
      console.log(message);
      console.log('='.repeat(80) + '\n');

      // Don't modify the message, just log it
      return;
    },

    onOutput: async (output: OutputData, context: InterceptorContext) => {
      const timestamp = context.timestamp.toISOString();
      const event = output.event;

      console.log('\n' + '='.repeat(80));
      console.log(`[${timestamp}] AGENT OUTPUT`);
      console.log('Session:', context.sessionId);
      console.log('Model:', context.model || 'unknown');
      console.log('Event Type:', event.type);
      console.log('-'.repeat(80));

      // Log different event types differently
      switch (event.type) {
        case GeminiEventType.Content:
          console.log('Content:', event.value);
          break;
        case GeminiEventType.Thought:
          console.log('Thought:', event.value);
          break;
        case GeminiEventType.ToolCallRequest:
          console.log('Tool Call Request:', event.value);
          break;
        case GeminiEventType.ToolCallResponse:
          console.log('Tool Call Response:', event.value);
          break;
        case GeminiEventType.Error:
          console.log('Error:', event.value);
          break;
        case GeminiEventType.Finished:
          console.log('Finished:', event.value);
          break;
        default:
          console.log('Event:', JSON.stringify(event, null, 2));
      }

      console.log('='.repeat(80) + '\n');

      // Don't modify the event, just log it
      return;
    },
  };
}

/**
 * Example usage:
 *
 * import { createLoggingInterceptor } from './examples/interceptors/logging-interceptor';
 *
 * const config = // ... your config instance
 * const interceptorManager = config.getInterceptorManager();
 *
 * // Register the logging interceptor
 * interceptorManager.register(createLoggingInterceptor());
 *
 * // Now all interactions will be logged to the console
 */
