# PokerProfiles - Development Session Summary

## Project Overview
PokerProfiles is a poker player tracking application that helps users record and analyze player behaviors, tells, and patterns during poker games. The app features real-time behavioral tracking with the "Tracker" feature for quick observation logging.

## Technology Stack
- **Backend**: Node.js with Express
- **Database**: Microsoft SQL Server (Azure hosted)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Frontend**: Vanilla JavaScript (no framework)
- **Styling**: Custom CSS with modern design

## Server Configuration
- **Server**: http://localhost:8080
- **Database**: 52.255.220.236:1433
- **Database Name**: PokerProfiles
- **Admin User**: isaac / isaaczahavi@gmail.com / ppp@2025!

## Key Files

### Backend
- `server.js` - Main Express server with all API endpoints
- `.env` - Environment configuration (SQL credentials, JWT secret)
- `package.json` - Dependencies and scripts
- `fix_schema_and_create_admin.js` - Script to set up admin user
- `run_quick_tap_setup.js` - Script to create Tracker tables

### Frontend
- `public/index.html` - Main application interface
- `public/login.html` - Login page with Remember Me feature

### Database Setup
- `add_quick_tap_tables.sql` - SQL script for Tracker feature tables
- `add_context_to_observations.sql` - SQL script for context fields
- `migrate_context.js` - Node.js migration script for context fields
- `update_bucket_types.sql` - Documentation for 4 bucket types

## Database Schema

### Tables
1. **app_user** - User accounts with email and password_hash (NVARCHAR)
2. **player** - Player profiles with name, table_image, confidence, zones_json
3. **note** - Text notes for players
4. **cue** - Behavioral cue catalog (zone, label, is_active)
5. **observation** - Tracker logs with context
   - player_id, user_id, bucket (1-4), cue_id, free_text
   - **hand_outcome** (1=Won, 2=Lost, 3=Folded)
   - **tilt_state** (0=Normal, 1=Slight, 2=On Tilt, 3=Steaming)
   - **stack_situation** (1=Short, 2=Medium, 3=Deep)
   - created_at

### Key Relationships
- Players belong to users
- Notes belong to players and users
- Observations belong to players and users, optionally reference cues

## Features Implemented

### 1. Authentication System
- Login page with email/password
- Remember Me checkbox (saves credentials in localStorage)
- Auto-login on page load if Remember Me enabled
- Proper logout with session flag to prevent auto-login
- JWT token-based API authentication

### 2. Player Management
- Create, read, update, delete player profiles
- Search/filter players by name
- **Simplified Player Form** (Session 6):
  - Name (required for identification)
  - Notes (free text for observations)
  - All tracking done via Tracker feature
  - Removed: Confidence Score, Table Image, Zones, Quick Notes buttons

### 3. Tracker Feature (formerly "Quick Tap")
**Location**: Top of Profile section, above all other fields

**Layout**:
```
Selected Profile: [Player Name]

Tracker (X Bluff, Y Semi-Bluff, Z Strong, W Semi-Strong)
┌─────────────────────────────────────────────────┐
│ 1. Click behavior(s) → 2. Set context → 3. Save│
│ [Chip fumble] [Fast grab] [Overtalking]        │
│ [Flat/quiet] [Locked stare] [Looks away]       │
│ ... more behaviors (200px scrollable) ...      │
│                                                 │
│ CONTEXT (Optional)                              │
│ [Hand: Won/Lost/Fold] [Tilt] [Stack: S/M/D]   │
│                                                 │
│ [BLUFF] [STRONG]                                │
│ [SEMI-BLUFF] [SEMI-STRONG]                      │
│                                                 │
│ [🔍 ANALYZE Selected Behaviors]                │
│ ┌─────────────────────────────────┐            │
│ │ Analysis: 60% Bluff, 20% Semi   │            │
│ └─────────────────────────────────┘            │
│                                                 │
│ History (180px scrollable):                     │
│ 🔴 BLUFF — Chip fumble ✓Won 😠 10:23 PM  [×]  │
│ 🟢 STRONG — Locked stare M$ 10:25 PM     [×]  │
│ 🟠 SEMI-BLUFF — Overtalking 10:30 PM     [×]  │
└─────────────────────────────────────────────────┘
```

**Workflow**:
1. Select a player from the list
2. Click one or more behavior chips (they highlight yellow)
3. **Optional**: Set context (Won/Lost, Tilt state, Stack size)
4. Click one of 4 bucket buttons (BLUFF, SEMI-BLUFF, STRONG, SEMI-STRONG)
5. All selected behaviors are saved with context
6. Selections clear automatically

**Analysis Workflow**:
1. Select behaviors you're currently observing
2. **Optional**: Set context filters (e.g., "On Tilt", "Short stack")
3. Click "ANALYZE Selected Behaviors"
4. View percentage likelihood for each bucket type
5. Results based on historical data matching selected context

