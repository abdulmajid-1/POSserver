/**
 * services/zatca/CertificateManager.js
 *
 * Thin wrapper around utils/crypto.js for CSR generation and certificate
 * parsing — equivalent to the certificate-related parts of ZATCA\EGS and
 * ZATCA\ZATCASimplifiedTaxInvoice (PHP).
 */

import {
  generateSecp256k1KeyPair,
  generateCSR,
  getCertificateInfo,
  cleanUpPemBody,
} from '../../utils/crypto.js';

/**
 * Generates a new EC key pair + CSR for onboarding (Compliance CSID step).
 *
 * @param {object} egsUnit - EGS unit info (see utils/crypto.js buildCsrConfig)
 * @param {string} solutionName - free-text solution/provider name (e.g. your app name)
 * @param {boolean} production - false for sandbox/compliance CSID, true for production CSID
 * @returns {{ privateKey: string, csr: string }}
 */
function generateNewKeysAndCSR(egsUnit, solutionName, production = false) {
  const privateKey = generateSecp256k1KeyPair();
  const csr = generateCSR(egsUnit, solutionName, privateKey, production);
  return { privateKey, csr };
}

/**
 * Extracts hash/issuer/serial/public key/signature from an issued
 * certificate (Compliance or Production CSID), needed for building the
 * XAdES signature and QR code on every invoice.
 */
function inspectCertificate(certificatePem) {
  return getCertificateInfo(certificatePem);
}

/** Strips PEM armor, returning the continuous base64 certificate body. */
function certificateBody(certificatePem) {
  return cleanUpPemBody(certificatePem);
}

export { generateNewKeysAndCSR, inspectCertificate, certificateBody };
