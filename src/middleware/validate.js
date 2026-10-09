import { ZodError } from 'zod';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      next(result.error instanceof ZodError ? result.error : new ZodError(result.error.issues));
      return;
    }

    req.validated = result.data;
    if (result.data.body !== undefined) {
      req.body = result.data.body;
    }
    if (result.data.query !== undefined) {
      req.query = result.data.query;
    }
    if (result.data.params !== undefined) {
      req.params = result.data.params;
    }
    next();
  };
}
