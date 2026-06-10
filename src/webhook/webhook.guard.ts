import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(@Inject('WEBHOOK_SECRET') private readonly secret: string) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) throw new UnauthorizedException('Missing X-Hub-Signature-256');

    const rawBody = (req as any).rawBody as Buffer;
    const expected = 'sha256=' + createHmac('sha256', this.secret).update(rawBody).digest('hex');

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid signature');
    }
    return true;
  }
}
