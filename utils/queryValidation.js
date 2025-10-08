const toStringOrNull = (value) => {
    if (value === undefined || value === null) {
        return null;
    }

    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === null) {
        return null;
    }

    const result = String(raw).trim();
    return result.length > 0 ? result : null;
};

const sanitizeProductsQuery = (query = {}) => ({
    gender: toStringOrNull(query.gender),
    categoryId: toStringOrNull(query.categoryId ?? query.category_id),
});

const sanitizeSearchQuery = (query = {}) => ({
    q: toStringOrNull(query.q),
    gender: toStringOrNull(query.gender),
    categoryId: toStringOrNull(query.categoryId ?? query.category_id),
});

module.exports = {
    toStringOrNull,
    sanitizeProductsQuery,
    sanitizeSearchQuery,
};
