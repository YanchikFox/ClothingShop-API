require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const createProductsRouter = require('./routes/products');
const createCartRouter = require('./routes/cart');
const createAuthRouter = require('./routes/auth');
const createRecommendationsRouter = require('./routes/recommendations');
const { createRecsRouter } = require('./routes/recs');
const createRatingsRouter = require('./routes/ratingsRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

const {
    PORT = 3000,
    DATABASE_URL,
    DB_HOST = 'localhost',
    DB_PORT = '5432',
    DB_USER = 'myuser',
    DB_PASSWORD = 'mypassword',
    DB_NAME = 'mydatabase',
    JWT_SECRET = 'dev-secret-change-me',
    ML_URL,
    DB_SSL = 'false',
} = process.env;

const poolConfig = DATABASE_URL
    ? { connectionString: DATABASE_URL }
    : {
          host: DB_HOST,
          port: Number(DB_PORT),
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
      };

if (DB_SSL === 'true') {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

app.use('/api', createProductsRouter(pool));
app.use('/api', createAuthRouter(pool, { jwtSecret: JWT_SECRET }));
app.use('/api', createCartRouter(pool));
app.use('/api', createRecommendationsRouter(pool));
app.use(
    '/api',
    createRecsRouter(pool, {
        mlUrl: ML_URL,
    })
);
app.use(
    '/api',
    createRatingsRouter(pool, {
        mlUrl: ML_URL,
    })
);

app.use(errorHandler);

const port = Number(PORT) || 3000;
if (require.main === module) {
    app.listen(port, () => {
        console.log(`🚀 Server started on port ${port}`);
    });
}

module.exports = { app, pool };
