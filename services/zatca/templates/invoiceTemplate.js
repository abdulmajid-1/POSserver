/**
 * Main invoice skeleton template.
 * Ported 1:1 from ZATCA/templates/simplified_tax_invoice_template.php,
 * layout preserved exactly (whitespace matters for hash reproducibility
 * once this same layout is used consistently for hashing and signing).
 *
 * UBL_EXTENSIONS_PLACEHOLDER / QR_PLACEHOLDER get substituted AFTER
 * hashing/signing (mirrors the PHP flow: the invoice is hashed with
 * these still empty, then the real signature/QR is spliced in).
 */

const INVOICE_TYPE_CODES = {
    INVOICE: 388,
    DEBIT_NOTE: 383,
    CREDIT_NOTE: 381,
};

function billingReference(canceledInvoiceNumber) {
    if (!canceledInvoiceNumber) return '';
    return `
    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>Invoice Number: ${canceledInvoiceNumber}</cbc:ID>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>`;
}

function deliveryBlock(invoiceSubType, issueDate) {
    if (invoiceSubType !== 'B2B') return '';
    return `
    <cac:Delivery>
        <cbc:ActualDeliveryDate>${issueDate}</cbc:ActualDeliveryDate>
    </cac:Delivery>`;
}

/**
 * Builds the AccountingCustomerParty XML block.
 * B2C: empty element (buyer identity not required).
 * B2B: full buyer block with VAT number, name, and address.
 *
 * buyer = { name, vatNumber, street?, buildingNumber?, citySubdivision?, city?, postalZone?, countryCode? }
 */
function accountingCustomerParty(invoiceSubType, buyer) {
    if (invoiceSubType !== 'B2B' || !buyer || !buyer.vatNumber) {
        return `<cac:AccountingCustomerParty></cac:AccountingCustomerParty>`;
    }

    const street          = buyer.street          || 'Al-Kharj St';
    const buildingNumber  = buyer.buildingNumber  || '1234';
    const citySubdivision = buyer.citySubdivision || 'Central';
    const city            = buyer.city            || 'Riyadh';
    const postalZone      = buyer.postalZone      || '12345';
    const countryCode     = buyer.countryCode     || 'SA';

    return `<cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PostalAddress>
                <cbc:StreetName>${street}</cbc:StreetName>
                <cbc:BuildingNumber>${buildingNumber}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>${citySubdivision}</cbc:CitySubdivisionName>
                <cbc:CityName>${city}</cbc:CityName>
                <cbc:PostalZone>${postalZone}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${countryCode}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${buyer.vatNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${buyer.name || 'Business Customer'}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>`;
}

function paymentMeansBlock(invoiceTypeName, cancelReason) {
    if (invoiceTypeName !== 'CREDIT_NOTE' && invoiceTypeName !== 'DEBIT_NOTE') return '';
    const note = cancelReason || 'Cancellation/Adjustment';
    return `
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
        <cbc:InstructionNote>${note}</cbc:InstructionNote>
    </cac:PaymentMeans>`;
}

/**
 * Builds the full invoice XML string with UBLExtensions/QR left as
 * placeholders (to be filled in after hashing + signing).
 *
 * invoiceSubType: 'B2C' (Simplified, 0200000) | 'B2B' (Standard, 0100000)
 * buyer: { name, vatNumber, street, city, postalZone } — required for B2B
 */
function buildInvoiceSkeleton({
    invoiceTypeName, // e.g. "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE"
    invoiceSubType,  // 'B2C' | 'B2B'
    buyer,           // buyer details (B2B only)
    canceledInvoiceNumber,
    cancelReason,
    invoiceSerialNumber,
    terminalUuid,
    issueDate,
    issueTime,
    invoiceCounterNumber,
    previousInvoiceHash,
    crnNumber,
    street,
    buildingNumber,
    plotIdentification,
    citySubdivision,
    city,
    postalZone,
    vatNumber,
    vatName,
    lineItemsXml,
}) {
    const invoiceTypeCode = INVOICE_TYPE_CODES[invoiceTypeName];
    if (!invoiceTypeCode) throw new Error(`Unknown invoice type: ${invoiceTypeName}`);

    // 0200000 = Simplified (B2C), 0100000 = Standard/Tax Invoice (B2B)
    const subTypeCode = invoiceSubType === 'B2B' ? '0100000' : '0200000';

    const customerPartyXml = accountingCustomerParty(invoiceSubType, buyer);

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <ext:UBLExtensions>__UBL_EXTENSIONS_PLACEHOLDER__
    </ext:UBLExtensions>
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>${invoiceSerialNumber}</cbc:ID>
    <cbc:UUID>${terminalUuid}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="${subTypeCode}">${invoiceTypeCode}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>${billingReference(canceledInvoiceNumber)}
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${invoiceCounterNumber}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${previousInvoiceHash}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">__QR_PLACEHOLDER__</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
      <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
      <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
    </cac:Signature>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${crnNumber}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>${street}</cbc:StreetName>
                <cbc:BuildingNumber>${buildingNumber}</cbc:BuildingNumber>
                <cbc:PlotIdentification>${plotIdentification}</cbc:PlotIdentification>
                <cbc:CitySubdivisionName>${citySubdivision}</cbc:CitySubdivisionName>
                <cbc:CityName>${city}</cbc:CityName>
                <cbc:PostalZone>${postalZone}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>SA</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${vatNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${vatName}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    ${customerPartyXml}${deliveryBlock(invoiceSubType, issueDate)}${paymentMeansBlock(invoiceTypeName, cancelReason)}
    ${lineItemsXml}
</Invoice>`;
}

export { buildInvoiceSkeleton, INVOICE_TYPE_CODES };
