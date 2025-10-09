const request = require('supertest');

jest.mock('pg', () => {
    const pools = [];
    const Pool = jest.fn().mockImplementation(() => {
        const instance = { query: jest.fn() };
        pools.push(instance);
        return instance;
    });
    Pool.__getInstances = () => pools;
    return { Pool };
});

const { app } = require('../server');
const { Pool } = require('pg');
const { toProductResponse } = require('../utils/productResponse');

const getPoolInstance = () => {
    const instances = Pool.__getInstances();
    return instances.length ? instances[instances.length - 1] : undefined;
};

const buildProductRow = (overrides = {}) => ({
    id: 'su001',
    article: 'ART-001',
    category_id: 'outerwear',
    name: 'Winter Parka',
    description: 'Stay warm',
    price: 199.99,
    price_string: '$199.99',
    is_bestseller: false,
    image_urls: JSON.stringify(['parka.png']),
    gender: 'female',
    features: JSON.stringify([]),
    reviews: JSON.stringify([]),
    ...overrides,
});

beforeEach(() => {
    const pool = getPoolInstance();
    if (pool && typeof pool.query?.mockReset === 'function') {
        pool.query.mockReset();
    }
});

describe('GET /api/products filters and pagination', () => {
    test('returns all products without filters', async () => {
        const pool = getPoolInstance();
        const rows = [buildProductRow(), buildProductRow({ id: 'su002', category_id: 'sweaters' })];

        pool.query.mockResolvedValue({ rows });

        const response = await request(app).get('/api/products');

        expect(response.status).toBe(200);
        expect(pool.query).toHaveBeenCalledWith('SELECT * FROM products ORDER BY id ASC', []);
        expect(response.body).toEqual(rows.map((row) => toProductResponse(row, 'en')));
    });

    test('filters by categoryId', async () => {
        const pool = getPoolInstance();
        pool.query.mockResolvedValue({ rows: [] });

        const response = await request(app).get('/api/products').query({ categoryId: 'outerwear' });

        expect(response.status).toBe(200);
        expect(pool.query).toHaveBeenCalledWith(
            'SELECT * FROM products WHERE category_id = $1 ORDER BY id ASC',
            ['outerwear']
        );
    });

    test('applies price range filter', async () => {
        const pool = getPoolInstance();
        pool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
            .get('/api/products')
            .query({ minPrice: '50', maxPrice: '150' });

        expect(response.status).toBe(200);
        expect(pool.query).toHaveBeenCalledWith(
            'SELECT * FROM products WHERE price >= $1 AND price <= $2 ORDER BY id ASC',
            [50, 150]
        );
    });

    test('sorts by price descending', async () => {
        const pool = getPoolInstance();
        const rows = [buildProductRow({ id: 'su003', price: 250 }), buildProductRow({ id: 'su004', price: 100 })];
        pool.query.mockResolvedValue({ rows });

        const response = await request(app)
            .get('/api/products')
            .query({ sortBy: 'price', sortOrder: 'desc' });

        expect(response.status).toBe(200);
        expect(pool.query).toHaveBeenCalledWith('SELECT * FROM products ORDER BY price DESC', []);
        expect(response.body).toEqual(rows.map((row) => toProductResponse(row, 'en')));
    });

    test('applies pagination with limit and page', async () => {
        const pool = getPoolInstance();
        pool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
            .get('/api/products')
            .query({ limit: '2', page: '2', sortBy: 'price' });

        expect(response.status).toBe(200);
        expect(pool.query).toHaveBeenCalledWith(
            'SELECT * FROM products ORDER BY price ASC LIMIT $1 OFFSET $2',
            [2, 2]
        );
    });

    test('rejects invalid price range', async () => {
        const pool = getPoolInstance();
        pool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
            .get('/api/products')
            .query({ minPrice: '200', maxPrice: '100' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: {
                code: 'INVALID_PRODUCTS_QUERY',
                message: 'Invalid products query parameters',
            },
        });
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects invalid page value', async () => {
        const pool = getPoolInstance();
        pool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
            .get('/api/products')
            .query({ limit: '5', page: '0' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: {
                code: 'INVALID_PRODUCTS_QUERY',
                message: 'Invalid products query parameters',
            },
        });
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('requires limit when page is provided', async () => {
        const pool = getPoolInstance();
        pool.query.mockResolvedValue({ rows: [] });

        const response = await request(app).get('/api/products').query({ page: '2' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: {
                code: 'INVALID_PRODUCTS_QUERY',
                message: 'Invalid products query parameters',
            },
        });
        expect(pool.query).not.toHaveBeenCalled();
    });
});
