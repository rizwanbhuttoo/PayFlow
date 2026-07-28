export const validate = (schema, target = "body") => (req, _res, next) => {
  const value = schema.parse(req[target]);
  if (target === "body") {
    req.body = value;
  } else {
    req.validated = { ...(req.validated || {}), [target]: value };
  }
  next();
};
