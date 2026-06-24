/**
 * Unit tests for ToastBuffer.
 */

import {describe, expect, it} from 'vitest';
import {ToastBuffer} from '../../../src/presentation/toastBuffer';

describe('ToastBuffer', () => {
  it('starts empty', () => {
    const buffer = new ToastBuffer();
    expect(buffer.toasts).toHaveLength(0);
  });

  it('adds a toast with a unique id', () => {
    const buffer = new ToastBuffer();
    buffer.push('info', 'Title', 'Message', 3000);

    expect(buffer.toasts).toHaveLength(1);
    expect(buffer.toasts[0]!.id).toBe('1');
    expect(buffer.toasts[0]!.kind).toBe('info');
    expect(buffer.toasts[0]!.title).toBe('Title');
    expect(buffer.toasts[0]!.message).toBe('Message');
    expect(buffer.toasts[0]!.duration).toBe(3000);
  });

  it('increments ids monotonically', () => {
    const buffer = new ToastBuffer();
    buffer.push('info', 'One', 'First');
    buffer.push('warning', 'Two', 'Second');

    expect(buffer.toasts[0]!.id).toBe('1');
    expect(buffer.toasts[1]!.id).toBe('2');
  });

  it('removes toast by id', () => {
    const buffer = new ToastBuffer();
    buffer.push('info', 'One', 'First');
    buffer.push('warning', 'Two', 'Second');

    buffer.remove('1');

    expect(buffer.toasts).toHaveLength(1);
    expect(buffer.toasts[0]!.id).toBe('2');
  });

  it('limits the number of visible toasts', () => {
    const buffer = new ToastBuffer();
    for (let i = 0; i < 12; i++) {
      buffer.push('info', `Toast ${i}`, `Message ${i}`);
    }

    expect(buffer.toasts).toHaveLength(10);
    expect(buffer.toasts[0]!.title).toBe('Toast 2');
    expect(buffer.toasts[9]!.title).toBe('Toast 11');
  });

  it('clears all toasts and resets ids', () => {
    const buffer = new ToastBuffer();
    buffer.push('info', 'One', 'First');
    buffer.clear();

    expect(buffer.toasts).toHaveLength(0);

    buffer.push('info', 'Two', 'Second');
    expect(buffer.toasts[0]!.id).toBe('1');
  });

  it('returns a copy of internal array', () => {
    const buffer = new ToastBuffer();
    buffer.push('info', 'One', 'First');

    const first = buffer.toasts;
    const second = buffer.toasts;
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
