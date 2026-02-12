/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PartListUnion } from '@google/genai';
import type { ServerGeminiStreamEvent } from '../core/turn.js';
import type {
  InterceptorConfig,
  InterceptorContext,
  InputData,
  OutputData,
} from './types.js';
import { debugLogger } from '../utils/debugLogger.js';

/**
 * Manages registration and execution of interceptors
 */
export class InterceptorManager {
  private interceptors: Map<string, InterceptorConfig> = new Map();
  private readonly sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Register an interceptor
   */
  register(config: InterceptorConfig): void {
    if (this.interceptors.has(config.id)) {
      debugLogger.debug(
        `[InterceptorManager] Replacing existing interceptor: ${config.id}`,
      );
    }
    this.interceptors.set(config.id, config);
    debugLogger.debug(
      `[InterceptorManager] Registered interceptor: ${config.id} (${config.name})`,
    );
  }

  /**
   * Unregister an interceptor
   */
  unregister(id: string): boolean {
    const result = this.interceptors.delete(id);
    if (result) {
      debugLogger.debug(`[InterceptorManager] Unregistered interceptor: ${id}`);
    }
    return result;
  }

  /**
   * Get all registered interceptors
   */
  getAll(): InterceptorConfig[] {
    return Array.from(this.interceptors.values());
  }

  /**
   * Get a specific interceptor by ID
   */
  get(id: string): InterceptorConfig | undefined {
    return this.interceptors.get(id);
  }

  /**
   * Clear all interceptors
   */
  clear(): void {
    this.interceptors.clear();
    debugLogger.debug('[InterceptorManager] Cleared all interceptors');
  }

  /**
   * Execute input interceptors in priority order
   */
  async executeInputInterceptors(
    message: PartListUnion,
    model?: string,
    isRetry?: boolean,
  ): Promise<{
    message: PartListUnion;
    blocked: boolean;
    blockReason?: string;
  }> {
    const enabledInterceptors = this.getSortedInputInterceptors();

    if (enabledInterceptors.length === 0) {
      return { message, blocked: false };
    }

    let currentMessage = message;
    let metadata: Record<string, unknown> = {};

    const context: InterceptorContext = {
      sessionId: this.sessionId,
      timestamp: new Date(),
      model,
      metadata,
    };

    const inputData: InputData = {
      message: currentMessage,
      isRetry,
    };

    for (const interceptor of enabledInterceptors) {
      if (!interceptor.onInput) {
        continue;
      }

      try {
        debugLogger.debug(
          `[InterceptorManager] Executing input interceptor: ${interceptor.id}`,
        );

        // Update context metadata for this interceptor
        context.metadata = metadata;

        // Update input data with current message
        inputData.message = currentMessage;

        const result = await interceptor.onInput(inputData, context);

        if (!result) {
          continue;
        }

        // Check if blocked
        if (result.blocked) {
          debugLogger.debug(
            `[InterceptorManager] Input blocked by interceptor: ${interceptor.id}`,
          );
          return {
            message: currentMessage,
            blocked: true,
            blockReason: result.blockReason,
          };
        }

        // Update message if modified
        if (result.message !== undefined) {
          currentMessage = result.message;
          debugLogger.debug(
            `[InterceptorManager] Input modified by interceptor: ${interceptor.id}`,
          );
        }

        // Merge metadata
        if (result.metadata) {
          metadata = { ...metadata, ...result.metadata };
        }
      } catch (error) {
        debugLogger.error(
          `[InterceptorManager] Error in input interceptor ${interceptor.id}:`,
          error,
        );
        // Continue with other interceptors even if one fails
      }
    }

    return { message: currentMessage, blocked: false };
  }

  /**
   * Execute output interceptors in priority order
   */
  async executeOutputInterceptors(
    event: ServerGeminiStreamEvent,
    model?: string,
  ): Promise<{
    event: ServerGeminiStreamEvent;
    blocked: boolean;
  }> {
    const enabledInterceptors = this.getSortedOutputInterceptors();

    if (enabledInterceptors.length === 0) {
      return { event, blocked: false };
    }

    let currentEvent = event;
    let metadata: Record<string, unknown> = {};

    const context: InterceptorContext = {
      sessionId: this.sessionId,
      timestamp: new Date(),
      model,
      metadata,
    };

    const outputData: OutputData = {
      event: currentEvent,
    };

    for (const interceptor of enabledInterceptors) {
      if (!interceptor.onOutput) {
        continue;
      }

      try {
        debugLogger.debug(
          `[InterceptorManager] Executing output interceptor: ${interceptor.id}`,
        );

        // Update context metadata for this interceptor
        context.metadata = metadata;

        // Update output data with current event
        outputData.event = currentEvent;

        const result = await interceptor.onOutput(outputData, context);

        if (!result) {
          continue;
        }

        // Check if blocked
        if (result.blocked) {
          debugLogger.debug(
            `[InterceptorManager] Output blocked by interceptor: ${interceptor.id}`,
          );
          return {
            event: currentEvent,
            blocked: true,
          };
        }

        // Update event if modified
        if (result.event !== undefined) {
          currentEvent = result.event;
          debugLogger.debug(
            `[InterceptorManager] Output modified by interceptor: ${interceptor.id}`,
          );
        }

        // Merge metadata
        if (result.metadata) {
          metadata = { ...metadata, ...result.metadata };
        }
      } catch (error) {
        debugLogger.error(
          `[InterceptorManager] Error in output interceptor ${interceptor.id}:`,
          error,
        );
        // Continue with other interceptors even if one fails
      }
    }

    return { event: currentEvent, blocked: false };
  }

  /**
   * Get sorted input interceptors (by priority, descending)
   */
  private getSortedInputInterceptors(): InterceptorConfig[] {
    return Array.from(this.interceptors.values())
      .filter((i) => i.enabled !== false && i.onInput !== undefined)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Get sorted output interceptors (by priority, descending)
   */
  private getSortedOutputInterceptors(): InterceptorConfig[] {
    return Array.from(this.interceptors.values())
      .filter((i) => i.enabled !== false && i.onOutput !== undefined)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
}
