/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterceptorManager } from './interceptorManager.js';
import type { InterceptorConfig } from './types.js';
import { GeminiEventType } from '../core/turn.js';
import type { ServerGeminiContentEvent } from '../core/turn.js';

describe('InterceptorManager', () => {
  let manager: InterceptorManager;

  beforeEach(() => {
    manager = new InterceptorManager('test-session');
  });

  describe('registration', () => {
    it('should register an interceptor', () => {
      const config: InterceptorConfig = {
        id: 'test-interceptor',
        name: 'Test Interceptor',
        onInput: vi.fn(),
      };

      manager.register(config);

      expect(manager.get('test-interceptor')).toBe(config);
    });

    it('should unregister an interceptor', () => {
      const config: InterceptorConfig = {
        id: 'test-interceptor',
        name: 'Test Interceptor',
        onInput: vi.fn(),
      };

      manager.register(config);
      const result = manager.unregister('test-interceptor');

      expect(result).toBe(true);
      expect(manager.get('test-interceptor')).toBeUndefined();
    });

    it('should return false when unregistering non-existent interceptor', () => {
      const result = manager.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should get all registered interceptors', () => {
      const config1: InterceptorConfig = {
        id: 'interceptor-1',
        name: 'Interceptor 1',
        onInput: vi.fn(),
      };
      const config2: InterceptorConfig = {
        id: 'interceptor-2',
        name: 'Interceptor 2',
        onOutput: vi.fn(),
      };

      manager.register(config1);
      manager.register(config2);

      const all = manager.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(config1);
      expect(all).toContainEqual(config2);
    });

    it('should clear all interceptors', () => {
      manager.register({
        id: 'interceptor-1',
        name: 'Interceptor 1',
        onInput: vi.fn(),
      });
      manager.register({
        id: 'interceptor-2',
        name: 'Interceptor 2',
        onOutput: vi.fn(),
      });

      manager.clear();

      expect(manager.getAll()).toHaveLength(0);
    });
  });

  describe('input interception', () => {
    it('should execute input interceptors', async () => {
      const inputFn = vi.fn();
      const config: InterceptorConfig = {
        id: 'test-interceptor',
        name: 'Test Interceptor',
        onInput: inputFn,
      };

      manager.register(config);

      await manager.executeInputInterceptors('test message');

      expect(inputFn).toHaveBeenCalled();
      const call = inputFn.mock.calls[0];
      expect(call[0].message).toBe('test message');
      expect(call[1].sessionId).toBe('test-session');
    });

    it('should modify input message', async () => {
      const config: InterceptorConfig = {
        id: 'modifier',
        name: 'Modifier',
        onInput: async () => ({
          message: 'modified message',
        }),
      };

      manager.register(config);

      const result = await manager.executeInputInterceptors('original message');

      expect(result.message).toBe('modified message');
      expect(result.blocked).toBe(false);
    });

    it('should block input', async () => {
      const config: InterceptorConfig = {
        id: 'blocker',
        name: 'Blocker',
        onInput: async () => ({
          blocked: true,
          blockReason: 'Input not allowed',
        }),
      };

      manager.register(config);

      const result = await manager.executeInputInterceptors('test message');

      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBe('Input not allowed');
    });

    it('should execute interceptors in priority order', async () => {
      const executionOrder: number[] = [];

      const config1: InterceptorConfig = {
        id: 'low-priority',
        name: 'Low Priority',
        priority: 1,
        onInput: async () => {
          executionOrder.push(1);
        },
      };

      const config2: InterceptorConfig = {
        id: 'high-priority',
        name: 'High Priority',
        priority: 10,
        onInput: async () => {
          executionOrder.push(10);
        },
      };

      manager.register(config1);
      manager.register(config2);

      await manager.executeInputInterceptors('test');

      expect(executionOrder).toEqual([10, 1]);
    });

    it('should skip disabled interceptors', async () => {
      const inputFn = vi.fn();
      const config: InterceptorConfig = {
        id: 'disabled-interceptor',
        name: 'Disabled',
        enabled: false,
        onInput: inputFn,
      };

      manager.register(config);

      await manager.executeInputInterceptors('test message');

      expect(inputFn).not.toHaveBeenCalled();
    });

    it('should continue execution if an interceptor throws error', async () => {
      const config1: InterceptorConfig = {
        id: 'error-interceptor',
        name: 'Error',
        onInput: async () => {
          throw new Error('Test error');
        },
      };

      const inputFn = vi.fn();
      const config2: InterceptorConfig = {
        id: 'normal-interceptor',
        name: 'Normal',
        onInput: inputFn,
      };

      manager.register(config1);
      manager.register(config2);

      const result = await manager.executeInputInterceptors('test');

      expect(inputFn).toHaveBeenCalled();
      expect(result.blocked).toBe(false);
    });

    it('should pass metadata between interceptors', async () => {
      const config1: InterceptorConfig = {
        id: 'metadata-setter',
        name: 'Metadata Setter',
        priority: 2,
        onInput: async () => ({
          metadata: { key: 'value' },
        }),
      };

      const inputFn = vi.fn();
      const config2: InterceptorConfig = {
        id: 'metadata-reader',
        name: 'Metadata Reader',
        priority: 1,
        onInput: inputFn,
      };

      manager.register(config1);
      manager.register(config2);

      await manager.executeInputInterceptors('test');

      const context = inputFn.mock.calls[0][1];
      expect(context.metadata).toEqual({ key: 'value' });
    });
  });

  describe('output interception', () => {
    it('should execute output interceptors', async () => {
      const outputFn = vi.fn();
      const config: InterceptorConfig = {
        id: 'test-interceptor',
        name: 'Test Interceptor',
        onOutput: outputFn,
      };

      manager.register(config);

      const event: ServerGeminiContentEvent = {
        type: GeminiEventType.Content,
        value: 'test output',
      };

      await manager.executeOutputInterceptors(event);

      expect(outputFn).toHaveBeenCalled();
      const call = outputFn.mock.calls[0];
      expect(call[0].event).toBe(event);
      expect(call[1].sessionId).toBe('test-session');
    });

    it('should modify output event', async () => {
      const modifiedEvent: ServerGeminiContentEvent = {
        type: GeminiEventType.Content,
        value: 'modified output',
      };

      const config: InterceptorConfig = {
        id: 'modifier',
        name: 'Modifier',
        onOutput: async () => ({
          event: modifiedEvent,
        }),
      };

      manager.register(config);

      const originalEvent: ServerGeminiContentEvent = {
        type: GeminiEventType.Content,
        value: 'original output',
      };

      const result = await manager.executeOutputInterceptors(originalEvent);

      expect(result.event).toBe(modifiedEvent);
      expect(result.blocked).toBe(false);
    });

    it('should block output', async () => {
      const config: InterceptorConfig = {
        id: 'blocker',
        name: 'Blocker',
        onOutput: async () => ({
          blocked: true,
        }),
      };

      manager.register(config);

      const event: ServerGeminiContentEvent = {
        type: GeminiEventType.Content,
        value: 'test output',
      };

      const result = await manager.executeOutputInterceptors(event);

      expect(result.blocked).toBe(true);
    });

    it('should execute output interceptors in priority order', async () => {
      const executionOrder: number[] = [];

      const config1: InterceptorConfig = {
        id: 'low-priority',
        name: 'Low Priority',
        priority: 1,
        onOutput: async () => {
          executionOrder.push(1);
        },
      };

      const config2: InterceptorConfig = {
        id: 'high-priority',
        name: 'High Priority',
        priority: 10,
        onOutput: async () => {
          executionOrder.push(10);
        },
      };

      manager.register(config1);
      manager.register(config2);

      const event: ServerGeminiContentEvent = {
        type: GeminiEventType.Content,
        value: 'test',
      };

      await manager.executeOutputInterceptors(event);

      expect(executionOrder).toEqual([10, 1]);
    });

    it('should skip interceptors without onOutput', async () => {
      const config: InterceptorConfig = {
        id: 'input-only',
        name: 'Input Only',
        onInput: vi.fn(),
      };

      manager.register(config);

      const event: ServerGeminiContentEvent = {
        type: GeminiEventType.Content,
        value: 'test',
      };

      const result = await manager.executeOutputInterceptors(event);

      expect(result.event).toBe(event);
      expect(result.blocked).toBe(false);
    });
  });

  describe('mixed interceptors', () => {
    it('should handle interceptors with both input and output handlers', async () => {
      const inputFn = vi.fn();
      const outputFn = vi.fn();

      const config: InterceptorConfig = {
        id: 'mixed',
        name: 'Mixed',
        onInput: inputFn,
        onOutput: outputFn,
      };

      manager.register(config);

      await manager.executeInputInterceptors('test input');
      expect(inputFn).toHaveBeenCalled();

      const event: ServerGeminiContentEvent = {
        type: GeminiEventType.Content,
        value: 'test output',
      };
      await manager.executeOutputInterceptors(event);
      expect(outputFn).toHaveBeenCalled();
    });
  });
});
