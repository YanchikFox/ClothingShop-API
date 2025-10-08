const { z } = require('zod');

const phoneSchema = z
    .string()
    .optional()
    .transform((value) => (value ?? '').trim())
    .refine((value) => value === '' || value.length >= 5, {
        message: 'Phone number must contain at least 5 characters',
    })
    .refine((value) => value.length <= 32, {
        message: 'Phone number is too long',
    });

const addressSchema = z
    .object({
        label: z.string().trim().min(1).max(100),
        line1: z.string().trim().min(1).max(255),
        line2: z.string().trim().max(255).optional().nullable(),
        city: z.string().trim().min(1).max(100),
        postal_code: z.string().trim().min(1).max(20),
        country: z.string().trim().min(1).max(100),
        is_default: z.boolean(),
    })
    .transform((address) => ({
        ...address,
        label: address.label.trim(),
        line1: address.line1.trim(),
        line2: address.line2?.trim() || null,
        city: address.city.trim(),
        postal_code: address.postal_code.trim(),
        country: address.country.trim(),
    }));

const profileUpdateSchema = z
    .object({
        name: z.string().trim().min(1).max(255),
        phone: phoneSchema,
        addresses: z.array(addressSchema).max(5).optional().default([]),
    })
    .transform((data) => ({
        ...data,
        name: data.name.trim(),
        phone: data.phone ?? '',
    }))
    .superRefine((data, ctx) => {
        const defaultCount = data.addresses.filter((address) => address.is_default).length;
        if (defaultCount > 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Only one address can be marked as default',
                path: ['addresses'],
            });
        }
    });

module.exports = {
    profileUpdateSchema,
};
