const errorHandler = (err, _req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (process.env.NODE_ENV !== 'test') {
        console.error(err);
    }

    const status = typeof err.status === 'number' ? err.status : 500;
    const code = err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'UNKNOWN_ERROR');
    const message = err.message || 'An unexpected error occurred';

    res.status(status).json({
        error: {
            code,
            message,
        },
    });
};

module.exports = errorHandler;
