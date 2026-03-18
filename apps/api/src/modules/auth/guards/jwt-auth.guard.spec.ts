import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(): ExecutionContext {
  return {
    getHandler: () => () => {},
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new JwtAuthGuard(reflector);
  });

  it('returns true immediately for routes decorated with @Public()', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = makeContext();

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalled();
  });

  it('delegates to super.canActivate when route is not public', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    // Spy on the parent class method so we don't need a real JWT.
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    void guard.canActivate(makeContext());

    expect(superSpy).toHaveBeenCalled();
    superSpy.mockRestore();
  });
});
