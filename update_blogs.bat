@echo off
title Tech Blog Update
cd /d "%~dp0"

REM Check pnpm is available
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pnpm not found in PATH.
    echo Make sure pnpm is installed and available from the command line.
    pause
    exit /b 1
)

echo ============================================
echo  Tech Blog Update Script
echo  %date% %time%
echo ============================================
echo.

REM Step 1: Format code
echo [1/4] Formatting code...
call pnpm format
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Formatting failed. Aborting.
    pause
    exit /b 1
)
echo [OK] Formatting done.
echo.

REM Step 2: Type check
echo [2/4] Checking articles and types...
call pnpm check
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Type check failed. Fix errors before committing. Aborting.
    pause
    exit /b 1
)
echo [OK] Type check passed.
echo.

REM Step 3: Build
echo [3/4] Building site...
call pnpm build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed. Fix errors before committing. Aborting.
    pause
    exit /b 1
)
echo [OK] Build succeeded.
echo.

REM Step 4: Git commit and push
echo [4/4] Committing and pushing changes...
git add -A

git diff --cached --quiet
if %errorlevel% neq 0 (
    echo.
    echo --- Staged changes ---
    git status --short
    echo ---------------------
    echo.

    if "%~1"=="" (
        set "commitMsg=Update blog: build and deploy"
    ) else (
        set "commitMsg=%~1"
    )

    git commit -m "%commitMsg%"
    if %errorlevel% neq 0 (
        echo [ERROR] Commit failed. Aborting.
        pause
        exit /b 1
    )
    echo [OK] Changes committed: %commitMsg%

    git push origin main
    if %errorlevel% neq 0 (
        echo [ERROR] Push failed. Please push manually.
        pause
        exit /b 1
    )
    echo [OK] Pushed to origin/main.
) else (
    echo [INFO] No changes to commit. Working tree is clean.
)

echo.
echo ============================================
echo  Update complete!
echo ============================================
pause
