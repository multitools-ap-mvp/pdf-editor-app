#!/usr/bin/env python3
"""
PDF Ticket Editor - Universal Installer
Usage: wget -qO- https://raw.githubusercontent.com/multitools-ap-mvp/pdf-ticket-editor/main/setup.py | python3 -
         OR
       curl -fsSL https://raw.githubusercontent.com/multitools-ap-mvp/pdf-ticket-editor/main/setup.py | python3 -
"""

import os
import sys
import platform
import subprocess
import shutil
import json
import tempfile
import urllib.request
from pathlib import Path

# Configuration
REPO_URL = "https://github.com/multitools-ap-mvp/pdf-ticket-editor.git"
REPO_RAW_URL = "https://raw.githubusercontent.com/multitools-ap-mvp/pdf-ticket-editor/main"
APP_NAME = "pdf-ticket-editor"
DEFAULT_PORT = 3000
NODE_MIN_VERSION = "18.0.0"

# Colors
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

def print_banner():
    print("")
    print(Colors.CYAN + Colors.BOLD)
    print("╔══════════════════════════════════════════════════════════╗")
    print("║           PDF Ticket Editor - Installer                  ║")
    print("║              Auto-detect  Edit  Export                   ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(Colors.END)
    print("")

def log(msg, color=Colors.BLUE):
    print(color + "→" + Colors.END + " " + msg)

def success(msg):
    print(Colors.GREEN + "✓" + Colors.END + " " + msg)

def warn(msg):
    print(Colors.YELLOW + "⚠" + Colors.END + " " + msg)

def error(msg):
    print(Colors.RED + "✗" + Colors.END + " " + msg)

def info(msg):
    print(Colors.CYAN + "ℹ" + Colors.END + " " + msg)

# OS Detection
def detect_os():
    system = platform.system().lower()
    if system == "darwin":
        return "macos"
    elif system == "linux":
        if os.path.exists("/etc/os-release"):
            with open("/etc/os-release") as f:
                content = f.read().lower()
                if "ubuntu" in content or "debian" in content:
                    return "debian"
                elif "fedora" in content or "rhel" in content or "centos" in content:
                    return "redhat"
                elif "arch" in content or "manjaro" in content:
                    return "arch"
                elif "alpine" in content:
                    return "alpine"
        return "linux"
    elif system == "windows":
        return "windows"
    return system

# Command Helpers
def run(cmd, check=True, capture=True, shell=False):
    if isinstance(cmd, str) and not shell:
        cmd = cmd.split()
    try:
        if capture:
            result = subprocess.run(cmd, check=check, capture_output=True, text=True, shell=shell)
            return result.stdout.strip()
        else:
            subprocess.run(cmd, check=check, shell=shell)
            return ""
    except subprocess.CalledProcessError as e:
        if check:
            error("Command failed: " + (" ".join(cmd) if isinstance(cmd, list) else cmd))
            if e.stderr:
                error("Error: " + e.stderr.strip())
            sys.exit(1)
        return ""

def command_exists(cmd):
    return shutil.which(cmd) is not None

def get_version(cmd):
    try:
        return run([cmd, "--version"], check=False)
    except:
        return ""

# Dependency Checks
def check_node():
    if not command_exists("node"):
        return False, None
    import re
    version_output = get_version("node")
    match = re.search(r'v?(\d+\.\d+\.\d+)', version_output)
    if match:
        version = match.group(1)
        major = int(version.split('.')[0])
        min_major = int(NODE_MIN_VERSION.split('.')[0])
        return major >= min_major, version
    return False, None

def check_npm():
    return command_exists("npm")

def check_git():
    return command_exists("git")

def check_docker():
    return command_exists("docker")

def check_docker_compose():
    if command_exists("docker"):
        result = run(["docker", "compose", "version"], check=False)
        if result:
            return True, "docker compose"
    if command_exists("docker-compose"):
        return True, "docker-compose"
    return False, None

# Installers
def install_node_debian():
    log("Installing Node.js via NodeSource (Debian/Ubuntu)...")
    run("curl -fsSL https://deb.nodesource.com/setup_20.x | bash -", shell=True)
    run(["apt-get", "install", "-y", "nodejs"], check=False)

def install_node_redhat():
    log("Installing Node.js via NodeSource (RHEL/Fedora)...")
    run("curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -", shell=True)
    run(["dnf", "install", "-y", "nodejs"], check=False)

def install_node_arch():
    log("Installing Node.js (Arch)...")
    run(["pacman", "-S", "--noconfirm", "nodejs", "npm"], check=False)

def install_node_alpine():
    log("Installing Node.js (Alpine)...")
    run(["apk", "add", "nodejs", "npm"], check=False)

def install_node_macos():
    log("Installing Node.js via Homebrew...")
    if not command_exists("brew"):
        error("Homebrew not found. Please install Homebrew first:")
        info("  /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"")
        sys.exit(1)
    run(["brew", "install", "node"])

def install_node_windows():
    error("Please install Node.js manually from https://nodejs.org/")
    sys.exit(1)

def install_node(os_type):
    installers = {
        "debian": install_node_debian,
        "redhat": install_node_redhat,
        "arch": install_node_arch,
        "alpine": install_node_alpine,
        "macos": install_node_macos,
        "windows": install_node_windows,
        "linux": install_node_debian,
    }
    installer = installers.get(os_type, install_node_debian)
    installer()

def install_git(os_type):
    log("Installing Git...")
    commands = {
        "debian": ["apt-get", "update"],
        "redhat": ["dnf", "install", "-y", "git"],
        "arch": ["pacman", "-S", "--noconfirm", "git"],
        "alpine": ["apk", "add", "git"],
        "macos": ["brew", "install", "git"],
    }
    if os_type in commands:
        if os_type == "debian":
            run(["apt-get", "update"], check=False)
            run(["apt-get", "install", "-y", "git"], check=False)
        else:
            run(commands[os_type], check=False)
    else:
        warn("Could not auto-install Git. Please install manually.")

def install_docker_debian():
    log("Installing Docker...")
    run("curl -fsSL https://get.docker.com | sh", shell=True)
    run(["usermod", "-aG", "docker", os.environ.get("USER", "root")], check=False)
    warn("You may need to log out and back in for Docker permissions to take effect.")

def install_docker(os_type):
    if os_type in ["debian", "redhat", "arch", "linux"]:
        install_docker_debian()
    elif os_type == "macos":
        error("Please install Docker Desktop from https://www.docker.com/products/docker-desktop/")
    else:
        warn("Please install Docker manually from https://docs.docker.com/get-docker/")

# Main Setup
def ask_yes_no(question, default=True):
    suffix = " [Y/n]: " if default else " [y/N]: "
    while True:
        try:
            response = input(Colors.CYAN + "?" + Colors.END + " " + question + suffix).strip().lower()
            if not response:
                return default
            return response in ('y', 'yes')
        except (EOFError, KeyboardInterrupt):
            print("")
            sys.exit(0)

def ask_choice(question, choices, default=0):
    print("")
    print(Colors.BOLD + question + Colors.END)
    for i, choice in enumerate(choices, 1):
        marker = "→" if i - 1 == default else " "
        print("  " + marker + " " + str(i) + ". " + choice)
    while True:
        try:
            response = input("\n" + Colors.CYAN + "?" + Colors.END + " Select option (1-" + str(len(choices)) + "): ").strip()
            if not response:
                return default
            idx = int(response) - 1
            if 0 <= idx < len(choices):
                return idx
            warn("Please enter a number between 1 and " + str(len(choices)))
        except ValueError:
            warn("Please enter a valid number")
        except (EOFError, KeyboardInterrupt):
            print("")
            sys.exit(0)

def clone_repo(install_dir):
    log("Cloning repository to " + install_dir + "...")
    if os.path.exists(install_dir):
        if os.path.exists(os.path.join(install_dir, ".git")):
            warn("Directory " + install_dir + " already exists and is a git repo.")
            if ask_yes_no("Pull latest changes?", default=True):
                os.chdir(install_dir)
                run(["git", "pull"])
                return
            else:
                warn("Using existing repository.")
                return
        else:
            import time
            backup = install_dir + ".backup." + str(int(time.time()))
            warn("Directory exists but is not a git repo. Moving to " + backup)
            os.rename(install_dir, backup)
    run(["git", "clone", REPO_URL, install_dir])
    success("Repository cloned to " + install_dir)

def setup_node_app(install_dir, os_type):
    os.chdir(install_dir)
    log("Installing npm dependencies...")
    run(["npm", "install"])
    success("Dependencies installed")
    log("Installing Playwright Chromium browser...")
    log("This may take a few minutes on first run...")
    run(["npx", "playwright", "install", "chromium"])
    success("Playwright Chromium installed")
    for d in ["uploads", "output"]:
        os.makedirs(d, exist_ok=True)
    success("Node.js app ready!")

def setup_docker(install_dir):
    os.chdir(install_dir)
    log("Building Docker image...")
    run(["docker", "build", "-t", APP_NAME + ":latest", "."])
    success("Docker image built")
    log("Starting container...")
    run(["docker", "run", "-d", "-p", str(DEFAULT_PORT) + ":3000", 
         "--name", APP_NAME, "--restart", "unless-stopped",
         "-v", install_dir + "/uploads:/app/uploads",
         "-v", install_dir + "/output:/app/output",
         APP_NAME + ":latest"])
    success("Docker container started!")

def setup_docker_compose(install_dir):
    os.chdir(install_dir)
    compose_cmd = "docker compose" if run(["docker", "compose", "version"], check=False) else "docker-compose"
    log("Building and starting with Docker Compose...")
    run(compose_cmd + " up -d --build", shell=True)
    success("Docker Compose stack started!")

def launch_app(install_dir, use_docker=False):
    if use_docker:
        info("App is running in Docker at http://localhost:" + str(DEFAULT_PORT))
        info("To view logs: docker logs -f " + APP_NAME)
        info("To stop: docker stop " + APP_NAME)
    else:
        os.chdir(install_dir)
        log("Starting server...")
        info("App will be available at http://localhost:" + str(DEFAULT_PORT))
        info("Press Ctrl+C to stop\n")
        try:
            subprocess.run(["node", "src/server.js"])
        except KeyboardInterrupt:
            print("\n" + Colors.YELLOW + "Server stopped." + Colors.END)

def create_systemd_service(install_dir):
    if not os.path.exists("/etc/systemd/system"):
        return
    if not ask_yes_no("Create systemd service for auto-start?", default=False):
        return
    service_content = "[Unit]\nDescription=PDF Ticket Editor\nAfter=network.target\n\n[Service]\nType=simple\nUser=" + os.environ.get("USER", "root") + "\nWorkingDirectory=" + install_dir + "\nExecStart=/usr/bin/node src/server.js\nRestart=on-failure\nRestartSec=10\n\n[Install]\nWantedBy=multi-user.target\n"
    service_path = "/etc/systemd/system/pdf-ticket-editor.service"
    try:
        with open(service_path, "w") as f:
            f.write(service_content)
        run(["systemctl", "daemon-reload"])
        run(["systemctl", "enable", "pdf-ticket-editor"])
        success("Systemd service created at " + service_path)
        info("Start with: sudo systemctl start pdf-ticket-editor")
    except PermissionError:
        warn("Need sudo to create systemd service. Run:")
        info("  sudo tee " + service_path + " << 'EOF'")
        info(service_content)
        info("EOF")
        info("  sudo systemctl daemon-reload")
        info("  sudo systemctl enable --now pdf-ticket-editor")

def create_launchd_plist(install_dir):
    if platform.system().lower() != "darwin":
        return
    if not ask_yes_no("Create launchd service for auto-start?", default=False):
        return
    plist_content = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n    <key>Label</key>\n    <string>com.pdf-ticket-editor</string>\n    <key>ProgramArguments</key>\n    <array>\n        <string>/usr/local/bin/node</string>\n        <string>' + install_dir + '/src/server.js</string>\n    </array>\n    <key>WorkingDirectory</key>\n    <string>' + install_dir + '</string>\n    <key>RunAtLoad</key>\n    <true/>\n    <key>KeepAlive</key>\n    <true/>\n    <key>StandardOutPath</key>\n    <string>' + install_dir + '/output/server.log</string>\n    <key>StandardErrorPath</key>\n    <string>' + install_dir + '/output/server.error.log</string>\n</dict>\n</plist>\n'
    plist_path = os.path.expanduser("~/Library/LaunchAgents/com.pdf-ticket-editor.plist")
    os.makedirs(os.path.dirname(plist_path), exist_ok=True)
    with open(plist_path, "w") as f:
        f.write(plist_content)
    run(["launchctl", "load", plist_path])
    success("LaunchAgent created at " + plist_path)
    info("It will auto-start on login. To start now:")
    info("  launchctl start com.pdf-ticket-editor")

def create_shortcut(install_dir, os_type):
    if os_type == "macos":
        script_path = os.path.expanduser("~/.local/bin/" + APP_NAME)
        os.makedirs(os.path.dirname(script_path), exist_ok=True)
        with open(script_path, "w") as f:
            f.write("#!/bin/bash\ncd \"" + install_dir + "\" && node src/server.js\n")
        os.chmod(script_path, 0o755)
        success("Shortcut created: " + script_path)
    elif os_type in ["debian", "redhat", "arch", "alpine", "linux"]:
        script_path = os.path.expanduser("~/.local/bin/" + APP_NAME)
        os.makedirs(os.path.dirname(script_path), exist_ok=True)
        with open(script_path, "w") as f:
            f.write("#!/bin/bash\ncd \"" + install_dir + "\" && node src/server.js\n")
        os.chmod(script_path, 0o755)
        success("Shortcut created: " + script_path)
        bin_dir = os.path.expanduser("~/.local/bin")
        if bin_dir not in os.environ.get("PATH", ""):
            shell_rc = os.path.expanduser("~/.bashrc")
            if os.path.exists(os.path.expanduser("~/.zshrc")):
                shell_rc = os.path.expanduser("~/.zshrc")
            with open(shell_rc, "a") as f:
                f.write('\nexport PATH="$HOME/.local/bin:$PATH"\n')
            info("Added " + bin_dir + " to PATH in " + shell_rc)
            info("Run 'source " + shell_rc + "' or restart your terminal to use the shortcut.")

def main():
    print_banner()
    os_type = detect_os()
    info("Detected OS: " + platform.system() + " (" + os_type + ")")
    if os.geteuid() == 0:
        warn("Running as root. It's recommended to run as a regular user.")
        if not ask_yes_no("Continue as root?", default=False):
            sys.exit(0)
    
    # Choose Installation Method
    docker_available = check_docker()
    docker_compose_available = check_docker_compose()[0]
    
    print("")
    print(Colors.BOLD + "Installation Options:" + Colors.END)
    
    options = []
    if docker_compose_available:
        options.append("Docker Compose (recommended - easiest, isolated)")
    if docker_available:
        options.append("Docker (standalone container)")
    options.append("Native Node.js (direct install, best performance)")
    
    choice = ask_choice("How would you like to install?", options)
    use_docker = "Docker" in options[choice]
    use_compose = "Compose" in options[choice]
    
    # Install Missing Dependencies
    if not use_docker:
        node_ok, node_version = check_node()
        if not node_ok:
            if node_version:
                warn("Node.js " + node_version + " found, but " + NODE_MIN_VERSION + "+ required.")
            else:
                warn("Node.js not found.")
            if ask_yes_no("Install Node.js now?", default=True):
                install_node(os_type)
                node_ok, node_version = check_node()
        if not node_ok:
            error("Node.js is required but not available. Please install manually.")
            sys.exit(1)
        success("Node.js " + node_version + " ✓")
        
        if not check_npm():
            warn("npm not found. Attempting to install...")
            install_node(os_type)
        success("npm ✓")
        
        if not check_git():
            warn("Git not found.")
            if ask_yes_no("Install Git now?", default=True):
                install_git(os_type)
        if not check_git():
            warn("Git not available. Will download as ZIP instead.")
    else:
        if not docker_available:
            warn("Docker not found.")
            if ask_yes_no("Install Docker now?", default=True):
                install_docker(os_type)
            else:
                error("Docker is required for this installation method.")
                sys.exit(1)
        success("Docker ✓")
    
    # Clone Repository
    install_dir = os.path.expanduser("~/" + APP_NAME)
    if not ask_yes_no("Install to " + install_dir + "?", default=True):
        custom_dir = input(Colors.CYAN + "?" + Colors.END + " Enter installation directory: ").strip()
        if custom_dir:
            install_dir = os.path.expanduser(custom_dir)
    
    clone_repo(install_dir)
    
    # Setup Application
    if use_compose:
        setup_docker_compose(install_dir)
    elif use_docker:
        setup_docker(install_dir)
    else:
        setup_node_app(install_dir, os_type)
        if os_type in ["debian", "redhat", "arch", "alpine", "linux"]:
            create_systemd_service(install_dir)
        elif os_type == "macos":
            create_launchd_plist(install_dir)
        create_shortcut(install_dir, os_type)
    
    # Done
    print("")
    print(Colors.GREEN + Colors.BOLD)
    print("╔══════════════════════════════════════════════════════════╗")
    print("║              Installation Complete!                      ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(Colors.END)
    print("")
    print(Colors.CYAN + "PDF Ticket Editor is ready!" + Colors.END)
    print("")
    print(Colors.BOLD + "Access:" + Colors.END)
    print("  http://localhost:" + str(DEFAULT_PORT))
    print("")
    print(Colors.BOLD + "Installation Directory:" + Colors.END)
    print("  " + install_dir)
    print("")
    print(Colors.BOLD + "Usage:" + Colors.END)
    print("  1. Open your browser to http://localhost:" + str(DEFAULT_PORT))
    print("  2. Upload a PDF ticket")
    print("  3. Click any detected field to edit")
    print("  4. Export your edited PDF")
    print("")
    
    if not use_docker:
        if ask_yes_no("Launch the app now?", default=True):
            launch_app(install_dir, use_docker)
    else:
        info("Your app is already running in Docker!")
        info("View logs: docker logs -f " + APP_NAME)

if __name__ == "__main__":
    main()
