const { chromium } = require('playwright');
const fs = require('fs');

async function generateFromHtml(htmlPath, outputPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true
  });
  
  await browser.close();
  console.log(`✅ PDF regenerated: ${outputPath}`);
}

const [,, htmlPath, outputPath] = process.argv;
if (!htmlPath || !outputPath) {
  console.log('Usage: node src/generate-from-html.js <input.html> <output.pdf>');
  process.exit(1);
}

generateFromHtml(htmlPath, outputPath).catch(console.error);
