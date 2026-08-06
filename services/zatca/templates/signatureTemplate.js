/**
 * XAdES-BES signature templates.
 * Ported 1:1 from ZATCA/templates/ubl_signature.php,
 * ubl_signature_signed_properties_for_signing_template.php, and
 * ubl_signature_signed_properties_template.php
 */

/**
 * The SignedProperties XML used AS THE INPUT TO the signed-properties digest.
 *
 * ZATCA's validator canonicalizes (C14N) the embedded <xades:SignedProperties>
 * element from inside <ds:Object> and hashes the result.
 * When canonicalized as a standalone subtree, C14N:
 *   1. Propagates xmlns:ds from the outer <ds:Signature> context → we must
 *      add xmlns:ds explicitly on every ds: element (no parent to inherit from)
 *   2. Expands self-closing tags → <ds:DigestMethod ...></ds:DigestMethod>
 *   3. Preserves the exact whitespace/indentation from the embedded form
 *
 * Therefore this string must be byte-for-byte identical to what the ZATCA
 * validator's C14N produces from the embedded <xades:SignedProperties>.
 * That means: 36-space indentation (matching signedPropertiesEmbedded),
 * xmlns:ds on each ds: element, and no self-closing tags.
 */
function signedPropertiesForSigning({ signTimestamp, certificateHash, certificateIssuer, certificateSerialNumber }) {
    // Exact match of ubl_signature_signed_properties_for_signing_template.php
    // 4-space indent, xmlns:ds on every ds: child, self-closing DigestMethod
    return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
    <xades:SignedSignatureProperties>
        <xades:SigningTime>${signTimestamp}</xades:SigningTime>
        <xades:SigningCertificate>
            <xades:Cert>
                <xades:CertDigest>
                    <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                    <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certificateHash}</ds:DigestValue>
                </xades:CertDigest>
                <xades:IssuerSerial>
                    <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certificateIssuer}</ds:X509IssuerName>
                    <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certificateSerialNumber}</ds:X509SerialNumber>
                </xades:IssuerSerial>
            </xades:Cert>
        </xades:SigningCertificate>
    </xades:SignedSignatureProperties>
</xades:SignedProperties>`;
}

/**
 * Matches ubl_signature_signed_properties_template.php 1:1.
 * 36 spaces indentation, with no xmlns:ds repeated on children.
 */
function signedPropertiesEmbedded({ signTimestamp, certificateHash, certificateIssuer, certificateSerialNumber }) {
    return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>${signTimestamp}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>
                                                    <ds:DigestValue>${certificateHash}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName>${certificateIssuer}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber>${certificateSerialNumber}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`;
}

/**
 * The full <ext:UBLExtension> block that replaces
 * __UBL_EXTENSIONS_PLACEHOLDER__ in the invoice skeleton.
 */
function ublExtensions({ invoiceHash, signedPropertiesHash, digitalSignature, certificateBody, signedPropertiesXml }) {
    return `
        <ext:UBLExtension>
            <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
            <ext:ExtensionContent>
                <sig:UBLDocumentSignatures
                        xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
                        xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2"
                        xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2">
                    <sac:SignatureInformation>
                        <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                        <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                        <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
                            <ds:SignedInfo>
                                <ds:CanonicalizationMethod
                                        Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                                <ds:SignatureMethod
                                        Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
                                <ds:Reference Id="invoiceSignedData" URI="">
                                    <ds:Transforms>
                                        <ds:Transform
                                                Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                            <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                                        </ds:Transform>
                                        <ds:Transform
                                                Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                            <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                                        </ds:Transform>
                                        <ds:Transform
                                                Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                            <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>
                                        </ds:Transform>
                                        <ds:Transform
                                                Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                                    </ds:Transforms>
                                    <ds:DigestMethod
                                            Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                    <ds:DigestValue>${invoiceHash}</ds:DigestValue>
                                </ds:Reference>
                                <ds:Reference
                                        Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties"
                                        URI="#xadesSignedProperties">
                                    <ds:DigestMethod
                                            Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                    <ds:DigestValue>${signedPropertiesHash}</ds:DigestValue>
                                </ds:Reference>
                            </ds:SignedInfo>
                            <ds:SignatureValue>${digitalSignature}</ds:SignatureValue>
                            <ds:KeyInfo>
                                <ds:X509Data>
                                    <ds:X509Certificate>${certificateBody}</ds:X509Certificate>
                                </ds:X509Data>
                            </ds:KeyInfo>
                            <ds:Object>
                                <xades:QualifyingProperties Target="signature"
                                                            xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
                                    ${signedPropertiesXml}
                                </xades:QualifyingProperties>
                            </ds:Object>
                        </ds:Signature>
                    </sac:SignatureInformation>
                </sig:UBLDocumentSignatures>
            </ext:ExtensionContent>
        </ext:UBLExtension>`;
}

export { signedPropertiesForSigning, signedPropertiesEmbedded, ublExtensions };
