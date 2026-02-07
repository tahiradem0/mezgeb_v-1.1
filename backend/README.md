# Mezgeb Backend

Backend for the Mezgeb Expense Tracker PWA. Built with Node.js, Express, and MongoDB.

## Prerequisites
- Node.js (v14 or higher)
- MongoDB (Local or Atlas)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/mezgeb
   JWT_SECRET=your_secret_key
   ```
3. Start the server:
   - Development mode: `npm run dev`
   - Production mode: `npm run start`

## API Endpoints
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user profile
- `PATCH /api/auth/settings` - Update user settings
- `GET /api/categories` - Get user categories
- `POST /api/categories` - Create new category
- `GET /api/expenses` - Get user expenses (supports query filters)
- `POST /api/expenses` - Record new expense
- `DELETE /api/expenses/:id` - Remove expense
