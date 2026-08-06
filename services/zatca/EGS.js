/**
 * services/zatca/EGS.js
 *
 * Ported from ZATCA\EGS (PHP). Top-level orchestrator matching the
 * original public interface:
 *   const egs = new EGS(egsUnit);
 *   const { privateKey, csr } = egs.generateNewKeysAndCSR('MyPOS');
 *   const { requestID, binarySecurityToken, secret } = await egs.issueComplianceCertificate(otp, csr);
 *   const { signedInvoiceXml, invoiceHash, qr } = egs.signInvoice(invoice, binarySecurityToken, privateKey);
 *
 *   // B2C — report after giving the invoice to the customer
 *   const result = await egs.reportInvoice(signedInvoiceXml, invoiceHash, binarySecurityToken, secret);
 *
 *   // B2B — must clear BEFORE giving the invoice to the buyer
 *   const result = await egs.clearInvoice(signedInvoiceXml, invoiceHash, binarySecurityToken, secret);
 */

import { generateNewKeysAndCSR } from './CertificateManager.js';
import { signInvoice } from './Signer.js';
import * as api from './API.js';

class EGS {
    /**
     * @param {object} egsInfo - {
     *   uuid, custom_id, model, CRN_number, VAT_name, VAT_number,
     *   location: { city, city_subdivision, street, plot_identification, building, postal_zone },
     *   branch_name, branch_industry,
     *   cancelation: { cancelation_type: 'INVOICE'|'CREDIT_NOTE'|'DEBIT_NOTE', canceled_invoice_number }
     * }
     */
    constructor(egsInfo) {
        this.egsInfo = egsInfo;
        this.production = false;
    }

    /** Step 0: generate a private key + CSR for onboarding. */
    generateNewKeysAndCSR(solutionName) {
        return generateNewKeysAndCSR(this.egsInfo, solutionName, this.production);
    }

    /** Step 1: exchange the CSR + OTP for a Compliance CSID. */
    async issueComplianceCertificate(otp, csrPem) {
        if (!csrPem) throw new Error('EGS needs a CSR first — call generateNewKeysAndCSR().');
        return api.issueComplianceCertificate(csrPem, otp);
    }

    /** Step 1b: exchange the Compliance requestID for a Production CSID. */
    async issueProductionCertificate(complianceRequestID, complianceCertPem, complianceSecret) {
        return api.issueProductionCertificate(complianceRequestID, complianceCertPem, complianceSecret);
    }

    /** Step 2: build + sign an invoice. Synchronous — no network call. */
    signInvoice(invoice, certificatePem, privateKeyPem) {
        return signInvoice(invoice, this.egsInfo, certificatePem, privateKeyPem);
    }

    /** Step 3 (compliance check only — sandbox testing): validates format without real reporting. */
    async checkInvoiceCompliance(signedInvoiceXml, invoiceHash, certificatePem, secret) {
        if (!certificatePem || !secret) {
            throw new Error('EGS is missing a certificate/secret to check invoice compliance.');
        }
        return api.checkInvoiceCompliance(signedInvoiceXml, invoiceHash, this.egsInfo.uuid, certificatePem, secret);
    }

    /**
     * B2C Reporting: submit simplified invoice to ZATCA after giving to customer.
     * Uses POST /invoices/reporting/single
     */
    async reportInvoice(signedInvoiceXml, invoiceHash, certificatePem, secret) {
        if (!certificatePem || !secret) {
            throw new Error('EGS is missing a certificate/secret to report the invoice.');
        }
        return api.reportInvoice(signedInvoiceXml, invoiceHash, this.egsInfo.uuid, certificatePem, secret);
    }

    /**
     * B2B Clearance: submit standard invoice to ZATCA BEFORE giving to buyer.
     * ZATCA returns a stamped XML that must be given to the buyer instead.
     * Uses POST /invoices/clearance/single
     */
    async clearInvoice(signedInvoiceXml, invoiceHash, certificatePem, secret) {
        if (!certificatePem || !secret) {
            throw new Error('EGS is missing a certificate/secret to clear the invoice.');
        }
        return api.clearInvoice(signedInvoiceXml, invoiceHash, this.egsInfo.uuid, certificatePem, secret);
    }
}

export default EGS;