**Features**:
- 13 pre-seeded behavioral cues across 7 zones
- 4 bucket types: Bluff, Semi-Bluff, Strong, Semi-Strong
- Context tracking: Hand outcome, Tilt state, Stack situation
- AI-powered analysis with context filtering
- Multi-select behaviors before saving
- Visual feedback (yellow highlight) for selected behaviors
- Context badges in history (✓Won, 😠, S$, etc.)
- Immediate history display with timestamps
- Delete observations with × button
- Summary counter: "(X Bluff, Y Semi-Bluff, Z Strong, W Semi-Strong)"

### 4. UI/UX Improvements
- **Flash Messages**: Elegant sliding notifications (green for success, red for errors)
  - Replaced all browser alerts
  - Auto-dismiss after 2.5 seconds
  - Positioned top-right corner
- **Visual Selection**: Green checkmark (✓) next to currently selected player in list
- **Responsive Design**: Two-column layout on desktop, single column on mobile
- **Clean Interface**: Modern card-based design with smooth interactions

### 5. Quick Notes Feature
Four preset note templates:
- Bluff cues
- Strong cues
- Habit
- Breath spike

Clicking appends text to notes field.

### 6. Export Feature
Downloads all players and notes as JSON backup file.

## API Endpoints

### Authentication
- `POST /api/login` - Login with email/password
- `GET /api/devtoken?user_id={guid}` - Dev token generation

### Players
- `GET /api/players?q={search}` - List players (with search)
- `GET /api/players/:id` - Get single player
- `POST /api/players` - Create player
- `PUT /api/players/:id` - Update player
- `DELETE /api/players/:id` - Delete player

### Notes
- `GET /api/players/:id/notes` - Get notes for player
- `POST /api/players/:id/notes` - Add note

### Tracker (Observations)
- `GET /api/cues` - Get active behavioral cues
- `POST /api/players/:id/observe` - Log observation with context
  - bucket: 1=Bluff, 2=Strong, 3=Semi-Bluff, 4=Semi-Strong
  - Optional: hand_outcome, tilt_state, stack_situation
- `GET /api/players/:id/observe` - Get observation history with context
- `GET /api/players/:id/observe/summary` - Get counts for all 4 bucket types
- `POST /api/players/:id/observe/analyze` - Analyze selected behaviors with context filtering
  - Returns percentage likelihood for each bucket type
  - Filters by optional context parameters
- `DELETE /api/players/:id/observe/:obsId` - Delete observation

### Other
- `GET /api/export` - Export all data
- `GET /healthz` - Health check
- `GET /version` - Version info

## How to Run

### Start Server
```bash
cd C:\PokerProfiles
npm start
```

### Access Application
http://localhost:8080

### Login
- Email: isaaczahavi@gmail.com
- Password: ppp@2025!

### Stop Server
Find process:
```bash
netstat -ano | findstr :8080
```
Kill process:
```bash
taskkill /F /PID [number]
```

## Recent Session Improvements

### Session 1: Initial Setup & Authentication
1. Moved files from Downloads to C:\PokerProfiles
2. Fixed database connection (.env configuration)
3. Created admin user with bcrypt password hashing
4. Added login page with Remember Me feature
5. Configured static file serving

### Session 2: Frontend Integration
1. Integrated original detailed frontend design
2. Added zones chips, confidence slider, table image dropdown
3. Connected all features to API endpoints

### Session 3: Tracker Feature
1. Created `cue` and `observation` database tables
2. Added 13 pre-seeded behavioral cues
3. Built Tracker UI in yellow panel
4. Implemented real-time observation logging
5. Added observation history display with summary counts

### Session 4: Workflow Improvements
1. **Visual Feedback**: Yellow highlight for selected behavior chips
2. **Multi-Select Workflow**: Select multiple behaviors, then save as Bluff/Strong
3. **Delete Functionality**: × button to remove mistaken observations
4. **Layout Reorganization**:
   - Moved Tracker to top of profile section
   - Added "Selected Profile" display
   - Removed name input field from top (moved below Tracker)

### Session 5: UX Polish (Latest)
1. **Flash Messages**: Replaced all browser alerts with elegant sliding notifications
2. **Visual Selection**: Green checkmark next to selected player in list
3. **Increased Size**: Behavior chip area expanded to 200px height
4. **Fixed Delete Button**: Proper event handling with closure for observation IDs
5. **Debug Logging**: Added console logs for troubleshooting delete functionality

## Known Issues & To-Do
- Monitor delete button functionality (recently fixed with event listeners)
- Consider adding ability to edit/customize behavioral cues
- Potential future feature: Analytics dashboard for patterns

## File Locations

### Configuration
- Environment: `C:\PokerProfiles\.env`
- Package: `C:\PokerProfiles\package.json`

### Backend
- Main server: `C:\PokerProfiles\server.js`
- Admin setup: `C:\PokerProfiles\fix_schema_and_create_admin.js`
- Tracker setup: `C:\PokerProfiles\run_quick_tap_setup.js`

