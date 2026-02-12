/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Example: Content Filter Interceptor
 *
 * This example demonstrates how to create a content filtering interceptor
 * that blocks messages containing sensitive information like passwords,
 * API keys, or other secrets.
 *
 * Usage:
 * 1. Import this interceptor in your application
 * 2. Register it with the interceptor manager
 * 3. Messages with sensitive content will be blocked
 */

import type {
  InterceptorConfig,
  InputData,
  OutputData,
  InputInterceptorResult,
  OutputInterceptorResult,
} from '@google/gemini-cli-core';
import { GeminiEventType } from '@google/gemini-cli-core';

/**
 * Patterns to detect sensitive information
 */
const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*\S+/gi,
  /bearer\s+[a-zA-Z0-9._-]+/gi,
  /sk-[a-zA-Z0-9]{20,}/gi, // OpenAI-style keys
  /AIza[a-zA-Z0-9_-]{35}/gi, // Google API keys
];

/**
 * Check if text contains sensitive information
 */
function containsSensitiveInfo(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Redact sensitive information from text
 */
function redactSensitiveInfo(text: string): string {
  let redacted = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

/**
 * Creates a content filter interceptor
 *
 * @param options Configuration options
 * @param options.blockSensitiveInput If true, blocks input with sensitive data (default: true)
 * @param options.blockSensitiveOutput If true, blocks output with sensitive data (default: false)
 * @param options.redactInsteadOfBlock If true, redacts instead of blocking (default: false)
 */
export function createContentFilterInterceptor(options?: {
  blockSensitiveInput?: boolean;
  blockSensitiveOutput?: boolean;
  redactInsteadOfBlock?: boolean;
}): InterceptorConfig {
  const {
    blockSensitiveInput = true,
    blockSensitiveOutput = false,
    redactInsteadOfBlock = false,
  } = options || {};

  return {
    id: 'content-filter-interceptor',
    name: 'Content Filter Interceptor',
    description: 'Filters or redacts sensitive information from messages',
    priority: 100, // High priority - filter before other processing

    onInput: async (
      input: InputData,
    ): Promise<InputInterceptorResult | void> => {
      // Convert message to string for checking
      const messageText =
        typeof input.message === 'string'
          ? input.message
          : JSON.stringify(input.message);

      if (!containsSensitiveInfo(messageText)) {
        return; // No sensitive info, pass through
      }

      if (!blockSensitiveInput) {
        return; // Not configured to block input
      }

      if (redactInsteadOfBlock && typeof input.message === 'string') {
        // Redact the sensitive information
        const redactedMessage = redactSensitiveInfo(input.message);
        console.warn(
          '[Content Filter] Redacted sensitive information from input',
        );
        return {
          message: redactedMessage,
        };
      }

      // Block the message
      console.warn(
        '[Content Filter] Blocked input containing sensitive information',
      );
      return {
        blocked: true,
        blockReason:
          'Your message contains sensitive information (passwords, API keys, etc.). Please remove it and try again.',
      };
    },

    onOutput: async (
      output: OutputData,
    ): Promise<OutputInterceptorResult | void> => {
      if (!blockSensitiveOutput) {
        return; // Not configured to filter output
      }

      // Only check content events
      if (output.event.type !== GeminiEventType.Content) {
        return;
      }

      const content = output.event.value;
      if (typeof content !== 'string') {
        return;
      }

      if (!containsSensitiveInfo(content)) {
        return; // No sensitive info
      }

      if (redactInsteadOfBlock) {
        // Redact the sensitive information
        const redactedContent = redactSensitiveInfo(content);
        console.warn(
          '[Content Filter] Redacted sensitive information from output',
        );
        return {
          event: {
            ...output.event,
            value: redactedContent,
          },
        };
      }

      // Block the output
      console.warn(
        '[Content Filter] Blocked output containing sensitive information',
      );
      return {
        blocked: true,
      };
    },
  };
}

/**
 * Example usage:
 *
 * import { createContentFilterInterceptor } from './examples/interceptors/content-filter-interceptor';
 *
 * const config = // ... your config instance
 * const interceptorManager = config.getInterceptorManager();
 *
 * // Option 1: Block sensitive input, ignore output
 * interceptorManager.register(createContentFilterInterceptor());
 *
 * // Option 2: Block both input and output
 * interceptorManager.register(createContentFilterInterceptor({
 *   blockSensitiveInput: true,
 *   blockSensitiveOutput: true,
 * }));
 *
 * // Option 3: Redact instead of blocking
 * interceptorManager.register(createContentFilterInterceptor({
 *   blockSensitiveInput: true,
 *   redactInsteadOfBlock: true,
 * }));
 */
