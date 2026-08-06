import EGS from './EGS.js';
import { Sale } from '../../models/Sale.js';
import { Counter } from '../../models/Counter.js';

/**
 * services/zatca/ZatcaService.js
 *
 * Centralized service to manage ZATCA E-Invoicing integration,
 * dynamic configuration loading, ICV counter locking, PIH hash chaining,
 * invoice signing, and submission to ZATCA portal.
 *
 * Invoice type is auto-detected:
 *   - sale.customer.vatNumber present  → B2B Standard Invoice  → Clearance API
 *   - sale.customer.vatNumber absent   → B2C Simplified Invoice → Reporting API
 */

/**
 * Builds the EGS Unit configuration dynamically from environment variables.
 */
export function getEgsConfig() {
  return {
    uuid: process.env.ZATCA_EGS_UUID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    custom_id: process.env.ZATCA_CUSTOM_ID || 'EGS1-886431145',
    model: process.env.ZATCA_EGS_MODEL || '1.0',
    CRN_number: process.env.ZATCA_CRN_NUMBER || '7026093257',
    VAT_name: process.env.ZATCA_VAT_NAME || 'Ewan Al-Hazm Trading Establishment',
    VAT_number: process.env.ZATCA_VAT_NUMBER || '314852932200003',
    location: {
      city: process.env.ZATCA_LOCATION_CITY || 'Al-Kharj',
      city_subdivision: process.env.ZATCA_LOCATION_SUBDIVISION || 'As Saadah',
      street: process.env.ZATCA_LOCATION_STREET || 'As Saadah',
      plot_identification: process.env.ZATCA_LOCATION_PLOT || '0000',
      building: process.env.ZATCA_LOCATION_BUILDING || '0000',
      postal_zone: process.env.ZATCA_LOCATION_POSTAL_ZONE || '16443',
    },
    branch_name: process.env.ZATCA_BRANCH_NAME || 'Main Branch',
    branch_industry: process.env.ZATCA_BRANCH_INDUSTRY || 'Retail',
    cancelation: { cancelation_type: 'INVOICE', canceled_invoice_number: '' },
  };
}

/**
 * Atomically increments and gets the next Invoice Counter Value (ICV).
 */
export async function getNextIcv() {
  const counter = await Counter.findOneAndUpdate(
    { key: 'zatca_icv' },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return counter.seq;
}

/**
 * Gets the Previous Invoice Hash (PIH) from the last successfully
 * reported or cleared ZATCA invoice. Falls back to the initial seed PIH.
 */
export async function getLastReportedPih() {
  const lastSale = await Sale.findOne({
    'zatca.reportingStatus': { $in: ['REPORTED', 'CLEARED'] },
  })
    .sort({ 'zatca.icv': -1, createdAt: -1 })
    .exec();

  if (lastSale && lastSale.zatca && lastSale.zatca.invoiceHash) {
    return lastSale.zatca.invoiceHash;
  }

  // Fallback to initial seed PIH configured in .env
  return (
    process.env.ZATCA_INITIAL_PIH ||
    'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ=='
  );
}

/**
 * Formats date and time into ZATCA's expected ISO format (YYYY-MM-DD and HH:MM:SS)
 * using Saudi Arabia local time (UTC+3 / AST, no DST).
 */
function formatZatcaTimestamp(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  // Saudi Arabia is always UTC+3 (no DST)
  const saudiOffsetMs = 3 * 60 * 60 * 1000;
  const saudiMs = d.getTime() + (d.getTimezoneOffset() * 60 * 1000) + saudiOffsetMs;
  const saudi = new Date(saudiMs);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    issueDate: `${saudi.getFullYear()}-${pad(saudi.getMonth() + 1)}-${pad(saudi.getDate())}`,
    issueTime: `${pad(saudi.getHours())}:${pad(saudi.getMinutes())}:${pad(saudi.getSeconds())}`,
  };
}

/**
 * Detects whether the sale is a B2B (Standard Invoice) or B2C (Simplified Invoice).
 * Rule: a customer with a VAT number = B2B business transaction.
 */
function detectInvoiceSubType(sale) {
  // If CSID is configured as 0100 (Simplified Tax Invoices only),
  // B2B Standard Clearance is not supported by ZATCA on this CSID.
  // All invoices must be formatted and reported as B2C (Simplified).
  const invoiceTypeSetting = process.env.CSR_INVOICE_TYPE || process.env.ZATCA_INVOICE_TYPE || '0100';
  if (invoiceTypeSetting === '0100') {
    return 'B2C';
  }

  const vatNumber = sale.customer && sale.customer.vatNumber;
  return vatNumber && vatNumber.trim() ? 'B2B' : 'B2C';
}

