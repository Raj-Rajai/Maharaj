export const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors;
      const firstMsg = details[0]?.message || 'Validation failed';
      return res.status(400).json({
        message: firstMsg,
        error: {
          message: firstMsg,
          details,
        },
      });
    }
    req.body = result.data;
    next();
  };
};
