require('dotenv').config();

const crypto = require('crypto');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const USERS_TO_CREATE = Number(process.env.RATINGS_SEED_USERS || 20);
const MIN_RATINGS_PER_USER = Number(process.env.RATINGS_SEED_MIN || 5);
const MAX_RATINGS_PER_USER = Number(process.env.RATINGS_SEED_MAX || 10);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchImpl = async (...args) => {
    if (typeof fetch !== 'undefined') {
        return fetch(...args);
    }
    const { default: nodeFetch } = await import('node-fetch');
    return nodeFetch(...args);
};

const fetchJson = async (url, options = {}) => {
    const response = await fetchImpl(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Request to ${url} failed with ${response.status}: ${message}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
};

const loadProducts = async () => {
    console.log('▶️ Loading products...');
    const url = new URL(`${API_BASE_URL.replace(/\/$/, '')}/products`);
    url.searchParams.set('limit', '200');
    const products = await fetchJson(url);
    if (!Array.isArray(products) || products.length === 0) {
        throw new Error('No products returned from API');
    }
    console.log(`✅ Loaded ${products.length} products`);
    return products;
};

const registerUser = async (email, password) => {
    try {
        await fetchJson(`${API_BASE_URL}/register`, {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        console.log(`🆕 Registered ${email}`);
    } catch (error) {
        if (error.message.includes('USER_ALREADY_EXISTS')) {
            console.log(`ℹ️ User ${email} already exists, continuing`);
            return;
        }
        throw error;
    }
};

const loginUser = async (email, password) => {
    const response = await fetchJson(`${API_BASE_URL}/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    return response?.token;
};

const submitRating = async (token, productId, rating) => {
    await fetchJson(`${API_BASE_URL}/ratings`, {
        method: 'POST',
        headers: {
            'x-auth-token': token,
        },
        body: JSON.stringify({ productId, rating }),
    });
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const pickProducts = (products, count) => {
    const shuffled = [...products];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
};

const seedRatings = async () => {
    const products = await loadProducts();
    const password = 'RatingSeed123!';

    for (let i = 0; i < USERS_TO_CREATE; i += 1) {
        const email = `seed_user_${crypto.randomUUID()}@example.com`;
        await registerUser(email, password);
        const token = await loginUser(email, password);
        if (!token) {
            console.warn(`⚠️ Unable to retrieve token for ${email}, skipping`);
            continue;
        }

        const ratingCount = randomInt(MIN_RATINGS_PER_USER, MAX_RATINGS_PER_USER);
        const productsToRate = pickProducts(products, ratingCount);

        console.log(`⭐ ${email} will rate ${productsToRate.length} products`);

        for (const product of productsToRate) {
            const rating = randomInt(1, 5);
            try {
                await submitRating(token, product.id, rating);
            } catch (error) {
                console.warn(`⚠️ Failed to rate product ${product.id}: ${error.message}`);
            }

            await delay(100);
        }
    }
};

seedRatings()
    .then(() => {
        console.log('✅ Ratings seeding completed');
    })
    .catch((error) => {
        console.error('❌ Ratings seeding failed', error);
        process.exitCode = 1;
    });
