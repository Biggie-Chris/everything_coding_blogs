@echo off
title Tech Blog Update
cd /d "%~dp0"

REM Use local pnpm matching packageManager version (11.12.0)
set "LOCAL_PNPM=%USERPROFILE%\.local\pnpm"
if exist "%LOCAL_PNPM%\pnpm.cmd" (
    set "PNPM=%LOCAL_PNPM%\pnpm.cmd"
    set "PATH=%LOCAL_PNPM%;%LOCAL_PNPM%\node_modules\.bin;%PATH%"
) else if exist "%LOCAL_PNPM%\pnpm" (
    set "PNPM=node %LOCAL_PNPM%\pnpm"
) else (
    echo [WARN] Local pnpm 11.12.0 not found at %LOCAL_PNPM%
    echo Trying global pnpm instead...
    set "PNPM=pnpm"
)

echo ============================================
echo  Tech Blog Update Script
echo  %date% %time%
echo ============================================
echo.

REM Step 1: Format code
echo [1/4] Formatting code...
call %PNPM% format
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
call %PNPM% check
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
call %PNPM% build
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
