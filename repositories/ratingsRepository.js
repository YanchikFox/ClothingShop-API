const sanitizeRatingRow = (row = {}) => ({
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    rating: row.rating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const createOrUpdateRating = async (pool, { userId, productId, rating }) => {
    const query = `
        INSERT INTO ratings (user_id, product_id, rating)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, product_id)
        DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()
        RETURNING id, user_id, product_id, rating, created_at, updated_at
    `;

    const params = [userId, productId, rating];
    const { rows } = await pool.query(query, params);
    return sanitizeRatingRow(rows[0]);
};

const getRatingsByUser = async (pool, userId) => {
    const { rows } = await pool.query(
        `SELECT id, user_id, product_id, rating, created_at, updated_at
         FROM ratings
         WHERE user_id = $1
         ORDER BY updated_at DESC, id DESC`,
        [userId]
    );

    return rows.map(sanitizeRatingRow);
};

const getAllRatings = async (pool) => {
    const { rows } = await pool.query(
        `SELECT id, user_id, product_id, rating, created_at, updated_at
         FROM ratings
         ORDER BY updated_at DESC, id DESC`
    );

    return rows.map(sanitizeRatingRow);
};

module.exports = {
    createOrUpdateRating,
    getRatingsByUser,
    getAllRatings,
};
