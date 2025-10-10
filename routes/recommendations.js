const express = require('express');
const { createError } = require('../errors');
const { resolveLanguage, toProductResponse } = require('../utils/productResponse');
const { clampLimit, findAllProducts } = require('../repositories/productRepository');

const DEFAULT_LIMIT = 10;

const parsePrice = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return numeric;
        }
    }
    return 0;
};

const buildDimensions = (products) => {
    const categoryIndex = new Map();
    const brandIndex = new Map();
    let priceMax = 0;

    products.forEach((product) => {
        if (product.category_id && !categoryIndex.has(product.category_id)) {
            categoryIndex.set(product.category_id, categoryIndex.size);
        }
        if (product.brand && !brandIndex.has(product.brand)) {
            brandIndex.set(product.brand, brandIndex.size);
        }
        const price = parsePrice(product.price);
        if (price > priceMax) {
            priceMax = price;
        }
    });

    const priceIndex = categoryIndex.size + brandIndex.size;
    const vectorSize = priceIndex + 1;

    return { categoryIndex, brandIndex, priceIndex, vectorSize, priceMax };
};

const createEmptyVector = (size) => new Array(size).fill(0);

const normalisePrice = (price, maxPrice) => {
    if (!maxPrice || maxPrice <= 0) {
        return 0;
    }
    return Math.min(Math.max(price / maxPrice, 0), 1);
};

const buildProductVector = (product, dimensions) => {
    const vector = createEmptyVector(dimensions.vectorSize);

    if (product.category_id && dimensions.categoryIndex.has(product.category_id)) {
        const idx = dimensions.categoryIndex.get(product.category_id);
        vector[idx] = 1;
    }

    if (product.brand && dimensions.brandIndex.has(product.brand)) {
        const idx = dimensions.brandIndex.get(product.brand) + dimensions.categoryIndex.size;
        vector[idx] = 1;
    }

    vector[dimensions.priceIndex] = normalisePrice(parsePrice(product.price), dimensions.priceMax);

    return vector;
};

const buildUserVector = ({ categories, brands, priceRange }, dimensions) => {
    const vector = createEmptyVector(dimensions.vectorSize);

    categories.forEach((category) => {
        if (dimensions.categoryIndex.has(category)) {
            const idx = dimensions.categoryIndex.get(category);
            vector[idx] = 1;
        }
    });

    brands.forEach((brand) => {
        if (dimensions.brandIndex.has(brand)) {
            const idx = dimensions.brandIndex.get(brand) + dimensions.categoryIndex.size;
            vector[idx] = 1;
        }
    });

    if (priceRange) {
        const [minPrice, maxPrice] = priceRange;
        const desiredPrice = (minPrice + maxPrice) / 2;
        vector[dimensions.priceIndex] = normalisePrice(desiredPrice, dimensions.priceMax);
    }

    return vector;
};

const cosineSimilarity = (a, b) => {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i += 1) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }

    if (magA === 0 || magB === 0) {
        return 0;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

const sanitiseStringArray = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(
        new Set(
            value
                .filter((item) => typeof item === 'string')
                .map((item) => item.trim())
                .filter(Boolean)
        )
    );
};

const sanitisePriceRange = (value) => {
    if (!Array.isArray(value) || value.length !== 2) {
        return null;
    }

    const [minValueRaw, maxValueRaw] = value;
    const minValue = Number(minValueRaw);
    const maxValue = Number(maxValueRaw);

    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        return null;
    }

    if (minValue < 0 || maxValue < 0 || minValue > maxValue) {
        return null;
    }

    return [minValue, maxValue];
};

const parseLimit = (value) => clampLimit(value, DEFAULT_LIMIT, 50);

const createRecommendationsRouter = (pool) => {
    const router = express.Router();

    router.post('/recs/personal', async (req, res, next) => {
        try {
            const categories = sanitiseStringArray(req.body?.categories);
            const brands = sanitiseStringArray(req.body?.brands);
            const priceRange = sanitisePriceRange(req.body?.priceRange);
            const limit = parseLimit(req.query?.limit);

            if (req.body && Object.keys(req.body).length > 0) {
                if (req.body.categories && categories.length === 0 && req.body.categories.length > 0) {
                    return next(
                        createError('INVALID_CATEGORIES', 400, 'categories must be an array of non-empty strings', null)
                    );
                }

                if (req.body.brands && brands.length === 0 && req.body.brands.length > 0) {
                    return next(createError('INVALID_BRANDS', 400, 'brands must be an array of non-empty strings', null));
                }

                if (req.body.priceRange && !priceRange) {
                    return next(createError('INVALID_PRICE_RANGE', 400, 'priceRange must be [min, max] with non-negative numbers', null));
                }
            }

            const rows = await findAllProducts(pool);
            if (!rows || rows.length === 0) {
                return res.json({ items: [] });
            }

            const language = resolveLanguage(req);
            const dimensions = buildDimensions(rows);
            const userVector = buildUserVector({ categories, brands, priceRange }, dimensions);

            const userMagnitude = Math.sqrt(userVector.reduce((sum, value) => sum + value * value, 0));

            let candidates = rows;
            if (priceRange) {
                const [minPrice, maxPrice] = priceRange;
                candidates = candidates.filter((product) => {
                    const price = parsePrice(product.price);
                    return price >= minPrice && price <= maxPrice;
                });
            }

            if (candidates.length === 0) {
                candidates = rows;
            }

            let recommendations;

            if (userMagnitude === 0) {
                recommendations = candidates
                    .slice()
                    .sort((a, b) => {
                        if (a.is_bestseller && !b.is_bestseller) {
                            return -1;
                        }
                        if (!a.is_bestseller && b.is_bestseller) {
                            return 1;
                        }
                        return String(a.id).localeCompare(String(b.id));
                    })
                    .slice(0, limit);
            } else {
                const scored = candidates.map((product) => {
                    const vector = buildProductVector(product, dimensions);
                    const score = cosineSimilarity(userVector, vector);
                    return { product, score };
                });

                scored.sort((a, b) => b.score - a.score || (b.product.is_bestseller - a.product.is_bestseller) || String(a.product.id).localeCompare(String(b.product.id)));

                recommendations = scored.slice(0, limit).map((entry) => entry.product);
            }

            res.json({ items: recommendations.map((product) => toProductResponse(product, language)) });
        } catch (err) {
            next(createError('PERSONAL_RECS_FAILED', 500, 'Failed to build personal recommendations', err));
        }
    });

    return router;
};

module.exports = createRecommendationsRouter;
