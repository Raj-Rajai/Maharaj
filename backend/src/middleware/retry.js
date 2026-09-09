/**
 * Express middleware that auto-retries on Prisma P1017 (connection dropped) errors.
 * Supabase pooler can intermittently drop connections — this makes it transparent to the client.
 */
export const retryOnConnectionDrop = (handler) => {
  return async (req, res, next) => {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await handler(req, res, next);
        return; // Success — exit
      } catch (err) {
        if (err?.code === 'P1017' && attempt < maxRetries) {
          console.warn(`P1017 retry ${attempt + 1}/${maxRetries} for ${req.method} ${req.url}`);
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        // Not a P1017 or out of retries — pass to error handler
        return next(err);
      }
    }
  };
};
