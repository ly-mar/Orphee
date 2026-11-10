// __tests__/actionLock.test.js
import { createAsyncActionLock } from '../utils/actionLockUtils';

describe('Rapid Double-Tap Action Lock [BUG-011]', () => {
  test('drops concurrent duplicate taps while an async vote or profile save is in flight', async () => {
    const runExclusive = createAsyncActionLock();
    let resolveFirst;
    const slowMutation = jest.fn(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    );

    const p1 = runExclusive(slowMutation);
    const p2 = runExclusive(slowMutation); // Rapid second tap before p1 resolves
    const p3 = runExclusive(slowMutation); // Rapid third tap

    expect(slowMutation).toHaveBeenCalledTimes(1);
    expect(await p2).toBeUndefined();
    expect(await p3).toBeUndefined();

    resolveFirst('saved');
    expect(await p1).toBe('saved');

    // Subsequent tap after resolution is allowed
    const fastMutation = jest.fn().mockResolvedValue('next');
    expect(await runExclusive(fastMutation)).toBe('next');
    expect(fastMutation).toHaveBeenCalledTimes(1);
  });
});

