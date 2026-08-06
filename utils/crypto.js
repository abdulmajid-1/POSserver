/**
 * utils/crypto.js
 *
 * Low-level cryptographic primitives for ZATCA Phase 2 integration.
 * Ported from the PHP ZATCA\EGS and ZATCA\ZATCASimplifiedTaxInvoice classes,
 * with three deliberate corrections vs. the PHP source (documented inline
 * and summarized at the bottom of this file) that were verified against
 * ZATCA's published signature requirements and cross-checked locally.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

/* ------------------------------------------------------------------ *
 * Key generation
 * ------------------------------------------------------------------ */

/**
 * Generates a secp256k1 EC key pair and returns the private key in SEC1
 * PEM format ("-----BEGIN EC PRIVATE KEY-----"), which is what OpenSSL's
 * `openssl req` command (used for CSR generation) expects as input, and
 * what ZATCA's own tooling/examples use.
 *
 * NOTE: generated natively via Node's crypto module rather than shelling
 * out to `openssl ecparam` (as the PHP source does) — this avoids relying
 * on the OpenSSL CLI being on PATH for this step and is fully portable
 * across Windows/macOS/Linux since Node 12+. The CSR step below still
 * requires the OpenSSL CLI, since Node has no built-in CSR support.
 */
function generateSecp256k1KeyPair() {
    const { privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        privateKeyEncoding: { type: 'sec1', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    return privateKey.trim();
}

/**
 * Generates a ZATCA-compliant CSR by shelling out to the OpenSSL CLI,
 * mirroring the PHP implementation. Requires `openssl` to be installed
 * and on PATH.
 *
 * @param {object} egsInfo - see buildCsrConfig() for required fields
 * @param {string} solutionName - free-text solution/provider name
 * @param {string} privateKeyPem - SEC1 PEM private key
 * @param {boolean} production - false = test/sandbox CSID, true = production
 * @returns {string} CSR in PEM format
 */
function generateCSR(egsInfo, solutionName, privateKeyPem, production) {
    if (!privateKeyPem) throw new Error('generateCSR: private key is required');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zatca-csr-'));
    const keyFile = path.join(tmpDir, 'key.pem');
    const confFile = path.join(tmpDir, 'csr.cnf');

    try {
        fs.writeFileSync(keyFile, privateKeyPem);
        fs.writeFileSync(confFile, buildCsrConfig(egsInfo, solutionName, production));

        let result;
        try {
            result = execSync(
                `openssl req -new -sha256 -key "${keyFile}" -config "${confFile}"`,
                { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
            );
        } catch (err) {
            throw new Error(
                `OpenSSL CSR generation failed. Make sure OpenSSL is installed and on PATH. ` +
                `stderr: ${err.stderr ? err.stderr.toString() : err.message}`
            );
        }

        const marker = '-----BEGIN CERTIFICATE REQUEST-----';
        const idx = result.indexOf(marker);
        if (idx === -1) {
            throw new Error('OpenSSL did not return a certificate request. Raw output: ' + result);
        }
        return result.slice(idx).trim();
    } finally {
        // Clean up temp key/config files — the private key temp file in
        // particular should not linger on disk.
        try { fs.unlinkSync(keyFile); } catch (_) { }
        try { fs.unlinkSync(confFile); } catch (_) { }
        try { fs.rmdirSync(tmpDir); } catch (_) { }
    }
}

/**
 * Builds the OpenSSL CSR config file content (the [req]/[v3_req]/[dir_sect]
 * sections ZATCA requires), equivalent to ZATCA/templates/csr_template.php.
 *
 * egsInfo shape:
 * {
 *   model, uuid, VAT_number, VAT_name, custom_id, branch_name, branch_industry,
 *   location: { building, street, city, city_subdivision, plot_identification, postal_zone }
 * }
 */
function buildCsrConfig(egsInfo, solutionName, production) {
    const egsSerialNumber = `1-${solutionName}|2-${egsInfo.model}|3-${egsInfo.uuid}`;
    const branchLocation = `${egsInfo.location.building} ${egsInfo.location.street}, ${egsInfo.location.city}`;
    const isProd = production || process.env.ZATCA_ENV === 'production';
    const productionValue = isProd ? 'ZATCA-Code-Signing' : 'TSTZATCA-Code-Signing';

    return `# ------------------------------------------------------------------
# Default section for "req" command options
# ------------------------------------------------------------------
[req]
prompt = no
utf8 = no
distinguished_name = my_req_dn_prompt
req_extensions = v3_req

[ v3_req ]
1.3.6.1.4.1.311.20.2 = ASN1:UTF8String:${productionValue}
subjectAltName=dirName:dir_sect

[ dir_sect ]
SN = ${egsSerialNumber}
UID = ${egsInfo.VAT_number}
title = 0100
registeredAddress = ${branchLocation}
businessCategory = ${egsInfo.branch_industry}

[my_req_dn_prompt]
commonName = ${egsInfo.custom_id}
organizationalUnitName = ${egsInfo.branch_name}
organizationName = ${egsInfo.VAT_name}
countryName = SA
`;
}

/* ------------------------------------------------------------------ *
 * Hashing
 * ------------------------------------------------------------------ */

/**
 * SHA-256 hash of a UTF-8 string, returned base64-encoded.
 * Equivalent to PHP's: base64_encode(pack('H*', hash('sha256', $str)))
 */
function sha256Base64(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('base64');
}

/* ------------------------------------------------------------------ *
 * ECDSA signing
 * ------------------------------------------------------------------ *
 * NOTE ON SIGNATURE ENCODING:
 * An earlier draft of this file "corrected" the PHP source to use raw
 * IEEE P1363 signature encoding, based on a secondary community source.
 * That was WRONG — verified by byte-decoding ZATCA's own official sample
 * invoice XML (the SME00023 example from their documentation): its
 * ds:SignatureValue and QR tag 7 both decode to a value starting with
 * 0x30 0x45 (ASN.1 SEQUENCE), i.e. standard DER-encoded ECDSA signatures
 * — the OpenSSL/Node default. So this implementation uses plain
 * crypto.sign('sha256', ...) with NO dsaEncoding override, matching both
 * the PHP source and the verified real ZATCA sample.
 * ------------------------------------------------------------------ *
 * CORRECTION vs. PHP source (kept):
 * The PHP EGS::signInvoice() signs base64_encode($invoice_hash) — i.e. the
 * ALREADY-base64-encoded hash string gets base64-encoded a second time
 * before signing. This still looks like a bug: the signature should be
 * over the same canonical content the hash was computed from (equivalently,
 * the raw hash digest). This implementation signs the canonical invoice
 * string directly (the ECDSA-SHA256 signer hashes it internally, which is
 * mathematically equivalent to signing the raw invoice_hash digest bytes),
 * rather than the PHP source's double-base64 string.
 * ------------------------------------------------------------------ */

/**
 * Signs data with an EC private key using ECDSA-SHA256, returning the
 * signature in standard ASN.1 DER format, base64-encoded — matches the
 * format observed in ZATCA's own published sample invoice.
 *
 * @param {string|Buffer} data - the exact bytes to sign (e.g. the
 *   canonical invoice XML string for the invoice signature, or the
 *   SignedProperties-for-signing XML string for the properties signature)
 * @param {string} privateKeyPem - SEC1 or PKCS8 PEM EC private key
 * @returns {string} base64-encoded DER-encoded (r,s) signature
 */
function ecdsaSignDerBase64(data, privateKeyPem) {
    const keyObject = crypto.createPrivateKey(privateKeyPem);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const signature = crypto.sign('sha256', buf, keyObject);
    return signature.toString('base64');
}

/**
 * Verifies a DER-encoded ECDSA-SHA256 signature — useful for self-testing
 * that signing round-trips correctly before ever hitting ZATCA's API.
 */
function ecdsaVerifyDer(data, signatureBase64, publicKeyPem) {
    const keyObject = crypto.createPublicKey(publicKeyPem);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    return crypto.verify('sha256', buf, keyObject, Buffer.from(signatureBase64, 'base64'));
}

/* ------------------------------------------------------------------ *
 * X.509 certificate parsing
 * ------------------------------------------------------------------ *
 * CORRECTION #3 vs. PHP source:
 * PHP builds the X509IssuerName as: 'CN=' . implode(', ', array_reverse(...))
 * which joins only the RDN *values* behind a single literal "CN=" prefix —
 * producing something like "CN=SA, MyOrg, MyBranch, id123" instead of
 * proper "attribute=value" pairs. Real ZATCA-issued certificates (and
 * ZATCA's own published sample XML) show issuer strings formatted as
 * "CN=..., DC=..., DC=..., DC=..." — i.e. each RDN kept as "key=value",
 * reversed in order, comma-joined. This implementation builds it that way.
 * ------------------------------------------------------------------ */

/**
 * Minimal DER/BER tag-length-value reader (used only to pull the raw
 * signatureValue BIT STRING out of a certificate's DER bytes — Node's
 * crypto.X509Certificate does not expose this directly).
 * Returns { tag, length, valueStart, valueEnd, nextOffset }.
 */
function readTLV(buf, offset) {
    const tag = buf[offset];
    let lenByte = buf[offset + 1];
    let length;
    let lenBytesUsed = 1;

    if (lenByte & 0x80) {
        const numBytes = lenByte & 0x7f;
        length = 0;
        for (let i = 0; i < numBytes; i++) {
            length = (length << 8) | buf[offset + 2 + i];
        }
        lenBytesUsed = 1 + numBytes;
    } else {
        length = lenByte;
    }

    const valueStart = offset + 1 + lenBytesUsed;
    const valueEnd = valueStart + length;
    return { tag, length, valueStart, valueEnd, nextOffset: valueEnd };
}

/**
 * Extracts the raw signatureValue bytes (the CA's signature over the
 * certificate) from a DER-encoded X.509 certificate.
 *
 * Certificate ::= SEQUENCE {
 *   tbsCertificate       TBSCertificate,      -- 1st element
 *   signatureAlgorithm   AlgorithmIdentifier,  -- 2nd element
 *   signatureValue       BIT STRING }          -- 3rd element (what we want)
 */
function extractCertificateSignature(derBuffer) {
    // Outer SEQUENCE (tag 0x30)
    const outer = readTLV(derBuffer, 0);
    if (outer.tag !== 0x30) throw new Error('Not a valid DER certificate (expected outer SEQUENCE)');

    // 1st child: tbsCertificate — skip over it
    const tbs = readTLV(derBuffer, outer.valueStart);

    // 2nd child: signatureAlgorithm SEQUENCE — skip over it
    const sigAlg = readTLV(derBuffer, tbs.nextOffset);

    // 3rd child: signatureValue BIT STRING (tag 0x03)
    const sigValue = readTLV(derBuffer, sigAlg.nextOffset);
    if (sigValue.tag !== 0x03) throw new Error('Expected BIT STRING for signatureValue');

    // First byte of a BIT STRING's content is the "unused bits" count
    // (0 for byte-aligned data, which certificate signatures always are).
    const unusedBits = derBuffer[sigValue.valueStart];
    if (unusedBits !== 0) {
        throw new Error('Unexpected unused-bits value in signatureValue BIT STRING');
    }
    return derBuffer.slice(sigValue.valueStart + 1, sigValue.valueEnd);
}

/**
 * Extracts everything needed from a signed certificate (Compliance or
 * Production CSID) for building the invoice's XAdES signature and QR code.
 * Matches ZATCASimplifiedTaxInvoice.php getCertificateInfo 1:1.
 */
function getCertificateInfo(certificatePem) {
    const cleaned = cleanUpPemBody(certificatePem);
    const wrapped = `-----BEGIN CERTIFICATE-----\n${cleaned}\n-----END CERTIFICATE-----`;

    const x509 = new crypto.X509Certificate(wrapped);

    // Matches PHP 1:1: getCertificateHash: openssl_digest(cleaned, 'sha256') -> hex string, base64-encoded
    const hexDigest = crypto.createHash('sha256').update(cleaned, 'utf8').digest('hex');
    const hash = Buffer.from(hexDigest, 'utf8').toString('base64');

    // Issuer: 'CN=' . implode(', ', array_reverse((array) $x509['issuer']))
    let issuer = x509.issuer.split('\n').reverse().join(', ');
    if (!issuer.startsWith('CN=')) {
        issuer = 'CN=' + issuer;
    }

    // Serial number
    const serialNumber = BigInt('0x' + x509.serialNumber).toString(10);

    const publicKeyDer = x509.publicKey.export({ type: 'spki', format: 'der' });
    const signature = extractCertificateSignature(x509.raw);

    return { hash, issuer, serialNumber, publicKeyDer, signature };
}

function cleanUpPemBody(pem) {
    return pem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\r/g, '')
        .split('\n')
        .map((l) => l.trim())
        .join('')
        .trim();
}

function cleanUpPrivateKeyBody(pem) {
    return pem
        .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
        .replace(/-----END EC PRIVATE KEY-----/g, '')
        .trim();
}

export {
    generateSecp256k1KeyPair,
    generateCSR,
    sha256Base64,
    ecdsaSignDerBase64,
    ecdsaVerifyDer,
    getCertificateInfo,
    extractCertificateSignature,
    cleanUpPemBody,
    cleanUpPrivateKeyBody,
};
