const express = require('express');

const authMiddleware = require('../authMiddleware');
const { createError } = require('../errors');
const {
    createOrUpdateRating,
    getRatingsByUser,
    getAllRatings,
} = require('../repositories/ratingsRepository');
const {
    clampLimit,
    findProductsByIds,
} = require('../repositories/productRepository');
const { resolveLanguage, toProductResponse } = require('../utils/productResponse');
const { fetchRecommendations, normaliseRecommendations } = require('./recs');

const DEFAULT_TIMEOUT_MS = 5000;
const { RATINGS_EXPORT_TOKEN } = process.env;

const toRatingResponse = (record) => ({
    id: record.id,
    userId: record.userId,
    productId: record.productId,
    rating: record.rating,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
});

const ensureValidRating = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
        throw createError('INVALID_RATING', 400, 'rating must be an integer between 1 and 5', null);
    }
    return parsed;
};

const ensureProductId = (value) => {
    if (typeof value !== 'string' || value.trim() === '') {
        throw createError('INVALID_PRODUCT_ID', 400, 'productId is required', null);
    }
    return value.trim();
};

const createRatingsRouter = (pool, { mlUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
    const router = express.Router();

    router.post('/ratings', authMiddleware, async (req, res, next) => {
        let productId;
        let ratingValue;
        try {
            productId = ensureProductId(req.body?.productId);
            ratingValue = ensureValidRating(req.body?.rating);
        } catch (validationError) {
            return next(validationError);
        }

        try {
            const record = await createOrUpdateRating(pool, {
                userId: req.user.id,
                productId,
                rating: ratingValue,
            });
            return res.status(201).json({ rating: toRatingResponse(record) });
        } catch (error) {
            return next(createError('RATING_SAVE_FAILED', 500, 'Unable to save rating', error));
        }
    });

    router.get('/ratings', authMiddleware, async (req, res, next) => {
        try {
            const ratings = await getRatingsByUser(pool, req.user.id);
            return res.json(ratings.map(toRatingResponse));
        } catch (error) {
            return next(createError('RATINGS_FETCH_FAILED', 500, 'Unable to load ratings', error));
        }
    });

    router.get('/ratings/export', async (req, res, next) => {
        if (RATINGS_EXPORT_TOKEN) {
            const providedToken = req.query?.token || req.header('x-export-token');
            if (providedToken !== RATINGS_EXPORT_TOKEN) {
                return next(createError('FORBIDDEN', 403, 'Invalid export token', null));
            }
        }

        try {
            const ratings = await getAllRatings(pool);
            return res.json(ratings.map(toRatingResponse));
        } catch (error) {
            return next(createError('RATINGS_EXPORT_FAILED', 500, 'Unable to export ratings', error));
        }
    });

    router.get('/recommendations/personalized', authMiddleware, async (req, res, next) => {
        if (!mlUrl) {
            return res.json([]);
        }

        const limit = clampLimit(req.query?.limit, 20, 50);

        try {
            const response = await fetchRecommendations({
                baseUrl: mlUrl,
                path: '/recs/personalized',
                query: { user_id: req.user.id, limit },
                timeout: timeoutMs,
            });

            const recommendations = normaliseRecommendations(response).slice(0, limit);
            if (recommendations.length === 0) {
                return res.json([]);
            }

            const ids = Array.from(new Set(recommendations.map((item) => item.productId)));
            const rows = await findProductsByIds(pool, ids);
            const productMap = new Map(rows.map((row) => [String(row.id), row]));
            const language = resolveLanguage(req);

            const items = recommendations
                .map(({ productId, score }) => {
                    const productRow = productMap.get(String(productId));
                    if (!productRow) {
                        return null;
                    }
                    return {
                        product: toProductResponse(productRow, language),
                        score,
                    };
                })
                .filter(Boolean);

            return res.json(items);
        } catch (error) {
            return next(error);
        }
    });

    return router;
};

module.exports = createRatingsRouter;
