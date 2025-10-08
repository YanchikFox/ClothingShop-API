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
                size,
                sortBy,
                sortOrder,
                page,
                pageSize,
            } = sanitizeProductsQuery(req.query);

            const filters = [];
            const params = [];

            if (gender) {
                params.push(gender);
                filters.push(`gender = $${params.length}`);
            }

            if (categoryId) {
                params.push(categoryId);
                filters.push(`category_id = $${params.length}`);
            }

            if (minPrice !== null) {
                params.push(minPrice);
                filters.push(`price >= $${params.length}`);
            }

            if (maxPrice !== null) {
                params.push(maxPrice);
                filters.push(`price <= $${params.length}`);
            }

            if (size) {
                params.push(size);
                filters.push(
                    `EXISTS (SELECT 1 FROM product_sizes ps WHERE ps.product_id = products.id AND ps.size = $${params.length})`
                );
            }

            const whereClause = filters.length > 0 ? ` WHERE ${filters.join(' AND ')}` : '';
            const baseQuery = `FROM products${whereClause}`;

            const countResult = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);
            const total = Number.parseInt(countResult.rows[0]?.count ?? '0', 10) || 0;
            const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

            const offset = (page - 1) * pageSize;

            const orderClause = (() => {
                const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';
                switch (sortBy) {
                    case 'price':
                        return ` ORDER BY price ${direction}, id ASC`;
                    case 'name':
                        return ` ORDER BY name ${direction}, id ASC`;
                    case 'newest':
                        return ` ORDER BY COALESCE(created_at, '1970-01-01'::timestamptz) ${direction}, id ${direction}`;
                    case 'bestseller':
                        return ` ORDER BY CASE WHEN is_bestseller THEN 1 ELSE 0 END ${direction}, name ASC`;
                    default:
                        return ' ORDER BY id ASC';
                }
            })();

            const itemsQuery = `SELECT * ${baseQuery}${orderClause} LIMIT $${params.length + 1} OFFSET $${
                params.length + 2
            }`;
            const itemsParams = [...params, pageSize, offset];
            const itemsResult = await pool.query(itemsQuery, itemsParams);

            res.json({
                items: itemsResult.rows.map((row) => toProductResponse(row, language)),
                page,
                pageSize,
                total,
                totalPages,
            });
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
