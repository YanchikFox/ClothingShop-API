const createError = (code, status, message, originalError) => {
    const error = originalError instanceof Error ? originalError : new Error(message);
    if (message && error.message !== message) {
        error.message = message;
    }

    error.status = status;
    error.code = code;

    if (originalError && originalError !== error) {
        error.cause = originalError;
    }

    return error;
};

module.exports = { createError };
