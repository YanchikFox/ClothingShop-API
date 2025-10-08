const buildIssueDetails = (error) => {
    if (!error || !Array.isArray(error.issues)) {
        return [];
    }

    return error.issues.map((issue) => ({
        path: issue.path && issue.path.length > 0 ? issue.path.join('.') : '(root)',
        message: issue.message,
    }));
};

const validationErrorResponse = (error) => ({
    error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: buildIssueDetails(error),
    },
});

module.exports = {
    validationErrorResponse,
};
