# Deploying ALAASKA for testers (Vercel + Render, free tiers)

Frontend (React) on **Vercel**, backend (FastAPI) on **Render**, database stays on **MongoDB Atlas**.
The DS 442 homework search (ChromaDB) is turned off in the cloud (`ENABLE_RAG=false`) because it needs
more memory than Render's free plan; everything else works.

## 0. Push the code
Render and Vercel deploy from GitHub, so commit and push the branch first
(`git add backend frontend/src render.yaml DEPLOY.md frontend/vercel.json`, never `.env`).

## 1. MongoDB Atlas
- Render's free plan has no fixed IP, so Network Access needs `0.0.0.0/0` (allow from anywhere).
  **Get Dr. Saha's OK first**; the database is then protected only by its username/password.
- Recommended: create a separate database user for the deployment (Database Access -> Add user).
- The deployment uses the database **alaaska_test**, so testers never see real data.

## 2. Backend on Render
1. render.com -> sign in with GitHub -> **New + -> Blueprint** -> choose the ALAASKA repo and branch.
2. Fill in the secret values (same as your local `.env`): `OPENAI_API_KEY`, `SECRET_KEY`, `AUTH0_DOMAIN`,
   `AUTH0_API_AUDIENCE`, `MONGODB_URL` (the new user's connection string), and `FRONTEND_URL`
   (put a placeholder now, fix it after step 3).
3. Deploy. Your backend URL looks like `https://alaaska-backend.onrender.com`; `/docs` should open.
   Free services sleep after ~15 idle minutes; the first request then takes ~1 minute.

## 3. Frontend on Vercel
1. vercel.com -> sign in with GitHub -> **Add New -> Project** -> the ALAASKA repo.
2. **Root Directory: `frontend`** (framework: Create React App).
3. Environment variables:
   - `REACT_APP_API_URL` = your Render URL (no trailing slash)
   - `REACT_APP_AUTH0_DOMAIN`, `REACT_APP_AUTH0_CLIENT_ID`, `REACT_APP_AUTH0_API_AUDIENCE` = same as `frontend/.env`
4. Deploy. You get a URL like `https://alaaska-zamil.vercel.app`.
5. Back in Render, set `FRONTEND_URL` to that URL (add `,http://localhost:3000` to keep local dev working) and redeploy.

## 4. Auth0
Applications -> ALAASKA app -> Settings: add the Vercel URL to **Allowed Callback URLs**,
**Allowed Logout URLs** and **Allowed Web Origins** (comma-separated, keep the localhost entries). Save.

## 5. Testers
1. Both testers log in once on the Vercel URL (this creates their user records in `alaaska_test`).
2. Atlas -> Browse Collections -> `alaaska_test.users` -> set `is_admin: true` for the admin tester.
3. The admin tester creates a template + assignment; the student tester accepts and works on it.

Costs: Vercel and Render free; OpenAI usage is billed to the key you configure.

## Pre-approving testers (no database editing)

- **Admin tester:** in Render → Environment, set `ADMIN_EMAILS` to their email (comma-separate several).
  They become admin automatically on first login, as long as Auth0 shows the email as verified
  (Google logins always are; email/password sign-ups must click Auth0's verification email first).
- **Student tester:** put their email in the assignment's allowed students when creating it.
  It can be added before they ever log in; the assignment appears on their first login.
