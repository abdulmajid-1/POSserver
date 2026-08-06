/**
 * services/zatca/API.js
 *
 * Ported from ZATCA\API (PHP) using axios instead of curl.
 * Sandbox (developer portal) endpoints only — matches what the PHP
 * source implements. Production endpoints differ (see note below) and
 * are NOT included here since the source didn't cover them either;
 * flagging this so it isn't mistaken for a complete production client.
 */

import axios from 'axios';

function getBaseUrl() {
    const env = (process.env.ZATCA_ENV || 'developer-portal').toLowerCase();
    if (env === 'production' || env === 'prod') {
        return 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core';
    }
    if (env === 'simulation' || env === 'sim') {
        return 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation';
    }
    return 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';
}

const API_VERSION = 'V2';

/**
 * Builds the HTTP Basic auth header ZATCA expects: base64(base64(cert):secret)
 * — yes, the certificate is base64-encoded TWICE (once because that's the
 * raw cert-to-username transform ZATCA specifies, once more because HTTP
 * Basic auth itself base64-encodes "username:password"). This matches the
 * PHP source exactly and is a genuine ZATCA API requirement, not a bug.
 */
function getAuthHeaders(certificatePem, secret) {
    if (!certificatePem || !secret) return {};
    const certBody = certificatePem
        .replace(/\\n/g, '\n')
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .trim();
    const certBase64 = Buffer.from(certBody, 'utf8').toString('base64');
    const basic = Buffer.from(`${certBase64}:${secret}`, 'utf8').toString('base64');
    return { Authorization: `Basic ${basic}` };
}

/**
 * Helper to wrap network requests and produce human-readable network error messages.
 */
async function safeApiCall(fn) {
    try {
        return await fn();
    } catch (err) {
        if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
            throw new Error('Network Error: Could not resolve ZATCA server (gw-fatoora.zatca.gov.sa). Please check your internet connection.');
        }
        if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
            throw new Error('Network Error: Connection to ZATCA server timed out or was refused. Please try again in a moment.');
        }
        throw err;
    }
}

/**
 * Step 1 of onboarding: exchange a CSR + OTP for a Compliance CSID.
 * @returns {{ requestID: string, binarySecurityToken: string, secret: string }}
 *   binarySecurityToken is returned already wrapped in PEM armor.
 */
async function issueComplianceCertificate(csrPem, otp) {
    return safeApiCall(async () => {
        const response = await axios.post(
            `${getBaseUrl()}/compliance`,
            { csr: Buffer.from(csrPem, 'utf8').toString('base64') },
            {
                headers: {
                    'Accept-Version': API_VERSION,
                    OTP: otp,
                    'Content-Type': 'application/json',
                },
                validateStatus: () => true,
            }
        );

        if (response.status !== 200) {
            throw new Error(
                `Error issuing compliance certificate (HTTP ${response.status}): ${JSON.stringify(response.data)}`
            );
        }

        const data = response.data;
        const issuedCertificateBody = Buffer.from(data.binarySecurityToken, 'base64').toString('utf8');
        return {
            requestID: data.requestID,
            binarySecurityToken: `-----BEGIN CERTIFICATE-----\n${issuedCertificateBody}\n-----END CERTIFICATE-----`,
            secret: data.secret,
            rawToken: data.binarySecurityToken,
        };
    });
}

/**
 * Step 2 of onboarding: exchange a compliance requestID for a Production CSID.
 * @returns {{ binarySecurityToken: string, secret: string, rawToken: string }}
 */
async function issueProductionCertificate(complianceRequestID, complianceCertPem, complianceSecret) {
    return safeApiCall(async () => {
        const response = await axios.post(
            `${getBaseUrl()}/production/csids`,
            { compliance_request_id: String(complianceRequestID) },
            {
                headers: {
                    'Accept-Version': API_VERSION,
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(complianceCertPem, complianceSecret),
                },
                validateStatus: () => true,
            }
        );

        if (response.status !== 200) {
            throw new Error(
                `Error issuing production certificate (HTTP ${response.status}): ${JSON.stringify(response.data)}`
            );
        }

        const data = response.data;
        const issuedCertificateBody = Buffer.from(data.binarySecurityToken, 'base64').toString('utf8');
        return {
            binarySecurityToken: `-----BEGIN CERTIFICATE-----\n${issuedCertificateBody}\n-----END CERTIFICATE-----`,
            secret: data.secret,
            rawToken: data.binarySecurityToken,
        };
    });
}

