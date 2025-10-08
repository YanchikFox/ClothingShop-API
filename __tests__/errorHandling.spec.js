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

describe('Centralized error handling', () => {
    test('GET /api/products failure returns standardized error payload', async () => {
        const pool = getPoolInstance();
        pool.query.mockRejectedValueOnce(new Error('database offline'));

        const response = await request(app).get('/api/products');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            error: {
                code: 'GET_PRODUCTS_FAILED',
                message: 'Unable to retrieve products',
            },
        });
    });

    test('POST /api/login validation errors return standardized payload', async () => {
        const response = await request(app).post('/api/login').send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: {
                code: 'LOGIN_VALIDATION_ERROR',
                message: 'Email and password are required',
            },
        });
    });

    test('GET /api/profile not found returns standardized payload', async () => {
        const pool = getPoolInstance();
        pool.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/profile');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: {
                code: 'USER_NOT_FOUND',
                message: 'User not found',
            },
        });
    });
});