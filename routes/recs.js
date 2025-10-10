const express = require('express');
const { createError } = require('../errors');
const { resolveLanguage, toProductResponse } = require('../utils/productResponse');
const {
    clampLimit,
    DEFAULT_SIMILAR_LIMIT,
    findProductsByIds,
    findSimilarProducts,
} = require('../repositories/productRepository');

const DEFAULT_TIMEOUT_MS = 5000;

const normaliseRecommendations = (payload) => {
    if (payload && typeof payload === 'object' && Array.isArray(payload.items)) {
        return normaliseRecommendations(payload.items);
    }

    if (!Array.isArray(payload)) {
        return [];
    }

    return payload
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            const productId = item.product_id ?? item.productId ?? item.id;
            if (!productId) {
                return null;
            }

            const numericScore = Number(item.score);

            return {
                productId: String(productId),
                score: Number.isFinite(numericScore) ? numericScore : null,
            };
        })
        .filter(Boolean);
};

const fetchRecommendations = async ({
    baseUrl,
    path,
    method = 'GET',
    query = {},
    body,
    timeout = DEFAULT_TIMEOUT_MS,
}) => {
    if (!baseUrl) {
        throw createError('ML_SERVICE_NOT_CONFIGURED', 503, 'ML_URL is not configured', null);
    }

    let url;
    try {
        url = new URL(path, baseUrl);
    } catch (error) {
        throw createError('ML_REQUEST_FAILED', 502, 'Failed to construct ML URL', error);
    }

    Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) {
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item) => url.searchParams.append(key, String(item)));
        } else {
            url.searchParams.set(key, String(value));
        }
    });

    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        if (!response.ok) {
            throw createError(
                'ML_REQUEST_FAILED',
                502,
                `ML service responded with status ${response.status}`,
                null
            );
        }

        if (response.status === 204) {
            return [];
        }

        const rawBody = await response.text();
        if (!rawBody) {
            return [];
        }

        try {
            return JSON.parse(rawBody);
        } catch (parseError) {
            throw createError('ML_RESPONSE_INVALID', 502, 'ML service returned invalid JSON', parseError);
        }
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw createError('ML_REQUEST_TIMEOUT', 504, 'ML service request timed out', error);
        }
        if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
            throw createError('ML_REQUEST_FAILED', 502, 'ML service is unavailable', error);
        }
        if (error?.code === 'UND_ERR_CONNECT_TIMEOUT') {
            throw createError('ML_REQUEST_TIMEOUT', 504, 'ML service request timed out', error);
        }
        if (error?.status) {
            throw error;
        }
        throw createError('ML_REQUEST_FAILED', 502, 'Failed to contact ML service', error);
    } finally {
        clearTimeout(abortTimer);
    }
};

const createRecsRouter = (pool, { mlUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
    const router = express.Router();

    const enrich = async (req, res, next, fetchOptions) => {
        if (!mlUrl) {
            return res.json([]);
        }
        try {
            const rawResponse = await fetchRecommendations({
                baseUrl: mlUrl,
                timeout: timeoutMs,
                ...fetchOptions,
            });

            const recommendations = normaliseRecommendations(rawResponse);
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
    };

    router.get('/recs/similar', async (req, res, next) => {
        const language = resolveLanguage(req);
        const rawProductId = req.query?.product_id ?? req.query?.productId;
        const productId = typeof rawProductId === 'string' ? rawProductId.trim() : String(rawProductId ?? '').trim();
        if (!productId) {
            return next(
                createError('INVALID_PRODUCT_ID', 400, 'product_id query parameter is required', null)
            );
        }

        const limit = clampLimit(req.query?.limit, DEFAULT_SIMILAR_LIMIT);

        const respondWithFallback = async () => {
            const rows = await findSimilarProducts(pool, { productId, limit });
            return rows.map((row) => ({
                product: toProductResponse(row, language),
                score: null,
            }));
        };

        if (!mlUrl) {
            try {
                const items = await respondWithFallback();
                return res.json(items);
            } catch (error) {
                return next(createError('SIMILAR_PRODUCTS_FAILED', 500, 'Unable to fetch similar products', error));
            }
        }

        try {
            const rawResponse = await fetchRecommendations({
                baseUrl: mlUrl,
                timeout: timeoutMs,
                path: '/recs/similar',
                method: 'GET',
                query: req.query,
            });

            const recommendations = normaliseRecommendations(rawResponse);
            if (recommendations.length === 0) {
                const items = await respondWithFallback();
                return res.json(items);
            }

            const ids = Array.from(new Set(recommendations.map((item) => item.productId)));
            const rows = await findProductsByIds(pool, ids);
            const productMap = new Map(rows.map((row) => [String(row.id), row]));

            const items = recommendations
                .map(({ productId: recommendationId, score }) => {
                    const productRow = productMap.get(String(recommendationId));
                    if (!productRow) {
                        return null;
                    }
                    return {
                        product: toProductResponse(productRow, language),
                        score,
                    };
                })
                .filter(Boolean);

            if (items.length === 0) {
                const fallbackItems = await respondWithFallback();
                return res.json(fallbackItems);
            }

            return res.json(items);
        } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
                console.warn('ML similar recommendations failed, falling back to DB query', error);
            }

            try {
                const fallbackItems = await respondWithFallback();
                return res.json(fallbackItems);
            } catch (fallbackError) {
                return next(
                    createError('SIMILAR_PRODUCTS_FAILED', 500, 'Unable to fetch similar products', fallbackError)
                );
            }
        }
    });

    router.post('/recs/personal', async (req, res, next) => {
        await enrich(req, res, next, {
            path: '/recs/personal',
            method: 'POST',
            query: req.query,
            body: req.body,
        });
    });

    return router;
};

module.exports = createRecsRouter;
