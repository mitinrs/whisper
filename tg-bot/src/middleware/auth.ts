import { Context, MiddlewareFn } from 'grammy';

export function authMiddleware(allowedIds: number[]): MiddlewareFn<Context> {
  const idSet = new Set(allowedIds);
  return (ctx, next) => {
    if (ctx.from && idSet.has(ctx.from.id)) {
      return next();
    }
  };
}
