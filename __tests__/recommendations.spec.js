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
    return instances[instances.length - 1];
};

const buildProductRow = (overrides = {}) => ({
    id: 'prod-001',
    article: 'ART-001',
    category_id: 'outerwear',
    name: 'Insulated Parka',
    description: 'Warm and stylish',
    price: 1200,
    price_string: '1200',
    is_bestseller: false,
    image_urls: JSON.stringify(['outerwear/parka.jpg']),
    gender: 'unisex',
    brand: 'NordCraft',
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

describe('POST /api/recs/personal', () => {
    test('rejects invalid category values', async () => {
        const pool = getPoolInstance();
        pool.query.mockResolvedValue({ rows: [] });

        const response = await request(app).post('/api/recs/personal').send({ categories: [123] });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: {
                code: 'INVALID_CATEGORIES',
                message: 'categories must be an array of non-empty strings',
            },
        });
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('falls back to bestsellers when no preferences supplied', async () => {
        const pool = getPoolInstance();
        const rows = [
            buildProductRow({ id: 'prod-001', is_bestseller: false }),
            buildProductRow({ id: 'prod-002', is_bestseller: true }),
            buildProductRow({ id: 'prod-003', is_bestseller: false }),
        ];

        pool.query.mockResolvedValue({ rows });

        const response = await request(app).post('/api/recs/personal').send({});

        expect(response.status).toBe(200);
        expect(pool.query).toHaveBeenCalledWith('SELECT * FROM products');
        expect(response.body).toEqual({
            items: [
                toProductResponse(rows[1], 'en'),
                toProductResponse(rows[0], 'en'),
                toProductResponse(rows[2], 'en'),
            ],
        });
    });

    test('prioritises products matching the preference profile', async () => {
        const pool = getPoolInstance();
        const rows = [
            buildProductRow({ id: 'prod-outer-brand-a', brand: 'BrandA', price: 1000 }),
            buildProductRow({ id: 'prod-outer-brand-b', brand: 'BrandB', price: 1200 }),
            buildProductRow({ id: 'prod-knit-brand-a', category_id: 'knitwear', brand: 'BrandA', price: 1100 }),
        ];

        pool.query.mockResolvedValue({ rows });

        const response = await request(app)
            .post('/api/recs/personal')
            .query({ limit: 2 })
            .send({
                categories: ['outerwear'],
                brands: ['BrandA'],
                priceRange: [900, 1300],
            });

        expect(response.status).toBe(200);
        expect(pool.query).toHaveBeenCalledWith('SELECT * FROM products');
        expect(response.body.items).toHaveLength(2);
        expect(response.body.items[0].id).toBe('prod-outer-brand-a');
    });
});
