const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../authMiddleware');
const { createError } = require('../errors');
const { profileUpdateSchema } = require('../schemas/profileSchemas');
const { validationErrorResponse } = require('../utils/validation');

const createAuthRouter = (pool, options = {}) => {
    const router = express.Router();
    const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || 'dev-secret-change-me';

    const fetchUserProfile = async (userId) => {
        const userResult = await pool.query(
            `SELECT id, email, full_name, phone_number, created_at
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return null;
        }

        const user = userResult.rows[0];

        const addressesResult = await pool.query(
            `SELECT id, label, line1, line2, city, postal_code, country, is_default
             FROM user_addresses
             WHERE user_id = $1
             ORDER BY is_default DESC, id`,
            [userId]
        );

        const ordersResult = await pool.query(
            `SELECT id, order_number, status, total_amount, placed_at
             FROM orders
             WHERE user_id = $1
             ORDER BY placed_at DESC`,
            [userId]
        );

        return {
            id: user.id,
            email: user.email,
            name: user.full_name,
            phone: user.phone_number,
            created_at: user.created_at,
            addresses: addressesResult.rows,
            order_history: ordersResult.rows,
        };
    };

    const sanitizeAddresses = (addresses) => {
        if (!Array.isArray(addresses) || addresses.length === 0) {
            return [];
        }

        let defaultAssigned = false;

        return addresses.map((address, index) => {
            let isDefault = false;

            if (address.is_default && !defaultAssigned) {
                isDefault = true;
                defaultAssigned = true;
            } else if (!defaultAssigned && index === 0) {
                isDefault = true;
                defaultAssigned = true;
            }

            return {
                ...address,
                line2: address.line2 ?? null,
                is_default: isDefault,
            };
        });
    };

    router.post('/register', async (req, res, next) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: {
                        code: 'REGISTRATION_VALIDATION_ERROR',
                        message: 'Email and password are required',
                    },
                });
            }

            const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            if (user.rows.length > 0) {
                return res.status(400).json({
                    error: {
                        code: 'USER_ALREADY_EXISTS',
                        message: 'User with this email already exists',
                    },
                });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = await pool.query(
                'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
                [email, hashedPassword]
            );

            res.status(201).json(newUser.rows[0]);
        } catch (err) {
            next(createError('REGISTER_FAILED', 500, 'Unable to register user', err));
        }
    });

    router.post('/login', async (req, res, next) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: {
                        code: 'LOGIN_VALIDATION_ERROR',
                        message: 'Email and password are required',
                    },
                });
            }

            const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            if (user.rows.length === 0) {
                return res.status(400).json({
                    error: {
                        code: 'INVALID_CREDENTIALS',
                        message: 'Invalid credentials',
                    },
                });
            }

            const isMatch = await bcrypt.compare(password, user.rows[0].password);
            if (!isMatch) {
                return res.status(400).json({
                    error: {
                        code: 'INVALID_CREDENTIALS',
                        message: 'Invalid credentials',
                    },
                });
            }

            const payload = { user: { id: user.rows[0].id } };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });

            res.json({ token });
        } catch (err) {
            next(createError('LOGIN_FAILED', 500, 'Unable to log in user', err));
        }
    });

    router.get('/profile', authMiddleware, async (req, res, next) => {
        try {
            const profile = await fetchUserProfile(req.user.id);

            if (!profile) {
                return res.status(404).json({
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User not found',
                    },
                });
            }

            res.json(profile);
        } catch (err) {
            next(createError('GET_PROFILE_FAILED', 500, 'Unable to retrieve profile', err));
        }
    });

    router.put('/profile', authMiddleware, async (req, res, next) => {
        const validationResult = profileUpdateSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json(validationErrorResponse(validationResult.error));
        }

        const { name, phone, addresses } = validationResult.data;
        const sanitizedAddresses = sanitizeAddresses(addresses);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('UPDATE users SET full_name = $1, phone_number = $2 WHERE id = $3', [
                name.trim(),
                phone ?? '',
                req.user.id,
            ]);

            await client.query('DELETE FROM user_addresses WHERE user_id = $1', [req.user.id]);

            for (const address of sanitizedAddresses) {
                await client.query(
                    `INSERT INTO user_addresses (
                        user_id, label, line1, line2, city, postal_code, country, is_default
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        req.user.id,
                        address.label,
                        address.line1,
                        address.line2,
                        address.city,
                        address.postal_code,
                        address.country,
                        address.is_default,
                    ]
                );
            }

            await client.query('COMMIT');

            const updatedProfile = await fetchUserProfile(req.user.id);
            res.json(updatedProfile);
        } catch (err) {
            await client.query('ROLLBACK');
            next(createError('UPDATE_PROFILE_FAILED', 500, 'Unable to update profile', err));
        } finally {
            client.release();
        }
    });

    return router;
};

module.exports = createAuthRouter;
