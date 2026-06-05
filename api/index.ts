import app from '../server';

// Vercel rewrites /api/* requests to this handler. Express routes in server.ts
// are defined with the literal `/api/...` prefix, so we restore the original
// path on req.url before delegating to Express.
export default function handler(req: any, res: any) {
  const original =
    (req.headers && (req.headers['x-vercel-original-url'] || req.headers['x-forwarded-uri'])) ||
    req.url ||
    '/';

  let url = String(original);
  if (!url.startsWith('/')) url = '/' + url;
  if (!url.startsWith('/api/') && url !== '/api') {
    url = '/api' + url;
  }
  req.url = url;

  return (app as any)(req, res);
}
