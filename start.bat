@echo off
echo Stopping any running instances...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do taskkill /f /pid %%a 2>nul

echo Starting Mezgeb Expense Tracker (Production Mode)...
echo Waiting for backend to initialize...

start "" "http://localhost:5000"

cd backend
npm start
pause
