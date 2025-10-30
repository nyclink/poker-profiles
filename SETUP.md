# 🚀 Quick Start Guide - Poker Profiles

## Prerequisites
✅ Node.js (v16+)
✅ SQL Server (LocalDB, Express, or Full version)

## Setup Steps

### 1️⃣ Install SQL Server (if not already installed)

**Option A: SQL Server Express (Windows)**
- Download from: https://www.microsoft.com/en-us/sql-server/sql-server-downloads
- Install with default settings

**Option B: Docker (Mac/Linux/Windows)**
```bash
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong@Passw0rd" \
   -p 1433:1433 --name sqlserver \
   -d mcr.microsoft.com/mssql/server:2022-latest
```

### 2️⃣ Create the Database

**Using SQL Server Management Studio (SSMS):**
1. Open SSMS and connect to your server
2. Open `setup_database.sql`
3. Execute the script (F5)

**Using sqlcmd (command line):**
```bash
sqlcmd -S localhost -U sa -P YourStrong@Passw0rd -i setup_database.sql
```

**Using Docker:**
```bash
docker exec -it sqlserver /opt/mssql-tools/bin/sqlcmd \
   -S localhost -U sa -P YourStrong@Passw0rd -i /setup_database.sql
```

### 3️⃣ Configure Environment Variables

Edit `.env` file with your database credentials:
```env
SQL_SERVER=localhost
SQL_USER=sa
SQL_PASSWORD=YourStrong@Passw0rd
SQL_DATABASE=PokerProfiles
JWT_SECRET=change_this_to_something_secure
```

### 4️⃣ Install Dependencies

```bash
npm install
```

### 5️⃣ Start the Server

```bash
npm start
```

You should see:
```
API on :8080
```

### 6️⃣ Open the Frontend

Open `index.html` in your browser:
- **Direct:** Open `file:///path/to/index.html`
- **Or serve it:** `npx serve .` then visit `http://localhost:3000`

The frontend is already configured with a dev token that matches the test user.

## 🧪 Test the API

### Get a dev token:
```bash
curl http://localhost:8080/api/devtoken?user_id=9E1B0AC3-2DA7-45CA-8A20-EA2C685C6AF7
```

### Check health:
```bash
curl http://localhost:8080/healthz
```

### List players:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/players
```

## 🔧 Troubleshooting

**Connection Error:**
- Check SQL Server is running
- Verify credentials in `.env`
- Try `SQL_ENCRYPT=false` and `SQL_TRUST_CERT=true`

**Port in Use:**
- Change `PORT=8080` in `.env` to another port

**JWT Error:**
- Make sure `JWT_SECRET` is set in `.env`
- Get a fresh token from `/api/devtoken`

## 📱 Add to iPhone Home Screen

1. Open `index.html` in Safari
2. Tap the share button
3. Scroll down and tap "Add to Home Screen"
4. Name it "Poker Profiles"

Enjoy! 🎯♠️♥️♣️♦️
