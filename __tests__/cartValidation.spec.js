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
    const validProductId = '123e4567-e89b-12d3-a456-426614174000';

    test('POST /api/cart rejects invalid productId', async () => {
        const pool = getPoolInstance();

        const response = await request(app)
            .post('/api/cart')
            .send({ productId: 'not-a-uuid', quantity: 2 });

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
            .put('/api/cart/item/not-a-uuid')
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