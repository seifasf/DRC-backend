# DRC Lab Management System — API

## Setup

```bash
cd server
cp .env.example .env   # or edit .env with your Atlas URI
npm install
npm run dev
```

## Environment

| Variable        | Description                    |
|----------------|--------------------------------|
| `PORT`         | Server port (default 5000; use 5050 on macOS if 5000 is taken by AirPlay) |
| `MONGO_URI`    | MongoDB connection string      |
| `JWT_SECRET`   | Secret for signing JWTs        |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `NODE_ENV`     | `development` or `production`  |

## First admin user

When the database has **no users**, `POST /api/v1/auth/register` is public and creates the first account (send `role: "admin"`). After that, only admins can register users.

## Base URL

`/api/v1`

## Health

`GET /health` — no auth.
