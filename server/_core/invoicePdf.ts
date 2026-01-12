/**
 * Invoice PDF Generation Service
 * Generates branded PDF invoices for emailing to customers
 */

// Invoice PDF generation service

interface InvoiceLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate?: string | null;
  taxAmount?: string | null;
  totalAmount: string;
}

interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date | string;
  dueDate?: Date | string | null;
  customer: {
    name: string;
    email?: string | null;
    address?: string | null;
    phone?: string | null;
  };
  items: InvoiceLineItem[];
  subtotal: string;
  taxAmount?: string | null;
  discountAmount?: string | null;
  totalAmount: string;
  notes?: string | null;
  terms?: string | null;
  currency?: string;
}

interface CompanyInfo {
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
}

function formatCurrency(value: string | number | null | undefined, currency = 'USD'): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Generate HTML template for invoice PDF
 */
export function generateInvoiceHtml(invoice: InvoiceData, company: CompanyInfo): string {
  const itemsHtml = invoice.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unitPrice, invoice.currency)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.totalAmount, invoice.currency)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      margin: 0;
      padding: 40px;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #3b82f6;
    }
    .company-info {
      max-width: 300px;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 8px;
    }
    .company-details {
      font-size: 12px;
      color: #6b7280;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h1 {
      font-size: 32px;
      color: #3b82f6;
      margin: 0 0 8px 0;
    }
    .invoice-number {
      font-size: 14px;
      color: #6b7280;
    }
    .invoice-meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .bill-to {
      max-width: 300px;
    }
    .bill-to h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin: 0 0 8px 0;
    }
    .bill-to p {
      margin: 4px 0;
    }
    .invoice-dates {
      text-align: right;
    }
    .invoice-dates p {
      margin: 4px 0;
      font-size: 14px;
    }
    .invoice-dates strong {
      color: #6b7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
    }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) {
      text-align: right;
    }
    th:nth-child(2) {
      text-align: center;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    .totals-table {
      width: 300px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.total {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
      border-bottom: none;
      border-top: 2px solid #1f2937;
      padding-top: 12px;
    }
    .notes {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .notes h3 {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 8px 0;
    }
    .notes p {
      margin: 0;
      font-size: 14px;
    }
    .footer {
      margin-top: 60px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="invoice-header">
    <div class="company-info">
      ${company.logo ? `<img src="${company.logo}" alt="${company.name}" style="max-height: 60px; margin-bottom: 12px;">` : ''}
      <div class="company-name">${company.name}</div>
      <div class="company-details">
        ${company.address ? `<p>${company.address}</p>` : ''}
        ${company.phone ? `<p>Phone: ${company.phone}</p>` : ''}
        ${company.email ? `<p>Email: ${company.email}</p>` : ''}
        ${company.taxId ? `<p>Tax ID: ${company.taxId}</p>` : ''}
      </div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <div class="invoice-number">${invoice.invoiceNumber}</div>
    </div>
  </div>

  <div class="invoice-meta">
    <div class="bill-to">
      <h3>Bill To</h3>
      <p><strong>${invoice.customer.name}</strong></p>
      ${invoice.customer.email ? `<p>${invoice.customer.email}</p>` : ''}
      ${invoice.customer.address ? `<p>${invoice.customer.address}</p>` : ''}
      ${invoice.customer.phone ? `<p>${invoice.customer.phone}</p>` : ''}
    </div>
    <div class="invoice-dates">
      <p><strong>Issue Date:</strong> ${formatDate(invoice.issueDate)}</p>
      <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
      </div>
      ${invoice.taxAmount && parseFloat(invoice.taxAmount) > 0 ? `
      <div class="totals-row">
        <span>Tax</span>
        <span>${formatCurrency(invoice.taxAmount, invoice.currency)}</span>
      </div>
      ` : ''}
      ${invoice.discountAmount && parseFloat(invoice.discountAmount) > 0 ? `
      <div class="totals-row">
        <span>Discount</span>
        <span>-${formatCurrency(invoice.discountAmount, invoice.currency)}</span>
      </div>
      ` : ''}
      <div class="totals-row total">
        <span>Total Due</span>
        <span>${formatCurrency(invoice.totalAmount, invoice.currency)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes || invoice.terms ? `
  <div class="notes">
    ${invoice.notes ? `<h3>Notes</h3><p>${invoice.notes}</p>` : ''}
    ${invoice.terms ? `<h3 style="margin-top: 16px;">Terms & Conditions</h3><p>${invoice.terms}</p>` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <p>Thank you for your business!</p>
    ${company.website ? `<p>${company.website}</p>` : ''}
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF from invoice data using html-pdf-node
 * Returns Buffer containing PDF
 */
export async function generateInvoicePdf(invoice: InvoiceData, company: CompanyInfo): Promise<Buffer> {
  const html = generateInvoiceHtml(invoice, company);
  
  // Use dynamic import for puppeteer
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      });
      
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (error) {
    // Fallback: return HTML as buffer if PDF generation fails
    console.error('[InvoicePDF] PDF generation failed, returning HTML:', error);
    return Buffer.from(html, 'utf-8');
  }
}

/**
 * Get default company info from environment or settings
 */
export function getDefaultCompanyInfo(): CompanyInfo {
  return {
    name: process.env.VITE_APP_TITLE || 'SuperHumn',
    logo: process.env.VITE_APP_LOGO || undefined,
    email: 'billing@superhumn.co',
    website: 'https://superhumn.co',
  };
}
