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

const toNumberOrNull = (value) => {
    const raw = toStringOrNull(value);
    if (raw === null) {
        return null;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
        return null;
    }

    return numeric;
};

const toPositiveIntegerOrNull = (value) => {
    const raw = toStringOrNull(value);
    if (raw === null) {
        return null;
    }

    const numeric = Number.parseInt(raw, 10);
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }

    return numeric;
};

const normalizeGender = (value) => {
    const normalized = toStringOrNull(value)?.toLowerCase();
    if (!normalized) {
        return null;
    }

    const allowed = new Set(['male', 'female', 'unisex']);
    return allowed.has(normalized) ? normalized : null;
};

const normalizeSortBy = (value) => {
    const normalized = toStringOrNull(value)?.toLowerCase();
    const allowed = ['price', 'name', 'newest', 'bestseller'];
    if (normalized && allowed.includes(normalized)) {
        return normalized;
    }

    return 'name';
};

const normalizeSortOrder = (value, sortBy) => {
    const normalized = toStringOrNull(value)?.toLowerCase();
    if (normalized === 'asc' || normalized === 'desc') {
        return normalized;
    }

    if (sortBy === 'newest' || sortBy === 'bestseller') {
        return 'desc';
    }

    return 'asc';
};

const sanitizeProductsQuery = (query = {}) => {
    const gender = normalizeGender(query.gender);
    const categoryIdRaw = toStringOrNull(query.categoryId ?? query.category_id);
    const categoryId = categoryIdRaw ? categoryIdRaw.toLowerCase() : null;
    const sizeRaw = toStringOrNull(query.size);
    const size = sizeRaw ? sizeRaw.toUpperCase() : null;

    let minPrice = toNumberOrNull(query.minPrice ?? query.min_price);
    let maxPrice = toNumberOrNull(query.maxPrice ?? query.max_price);

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        [minPrice, maxPrice] = [maxPrice, minPrice];
    }

    const sortBy = normalizeSortBy(query.sortBy ?? query.sort_by);
    const sortOrder = normalizeSortOrder(query.sortOrder ?? query.sort_order, sortBy);

    const page = toPositiveIntegerOrNull(query.page) ?? 1;
    const pageSizeRaw = toPositiveIntegerOrNull(query.pageSize ?? query.page_size) ?? 20;
    const pageSize = Math.min(pageSizeRaw, 100);

    return {
        gender,
        categoryId,
        minPrice,
        maxPrice,
        size,
        sortBy,
        sortOrder,
        page,
        pageSize,
    };
};

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
