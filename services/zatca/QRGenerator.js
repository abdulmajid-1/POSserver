/**
 * services/zatca/QRGenerator.js
 *
 * Ported from ZATCA\GenerateQrCode / ZATCA\Tag (PHP) and the TLV() method
 * in ZATCA\ZATCASimplifiedTaxInvoice — then VERIFIED and CORRECTED against
 * the actual byte structure of ZATCA's own official sample invoice XML
 * (the "SME00023" example from their documentation), decoded tag-by-tag
 * during development of this file. Two corrections resulted:
 *
 *  1. Tags 6 (invoice hash) and 7 (digital signature) embed the BASE64
 *     STRING's ASCII characters directly as the TLV value — NOT the
 *     raw bytes you'd get from base64-decoding them. (Tag 8, the public
 *     key, IS raw DER bytes, not base64 text — confirmed the same way.)
 *  2. The verified sample contains only 8 tags total (ends at the public
 *     key) — there is no 9th "CA signature over the public key" tag,
 *     despite that being what the PHP source and some community
 *     write-ups build. This implementation defaults to 8 tags and
 *     accepts a 9th only if explicitly supplied.
 *
 * Tag/length is measured in BYTES, not characters — important since
 * Arabic seller names are multi-byte in UTF-8. This works on Buffers
 * throughout rather than JS string .length.
 */

/** Builds a single TLV entry: [tag byte][length byte][value bytes] */
function tlvEntry(tag, value) {
    const valueBuf = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ''), 'utf8');
    if (valueBuf.length > 255) {
        throw new Error(`TLV value for tag ${tag} exceeds 255 bytes (${valueBuf.length}) — not representable in single-byte length encoding`);
    }
    const header = Buffer.from([tag, valueBuf.length]);
    return Buffer.concat([header, valueBuf]);
}

/**
 * Builds the QR TLV payload and returns it base64-encoded.
 *
 * Tags:
 *   1 Seller name (UTF-8 text)
 *   2 VAT registration number (text)
 *   3 Invoice timestamp, format YYYY-MM-DDTHH:MM:SS (text)
 *   4 Invoice total with VAT (text)
 *   5 VAT total (text)
 *   6 Invoice XML hash — the base64 STRING's characters, as text
 *   7 ECDSA digital signature (DER, base64-encoded) — the base64
 *     STRING's characters, as text
 *   8 ECDSA public key — raw SubjectPublicKeyInfo DER bytes (NOT base64 text)
 *   9 (optional) ECDSA signature of the public key by ZATCA's CA — only
 *     included if `certificateSignature` is passed; omitted by default to
 *     match the verified 8-tag structure of ZATCA's own sample.
 */
function generateQR({
    sellerName,
    vatNumber,
    timestamp,
    invoiceTotal,
    vatTotal,
    invoiceHashBase64,
    digitalSignatureBase64,
    publicKeyDer,
    certificateSignature, // optional Buffer — omit for the verified 8-tag form
}) {
    const entries = [
        tlvEntry(1, sellerName),
        tlvEntry(2, vatNumber),
        tlvEntry(3, timestamp),
        tlvEntry(4, String(invoiceTotal)),
        tlvEntry(5, String(vatTotal)),
        tlvEntry(6, invoiceHashBase64), // base64 string as text, per verified sample
        tlvEntry(7, digitalSignatureBase64), // base64 string as text, per verified sample
        tlvEntry(8, publicKeyDer), // raw DER bytes
    ];

    if (certificateSignature) {
        entries.push(tlvEntry(9, certificateSignature));
    }

    const tlvBuffer = Buffer.concat(entries);
    return tlvBuffer.toString('base64');
}

export { generateQR, tlvEntry };
