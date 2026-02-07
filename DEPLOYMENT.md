# Deployment Roadmap for Mezgeb

This project has been restructured into **Frontend** and **Backend** folders to support separate deployments on Vercel and Render.

## 1. Local Verification
Before pushing to GitHub, verify you can still run it locally:
- **Backend**: `cd backend && npm run dev`
- **Frontend**: `cd frontend && npx serve .`

## 2. Push to GitHub
1. Create a new repository on GitHub named `mezgeb`.
2. Open terminal in the project root:
   ```bash
   git init
   git add .
   git commit -m "chore: restructure for separate deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/mezgeb.git
   git push -u origin main
   ```

## 3. Deploy Backend (Render)
1. Go to [Render](https://render.com/).
2. Create a **New Web Service**.
3. Connect your GitHub repository.
4. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. **Environment Variables**: Add `MONGODB_URI`, `JWT_SECRET`, and any others from your local `.env`.
6. Once deployed, copy your Render URL (e.g., `https://mezgeb-backend.onrender.com`).

## 4. Deploy Frontend (Vercel)
1. Go to [Vercel](https://vercel.com/).
2. Create a **New Project**.
3. Connect your GitHub repository.
4. Settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Other (or Static)
5. **Important**: You must update `frontend/js/api.js` with your actual Render URL before deployment, OR use an environment variable if you plan to use a build step.

## 5. Security Note
- Ensure CORS on the backend allows requests from your Vercel domain.
- Currently, CORS is set to `app.use(cors())` (allows all). For production, restrict it to your Vercel URL.
