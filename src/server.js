const express = require('express');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'editor')));

// Serve the editable HTML
app.get('/editor', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'output', 'editable.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Run npm run extract && npm run generate first');
  }
});

// Save edited HTML
app.post('/save', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'output', 'editable.html');
  fs.writeFileSync(htmlPath, req.body.html);
  res.json({ success: true });
});

// Generate PDF from edited HTML
app.post('/generate', async (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'output', 'editable.html');
  const pdfPath = path.join(__dirname, '..', 'output', 'final.pdf');
  
  const html = fs.readFileSync(htmlPath, 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true
  });
  
  await browser.close();
  res.download(pdfPath);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🌐 Editor running at http://localhost:${PORT}`);
  console.log(`📂 Open http://localhost:${PORT}/editor to edit your ticket`);
});
