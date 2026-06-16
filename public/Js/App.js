// State
let currentFields = [];
let zoom = 1;
let activeFieldId = null;

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const pdfInput = document.getElementById('pdfInput');
const fieldPanel = document.getElementById('fieldPanel');
const fieldList = document.getElementById('fieldList');
const actions = document.getElementById('actions');
const previewFrame = document.getElementById('previewFrame');
const emptyState = document.getElementById('emptyState');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const status = document.getElementById('status');
const toast = document.getElementById('toast');
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const zoomLevel = document.getElementById('zoomLevel');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');

// Upload Handling
uploadZone.addEventListener('click', () => pdfInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    handleUpload(file);
  } else {
    showToast('Please upload a PDF file', 'error');
  }
});

pdfInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleUpload(e.target.files[0]);
});

async function handleUpload(file) {
  showLoading('Uploading PDF...');
  
  const formData = new FormData();
  formData.append('pdf', file);
  
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    hideLoading();
    
    if (data.success) {
      currentFields = data.fields;
      renderFields(data.fields);
      renderPreview(data.html);
      showToast(`Detected ${data.fields.length} editable fields`, 'success');
      status.textContent = `${file.name} • ${data.pageCount} pages • ${data.fields.length} fields`;
    } else {
      showToast(data.error || 'Upload failed', 'error');
    }
  } catch (err) {
    hideLoading();
    showToast('Upload failed: ' + err.message, 'error');
  }
}

// Render Fields Sidebar
function renderFields(fields) {
  fieldPanel.style.display = 'block';
  actions.style.display = 'flex';
  
  fieldList.innerHTML = fields.map(f => `
    <div class="field-item" data-id="${f.id}" data-category="${f.category}">
      <div class="field-label">${f.label}</div>
      <div class="field-value">${escapeHtml(f.value)}</div>
      <span class="field-category ${f.category}">${f.category}</span>
    </div>
  `).join('');
  
  fieldList.querySelectorAll('.field-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      highlightField(id);
      
      const el = previewFrame.querySelector(`[data-field="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    });
  });
}

function highlightField(id) {
  fieldList.querySelectorAll('.field-item').forEach(i => i.classList.remove('active'));
  previewFrame.querySelectorAll('[data-field]').forEach(el => {
    el.classList.remove('highlighted', 'editing');
  });
  
  const item = fieldList.querySelector(`[data-id="${id}"]`);
  if (item) item.classList.add('active');
  
  const el = previewFrame.querySelector(`[data-field="${id}"]`);
  if (el) {
    el.classList.add('highlighted');
    setTimeout(() => el.classList.remove('highlighted'), 2000);
  }
  
  activeFieldId = id;
}

// Render Preview
function renderPreview(html) {
  emptyState.style.display = 'none';
  previewFrame.style.display = 'block';
  previewFrame.innerHTML = html;
  
  previewFrame.querySelectorAll('[data-field]').forEach(el => {
    el.contentEditable = true;
    el.addEventListener('focus', () => {
      el.classList.add('editing');
      const fieldId = el.dataset.field;
      if (fieldId) highlightField(fieldId);
    });
    el.addEventListener('blur', () => {
      el.classList.remove('editing');
      updateFieldValue(el.dataset.field, el.textContent);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
    });
  });
}

function updateFieldValue(fieldId, newValue) {
  const field = currentFields.find(f => f.id === fieldId);
  if (field) {
    field.value = newValue.trim();
    const item = fieldList.querySelector(`[data-id="${fieldId}"] .field-value`);
    if (item) item.textContent = newValue.trim();
  }
}

// Zoom
zoomIn.addEventListener('click', () => setZoom(zoom + 0.1));
zoomOut.addEventListener('click', () => setZoom(zoom - 0.1));

function setZoom(newZoom) {
  zoom = Math.max(0.3, Math.min(2, newZoom));
  previewFrame.style.transform = `scale(${zoom})`;
  zoomLevel.textContent = Math.round(zoom * 100) + '%';
}

// Generate PDF
generateBtn.addEventListener('click', async () => {
  showLoading('Generating PDF...');
  
  const html = `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8">
      <title>Ticket</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 0; }
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 11pt; line-height: 1.4; color: #1a1a1a;
          background: white;
        }
        .ticket-page {
          width: 210mm; min-height: 297mm;
          padding: 20mm; background: white;
          position: relative; page-break-after: always;
        }
        .ticket-page:last-child { page-break-after: auto; }
        .header {
          display: flex; justify-content: space-between;
          align-items: center; padding-bottom: 15px;
          border-bottom: 3px solid #e60000; margin-bottom: 25px;
        }
        .header-left { font-size: 20pt; font-weight: 800; color: #e60000; }
        .header-right { font-size: 10pt; color: #
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
        [data-field] { border: none !important; background: transparent !important; }
      </style>
    </head>
    <body>
      ${previewFrame.innerHTML}
    </body>
    </html>
  `;
  
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html })
    });
    
    const data = await res.json();
    hideLoading();
    
    if (data.success) {
      showToast('PDF generated! Downloading...', 'success');
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = 'edited-ticket.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      showToast(data.error || 'Generation failed', 'error');
    }
  } catch (err) {
    hideLoading();
    showToast('Generation failed: ' + err.message, 'error');
  }
});

// Reset
resetBtn.addEventListener('click', () => {
  currentFields = [];
  activeFieldId = null;
  fieldPanel.style.display = 'none';
  actions.style.display = 'none';
  previewFrame.style.display = 'none';
  emptyState.style.display = 'block';
  previewFrame.innerHTML = '';
  status.textContent = 'Upload a PDF to begin';
  pdfInput.value = '';
  zoom = 1;
  previewFrame.style.transform = 'scale(1)';
  zoomLevel.textContent = '100%';
});

// Utilities
function showLoading(text) {
  loadingText.textContent = text;
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 's') {
      e.preventDefault();
      if (currentFields.length > 0) generateBtn.click();
    }
  }
});