/**
 * Step 2 of onboarding: submit a signed invoice for a compliance check
 * against ZATCA's validator (does NOT report the invoice for real).
 */
async function checkInvoiceCompliance(signedInvoiceXml, invoiceHash, uuid, certificatePem, secret) {
    if (!certificatePem || !secret) {
        throw new Error('checkInvoiceCompliance requires a certificate and secret from issueComplianceCertificate()');
    }

    return safeApiCall(async () => {
        const response = await axios.post(
            `${getBaseUrl()}/compliance/invoices`,
            {
                invoiceHash,
                uuid,
                invoice: Buffer.from(signedInvoiceXml, 'utf8').toString('base64'),
            },
            {
                headers: {
                    'Accept-Version': API_VERSION,
                    'Accept-Language': 'en',
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(certificatePem, secret),
                },
                validateStatus: () => true,
            }
        );

        if (response.status !== 200 && response.status !== 202) {
            throw new Error(`Error in compliance check (HTTP ${response.status}): ${JSON.stringify(response.data)}`);
        }

        return response.data;
    });
}

/**
 * B2C Reporting: submit a single simplified invoice to ZATCA for reporting.
 * ZATCA records it and returns a validation result.
 * Call this AFTER giving the invoice to the customer.
 *
 * @returns {{ reportingStatus: string, validationResults: object }}
 */
async function reportInvoice(signedInvoiceXml, invoiceHash, uuid, certificatePem, secret) {
    if (!certificatePem || !secret) {
        throw new Error('reportInvoice requires a certificate and secret.');
    }

    return safeApiCall(async () => {
        const response = await axios.post(
            `${getBaseUrl()}/invoices/reporting/single`,
            {
                invoiceHash,
                uuid,
                invoice: Buffer.from(signedInvoiceXml, 'utf8').toString('base64'),
            },
            {
                headers: {
                    'Accept-Version': API_VERSION,
                    'Accept-Language': 'en',
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(certificatePem, secret),
                },
                validateStatus: () => true,
            }
        );

        // ZATCA returns 200 (REPORTED) or 202 (warnings but accepted)
        if (response.status !== 200 && response.status !== 202) {
            throw new Error(
                `Error in B2C reporting (HTTP ${response.status}): ${JSON.stringify(response.data)}`
            );
        }

        return response.data;
    });
}

/**
 * B2B Clearance: submit a single standard invoice to ZATCA for clearance.
 * ZATCA validates AND stamps the XML — you MUST give the buyer the
 * stamped XML (clearedInvoice), NOT your original signed version.
 *
 * @returns {{ reportingStatus: string, clearanceStatus: string,
 *             clearedInvoice: string (base64 stamped XML) }}
 */
async function clearInvoice(signedInvoiceXml, invoiceHash, uuid, certificatePem, secret) {
    if (!certificatePem || !secret) {
        throw new Error('clearInvoice requires a certificate and secret.');
    }

    return safeApiCall(async () => {
        const response = await axios.post(
            `${getBaseUrl()}/invoices/clearance/single`,
            {
                invoiceHash,
                uuid,
                invoice: Buffer.from(signedInvoiceXml, 'utf8').toString('base64'),
            },
            {
                headers: {
                    'Accept-Version': API_VERSION,
                    'Accept-Language': 'en',
                    'Clearance-Status': '1',          // Required header for clearance
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(certificatePem, secret),
                },
                validateStatus: () => true,
            }
        );

        // ZATCA returns 200 (CLEARED) or 202 (cleared with warnings)
        if (response.status !== 200 && response.status !== 202) {
            throw new Error(
                `Error in B2B clearance (HTTP ${response.status}): ${JSON.stringify(response.data)}`
            );
        }

        // Decode the ZATCA-stamped XML from base64
        const data = response.data;
        if (data.clearedInvoice) {
            data.clearedInvoiceXml = Buffer.from(data.clearedInvoice, 'base64').toString('utf8');
        }

        return data;
    });
}

export { issueComplianceCertificate, issueProductionCertificate, checkInvoiceCompliance, getAuthHeaders, reportInvoice, clearInvoice };
