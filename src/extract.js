// This parses your PDF and outputs structured JSON you can edit

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function extractPdfData(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdf(buffer);
  
  // Parse the text content into structured data
  // Based on your ticket format
  const text = data.text;
  
  // Extract ticket pages (your PDF has 4 pages, 2 tickets with 2 pages each)
  const tickets = parseTickets(text);
  
  const output = {
    source: path.basename(pdfPath),
    pageCount: data.numpages,
    tickets: tickets,
    rawText: text
  };
  
  const outputPath = path.join(__dirname, 'data', 'ticket-data.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`✅ Extracted data saved to: ${outputPath}`);
  return output;
}

function parseTickets(text) {
  // Split by ticket headers
  const ticketBlocks = text.split(/OstgotaTrafiken Biljett \d+av \d+/).filter(Boolean);
  
  return ticketBlocks.map((block, index) => {
    const lines = block.split('\n').filter(l => l.trim());
    
    // Extract fields using regex patterns
    const routeMatch = lines.find(l => l.includes('station') || l.includes('entré'));
    const nameMatch = lines.find(l => l.match(/^#?\s*[A-ZÅÄÖ][a-zåäö]+\s+[A-ZÅÄÖ]/));
    const bookingMatch = lines.find(l => l.includes('Bokningsnr:'));
    const ticketMatch = lines.find(l => l.includes('Biljettnr:'));
    const dateMatch = lines.find(l => l.match(/Måndag|Tisdag|Onsdag|Torsdag|Fredag|Lördag|Söndag/));
    const timeMatch = lines.find(l => l.match(/\d{2}:\d{2}/));
    
    return {
      ticketNumber: index + 1,
      route: routeMatch ? routeMatch.replace(/#/g, '').trim() : '',
      passengerName: nameMatch ? nameMatch.replace(/#/g, '').trim() : '',
      bookingNumber: bookingMatch ? extractValue(bookingMatch, 'Bokningsnr:') : '',
      ticketNumberCode: ticketMatch ? extractValue(ticketMatch, 'Biljettnr:') : '',
      date: dateMatch ? dateMatch.replace(/#/g, '').trim() : '',
      times: extractTimes(block),
      transport: extractTransport(block),
      conditions: extractConditions(block)
    };
  });
}

function extractValue(line, key) {
  const parts = line.split(key);
  return parts.length > 1 ? parts[1].trim().split(/\s+/)[0] : '';
}

function extractTimes(block) {
  const timeMatches = block.match(/\d{2}:\d{2}/g) || [];
  const lines = block.split('\n');
  const times = [];
  
  lines.forEach(line => {
    if (line.match(/\d{2}:\d{2}/)) {
      const parts = line.split(/\d{2}:\d{2}/);
      const t = line.match(/\d{2}:\d{2}/g);
      if (t) {
        times.push({
          departure: t[0],
          arrival: t[1] || '',
          location: line.replace(/#/g, '').replace(/\d{2}:\d{2}/g, '').trim()
        });
      }
    }
  });
  
  return times;
}

function extractTransport(block) {
  const trainMatch = block.match(/Tåg\s+\d+/);
  const busMatch = block.match(/Buss\s+\d+/);
  return {
    type: trainMatch ? 'train' : busMatch ? 'bus' : 'unknown',
    number: (trainMatch || busMatch || [''])[0].replace(/Tåg|Buss/, '').trim()
  };
}

function extractConditions(block) {
  const conditionsStart = block.indexOf('Köp och resevillkor');
  if (conditionsStart === -1) return '';
  return block.substring(conditionsStart).replace(/<footer>.*<\/footer>/s, '').trim();
}

// Run extraction
const inputPath = process.argv[2] || path.join(__dirname, '..', 'input', 'Exemple-Edit.pdf');
extractPdfData(inputPath).catch(console.error);
