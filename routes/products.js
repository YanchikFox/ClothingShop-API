const express = require('express');
const { createError } = require('../errors');
const { resolveLanguage, toProductResponse, toCategoryResponse } = require('../utils/productResponse');
const { sanitizeProductsQuery, sanitizeSearchQuery } = require('../utils/queryValidation');

const createProductsRouter = (pool) => {
    const router = express.Router();

    router.get('/products', async (req, res, next) => {
        try {
            const language = resolveLanguage(req);
            const {
                gender,
                categoryId,
                minPrice,
                maxPrice,
                sortKey,
                sortOrder,
                page,
                limit,
                errors,
            } = sanitizeProductsQuery(req.query);

            if (errors.length > 0) {
                return next(
                    createError(
                        'INVALID_PRODUCTS_QUERY',
                        400,
                        'Invalid products query parameters',
                        new Error(errors.join(','))
                    )
                );
            }

            const conditions = [];
            const queryParams = [];

            if (gender) {
                queryParams.push(gender);
                conditions.push(`gender = $${queryParams.length}`);
            }

            if (categoryId) {
                queryParams.push(categoryId);
                conditions.push(`category_id = $${queryParams.length}`);
            }

            if (minPrice !== null) {
                queryParams.push(minPrice);
                conditions.push(`price >= $${queryParams.length}`);
            }

            if (maxPrice !== null) {
                queryParams.push(maxPrice);
                conditions.push(`price <= $${queryParams.length}`);
            }

            let query = 'SELECT * FROM products';

            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }

            const orderClause = (() => {
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
            })();

            query += ` ORDER BY ${orderClause}`;

            if (limit !== null) {
                queryParams.push(limit);
                query += ` LIMIT $${queryParams.length}`;

                const currentPage = page ?? 1;
                const offset = Math.max(0, (currentPage - 1) * limit);
                if (offset > 0) {
                    queryParams.push(offset);
                    query += ` OFFSET $${queryParams.length}`;
                }
            }

            const allProducts = await pool.query(query, queryParams);
            res.json(allProducts.rows.map((row) => toProductResponse(row, language)));
        } catch (err) {
            next(createError('GET_PRODUCTS_FAILED', 500, 'Unable to retrieve products', err));
        }
    });

    router.get('/categories', async (req, res, next) => {
        try {
            const language = resolveLanguage(req);
            const allCategories = await pool.query('SELECT * FROM categories ORDER BY id');
            res.json(allCategories.rows.map((row) => toCategoryResponse(row, language)));
        } catch (err) {
            next(createError('GET_CATEGORIES_FAILED', 500, 'Unable to retrieve categories', err));
        }
    });

    router.get('/search', async (req, res, next) => {
        try {
            const language = resolveLanguage(req);
            const { q, gender, categoryId } = sanitizeSearchQuery(req.query);

            if (!q) {
                return res.json([]);
            }

            const params = [`%${q}%`, language];
            let query = `
                SELECT * FROM products
                WHERE (
                    name ILIKE $1
                    OR description ILIKE $1
                    OR COALESCE(name_translations ->> $2, '') ILIKE $1
                    OR COALESCE(description_translations ->> $2, '') ILIKE $1
                )
            `;

            const additionalFilters = [];

            if (gender) {
                params.push(gender);
                additionalFilters.push(`gender = $${params.length}`);
            }

            if (categoryId) {
                params.push(categoryId);
                additionalFilters.push(`category_id = $${params.length}`);
            }

            if (additionalFilters.length > 0) {
                query += ` AND ${additionalFilters.join(' AND ')}`;
            }

            query += ' ORDER BY id';

            const searchResults = await pool.query(query, params);
            res.json(searchResults.rows.map((row) => toProductResponse(row, language)));
        } catch (err) {
            next(createError('SEARCH_FAILED', 500, 'Unable to perform search', err));
        }
    });

    return router;
};

module.exports = createProductsRouter;
