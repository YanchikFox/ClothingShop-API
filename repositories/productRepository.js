const DEFAULT_LIMIT = 10;

const executeQuery = async (pool, query, params = []) => {
    const { rows } = await pool.query(query, params);
    return rows;
};

const buildOrderClause = (sortKey, sortOrder) => {
    const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';
    switch (sortKey) {
        case 'price':
            return `price ${direction}`;
        case 'name':
            return `LOWER(name) ${direction}`;
        case 'created_at':
            return `created_at ${direction}`;
        case 'newest':
            return 'created_at DESC';
        case 'oldest':
            return 'created_at ASC';
        case 'bestseller':
            return 'is_bestseller DESC, id ASC';
        case 'id':
            return `id ${direction}`;
        default:
            return 'id ASC';
    }
};

const toNullableNumber = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const findProducts = async (
    pool,
    { gender, categoryId, minPrice, maxPrice } = {},
    { sortKey, sortOrder, page, limit } = {}
) => {
    const conditions = [];
    const params = [];

    if (gender) {
        params.push(gender);
        conditions.push(`gender = $${params.length}`);
    }

    if (categoryId) {
        params.push(categoryId);
        conditions.push(`category_id = $${params.length}`);
    }

    const minPriceValue = toNullableNumber(minPrice);
    if (minPriceValue !== null) {
        params.push(minPriceValue);
        conditions.push(`price >= $${params.length}`);
    }

    const maxPriceValue = toNullableNumber(maxPrice);
    if (maxPriceValue !== null) {
        params.push(maxPriceValue);
        conditions.push(`price <= $${params.length}`);
    }

    let query = 'SELECT * FROM products';

    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY ${buildOrderClause(sortKey, sortOrder)}`;

    const limitValue = toNullableNumber(limit);
    if (limitValue !== null) {
        params.push(limitValue);
        query += ` LIMIT $${params.length}`;

        const pageValue = toNullableNumber(page) ?? 1;
        const offset = Math.max(0, (pageValue - 1) * limitValue);
        if (offset > 0) {
            params.push(offset);
            query += ` OFFSET $${params.length}`;
        }
    }

    return executeQuery(pool, query, params);
};

const findAllProducts = (pool) => executeQuery(pool, 'SELECT * FROM products');

const findCategories = (pool) =>
    executeQuery(pool, 'SELECT * FROM categories ORDER BY id');

const searchProducts = async (pool, { searchTerm, gender, categoryId, language }) => {
    const term = searchTerm?.trim();
    if (!term) {
        return [];
    }

    const params = [`%${term}%`, language];
    let query = `
        SELECT * FROM products
        WHERE (
            name ILIKE $1
            OR description ILIKE $1
            OR COALESCE(name_translations ->> $2, '') ILIKE $1
            OR COALESCE(description_translations ->> $2, '') ILIKE $1
        )
    `;

    if (gender) {
        params.push(gender);
        query += ` AND gender = $${params.length}`;
    }

    if (categoryId) {
        params.push(categoryId);
        query += ` AND category_id = $${params.length}`;
    }

    query += ' ORDER BY id';

    return executeQuery(pool, query, params);
};

const findProductsByIds = (pool, ids = []) => {
    if (!Array.isArray(ids) || ids.length === 0) {
        return Promise.resolve([]);
    }
    const uniqueIds = Array.from(new Set(ids));
    return executeQuery(pool, 'SELECT * FROM products WHERE id = ANY($1)', [uniqueIds]);
};

const findProductById = async (pool, productId) => {
    if (!productId) {
        return null;
    }
    const rows = await executeQuery(pool, 'SELECT * FROM products WHERE id = $1', [productId]);
    return rows[0] ?? null;
};

const DEFAULT_SIMILAR_LIMIT = 10;

const clampLimit = (value, fallback = DEFAULT_SIMILAR_LIMIT, max = 50) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(parsed, max);
};

const findSimilarProducts = async (pool, { productId, limit = DEFAULT_SIMILAR_LIMIT } = {}) => {
    const product = await findProductById(pool, productId);
    if (!product) {
        return [];
    }

    const params = [productId];
    const filters = [];

    if (product.category_id) {
        params.push(product.category_id);
        filters.push(`category_id = $${params.length}`);
    }

    if (product.gender) {
        params.push(product.gender);
        filters.push(`gender = $${params.length}`);
    }

    let query = 'SELECT * FROM products WHERE id <> $1';
    if (filters.length > 0) {
        query += ` AND ${filters.join(' AND ')}`;
    }

    query += ' ORDER BY is_bestseller DESC, created_at DESC, id DESC';

    const limitValue = clampLimit(limit, DEFAULT_SIMILAR_LIMIT);
    if (limitValue) {
        params.push(limitValue);
        query += ` LIMIT $${params.length}`;
    }

    return executeQuery(pool, query, params);
};

module.exports = {
    DEFAULT_LIMIT,
    DEFAULT_SIMILAR_LIMIT,
    clampLimit,
    findAllProducts,
    findCategories,
    findProductById,
    findProducts,
    findProductsByIds,
    findSimilarProducts,
    searchProducts,
};
