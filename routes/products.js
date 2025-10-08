const express = require('express');
const { createError } = require('../errors');
const { resolveLanguage, toProductResponse, toCategoryResponse } = require('../utils/productResponse');
const { sanitizeProductsQuery, sanitizeSearchQuery } = require('../utils/queryValidation');

const createProductsRouter = (pool) => {
    const router = express.Router();

    router.get('/products', async (req, res, next) => {
        try {
            const language = resolveLanguage(req);
            const { gender, categoryId } = sanitizeProductsQuery(req.query);
            const filter = gender ?? categoryId;

            let query = 'SELECT * FROM products';
            const queryParams = [];

            if (filter) {
                query += ' WHERE gender = $1';
                queryParams.push(filter);
            }

            query += ' ORDER BY id';

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
