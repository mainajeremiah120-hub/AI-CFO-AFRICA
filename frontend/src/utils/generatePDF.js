import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const getCompany = () => {
  try { return JSON.parse(localStorage.getItem('company') || '{}'); } catch { return {}; }
};

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`;

const addHeader = (doc, title, subtitle, company) => {
  const pageW = doc.internal.pageSize.getWidth();

  // Company name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(163, 27, 50);
  doc.text(company.name || 'Your Company', 14, 20);

  // Title label (top right)
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(163, 27, 50);
  doc.text(title, pageW - 14, 20, { align: 'right' });

  // Company info row
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const infoLine = [company.address, company.phone, company.email].filter(Boolean).join('  |  ');
  if (infoLine) doc.text(infoLine, 14, 28);

  if (subtitle) {
    doc.text(subtitle, pageW - 14, 28, { align: 'right' });
  }

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, pageW - 14, 32);

  return 38; // next Y position
};

const addFooter = (doc, text = 'Thank you for your business') => {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.line(14, pageH - 16, pageW - 14, pageH - 16);
  doc.text(text, pageW / 2, pageH - 10, { align: 'center' });
};

// ─── INVOICE PDF ─────────────────────────────────────────────────────────────
export const downloadInvoicePDF = (inv) => {
  const company = getCompany();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, 'TAX INVOICE', inv.invoice_number, company);

  // Two-column meta row
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('BILL TO', 14, y);
  doc.text('INVOICE DETAILS', pageW / 2 + 2, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.text(inv.customer_name || '', 14, y);

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const dateStr = inv.date ? new Date(inv.date).toLocaleDateString() : '';
  const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '';
  doc.text(`Invoice Date: ${dateStr}`, pageW / 2 + 2, y);
  y += 5;
  doc.text(`Due Date:     ${dueStr}`, pageW / 2 + 2, y);
  y += 5;

  // Status badge text
  const statusColors = { paid: [22, 101, 52], overdue: [153, 27, 27], partial: [146, 64, 14], unpaid: [107, 114, 128] };
  const sc = statusColors[inv.status] || [107, 114, 128];
  doc.setTextColor(...sc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Status: ${(inv.status || 'unpaid').toUpperCase()}`, pageW / 2 + 2, y);

  y += 8;

  // Line items table
  const items = (inv.items || []).filter(it => it && it.description);
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: items.map(it => [
      it.description,
      Number(it.quantity || 0).toLocaleString(),
      fmt(it.unit_price || 0),
      fmt(it.amount || it.total || ((it.quantity || 0) * (it.unit_price || 0))),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [163, 27, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 6;

  // Totals section
  const subtotal = items.reduce((s, it) => s + Number(it.amount || it.total || ((it.quantity || 0) * (it.unit_price || 0))), 0);
  const taxRate = Number(inv.tax_rate || 0);
  const taxAmt = (subtotal * taxRate) / 100;
  const grand = Number(inv.total_amount || (subtotal + taxAmt));
  const balanceDue = Number(inv.balance_due || 0);

  const totalsX = pageW - 80;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const totalsRows = [
    ['Subtotal', fmt(subtotal)],
    [`Tax (${taxRate}%)`, fmt(taxAmt)],
  ];
  totalsRows.forEach(([label, value]) => {
    doc.text(label, totalsX, y);
    doc.text(value, pageW - 14, y, { align: 'right' });
    y += 5;
  });

  doc.setDrawColor(180, 180, 180);
  doc.line(totalsX, y - 1, pageW - 14, y - 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text('Grand Total', totalsX, y + 4);
  doc.text(fmt(grand), pageW - 14, y + 4, { align: 'right' });
  y += 10;

  if (balanceDue > 0) {
    doc.setTextColor(163, 27, 50);
    doc.setFontSize(10);
    doc.text('Balance Due', totalsX, y + 4);
    doc.text(fmt(balanceDue), pageW - 14, y + 4, { align: 'right' });
    y += 10;
  }

  // Notes
  if (inv.notes) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Notes:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(inv.notes, 14, y + 5, { maxWidth: pageW - 28 });
  }

  addFooter(doc);
  doc.save(`invoice-${inv.invoice_number || 'download'}.pdf`);
};

// ─── BILL PDF ────────────────────────────────────────────────────────────────
export const downloadBillPDF = (bill) => {
  const company = getCompany();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, 'PURCHASE BILL', bill.bill_number, company);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('SUPPLIER', 14, y);
  doc.text('BILL DETAILS', pageW / 2 + 2, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.text(bill.supplier_name || '', 14, y);

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const dateStr = bill.date ? new Date(bill.date).toLocaleDateString() : '';
  const dueStr = bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '';
  doc.text(`Bill Date: ${dateStr}`, pageW / 2 + 2, y);
  y += 5;
  doc.text(`Due Date:  ${dueStr}`, pageW / 2 + 2, y);
  y += 5;

  const statusColors = { paid: [22, 101, 52], overdue: [153, 27, 27], partial: [146, 64, 14], unpaid: [107, 114, 128] };
  const sc = statusColors[bill.status] || [107, 114, 128];
  doc.setTextColor(...sc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Status: ${(bill.status || 'unpaid').toUpperCase()}`, pageW / 2 + 2, y);

  y += 8;

  const items = (bill.items || []).filter(it => it && it.description);
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: items.map(it => [
      it.description,
      Number(it.quantity || 0).toLocaleString(),
      fmt(it.unit_price || 0),
      fmt(it.amount || it.total || ((it.quantity || 0) * (it.unit_price || 0))),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [163, 27, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 6;

  const subtotal = items.reduce((s, it) => s + Number(it.amount || it.total || ((it.quantity || 0) * (it.unit_price || 0))), 0);
  const taxRate = Number(bill.tax_rate || 0);
  const taxAmt = (subtotal * taxRate) / 100;
  const grand = Number(bill.total_amount || (subtotal + taxAmt));
  const balanceDue = Number(bill.balance_due || 0);

  const totalsX = pageW - 80;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  [['Subtotal', fmt(subtotal)], [`Tax (${taxRate}%)`, fmt(taxAmt)]].forEach(([label, value]) => {
    doc.text(label, totalsX, y);
    doc.text(value, pageW - 14, y, { align: 'right' });
    y += 5;
  });

  doc.setDrawColor(180, 180, 180);
  doc.line(totalsX, y - 1, pageW - 14, y - 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text('Grand Total', totalsX, y + 4);
  doc.text(fmt(grand), pageW - 14, y + 4, { align: 'right' });
  y += 10;

  if (balanceDue > 0) {
    doc.setTextColor(163, 27, 50);
    doc.setFontSize(10);
    doc.text('Balance Due', totalsX, y + 4);
    doc.text(fmt(balanceDue), pageW - 14, y + 4, { align: 'right' });
    y += 10;
  }

  if (bill.notes) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Notes:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.notes, 14, y + 5, { maxWidth: pageW - 28 });
  }

  addFooter(doc);
  doc.save(`bill-${bill.bill_number || 'download'}.pdf`);
};

// ─── PAYSLIP PDF ─────────────────────────────────────────────────────────────
export const downloadPayslipPDF = (payslip, run) => {
  const company = getCompany();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  const MONTHS = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  const month = run?.pay_period || (run?.month ? MONTHS[(run.month || 1) - 1] + ' ' + run.year : '');

  // Header bar
  doc.setFillColor(163, 27, 50);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Payslip', 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pay Period: ${month}`, 14, 21);
  doc.text(company.name || '', pageW - 14, 13, { align: 'right' });
  if (run?.pay_date) {
    doc.text(`Pay Date: ${new Date(run.pay_date).toLocaleDateString()}`, pageW - 14, 21, { align: 'right' });
  }

  let y = 36;

  // Employee info grid
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const infoItems = [
    ['Employee Name', payslip.employee_name || payslip.full_name || ''],
    ['Employee #', payslip.employee_number || '—'],
    ['Department', payslip.department || '—'],
    ['Position', payslip.position || '—'],
  ];
  infoItems.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 14 : pageW / 2 + 5;
    const rowY = y + Math.floor(i / 2) * 12;
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');
    doc.text(label.toUpperCase(), x, rowY);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(String(value), x, rowY + 5);
    doc.setFontSize(8);
  });

  y += 30;

  doc.setDrawColor(220, 220, 220);
  doc.line(14, y, pageW - 14, y);
  y += 6;

  // Earnings & Deductions side by side
  const gross = Number(payslip.gross_salary || payslip.gross_pay || payslip.basic_salary || 0);
  const paye = Number(payslip.paye || 0);
  const nssf = Number(payslip.nssf || 0);
  const nhif = Number(payslip.nhif || 0);
  const housing = Number(payslip.housing_levy || payslip.other_deductions || 0) || Math.round(gross * 0.015);
  const totalDed = paye + nssf + nhif + housing;
  const net = Number(payslip.net_salary || payslip.net_pay || (gross - totalDed));

  const halfW = (pageW - 28) / 2;

  // Earnings box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text('EARNINGS', 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['Description', 'Amount']],
    body: [
      ['Basic Salary', fmt(gross)],
      ['Gross Pay', fmt(gross)],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: pageW / 2 + 2 },
    tableWidth: halfW,
  });

  const earningsEndY = doc.lastAutoTable.finalY;

  // Deductions box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(185, 28, 28);
  doc.text('DEDUCTIONS', pageW / 2 + 5, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['Description', 'Amount']],
    body: [
      ['PAYE (Income Tax)', fmt(paye)],
      ['NSSF (Pension)', fmt(nssf)],
      ['NHIF / SHA (Health)', fmt(nhif)],
      ['Housing Levy (1.5%)', fmt(housing)],
      ['Total Deductions', fmt(totalDed)],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 1: { halign: 'right' } },
    bodyStyles: {},
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [185, 28, 28];
      }
    },
    margin: { left: pageW / 2 + 5, right: 14 },
    tableWidth: halfW,
  });

  y = Math.max(earningsEndY, doc.lastAutoTable.finalY) + 8;

  // Net Pay box
  doc.setFillColor(240, 249, 240);
  doc.setDrawColor(34, 197, 94);
  doc.roundedRect(14, y, pageW - 28, 16, 3, 3, 'FD');
  doc.setTextColor(21, 128, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('NET PAY', 20, y + 10);
  doc.setFontSize(14);
  doc.text(fmt(net), pageW - 20, y + 10, { align: 'right' });

  y += 24;

  // Signature lines
  const sigY = y + 16;
  const sigPositions = [14, pageW / 2 - 20, pageW - 60];
  const sigLabels = ['Employee Signature', 'HR / Payroll Officer', 'Finance Director'];
  sigPositions.forEach((x, i) => {
    doc.setDrawColor(150, 150, 150);
    doc.line(x, sigY, x + 52, sigY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(sigLabels[i], x + 26, sigY + 5, { align: 'center' });
  });

  addFooter(doc, `CONFIDENTIAL — ${payslip.employee_name || payslip.full_name || ''} only`);
  doc.save(`payslip-${(payslip.employee_name || payslip.full_name || 'employee').replace(/\s+/g, '-')}.pdf`);
};

// ─── GENERIC FINANCIAL PDF ───────────────────────────────────────────────────
export const downloadFinancialPDF = (title, data, columns) => {
  const company = getCompany();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = addHeader(doc, title, new Date().toLocaleDateString(), company);

  autoTable(doc, {
    startY: y,
    head: [columns.map(c => c.label)],
    body: (data || []).map(row => columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val !== '')) {
        return Number(val).toLocaleString();
      }
      return String(val);
    })),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [163, 27, 50], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, `${company.name || 'Your Company'} — ${title}`);
  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
};
