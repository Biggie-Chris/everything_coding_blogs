@echo off
setlocal enabledelayedexpansion

REM Switch to script directory (project root)
cd /d "%~dp0"

echo ============================================
echo  Tech Blog Update Script
echo  %date% %time%
echo ============================================
echo.

REM Step 1: Format code
echo [1/4] Formatting code...
call pnpm format
if errorlevel 1 (
    echo.
    echo [ERROR] Formatting failed. Aborting.
    exit /b 1
)
echo [OK] Formatting done.
echo.

REM Step 2: Type check
echo [2/4] Checking articles and types...
call pnpm check
if errorlevel 1 (
    echo.
    echo [ERROR] Type check failed. Fix errors before committing. Aborting.
    exit /b 1
)
echo [OK] Type check passed.
echo.

REM Step 3: Build
echo [3/4] Building site...
call pnpm build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Fix errors before committing. Aborting.
    exit /b 1
)
echo [OK] Build succeeded.
echo.

REM Step 4: Git commit and push
echo [4/4] Committing and pushing changes...
git add -A

REM Check if there are staged changes to commit
git diff --cached --quiet
if errorlevel 1 (
    echo.
    echo --- Staged changes ---
    git status --short
    echo ---------------------
    echo.

    REM Build commit message: use arg if provided, else timestamp
    if "%~1"=="" (
        set "commitMsg=Update blog: check, build and deploy %date% %time%"
    ) else (
        set "commitMsg=%~1"
    )

    git commit -m "!commitMsg!"
    if errorlevel 1 (
        echo [ERROR] Commit failed. Aborting.
        exit /b 1
    )
    echo [OK] Changes committed: !commitMsg!

    git push origin main
    if errorlevel 1 (
        echo [ERROR] Push failed. Please push manually.
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

endlocal