### Frontend
- Main app: `C:\PokerProfiles\public\index.html`
- Login: `C:\PokerProfiles\public\login.html`

### Database Scripts
- Tracker tables: `C:\PokerProfiles\add_quick_tap_tables.sql`
- Context fields: `C:\PokerProfiles\add_context_to_observations.sql`
- Context migration: `C:\PokerProfiles\migrate_context.js`
- Bucket types doc: `C:\PokerProfiles\update_bucket_types.sql`
- Migration runner: `C:\PokerProfiles\run_migration.bat`

## Code References

### Tracker Feature
- Cue chips rendering: `index.html:516-527`
- Multi-select logic: `index.html:529-556`
- Delete observation: `index.html:561-587`
- Refresh display: `index.html:589-650`

### Flash Messages
- CSS styles: `index.html:60-63`
- Flash function: `index.html:203-211`
- Used throughout for all user feedback

### Player Selection
- Checkmark display: `index.html:245-251`
- List refresh on selection: `index.html:300`

## Development Notes
- All times displayed in browser's local timezone
- Observations stored with UTC timestamps
- Zone data stored as JSON in zones_json column
- Password hashes use bcrypt with salt rounds
- JWT tokens expire after 30 days
- CORS currently set to allow all origins (lock down in production)

## Next Steps Recommendations
1. **Pattern Recognition**: Detect behavioral patterns that consistently predict outcomes
2. **Advanced Analytics**:
   - Timeline view of observations per player
   - Heatmap of most reliable tells per context
   - Win rate correlation with observed behaviors
3. **Customization**:
   - Allow users to add custom behavioral cues
   - Personalize context categories
4. **Mobile Optimization**:
   - Touch-friendly interface for table use
   - One-handed operation mode
   - Offline capability with sync
5. **Data Export**:
   - Export analysis reports as PDF
   - Share player profiles securely
6. **Machine Learning**:
   - Improve analysis with pattern detection algorithms
   - Confidence intervals based on sample size
   - Recency weighting (recent observations weighted higher)
7. **Multi-Session Tracking**:
   - Track performance over multiple sessions
   - Note session conditions (stakes, venue, time of day)
8. **Production Deployment**:
   - Lock down CORS
   - HTTPS/SSL certificates
   - Database backup strategy

### Session 6: Advanced Analysis & Context (Latest)
1. **4 Bucket Types**: Expanded from 2 to 4 observation categories
   - Bluff (Red) - Strong bluffing behavior
   - Semi-Bluff (Orange) - Moderate/uncertain bluffing
   - Strong (Green) - Strong hand behavior
   - Semi-Strong (Teal) - Moderate strength
   - UI: 2x2 grid layout for save buttons

2. **AI-Powered Analysis Feature**:
   - New "🔍 ANALYZE Selected Behaviors" button
   - Analyzes historical data for selected behaviors
   - Shows percentage likelihood for each bucket type
   - Displays sample size and observation counts
   - Example: "Based on 20 historical observations"
   - Results shown in color-coded grid with percentages

3. **Context-Aware Tracking**:
   - Added 3 context dimensions to observations:
     - **Hand Outcome**: Won / Lost / Folded
     - **Tilt State**: Normal / Slight Tilt / On Tilt / Steaming
     - **Stack Situation**: Short / Medium / Deep
   - Context saved with each observation
   - Context filters applied during analysis
   - Database schema: Added `hand_outcome`, `tilt_state`, `stack_situation` columns

4. **Context Display**:
   - Context badges in observation history
   - ✓Won / ✗Lost / Fold badges (blue)
   - 😐😠🔥💥 emoji badges for tilt state (yellow)
   - S$ / M$ / D$ badges for stack size (green)
   - Context message in analysis results

5. **UI Simplification**:
   - Removed: Confidence Score slider
   - Removed: Table Image dropdown
   - Removed: Zones toggle chips
   - Removed: Quick Notes append buttons
   - Kept: Name input, Notes textarea, Tracker feature
   - Cleaner, focused interface on core functionality

6. **Database Migrations**:
   - Created `add_context_to_observations.sql`
   - Created `migrate_context.js` (Node.js migration script)
   - Successfully added context columns to observation table

7. **API Enhancements**:
   - Updated `POST /api/players/:id/observe` to accept context data
   - Updated `GET /api/players/:id/observe` to return context data
   - Updated `GET /api/players/:id/observe/summary` for 4 bucket types
   - New `POST /api/players/:id/observe/analyze` endpoint with context filtering
   - Context filtering builds dynamic WHERE clauses

8. **Analysis Algorithm**:
   - Type: Frequency-Based Probability / Naive Bayes
   - Method: Count matching observations by bucket, calculate percentages
   - Context-aware: Filters historical data by selected context factors
   - Example: "Lip press + On Tilt + Short stack" only matches those conditions
   - Returns: Percentages + raw counts for transparency

---
**Last Updated**: Session 6 - January 2025
**Server Status**: Running on localhost:8080
**Database Status**: Connected to Azure SQL Server
