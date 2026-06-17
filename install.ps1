<#
.SYNOPSIS
    PDF Ticket Editor - Windows Installer
.DESCRIPTION
    Auto-detects Windows version, installs dependencies, clones repo,
    sets up Node.js app or Docker, and launches the PDF Ticket Editor.
.EXAMPLE
    # One-line install:
    # irm https://raw.githubusercontent.com/YOUR_USERNAME/pdf-ticket-editor/main/install.ps1 | iex
    
    # Or download and run:
    # .\install.ps1
#>

param(
    [switch]$Docker,
    [switch]$Native,
    [string]$InstallDir = "$env:USERPROFILE\pdf-ticket-editor",
    [switch]$SkipPrompts,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
PDF Ticket Editor - Windows Installer

Usage:
  irm https://raw.githubusercontent.com/YOUR_USERNAME/pdf-ticket-editor/main/install.ps1 | iex

Parameters:
  -Docker       Force Docker installation
  -Native       Force native Node.js installation
  -InstallDir   Custom installation directory (default: ~\pdf-ticket-editor)
  -SkipPrompts  Auto-accept all prompts
  -Help         Show this help
"@ -ForegroundColor Cyan
    exit 0
}

# Configuration
$RepoUrl = "https://github.com/YOUR_USERNAME/pdf-ticket-editor.git"
$RepoRaw = "https://raw.githubusercontent.com/YOUR_USERNAME/pdf-ticket-editor/main"
$AppName = "pdf-ticket-editor"
$DefaultPort = 3000
$NodeMinVersion = [version]"18.0.0"

# Colors
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  $Text" -ForegroundColor Cyan -NoNewline
    Write-Host (" " * (56 - $Text.Length)) -NoNewline
    Write-Host "║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step { param([string]$Text) Write-Host "→ $Text" -ForegroundColor Blue }
