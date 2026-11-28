const PDFDocument = require('pdfkit');
const pool = require('../db');
const { uploadToCloudinary } = require('./upload');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function generateCertificate(purchaseId) {
  const result = await pool.query(
    `SELECT pr.id, pr.purchase_date, pr.units_purchased, pr.status,
            p.title AS project_title, p.location, p.unit_label,
            b.name AS business_name
       FROM purchase_records pr
       JOIN offset_projects p ON p.id = pr.project_id
       JOIN users b ON b.id = pr.business_id
      WHERE pr.id = $1`,
    [purchaseId]
  );

  if (result.rows.length === 0) {
    throw createError('Purchase not found', 404);
  }

  const purchase = result.rows[0];

  // Approval sets the purchase to verified before generating its certificate.
  if (!['verified', 'certified'].includes(purchase.status)) {
    throw createError('A certificate can only be generated for an approved purchase', 409);
  }

  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  const chunks = [];

  const pdfBufferPromise = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc
    .font('Helvetica-Bold')
    .fontSize(24)
    .fillColor('#246b45')
    .text('RootProof', { align: 'center' });

  doc.moveDown(0.5);
  doc
    .fontSize(19)
    .fillColor('#222222')
    .text('Certificate of Environmental Contribution', { align: 'center' });

  doc.moveDown(2);
  doc
    .font('Helvetica')
    .fontSize(13)
    .text('This certifies that', { align: 'center' });

  doc.moveDown(0.5);
  doc
    .font('Helvetica-Bold')
    .fontSize(21)
    .text(purchase.business_name, { align: 'center' });

  doc.moveDown(0.75);
  doc
    .font('Helvetica')
    .fontSize(13)
    .text('made a verified contribution to the following environmental project:', {
      align: 'center',
    });

  doc.moveDown(1.5);
  doc
    .font('Helvetica-Bold')
    .fontSize(17)
    .text(purchase.project_title, { align: 'center' });

  doc.moveDown(0.5);
  doc
    .font('Helvetica')
    .fontSize(12)
    .text(`Location: ${purchase.location || 'Not specified'}`, { align: 'center' });

  doc.moveDown(2);

  const purchaseDate = new Date(purchase.purchase_date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const details = [
    ['Units supported', `${purchase.units_purchased} ${purchase.unit_label || 'units'}`],
    ['Purchase date', purchaseDate],
    ['Certificate number', purchase.id.slice(0, 8).toUpperCase()],
  ];

  for (const [label, value] of details) {
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value);
    doc.moveDown(0.6);
  }

  doc.end();

  const pdfBuffer = await pdfBufferPromise;
  return uploadToCloudinary(pdfBuffer, 'application/pdf');
}

module.exports = { generateCertificate };