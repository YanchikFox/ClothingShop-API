const { z } = require('zod');

const cartItemBodySchema = z
    .object({
        productId: z
            .string({ required_error: 'productId is required' })
            .trim()
            .min(1, 'productId must be a non-empty string'),
        quantity: z
            .coerce.number({ required_error: 'quantity is required' })
            .int('quantity must be an integer')
            .positive('quantity must be greater than 0'),
    })
    .strict();

const cartItemParamsSchema = z.object({
    productId: z
        .string({ required_error: 'productId is required' })
        .trim()
        .min(1, 'productId must be a non-empty string'),
});

const cartQuantitySchema = z
    .object({
        quantity: z
            .coerce.number({ required_error: 'quantity is required' })
            .int('quantity must be an integer')
            .positive('quantity must be greater than 0'),
    })
    .strict();

const formatZodError = (error) =>
    error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
    }));

module.exports = {
    cartItemBodySchema,
    cartItemParamsSchema,
    cartQuantitySchema,
    formatZodError,
};