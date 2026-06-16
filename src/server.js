const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { chromium } = require('playwright');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Ensure directories exist
['uploads', 'output'].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ───────────────────────────────────────────────
// FIELD DETECTION ENGINE
// ───────────────────────────────────────────────

function detectFields(text) {
  const fields = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const add = (type, label, value, category = 'general') => {
    if (!value || fields.find(f => f.value === value)) return;
    fields.push({ type, label, value, category, id: `field_${fields.length}` });
  };

  // 1. Passenger name
  lines.forEach(line => {
    const clean = line.replace(/^#\s*/, '').trim();
    if (/^[A-ZÅÄÖ][a-zåäö]+\s+[A-ZÅÄÖ][a-zåäö]+$/.test(clean) && clean.length < 40) {
      add('text', 'Passenger Name', clean, 'passenger');
    }
  });

  // 2. Booking number
  const bookingMatch = text.match(/Bokningsnr[:\s]+([A-Z0-9]+)/i);
  if (bookingMatch) add('text', 'Booking Number', bookingMatch[1], 'booking');

  // 3. Ticket number
  const ticketMatch = text.match(/Biljettnr[:\s]+(\d+)/i);
  if (ticketMatch) add('text', 'Ticket Number', ticketMatch[1], 'booking');

  // 4. Dates
  const dateRegex = /(Måndag|Tisdag|Onsdag|Torsdag|Fredag|Lördag|Söndag),?\s*(\d{1,2})\s*(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s*(\d{4})/gi;
  let dateMatch;
  while ((dateMatch = dateRegex.exec(text)) !== null) {
    add('date', 'Travel Date', `${dateMatch[1]}, ${dateMatch[2]} ${dateMatch[3]} ${dateMatch[4]}`, 'journey');
  }

  // 5. Times
  const timeRegex = /(\d{2}:\d{2})\s*([A-ZÅÄÖ][a-zåäö\s]+(?:station|Central|entré))\s*[-–]\s*(\d{2}:\d{2})\s*([A-ZÅÄÖ][a-zåäö\s]+(?:station|Central|entré))/gi;
  let timeMatch;
  while ((timeMatch = timeRegex.exec(text)) !== null) {
    add('time', 'Departure Time', timeMatch[1], 'journey');
    add('text', 'From', timeMatch[2].trim(), 'journey');
    add('time', 'Arrival Time', timeMatch[3], 'journey');
    add('text', 'To', timeMatch[4].trim(), 'journey');
  }

  // 6. Transport
  const trainMatch = text.match(/Tåg\s+(\d+)/);
  if (trainMatch) add('text', 'Train Number', `Tåg ${trainMatch[1]}`, 'transport');
  
  const busMatch = text.match(/Buss\s+(\d+)/);
  if (busMatch) add('text', 'Bus Number', `Buss ${busMatch[1]}`, 'transport');

  // 7. Route
  const routeRegex = /([A-ZÅÄÖ][a-zåäö\s]+(?:station|entré))\s*[-–]\s*([A-ZÅÄÖ][a-zåäö\s]+(?:station|entré))/gi;
  let routeMatch;
  while ((routeMatch = routeRegex.exec(text)) !== null) {
    const route = `${routeMatch[1].trim()} – ${routeMatch[2].trim()}`;
    if (!fields.find(f => f.value === route)) {
      add('text', 'Route', route, 'journey');
    }
  }

  // 8. Class info
  const classMatch = text.match(/(Vuxen,\s*\d+\s*klass[^\n]*)/i);
  if (classMatch) add('text', 'Class', classMatch[1].trim(), 'transport');

  // 9. Operator
  const opMatch = text.match(/(ÖstgötaTrafiken|SJ|SL|Skånetrafiken)/i);
  if (opMatch) add('text', 'Operator', opMatch[1], 'transport');

  // 10. Ticket page count
  const pageMatch = text.match(/Biljett\s+(\d+)av\s+(\d+)/i);
  if (pageMatch) {
    add('text', 'Page', `${pageMatch[1]} of ${pageMatch[2]}`, 'meta');
  }

  return fields;
}

// ───────────────────────────────────────────────
// HTML TEMPLATE GENERATOR
// ───────────────────────────────────────────────

function generateTicketHtml(fields, originalText) {
  const categories = {
    passenger: fields.filter(f => f.category === 'passenger'),
    booking: fields.filter(f => f.category === 'booking'),
    journey: fields.filter(f => f.category === 'journey'),
    transport: fields.filter(f => f.category === 'transport'),
    meta: fields.filter(f => f.category === 'meta'),
    general: fields.filter(f => f.category === 'general')
  };

  const passenger = categories.passenger[0];
  const booking = categories.booking;
  const journey = categories.journey;
  const transport = categories.transport;
  const meta = categories.meta[0];

  // Build journey legs
  const times = journey.filter(f => f.type === 'time');
  const locations = journey.filter(f => f.label === 'From' || f.label === 'To');
  const routes = journey.filter(f => f.label === 'Route');
  const dates = journey.filter(f => f.type === 'date');

  let journeyHtml = '';
  const legs = [];
  for (let i = 0; i < times.length; i += 2) {
    legs.push({
      departure: times[i],
      arrival: times[i + 1],
      from: locations[i * 2] || locations[0],
      to: locations[i * 2 + 1] || locations[1],
      route: routes[Math.floor(i / 2)] || routes[0],
      date: dates[Math.floor(i / 2)] || dates[0],
      transport: transport.find(t => t.label.includes('Train') || t.label.includes('Bus'))
    });
  }

  legs.forEach((leg, idx) => {
    const classField = transport.find(t => t.label === 'Class');
    const transportType = leg.transport ? leg.transport.value : '';
    const operatorName = transport.find(t => t.label === 'Operator');
    const operatorText = operatorName ? (operatorName.value === 'ÖstgötaTrafiken' ? 'Östgötapendeln' : operatorName.value) : 'ÖstgötaTrafiken';
    
    journeyHtml += `
      <div class="journey-leg" data-leg="${idx}">
        <div class="leg-header">
          <span class="leg-date" data-field="${leg.date ? leg.date.id : ''}">${leg.date ? leg.date.value : ''}</span>
          <span class="leg-route" data-field="${leg.route ? leg.route.id : ''}">${leg.route ? leg.route.value : ''}</span>
        </div>
        <div class="leg-body">
          <div class="time-block">
            <div class="time" data-field="${leg.departure ? leg.departure.id : ''}">${leg.departure ? leg.departure.value : ''}</div>
            <div class="time-label">Avgång</div>
            <div class="location" data-field="${leg.from ? leg.from.id : ''}">${leg.from ? leg.from.value : ''}</div>
          </div>
          <div class="arrow">→</div>
          <div class="time-block">
            <div class="time" data-field="${leg.arrival ? leg.arrival.id : ''}">${leg.arrival ? leg.arrival.value : ''}</div>
            <div class="time-label">Ankomst</div>
            <div class="location" data-field="${leg.to ? leg.to.id : ''}">${leg.to ? leg.to.value : ''}</div>
          </div>
          <div class="transport-info">
            <div class="transport-badge" data-field="${leg.transport ? leg.transport.id : ''}">${transportType}</div>
            <div class="class-info" data-field="${classField ? classField.id : ''}">${classField ? classField.value : ''}</div>
          </div>
        </div>
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>Ticket Editor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt; line-height: 1.4; color: #1a1a1a;
      background: #f5f5f5; padding: 20px;
    }
    .ticket-page {
      width: 210mm; min-height: 297mm;
      padding: 20mm; margin: 0 auto 20px;
      background: white; position: relative;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    .ticket-page:last-child { page-break-after: auto; }
    .header {
      display: flex; justify-content: space-between;
      align-items: center; padding-bottom: 15px;
      border-bottom: 3px solid #e60000; margin-bottom: 25px;
    }
    .header-left { font-size: 20pt; font-weight: 800; color: #e60000; }
    .header-right { font-size: 10pt; color: #888; }
    .passenger-info { margin-bottom: 30px; }
    .passenger-name {
      font-size: 26pt; font-weight: 800; color: #1a1a1a;
      margin-bottom: 12px; letter-spacing: -0.5px;
    }
    .meta-row {
      display: flex; gap: 40px; font-size: 10pt; color: #666;
    }
    .meta-item strong {
      display: block; font-size: 8pt; text-transform: uppercase;
      letter-spacing: 1px; color: #999; margin-bottom: 4px;
    }
    .journey-leg {
      background: #f8f9fa; border-radius: 10px;
      padding: 20px; margin-bottom: 20px;
      border-left: 4px solid #e60000;
    }
    .leg-header {
      display: flex; justify-content: space-between;
      margin-bottom: 15px; padding-bottom: 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    .leg-date { font-size: 14pt; font-weight: 700; color: #1a1a1a; }
    .leg-route { font-size: 10pt; color: #888; }
    .leg-body {
      display: flex; align-items: center; gap: 20px;
    }
    .time-block { text-align: center; min-width: 80px; }
    .time {
      font-size: 22pt; font-weight: 800; color: #1a1a1a; line-height: 1;
    }
    .time-label {
      font-size: 8pt; color: #aaa; text-transform: uppercase;
      margin-top: 4px; letter-spacing: 1px;
    }
    .location {
      font-size: 11pt; font-weight: 600; color: #444; margin-top: 6px;
    }
    .arrow {
      font-size: 20pt; color: #e60000; font-weight: 800;
    }
    .transport-info { margin-left: auto; text-align: right; }
    .transport-badge {
      background: #e60000; color: white;
      padding: 8px 16px; border-radius: 20px;
      font-size: 9pt; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
      display: inline-block;
    }
    .class-info {
      margin-top: 8px; font-size: 9pt; color: #888; font-style: italic;
    }
    .conditions {
      margin-top: 30px; padding-top: 15px;
      border-top: 1px solid #eee;
      font-size: 8pt; line-height: 1.6; color: #888;
    }
    .conditions h3 {
      font-size: 9pt; color: #444; margin-bottom: 8px;
      text-transform: uppercase; letter-spacing: 1px;
    }
    .seller { margin-top: 10px; font-weight: 700; color: #333; }
    [data-field] {
      border: 2px solid transparent;
      border-radius: 4px; padding: 2px 6px;
      transition: all 0.2s; cursor: text;
      display: inline-block; min-width: 20px;
    }
    [data-field]:hover {
      border-color: #e60000; background: #fff0f0;
    }
    [data-field].editing {
      border-color: #e60000; background: #fff;
      box-shadow: 0 0 0 3px rgba(230,0,0,0.15);
    }
    @media print {
      body { background: white; padding: 0; }
      .ticket-page { box-shadow: none; margin: 0; }
      [data-field] { border: none !important; }
    }
  </style>
</head>
<body>
  <div class="ticket-page">
    <div class="header">
      <div class="header-left">ÖstgötaTrafiken</div>
      <div class="header-right">${meta ? meta.value : 'Biljett'}</div>
    </div>
    <div class="passenger-info">
      <div class="passenger-name" data-field="${passenger ? passenger.id : ''}">${passenger ? passenger.value : ''}</div>
      <div class="meta-row">
        ${booking.map(b => `
          <div class="meta-item">
            <strong>${b.label}</strong>
            <span data-field="${b.id}">${b.value}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ${journeyHtml}
    <div class="conditions">
      <h3>Köp och resevillkor</h3>
      <p>Biljetten är personlig. På resan behöver du kunna visa giltig id-handling (pass, nordiskt körkort eller id-kort, nationellt id-kort från EU-land eller Migrationsverkets LMA-kort som visar att du är asylansökande).</p>
      <p>När du köper en resa via SJs kanaler ingår du ett avtal med SJ. Vilka bestämmelser som gäller regleras i köp och resevillkoren som du hittar på sj.se.</p>
      <p>Vid trafikstörningar som påverkar din resa eller kommande byten, kontakta personalen ombord eller kundservice för den trafikoperatör där trafikstörningen hände. Vill du göra en reklamation, kontakta den operatör som reklamationen gäller.</p>
      <div class="seller">Biljetten är såld av SJ AB, organisationsnummer: 556196-1599</div>
    </div>
  </div>
</body>
</html>`;
}

// ───────────────────────────────────────────────
// ROUTES
// ───────────────────────────────────────────────

// Upload & detect
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const buffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(buffer);
    const fields = detectFields(data.text);
    
    const html = generateTicketHtml(fields, data.text);
    const htmlPath = path.join('output', 'preview.html');
    fs.writeFileSync(htmlPath, html);
    
    const fieldsPath = path.join('output', 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify(fields, null, 2));
    
    res.json({
      success: true,
      fields: fields,
      html: html,
      pageCount: data.numpages,
      text: data.text.substring(0, 500) + '...'
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF from edited HTML
app.post('/api/generate', async (req, res) => {
  try {
    const { html } = req.body;
    if (!html) return res.status(400).json({ error: 'No HTML provided' });
    
    const outputPath = path.join('output', `ticket-${Date.now()}.pdf`);
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true
    });
    
    await browser.close();
    
    res.json({
      success: true,
      downloadUrl: `/api/download/${path.basename(outputPath)}`
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Download generated PDF
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join('output', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 PDF Ticket Editor running at http://localhost:${PORT}`);
  console.log(`📂 Upload a PDF to start editing`);
});
