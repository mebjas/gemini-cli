/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PartListUnion } from '@google/genai';
import type { ServerGeminiStreamEvent } from '../core/turn.js';

/**
 * Context information about the interceptor invocation
 */
export interface InterceptorContext {
  /**
   * Unique session identifier
   */
  sessionId: string;

  /**
   * Timestamp when the interception occurred
   */
  timestamp: Date;

  /**
   * Current model being used
   */
  model?: string;

  /**
   * Additional metadata that can be passed to interceptors
   */
  metadata?: Record<string, unknown>;
}

/**
 * Input data passed to the agent
 */
export interface InputData {
  /**
   * The user's input message
   */
  message: PartListUnion;

  /**
   * Whether this is a retry of a previous input
   */
  isRetry?: boolean;
}

/**
 * Output data from the agent
 */
export interface OutputData {
  /**
   * The stream event from Gemini
   */
  event: ServerGeminiStreamEvent;
}

/**
 * Result from an input interceptor - can modify or block the input
 */
export interface InputInterceptorResult {
  /**
   * Modified input message (if undefined, uses original)
   */
  message?: PartListUnion;

  /**
   * If true, prevents the input from being sent to the agent
   */
  blocked?: boolean;

  /**
   * Reason for blocking (shown to user if blocked=true)
   */
  blockReason?: string;

  /**
   * Additional metadata to pass to the next interceptor
   */
  metadata?: Record<string, unknown>;
}

/**
 * Result from an output interceptor - can modify the output
 */
export interface OutputInterceptorResult {
  /**
   * Modified output event (if undefined, uses original)
   */
  event?: ServerGeminiStreamEvent;

  /**
   * If true, prevents the output from being displayed
   */
  blocked?: boolean;

  /**
   * Additional metadata to pass to the next interceptor
   */
  metadata?: Record<string, unknown>;
}

/**
 * Function signature for input interceptors
 */
export type InputInterceptor = (
  input: InputData,
  context: InterceptorContext,
) => Promise<InputInterceptorResult | void> | InputInterceptorResult | void;

/**
 * Function signature for output interceptors
 */
export type OutputInterceptor = (
  output: OutputData,
  context: InterceptorContext,
) => Promise<OutputInterceptorResult | void> | OutputInterceptorResult | void;

/**
 * Configuration for an interceptor
 */
export interface InterceptorConfig {
  /**
   * Unique identifier for this interceptor
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description of what this interceptor does
   */
  description?: string;

  /**
   * Input interceptor function
   */
  onInput?: InputInterceptor;

  /**
   * Output interceptor function
   */
  onOutput?: OutputInterceptor;

  /**
   * Whether this interceptor is enabled
   */
  enabled?: boolean;

  /**
   * Priority for execution order (higher = earlier execution)
   * Default is 0
   */
  priority?: number;
}
