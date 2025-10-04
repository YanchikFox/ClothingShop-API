# ClothingShop API  ![Node CI](https://github.com/YanchikFox/ClothingShop-API/actions/workflows/node-ci.yml/badge.svg)


A Node.js + Express backend that powers the ClothingShop mobile application. It exposes REST endpoints for browsing products, managing user accounts, and keeping track of cart contents in a PostgreSQL database.

## Features

- Product catalogue with optional gender-based filtering and keyword search.
- Email/password authentication with hashed credentials and JWT-based sessions.
- Persistent shopping cart per user with quantity management.
- Category listing for quick navigation in the client application.

## Tech stack

- [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/) via the official `pg` driver
- [bcryptjs](https://www.npmjs.com/package/bcryptjs) for password hashing
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) for issuing JWT access tokens

## Prerequisites

- Node.js 18+
- npm 9+
- Docker (optional, for running PostgreSQL locally via Docker Compose)

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Update `.env` with the connection details for your PostgreSQL instance and choose a strong `JWT_SECRET` for token signing.

3. **Start PostgreSQL**

   - Quick start (recommended):

     ```bash
     docker compose up -d
     ```

     This launches a local PostgreSQL 16 container with the credentials that match the defaults found in `.env.example` (`myuser` / `mypassword`, database `mydatabase`).

   - Alternatively, point the app at any PostgreSQL instance and make sure the credentials in your `.env` file match the remote server.

4. **Create the schema and seed data**

   ```bash
   node setup-database.js
   ```

   The script drops and recreates the tables (`users`, `categories`, `products`, `carts`, `cart_items`) and inserts a small set of demo products and categories for local testing.

5. **Start the development server**

   ```bash
   node server.js
   ```

   By default the API listens on `http://localhost:3000` (configurable via the `PORT` environment variable).

## Environment configuration

Configuration is now driven via environment variables (loaded from `.env` during local development). The API recognises the following keys:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Port for the Express server. | `3000` |
| `DATABASE_URL` | Full PostgreSQL connection string. If provided it takes precedence over the individual DB_* settings. | _none_ |
| `DB_HOST` | Database host for local/dev use. | `localhost` |
| `DB_PORT` | Database port. | `5432` |
| `DB_USER` | Database user. | `myuser` |
| `DB_PASSWORD` | Database password. | `mypassword` |
| `DB_NAME` | Database name. | `mydatabase` |
| `DB_SSL` | Set to `true` to enable SSL connections (uses `rejectUnauthorized: false`). | `false` |
| `JWT_SECRET` | Secret used for signing and verifying JWTs. **Change this in production.** | `dev-secret-change-me` |

Production deployments should provide secure values for these variables via the hosting platform's secret management system instead of storing them in `.env`.

## API reference

| Method & Path | Description |
| --- | --- |
| `GET /api/products?gender=male\|female\|unisex` | List products, optionally filtered by gender. |
| `GET /api/categories` | Fetch all product categories. |
| `GET /api/search?q=<term>` | Search products by name or description. |
| `POST /api/register` | Create a new user account. Expects `{ "email": string, "password": string }`. |
| `POST /api/login` | Authenticate a user. Returns `{ token }` on success. |
| `GET /api/profile` | Get the authenticated user profile. Requires `x-auth-token` header. |
| `GET /api/cart` | Retrieve the authenticated user's cart. Requires `x-auth-token`. |
| `POST /api/cart` | Add/update an item in the cart. Body: `{ "productId": string, "quantity": number }`. Requires `x-auth-token`. |
| `PUT /api/cart/item/:productId` | Set the quantity for a cart item. Body: `{ "quantity": number }`. Requires `x-auth-token`. |
| `DELETE /api/cart/item/:productId` | Remove a product from the cart. Requires `x-auth-token`. |

## Project scripts

- `npm install` – install dependencies
- `node setup-database.js` – initialise or reset the database
- `node server.js` – start the API server

## Useful tips

- For local Android emulator testing, expose the API using the host machine's IP address or a tunnelling service such as ngrok.