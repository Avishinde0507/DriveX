/**
 * Custom MongoDB Sanitization Middleware
 * 
 * Express 5 makes req.query a read-only getter, which causes the third-party 
 * express-mongo-sanitize library to throw a TypeError: "Cannot set property query of..."
 * 
 * This custom middleware performs the same sanitization (recursively deleting keys 
 * starting with '$' or containing '.') but mutates the objects in-place, which is 
 * fully supported by Express 5.
 */

function sanitize(target) {
  if (target === null || typeof target !== 'object') {
    return target;
  }

  // Skip instances of Date, RegExp, etc.
  if (target instanceof Date || target instanceof RegExp) {
    return target;
  }

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      sanitize(target[i]);
    }
  } else {
    for (const key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        if (key.startsWith('$') || key.includes('.')) {
          delete target[key];
        } else {
          sanitize(target[key]);
        }
      }
    }
  }
  return target;
}

module.exports = function mongoSanitize() {
  return (req, res, next) => {
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
  };
};