function Write-Success { param([string]$Text) Write-Host "✓ $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "⚠ $Text" -ForegroundColor Yellow }
function Write-Error { param([string]$Text) Write-Host "✗ $Text" -ForegroundColor Red }
function Write-Info { param([string]$Text) Write-Host "ℹ $Text" -ForegroundColor Cyan }

# Admin Check
function Test-Admin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# OS Detection
function Get-WindowsVersion {
    $os = Get-CimInstance Win32_OperatingSystem
    $build = [System.Environment]::OSVersion.Version.Build
    
    if ($build -ge 22000) { return "Windows 11" }
    if ($build -ge 19041) { return "Windows 10 (2004+)" }
    if ($build -ge 18362) { return "Windows 10 (1903+)" }
    if ($build -ge 17763) { return "Windows 10 (1809+)" }
    return "Windows 10/11"
}

# Command Helpers
function Test-Command { param([string]$Name) return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }

function Invoke-Safe {
    param([string]$Command, [switch]$IgnoreError)
    try {
        $output = Invoke-Expression $Command 2>&1
        return $output
    } catch {
        if (-not $IgnoreError) {
            Write-Error "Command failed: $Command"
            Write-Error $_.Exception.Message
            exit 1
        }
        return $null
    }
}

# Dependency Checks
function Test-NodeJs {
    if (-not (Test-Command "node")) { return $false, $null }
    
    try {
        $versionStr = (node --version) -replace "v", ""
        $version = [version]$versionStr
        return ($version -ge $NodeMinVersion), $versionStr
    } catch {
        return $false, $null
    }
}

function Test-Npm { return Test-Command "npm" }
function Test-Git { return Test-Command "git" }
function Test-Docker { return Test-Command "docker" }
function Test-DockerCompose {
    if (Test-Command "docker") {
        $composeV2 = docker compose version 2>$null
        if ($composeV2) { return $true, "docker compose" }
    }
    if (Test-Command "docker-compose") { return $true, "docker-compose" }
    return $false, $null
}

# Installers
function Install-NodeJs {
    Write-Step "Installing Node.js via winget..."
    
    if (Test-Command "winget") {
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    } else {
        Write-Step "Downloading Node.js installer..."
        $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
        $installerPath = "$env:TEMP\nodejs-installer.msi"
        
        Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath -UseBasicParsing
        Write-Step "Running Node.js installer (may prompt for UAC)..."
        Start-Process msiexec.exe -ArgumentList "/i `"$installerPath`" /qn" -Wait -Verb RunAs
        Remove-Item $installerPath -ErrorAction SilentlyContinue
    }
    
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    $nodeOk, $nodeVer = Test-NodeJs
    if (-not $nodeOk) {
        Write-Error "Node.js installation failed. Please install manually from https://nodejs.org/"
        exit 1
    }
    Write-Success "Node.js $nodeVer installed"
}

function Install-Git {
    Write-Step "Installing Git via winget..."
    
    if (Test-Command "winget") {
        winget install Git.Git --accept-source-agreements --accept-package-agreements
    } else {
        Write-Warn "winget not available. Please install Git manually from https://git-scm.com/download/win"
        Write-Error "Git is required but could not be installed automatically."
        exit 1
    }
    
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    if (-not (Test-Git)) {
        Write-Error "Git installation failed."
        exit 1
    }
    Write-Success "Git installed"
}

function Install-Docker {
    Write-Step "Docker Desktop is required for Docker installation."
    Write-Info "Please download and install Docker Desktop from:"
    Write-Info "  https://www.docker.com/products/docker-desktop/"
    Write-Info ""
    Write-Info "After installation, restart this script."
    
    Start-Process "https://www.docker.com/products/docker-desktop/"
    exit 1
}

# Prompts
function Read-YesNo {
    param([string]$Question, [bool]$Default = $true)
    if ($SkipPrompts) { return $Default }
    
    $suffix = if ($Default) { " [Y/n]: " } else { " [y/N]: " }
    $response = Read-Host ("? $Question$suffix")
    
    if ([string]::IsNullOrWhiteSpace($response)) { return $Default }
    return $response -match "^y"
}

function Read-Choice {
    param([string]$Question, [string[]]$Choices, [int]$Default = 0)
    if ($SkipPrompts) { return $Default }
    
    Write-Host ""
    Write-Host $Question -ForegroundColor Bold
    for ($i = 0; $i -lt $Choices.Length; $i++) {
        $marker = if ($i -eq $Default) { "→" } else { " " }
        Write-Host "  $marker $($i + 1). $($Choices[$i])"
    }
    Write-Host ""
    
    while ($true) {
        $response = Read-Host "? Select option (1-$($Choices.Length))"
        if ([string]::IsNullOrWhiteSpace($response)) { return $Default }
        
        try {
            $idx = [int]$response - 1
            if ($idx -ge 0 -and $idx -lt $Choices.Length) { return $idx }
            Write-Warn "Please enter a number between 1 and $($Choices.Length)"
        } catch {
            Write-Warn "Please enter a valid number"
        }
    }
}

# Setup Functions
function Clone-Repository {
    param([string]$TargetDir)
    
    Write-Step "Cloning repository to $TargetDir..."
    
    if (Test-Path $TargetDir) {
        if (Test-Path (Join-Path $TargetDir ".git")) {
            Write-Warn "Directory exists and is a git repo."
            if (Read-YesNo "Pull latest changes?" $true) {
                Set-Location $TargetDir
                git pull
                return
            } else {
                Write-Warn "Using existing repository."
                return
            }
        } else {
            $backup = "$TargetDir.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
            Write-Warn "Directory exists but is not a git repo. Moving to $backup"
            Rename-Item $TargetDir $backup
        }
    }
    
    git clone $RepoUrl $TargetDir
    Write-Success "Repository cloned to $TargetDir"
}

function Setup-NodeApp {
    param([string]$TargetDir)
    
    Set-Location $TargetDir
    
    Write-Step "Installing npm dependencies..."
    npm install
    Write-Success "Dependencies installed"
    
    Write-Step "Installing Playwright Chromium browser..."
    Write-Step "This may take a few minutes on first run..."
    npx playwright install chromium
    Write-Success "Playwright Chromium installed"
    
    New-Item -ItemType Directory -Force -Path "uploads", "output" | Out-Null
    Write-Success "Node.js app ready!"
}

function Setup-Docker {
    param([string]$TargetDir)
    
    Set-Location $TargetDir
    
    Write-Step "Building Docker image..."
    docker build -t "${AppName}:latest" .
    Write-Success "Docker image built"
    
    Write-Step "Starting container..."
    docker run -d -p "${DefaultPort}:3000" `
        --name $AppName `
        --restart unless-stopped `
        -v "${TargetDir}\uploads:/app/uploads" `
        -v "${TargetDir}\output:/app/output" `
        "${AppName}:latest"
    Write-Success "Docker container started!"
}

function Setup-DockerCompose {
    param([string]$TargetDir)
    
    Set-Location $TargetDir
    
    $composeCmd = if ((docker compose version 2>$null)) { "docker compose" } else { "docker-compose" }
    
    Write-Step "Building and starting with Docker Compose..."
    Invoke-Expression "$composeCmd up -d --build"
    Write-Success "Docker Compose stack started!"
}

function Launch-App {
    param([string]$TargetDir, [bool]$UseDocker)
    
    if ($UseDocker) {
        Write-Info "App is running in Docker at http://localhost:$DefaultPort"
        Write-Info "To view logs: docker logs -f $AppName"
        Write-Info "To stop: docker stop $AppName"
    } else {
        Set-Location $TargetDir
        Write-Step "Starting server..."
        Write-Info "App will be available at http://localhost:$DefaultPort"
        Write-Info "Press Ctrl+C to stop`n"
        
        try {
            node src/server.js
        } catch {
            Write-Warn "Server stopped."
        }
    }
}

function Create-Shortcut {
    param([string]$TargetDir)
    
    $shortcutPath = "$env:USERPROFILE\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\PDF Ticket Editor.lnk"
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "cmd.exe"
    $shortcut.Arguments = "/k cd /d `"$TargetDir`" && node src/server.js"
    $shortcut.WorkingDirectory = $TargetDir
    $shortcut.IconLocation = "cmd.exe,0"
    $shortcut.Save()
    
    Write-Success "Start Menu shortcut created"
    
    $batchPath = "$env:USERPROFILE\.local\bin\$AppName.bat"
    New-Item -ItemType Directory -Force -Path (Split-Path $batchPath) | Out-Null
    @"
@echo off
cd /d "$TargetDir"
node src\server.js
"@ | Set-Content $batchPath
    
    Write-Success "Command shortcut created: $batchPath"
    Write-Info "Add to PATH: $env:USERPROFILE\.local\bin"
}

function Create-ScheduledTask {
    param([string]$TargetDir)
    
    if (-not (Test-Admin)) {
        Write-Warn "Admin rights required to create scheduled task."
        Write-Info "Run as Administrator and execute:"
        Write-Info "  schtasks /create /tn `"PDF Ticket Editor`" /tr `"node $TargetDir\src\server.js`" /sc onlogon /rl highest"
        return
    }
    
    if (-not (Read-YesNo "Create scheduled task for auto-start on login?" $false)) {
        return
    }
    
    $action = New-ScheduledTaskAction -Execute "node" -Argument "src/server.js" -WorkingDirectory $TargetDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Limited
    
    Register-ScheduledTask -TaskName "PDF Ticket Editor" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
    
    Write-Success "Scheduled task created for auto-start on login"
    Write-Info "Manage in Task Scheduler or run: schtasks /delete /tn `"PDF Ticket Editor`" /f"
}

# Main
function Main {
    Write-Header "PDF Ticket Editor - Windows Installer"
    
    $winVer = Get-WindowsVersion
    Write-Info "Detected OS: $winVer"
    
    # Choose Installation Method
    $dockerAvailable = Test-Docker
    $dockerComposeAvailable = (Test-DockerCompose)[0]
    
    Write-Host ""
    Write-Host "Installation Options:" -ForegroundColor Bold
    
    $options = @()
    if ($Docker) {
        $options = @("Docker (forced)")
        $choice = 0
    } elseif ($Native) {
        $options = @("Native Node.js (forced)")
        $choice = 0
    } else {
        if ($dockerComposeAvailable) {
            $options += "Docker Compose (recommended - easiest, isolated)"
        }
        if ($dockerAvailable) {
            $options += "Docker (standalone container)"
        }
        $options += "Native Node.js (direct install, best performance)"
        
        $choice = Read-Choice "How would you like to install?" $options
    }
    
    $useDocker = $options[$choice] -match "Docker"
    $useCompose = $options[$choice] -match "Compose"
    
    # Install Missing Dependencies
    if (-not $useDocker) {
        $nodeOk, $nodeVer = Test-NodeJs
        if (-not $nodeOk) {
            if ($nodeVer) {
                Write-Warn "Node.js $nodeVer found, but $($NodeMinVersion)+ required."
            } else {
                Write-Warn "Node.js not found."
            }
            
            if (Read-YesNo "Install Node.js now?" $true) {
                Install-NodeJs
                $nodeOk, $nodeVer = Test-NodeJs
            }
        }
        
        if (-not $nodeOk) {
            Write-Error "Node.js is required but not available. Please install manually from https://nodejs.org/"
            exit 1
        }
        Write-Success "Node.js $nodeVer ✓"
        
        if (-not (Test-Npm)) {
            Write-Warn "npm not found. Attempting to install..."
            Install-NodeJs
        }
        Write-Success "npm ✓"
        
        if (-not (Test-Git)) {
            Write-Warn "Git not found."
            if (Read-YesNo "Install Git now?" $true) {
                Install-Git
            }
        }
        
        if (-not (Test-Git)) {
            Write-Warn "Git not available. Will download as ZIP instead."
        } else {
            Write-Success "Git ✓"
        }
    } else {
        if (-not $dockerAvailable) {
            Write-Warn "Docker not found."
            if (Read-YesNo "Install Docker now?" $true) {
                Install-Docker
            } else {
                Write-Error "Docker is required for this installation method."
                exit 1
            }
        }
        Write-Success "Docker ✓"
    }
    
    # Clone Repository
    if (-not (Read-YesNo "Install to $InstallDir?" $true)) {
        $customDir = Read-Host "? Enter installation directory"
        if ($customDir) { $InstallDir = $customDir }
    }
    
    Clone-Repository $InstallDir
    
    # Setup Application
    if ($useCompose) {
        Setup-DockerCompose $InstallDir
    } elseif ($useDocker) {
        Setup-Docker $InstallDir
    } else {
        Setup-NodeApp $InstallDir
        
        Create-Shortcut $InstallDir
        Create-ScheduledTask $InstallDir
    }
    
    # Done
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║              Installation Complete!                      ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "PDF Ticket Editor is ready!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Access:" -ForegroundColor Bold
    Write-Host "  http://localhost:$DefaultPort"
    Write-Host ""
    Write-Host "Installation Directory:" -ForegroundColor Bold
    Write-Host "  $InstallDir"
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Bold
    Write-Host "  1. Open your browser to http://localhost:$DefaultPort"
    Write-Host "  2. Upload a PDF ticket"
    Write-Host "  3. Click any detected field to edit"
    Write-Host "  4. Export your edited PDF"
    Write-Host ""
    
    if (-not $useDocker) {
        if (Read-YesNo "Launch the app now?" $true) {
            Launch-App $InstallDir $useDocker
        }
    } else {
        Write-Info "Your app is already running in Docker!"
        Write-Info "View logs: docker logs -f $AppName"
    }
}

# Run main
Main
