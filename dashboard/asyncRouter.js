/**
 * Express 4 does NOT catch rejected promises from `async` route handlers. When a
 * handler threw (e.g. a settings object missing a field), the promise rejected, nobody
 * called next(err), and the HTTP request just hung forever — in the browser that shows
 * up as a dashboard page stuck on "جاري التحميل..." with nothing in the UI to explain it.
 *
 * This wraps a router's route methods so a thrown/rejected error is forwarded to
 * next(err), i.e. to the JSON 500 handler in dashboard/server.js (which also logs it).
 * Only the public Router API is used, so it works with any Express 4 version.
 */
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'];

function wrap(handler) {
  // Error-handling middleware (4 args) and non-functions are left untouched.
  if (typeof handler !== 'function' || handler.length > 3) return handler;
  return function asyncSafeHandler(req, res, next) {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

function asyncRouter(router) {
  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) => original(path, ...handlers.flat().map(wrap));
  }
  const originalUse = router.use.bind(router);
  router.use = (...args) => originalUse(...args.map((a) => (Array.isArray(a) ? a.map(wrap) : wrap(a))));
  return router;
}

module.exports = asyncRouter;
module.exports.wrap = wrap;
