# Deployment Guide for Render

## Quick Deploy (Automated)

Your app is ready to deploy! I'll handle the deployment automatically.

## Manual Deploy (If Needed)

### Step 1: Create PostgreSQL Database
1. Go to https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Name: `poker-profiles-db`
4. Database: `pokerprofiles`
5. User: `pokerprofiles`
6. Plan: Free
7. Click "Create Database"
8. **Copy the "Internal Database URL"** - you'll need this

### Step 2: Initialize Database Schema
Once the database is created, go to the database's "Shell" tab and run:

```sql
-- Copy and paste the entire contents of init_db.sql here
```

### Step 3: Create Web Service
1. Click "New +" → "Web Service"
2. Choose "Build and deploy from a Git repository" OR "Deploy from Docker Hub"
3. For manual: Point to your repository
4. Name: `poker-profiles`
5. Runtime: Node
6. Build Command: `npm install`
7. Start Command: `npm start`
8. Plan: Free

### Step 4: Set Environment Variables
Add these environment variables in the Render dashboard:

- `NODE_ENV` = `production`
- `PORT` = `8080`
- `DATABASE_URL` = [paste Internal Database URL from Step 1]
- `JWT_SECRET` = [generate a random string, e.g., use https://www.uuidgenerator.net/]
- `GROQ_API_KEY` = [your Groq API key]
- `ALLOWED_ORIGINS` = `*`
- `DEV` = `false`

### Step 5: Deploy!
Click "Manual Deploy" → "Deploy latest commit"

### Step 6: Create Your First User
After deployment, you'll need to create an admin user in the database:

1. Go to your database's "Shell" tab
2. Run:
```sql
INSERT INTO app_user (email, password_hash)
VALUES ('your@email.com', '$2b$10$YourBcryptHashHere');
```

Or use the built-in script (if you have psql):
```bash
export DATABASE_URL="your-database-url"
node -e "
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const hash = await bcrypt.hash('your-password', 10);
  await pool.query('INSERT INTO app_user (email, password_hash) VALUES ($1, $2)', ['your@email.com', hash]);
  console.log('User created!');
  process.exit(0);
})();
"
```

## Your App URLs
- **App URL**: Will be `https://poker-profiles-XXXXX.onrender.com`
- **Database**: Internal connection only (secure!)

## Free Tier Limits
- **Web Service**: Spins down after 15 minutes of inactivity (first request may be slow)
- **Database**: 90-day expiration (data is deleted after 90 days)
- **Storage**: 1 GB database

## Need Help?
Check the logs in Render dashboard if something goes wrong!
