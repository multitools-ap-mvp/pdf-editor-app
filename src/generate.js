const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function generatePdf(dataPath, outputPath) {
  // Load extracted data
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Load template
  const templatePath = path.join(__dirname, 'template.html');
  let template = fs.readFileSync(templatePath, 'utf8');
  
  // Generate ticket pages HTML
  const ticketPagesHtml = data.tickets.map((ticket, index) => {
    const isReturn = index >= data.tickets.length / 2;
    const legs = ticket.times.map((time, i) => `
      <div class="journey-leg">
        <div class="time-block">
          <div class="time">${time.departure}</div>
          <div class="time-label">Avgång</div>
        </div>
        <div class="arrow">→</div>
        <div class="location">${time.location.split('–')[0]}</div>
        <div class="time-block">
          <div class="time">${time.arrival}</div>
          <div class="time-label">Ankomst</div>
        </div>
        <div class="location">${time.location.split('–')[1] || ''}</div>
        <div class="transport-badge">${ticket.transport.type} ${ticket.transport.number}</div>
      </div>
    `).join('');
    
    return `
      <div class="ticket-page">
        <div class="header">
          <div class="header-left">ÖstgötaTrafiken</div>
          <div class="header-right">Biljett ${ticket.ticketNumber} av ${data.tickets.length}</div>
        </div>
        
        <div class="route">${isReturn ? 'Retur' : 'Enkel'}: ${ticket.route}</div>
        
        <div class="passenger-info">
          <div class="passenger-name">${ticket.passengerName}</div>
          <div class="meta-row">
            <div class="meta-item">
              <strong>Bokningsnr</strong>
              ${ticket.bookingNumber}
            </div>
            <div class="meta-item">
              <strong>Biljettnr</strong>
              ${ticket.ticketNumberCode}
            </div>
          </div>
        </div>
        
        <div class="journey">
          <div class="journey-date">${ticket.date}</div>
          ${legs}
          <div class="class-info">
            ${ticket.transport.type === 'train' ? 'Östgötapendeln' : 'ÖstgötaTrafiken'} 
            Vuxen, 2 klass, kan ej återbetalas
          </div>
        </div>
        
        <div class="conditions">
          <h3>Köp och resevillkor</h3>
          <p>Biljetten är personlig. På resan behöver du kunna visa giltig id-handling (pass, nordiskt körkort eller id-kort, nationellt id-kort från EU-land eller Migrationsverkets LMA-kort som visar att du är asylansökande).</p>
          <p>När du köper en resa via SJs kanaler ingår du ett avtal med SJ. Vilka bestämmelser som gäller regleras i köp och resevillkoren som du hittar på sj.se.</p>
          <p>Vid trafikstörningar som påverkar din resa eller kommande byten, kontakta personalen ombord eller kundservice för den trafikoperatör där trafikstörningen hände. Vill du göra en reklamation, kontakta den operatör som reklamationen gäller.</p>
          <div class="seller">Biljetten är såld av SJ AB, organisationsnummer: 556196-1599</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Inject into template
  const finalHtml = template.replace('{{TICKET_PAGES}}', ticketPagesHtml);
  
  // Save intermediate HTML for editing
  const htmlPath = path.join(__dirname, '..', 'output', 'editable.html');
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, finalHtml);
  
  // Generate PDF with Playwright
  console.log('🚀 Launching Playwright...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(finalHtml, {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  
  // Wait for fonts to load
  await page.waitForTimeout(500);
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true
  });
  
  await browser.close();
  
  console.log(`✅ PDF generated: ${outputPath}`);
  console.log(`📝 Editable HTML saved: ${htmlPath}`);
  console.log('\n💡 To edit: Open the HTML file, make changes, then run:');
  console.log('   node src/generate-from-html.js output/edited.html output/final.pdf');
}

// Run
const dataPath = process.argv[2] || path.join(__dirname, 'data', 'ticket-data.json');
const outputPath = process.argv[3] || path.join(__dirname, '..', 'output', 'edited-ticket.pdf');

generatePdf(dataPath, outputPath).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});