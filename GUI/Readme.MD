# Multi Tools PDF Editor
// GUI/WebApp Version
// V0.3.1 Public Beta

---

# Feature | Functions

* Drag & Drop Upload
Drop any PDF ticket onto the upload zone

* Auto Field Detection
Extracts names, dates, times, routes, booking numbers, transport info automatically	

* Inline Editing
Click any field in the preview to edit directly	

* Sidebar Navigation
Click any detected field in the sidebar to jump to it in the preview	
Zoom Controls	Scale the preview for comfortable editing

* One-Click Export
Generates a clean, print-ready PDF via Playwright	

---
# Structure

GUI/
├── src/server.js          # Express API + field detection + PDF generation
├── public/
│   ├── index.html         # Main UI
│   ├── css/style.css      # Clean, modern styling
│   └── js/app.js          # Frontend logic
├── uploads/               # Temp uploaded PDFs
└── output/                # Generated PDFs + preview HTML

---
# Usage / Install

1. git clone
2. cd pdf-ticket-editor
3. npm install
4. npx playwright install chromium
5. npm start

**Then open http://localhost:3000**
OR
Go to "https://pdf.apexmultitools.se/"
And Use our free webapp. 

---

# ✨ How It Works

1. 
Upload your PDF — the backend parses text with  pdf-parse 

2. 
Fields auto-detect via regex patterns tuned for Swedish transport tickets (SJ, ÖstgötaTrafiken, etc.)

3. 
Edit inline — click any red-bordered field in the preview, type, hit Enter

4. 
Export — Playwright renders the edited HTML to a pixel-perfect A4 PDF

---

# Build 

Built for - Apex Multi Tools
Built By  - ApexAmstaff
Contact   - @

Stack     - 


