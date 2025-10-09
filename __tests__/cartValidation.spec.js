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

jest.mock('../authMiddleware', () => (req, _res, next) => {
    req.user = { id: 'test-user-id' };
    next();
});

const { app } = require('../server');
const { Pool } = require('pg');

const getPoolInstance = () => {
    const instances = Pool.__getInstances();
    return instances.length ? instances[instances.length - 1] : undefined;
};

beforeEach(() => {
    const pool = getPoolInstance();
    if (pool && typeof pool.query?.mockClear === 'function') {
        pool.query.mockClear();
    }
});

describe('Cart route validation', () => {
    const validProductId = 'su001';

    test('POST /api/cart rejects invalid productId', async () => {
        const pool = getPoolInstance();

        const response = await request(app)
            .post('/api/cart')
            .send({ productId: '', quantity: 2 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({ path: 'productId' }),
                ]),
            },
        });
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('POST /api/cart rejects non-positive quantity', async () => {
        const pool = getPoolInstance();

        const response = await request(app)
            .post('/api/cart')
            .send({ productId: validProductId, quantity: 0 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({ path: 'quantity' }),
                ]),
            },
        });
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('PUT /api/cart/item/:productId rejects invalid params productId', async () => {
        const pool = getPoolInstance();

        const response = await request(app)
            .put('/api/cart/item/%20%20%20')
            .send({ quantity: 3 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({ path: 'productId' }),
                ]),
            },
        });
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('PUT /api/cart/item/:productId rejects invalid quantity', async () => {
        const pool = getPoolInstance();

        const response = await request(app)
            .put(`/api/cart/item/${validProductId}`)
            .send({ quantity: -1 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({ path: 'quantity' }),
                ]),
            },
        });
        expect(pool.query).not.toHaveBeenCalled();
    });
});