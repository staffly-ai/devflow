import { createHmac } from 'crypto';
import { ExecutionContext } from '@nestjs/common';
import { WebhookGuard } from './webhook.guard';

function makeCtx(body: Buffer, secret: string, sign = true): ExecutionContext {
  const sig = sign
    ? 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
    : 'sha256=badsig';
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        rawBody: body,
        headers: { 'x-hub-signature-256': sig },
      }),
    }),
  } as any;
}

describe('WebhookGuard', () => {
  const secret = 'test-secret';
  const body = Buffer.from(JSON.stringify({ ref: 'refs/heads/feature/x' }));

  it('allows request with valid signature', () => {
    const guard = new WebhookGuard(secret);
    expect(guard.canActivate(makeCtx(body, secret))).toBe(true);
  });

  it('rejects request with invalid signature', () => {
    const guard = new WebhookGuard(secret);
    expect(() => guard.canActivate(makeCtx(body, secret, false))).toThrow();
  });
});
