/**
 * Wraps an asynchronous route handler function to catch any errors
 * and pass them to the Express error handling middleware (next).
 *
 * @param {Function} fn - The asynchronous function (req, res, next) => Promise<...>
 * @returns {Function} - A new function that handles promise rejections.
 */
const catchAsync = (fn) => {
  // Return a new anonymous function that Express will call
  return (req, res, next) => {
    // Execute the original async function (fn)
    // If it resolves, everything is fine.
    // If it rejects (throws an error), catch the error and pass it to next()
    fn(req, res, next).catch(next); // Equivalent to .catch(err => next(err))
  };
};

module.exports = catchAsync;
