# Apex Multi Tools 
// Another Useful MultiTools App
// MultiTools PDF Editor
// V0.3.1 Public Beta
// Load pdf > Edit as html > create pdf
---

# Structured PDF Editor

// PDF → HTML → Edit → PDF
// Convert any PDF to HTML
// With document structure intact
// Web Editor auto detects objects
// Edit what you want
// Create New PDF 
// Download or Mail PDF

---

# 4 Different Setups! Same App! 

// Selfhost Terminal Version
// GUI Version Installed
// Dockerfile Setup
// Hosted WebApp

# Quick Install
```
# Using wget

wget -qO- https://raw.githubusercontent.com/YOUR_USERNAME/pdf-ticket-editor/main/install.sh | bash

# Or curl

curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/pdf-ticket-editor/main/install.sh | bash

```

**Choose your preferred setup & Launch App to start editing**


**Selfhost**
```
1. Clone App
git clone https://github.com/multitools-ap-mvp/pdf-editor-app.git

2. Install
npm install

2.5.
Put your source PDF in /input/ Directory

3. Extract data from your PDF
npm run extract

4. Generate editable HTML + PDF
npm run generate

# 5. (Optional) Start web editor
npm run edit
```
---

# Usage 2
// GUI WebApp Version
// Go to website or install by:

```
1. Clone WebApp
git clone https://github.com/multitools-ap-mvp/pdf-editor-app.git

2.
cd pdf-ticket-editor

3.
npm install

4.
npx playwright install chromium

5.
npm start

**Then open http://localhost:3000**

```
# PWA WebApp
**Go to https://pdf.apexmultitools.se/**
