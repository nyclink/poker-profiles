# 🃏 Poker Profiles App

### Overview
Poker Profiles is a lightweight local web app designed for players or coaches who want to **track behavioral reads and notes** on opponents.  
It runs entirely on your own infrastructure — your SQL Server database and Node.js API — with a small HTML frontend that can even be saved to your iPhone home screen.

---

## ⚙️ Components

### 1. Database (SQL Server)
**Database:** `PokerProfiles`

**Tables Created:**

#### `app_user`
Holds users of the app.
| Column | Type | Notes |
|--------|------|-------|
| id | `uniqueidentifier` | Primary key (GUID) |
| email | `nvarchar(255)` | Unique user email |

#### `player`
Stores observed player profiles.
| Column | Type | Notes |
|--------|------|-------|
| id | `uniqueidentifier` | Primary key |
| user_id | `uniqueidentifier` | FK → `app_user.id` |
| name | `nvarchar(255)` | Player name |
| table_image | `nvarchar(100)` | Style label (e.g., Tight, Aggressive) |
| confidence | `tinyint` | Confidence level (1–5) |
| zones_json | `nvarchar(max)` | JSON object of observed behavior zones (hands, face, voice, timing, etc.) |
| updated_at | `datetime2` | Auto-updated timestamp |

#### `note`
Holds behavioral notes for each player.
| Column | Type | Notes |
|--------|------|-------|
| id | `int identity` | Primary key |
| player_id | `uniqueidentifier` | FK → `player.id` |
| user_id | `uniqueidentifier` | FK → `app_user.id` |
| body | `nvarchar(max)` | Note text |
| created_at | `datetime2` | Default `SYSUTCDATETIME()` |

---

### 2. Backend (Node.js + Express)

**File:** `server.js`

**Tech stack:**
- Node.js + Express
- `mssql` for database access
- `jsonwebtoken` for authentication
- `dotenv` for configuration
- `cors` for domain control

**Endpoints:**

| Method | Route | Description |
|--------|--------|-------------|
| `GET` | `/healthz` | Check API status |
| `GET` | `/api/devtoken?user_id=GUID` | Generate a temporary JWT for testing |
| `GET` | `/api/players` | List players for the current user |
| `GET` | `/api/players/:id` | Get a specific player |
| `POST` | `/api/players` | Create a new player |
| `PUT` | `/api/players/:id` | Update player info |
| `DELETE` | `/api/players/:id` | Delete a player |
| `GET` | `/api/players/:id/notes` | List player notes |
| `POST` | `/api/players/:id/notes` | Add note to player |
| `GET` | `/api/export` | Export all user data (players + notes) |

**Authentication:**  
JWT-based.  
Each request requires a header:  
