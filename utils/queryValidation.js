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

const parseNumberParam = (value, { min, max } = {}) => {
    const raw = toStringOrNull(value);
    if (raw === null) {
        return { value: null, invalid: false };
    }

    const numeric = Number.parseFloat(raw);
    if (Number.isNaN(numeric)) {
        return { value: null, invalid: true };
    }

    if (typeof min === 'number' && numeric < min) {
        return { value: null, invalid: true };
    }

    if (typeof max === 'number' && numeric > max) {
        return { value: null, invalid: true };
    }

    return { value: numeric, invalid: false };
};

const parseIntegerParam = (value, { min, max } = {}) => {
    const raw = toStringOrNull(value);
    if (raw === null) {
        return { value: null, invalid: false };
    }

    if (!/^[-+]?\d+$/.test(raw)) {
        return { value: null, invalid: true };
    }

    const numeric = Number.parseInt(raw, 10);
    if (Number.isNaN(numeric)) {
        return { value: null, invalid: true };
    }

    if (typeof min === 'number' && numeric < min) {
        return { value: null, invalid: true };
    }

    if (typeof max === 'number' && numeric > max) {
        return { value: null, invalid: true };
    }

    return { value: numeric, invalid: false };
};

const normalizeSortParams = (query) => {
    const supportedKeys = new Set(['price', 'name', 'created_at', 'newest', 'oldest', 'bestseller', 'id']);

    const sortParam = toStringOrNull(query.sort);
    const sortByParam = toStringOrNull(query.sortBy ?? query.sort_by);
    const sortOrderParam = toStringOrNull(query.sortOrder ?? query.sort_order ?? query.order);

    let sortKey = sortByParam ?? null;
    let sortOrder = sortOrderParam ?? null;

    if (sortParam) {
        const cleaned = sortParam.replace(/[:\s-]+/g, '_');
        const [rawKey, rawOrder] = cleaned.split('_');
        if (rawKey) {
            sortKey = rawKey;
        }
        if (rawOrder) {
            sortOrder = rawOrder;
        }
    }

    if (sortKey) {
        sortKey = sortKey.toLowerCase();
    }

    if (sortOrder) {
        sortOrder = sortOrder.toLowerCase();
    }

    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
        sortOrder = null;
    }

    if (sortKey && !supportedKeys.has(sortKey)) {
        return { sortKey: null, sortOrder, invalid: true };
    }

    return { sortKey, sortOrder, invalid: false };
};

const sanitizeProductsQuery = (query = {}) => {
    const gender = toStringOrNull(query.gender);
    const categoryId = toStringOrNull(query.categoryId ?? query.category_id);

    const { value: minPrice, invalid: invalidMinPrice } = parseNumberParam(query.minPrice ?? query.min_price, {
        min: 0,
    });
    const { value: maxPrice, invalid: invalidMaxPrice } = parseNumberParam(query.maxPrice ?? query.max_price, {
        min: 0,
    });

    const { value: page, invalid: invalidPage } = parseIntegerParam(query.page, { min: 1 });
    const { value: limit, invalid: invalidLimit } = parseIntegerParam(query.limit ?? query.pageSize ?? query.page_size, {
        min: 1,
    });

    const { sortKey, sortOrder, invalid: invalidSort } = normalizeSortParams(query);

    const errors = [];

    if (invalidMinPrice) {
        errors.push('INVALID_MIN_PRICE');
    }

    if (invalidMaxPrice) {
        errors.push('INVALID_MAX_PRICE');
    }

    if (invalidPage) {
        errors.push('INVALID_PAGE');
    }

    if (invalidLimit) {
        errors.push('INVALID_LIMIT');
    }

    if (invalidSort) {
        errors.push('INVALID_SORT');
    }

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        errors.push('PRICE_RANGE_INVALID');
    }

    if (page !== null && limit === null) {
        errors.push('PAGE_REQUIRES_LIMIT');
    }

    return {
        gender,
        categoryId,
        minPrice,
        maxPrice,
        sortKey,
        sortOrder,
        page,
        limit,
        errors,
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
    parseNumberParam,
    parseIntegerParam,
};