/**
 * Converts a POS Sale document to the ZATCA invoice JSON structure.
 * Auto-detects B2C vs B2B and populates buyer details accordingly.
 */
export function buildZatcaInvoicePayload(sale, icv, pih, egsConfig) {
  const { issueDate, issueTime } = formatZatcaTimestamp(sale.createdAt || new Date());

  const invoiceSubType = detectInvoiceSubType(sale);

  const lineItems = (sale.items || []).map((item, idx) => {
    // Use sale.taxRate directly — 0 means no VAT (don't default to 0.15 when explicitly 0)
    const vatRate = (sale.taxRate != null ? sale.taxRate : 15) / 100;

    // Convert percentage discounts to fixed SAR amounts for ZATCA
    let discounts = [];
    if (item.discount && item.discount > 0) {
      const base = Number(item.unitPrice) * Number(item.quantity);
      const fixedDiscountAmount =
        item.discountType === 'percentage'
          ? (base * item.discount) / 100
          : Number(item.discount);
      if (fixedDiscountAmount > 0) {
        discounts = [{ amount: fixedDiscountAmount, reason: 'Item Discount' }];
      }
    }

    return {
      id: String(idx + 1),
      name: item.productName || 'General Item',
      quantity: Number(item.quantity) || 1,
      tax_exclusive_price: Number(item.unitPrice) || 0,
      VAT_percent: vatRate,
      other_taxes: [],
      discounts,
    };
  });

  // Ensure at least 1 line item exists if sale has no items
  if (lineItems.length === 0) {
    const vatRate = (sale.taxRate != null ? sale.taxRate : 15) / 100;
    lineItems.push({
      id: '1',
      name: 'General Sale Item',
      quantity: 1,
      tax_exclusive_price: sale.subtotal || sale.total || 0,
      VAT_percent: vatRate,
      other_taxes: [],
      discounts: [],
    });
  }

  // Build buyer block for B2B invoices
  let buyer = null;
  if (invoiceSubType === 'B2B' && sale.customer) {
    buyer = {
      name: sale.customer.name || 'Business Customer',
      vatNumber: sale.customer.vatNumber,
      street: sale.customer.street || 'N/A',
      city: sale.customer.city || 'N/A',
      postalZone: sale.customer.postalZone || '00000',
      countryCode: 'SA',
    };
  }

  return {
    invoice_serial_number: `${egsConfig.custom_id}-${icv}`,
    issue_date: issueDate,
    issue_time: issueTime,
    invoice_counter_number: icv,
    previous_invoice_hash: pih,
    invoiceSubType,   // 'B2C' | 'B2B' — controls template type code + buyer block
    buyer,            // null for B2C, populated for B2B
    line_items: lineItems,
  };
}

/**
 * Core Service Method: Reports or clears a sale with ZATCA Phase 2 E-Invoicing.
 *
 * In PRODUCTION: reads credentials from .env (ZATCA_CERTIFICATE_PEM, ZATCA_SECRET, ZATCA_PRIVATE_KEY_PEM).
 * In SANDBOX:    generates a fresh key pair + CSR, exchanges the OTP for a Compliance CSID.
 *
 * @param {string} saleId - MongoDB Sale ObjectId
 * @param {string} [otp]  - OTP for sandbox/developer-portal testing (ignored in production)
 */
