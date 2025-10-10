const express = require('express');
const { createError } = require('../errors');
const { resolveLanguage, toProductResponse, toCategoryResponse } = require('../utils/productResponse');
const { sanitizeProductsQuery, sanitizeSearchQuery } = require('../utils/queryValidation');
const {
    findCategories,
    findProducts,
    searchProducts,
} = require('../repositories/productRepository');

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

            const productRows = await findProducts(
                pool,
                { gender, categoryId, minPrice, maxPrice },
                { sortKey, sortOrder, page, limit }
            );

            res.json(productRows.map((row) => toProductResponse(row, language)));
        } catch (err) {
            next(createError('GET_PRODUCTS_FAILED', 500, 'Unable to retrieve products', err));
        }
    });

    router.get('/categories', async (req, res, next) => {
        try {
            const language = resolveLanguage(req);
            const categoryRows = await findCategories(pool);
            res.json(categoryRows.map((row) => toCategoryResponse(row, language)));
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

            const searchRows = await searchProducts(pool, {
                searchTerm: q,
                gender,
                categoryId,
                language,
            });

            res.json(searchRows.map((row) => toProductResponse(row, language)));
        } catch (err) {
            next(createError('SEARCH_FAILED', 500, 'Unable to perform search', err));
        }
    });

    return router;
};

module.exports = createProductsRouter;
