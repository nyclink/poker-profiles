@echo off
echo Running database migration...
sqlcmd -S localhost -U sa -P "PokerProfiles2025!" -i "C:\PokerProfiles\add_context_to_observations.sql"
echo.
echo Migration complete! Press any key to exit.
pause