export async function reportSaleToZatca(saleId, otp = '12345') {
  const sale = await Sale.findById(saleId);
  if (!sale) {
    throw new Error(`Sale not found with ID: ${saleId}`);
  }

  // Idempotency: already fully processed — return as-is
  const alreadyDone = sale.zatca &&
    (sale.zatca.reportingStatus === 'REPORTED' || sale.zatca.reportingStatus === 'CLEARED');
  if (alreadyDone) {
    return sale;
  }

  const egsConfig = getEgsConfig();
  const egs = new EGS(egsConfig);

  const isProduction = (process.env.ZATCA_ENV || '').toLowerCase() === 'production';

  let binarySecurityToken;
  let secret;
  let privateKey;

  if (isProduction || (process.env.ZATCA_CERTIFICATE_PEM && process.env.ZATCA_SECRET && process.env.ZATCA_PRIVATE_KEY_PEM)) {
    binarySecurityToken = (process.env.ZATCA_CERTIFICATE_PEM || '').replace(/\\n/g, '\n');
    secret = (process.env.ZATCA_SECRET || '').trim();
    privateKey = (process.env.ZATCA_PRIVATE_KEY_PEM || '').replace(/\\n/g, '\n');

    if (!binarySecurityToken || !secret || !privateKey) {
      throw new Error('ZATCA Production Credentials missing in .env. Please check ZATCA_CERTIFICATE_PEM, ZATCA_SECRET, and ZATCA_PRIVATE_KEY_PEM.');
    }
  } else {
    // Sandbox / Testing OTP onboarding flow
    const { privateKey: genKey, csr } = egs.generateNewKeysAndCSR('POSserver');
    const compCert = await egs.issueComplianceCertificate(otp, csr);
    binarySecurityToken = compCert.binarySecurityToken;
    secret = compCert.secret;
    privateKey = genKey;
  }

  // 2. Get Next ICV & Previous Invoice Hash (maintains invoice chain)
  const icv = await getNextIcv();
  const pih = await getLastReportedPih();

  // 3. Build invoice payload (auto-detects B2C vs B2B)
  const invoicePayload = buildZatcaInvoicePayload(sale, icv, pih, egsConfig);
  const invoiceSubType = invoicePayload.invoiceSubType; // 'B2C' | 'B2B'

  // 4. Sign the invoice locally (builds XML, hashes, signs with private key)
  const { signedInvoiceXml, invoiceHash, qr, digitalSignature } = egs.signInvoice(
    invoicePayload,
    binarySecurityToken,
    privateKey
  );

  // 5. Submit to ZATCA — route based on environment and invoice type
  let zatcaResult;
  let reportingStatus = 'FAILED';
  let clearedXml = null;
  let clearanceStatus = null;

  try {
    if (!isProduction) {
      // --- SANDBOX / TESTING MODE ---
      // In Sandbox mode using a Compliance CSID (OTP), ZATCA requires all invoices
      // (both B2B and B2C) to be checked via /compliance/invoices.
      zatcaResult = await egs.checkInvoiceCompliance(
        signedInvoiceXml,
        invoiceHash,
        binarySecurityToken,
        secret
      );

      const hasErrors = zatcaResult.validationResults?.errorMessages?.length > 0;
      if (!hasErrors) {
        reportingStatus = invoiceSubType === 'B2B' ? 'CLEARED' : 'REPORTED';
        clearanceStatus = zatcaResult.clearanceStatus || (invoiceSubType === 'B2B' ? 'CLEARED' : null);
      }
    } else {
      // --- PRODUCTION MODE ---
      if (invoiceSubType === 'B2B') {
        try {
          zatcaResult = await egs.clearInvoice(
            signedInvoiceXml,
            invoiceHash,
            binarySecurityToken,
            secret
          );
          clearanceStatus = zatcaResult.clearanceStatus;
          const hasErrors = zatcaResult.validationResults?.errorMessages?.length > 0;
          if (!hasErrors) {
            reportingStatus = 'CLEARED';
            clearedXml = zatcaResult.clearedInvoiceXml || null;
          }
        } catch (clearErr) {
          if (clearErr.message && (clearErr.message.includes('does not cover Standard documents') || clearErr.message.includes('certificate-permissions'))) {
            // Fallback to B2C Simplified Reporting API if CSID is 0100
            zatcaResult = await egs.reportInvoice(
              signedInvoiceXml,
              invoiceHash,
              binarySecurityToken,
              secret
            );
            const hasErrors = zatcaResult.validationResults?.errorMessages?.length > 0;
            if (!hasErrors) {
              reportingStatus = 'REPORTED';
            }
          } else {
            throw clearErr;
          }
        }
      } else {
        zatcaResult = await egs.reportInvoice(
          signedInvoiceXml,
          invoiceHash,
          binarySecurityToken,
          secret
        );
        const hasErrors = zatcaResult.validationResults?.errorMessages?.length > 0;
        if (!hasErrors) {
          reportingStatus = 'REPORTED';
        }
      }
    }
  } catch (err) {
    zatcaResult = { error: err.message };
    reportingStatus = 'FAILED';
    throw err;
  } finally {
    // 6. Persist all ZATCA data to the Sale document regardless of outcome
    sale.zatca = {
      icv,
      invoiceSerialNumber: invoicePayload.invoice_serial_number,
      invoiceUUID: egsConfig.uuid,
      invoiceType: invoiceSubType,
      pih,
      invoiceHash,
      digitalSignature: digitalSignature || null,
      qrCode: qr,
      signedXml: signedInvoiceXml,
      clearedXml,
      reportingStatus,
      clearanceStatus,
      validationResults: zatcaResult,
      submittedAt: new Date(),
    };
    await sale.save();
  }

  return sale;
}
