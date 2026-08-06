/**
 * services/zatca/Signer.js
 *
 * Orchestrates the full invoice signing flow using zatca-xml-js signing library
 * to guarantee 100% ZATCA compliant XAdES-BES signature and SignedProperties digest.
 */

import { createRequire } from 'module';
import { buildInvoiceXml, money } from './XMLBuilder.js';

const require = createRequire(import.meta.url);
const { generateSignedXMLString } = require('zatca-xml-js/lib/zatca/signing');
const { XMLDocument } = require('zatca-xml-js/lib/parser');

/**
 * Returns current date/time in Saudi Arabia timezone (UTC+3)
 * formatted as { date: 'YYYY-MM-DD', time: 'HH:MM:SS' }.
 * ZATCA servers run in Saudi Arabia (AST, UTC+3).
 */
function getSaudiDateTime() {
    const now = new Date();
    const saudiOffset = 3 * 60; // minutes
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const saudiMs = utcMs + (saudiOffset * 60000);
    const saudi = new Date(saudiMs);
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${saudi.getFullYear()}-${pad(saudi.getMonth() + 1)}-${pad(saudi.getDate())}`;
    const time = `${pad(saudi.getHours())}:${pad(saudi.getMinutes())}:${pad(saudi.getSeconds())}`;
    return { date, time };
}

/**
 * Formats "issue_date" + "issue_time" into ZATCA's expected timestamp.
 */
function toSigningTimestamp(issueDate, issueTime) {
    return `${issueDate}T${issueTime}`;
}

/**
 * Signs a complete invoice end-to-end.
 *
 * @param {object} invoice - see XMLBuilder.buildInvoiceXml
 * @param {object} egsUnit - see XMLBuilder.buildInvoiceXml
 * @param {string} certificatePem - the Compliance/Production CSID certificate
 * @param {string} privateKeyPem - the EGS's own EC private key (SEC1 PEM)
 * @returns {{ signedInvoiceXml: string, invoiceHash: string, qr: string, totals: object }}
 */
function signInvoice(invoice, egsUnit, certificatePem, privateKeyPem) {
    const { xml: rawUnsignedXml, totals } = buildInvoiceXml(invoice, egsUnit);

    const unsignedXml = rawUnsignedXml
        .replace('__UBL_EXTENSIONS_PLACEHOLDER__', 'SET_UBL_EXTENSIONS_STRING')
        .replace('__QR_PLACEHOLDER__', 'SET_QR_CODE_DATA');

    const invoice_xml = new XMLDocument(unsignedXml);

    const { signed_invoice_string, invoice_hash, qr } = generateSignedXMLString({
        invoice_xml,
        certificate_string: certificatePem,
        private_key_string: privateKeyPem,
    });

    return {
        signedInvoiceXml: signed_invoice_string,
        invoiceHash: invoice_hash,
        qr,
        totals
    };
}

export { signInvoice, toSigningTimestamp, getSaudiDateTime };
