/**
 * Templates for <cac:TaxTotal> (invoice-level) and <cac:LegalMonetaryTotal>.
 * Ported 1:1 from ZATCA/templates/tax_total_template.php and
 * ZATCA/templates/legal_monetary_total_template.php
 */

function taxSubtotal({ taxableAmount, taxAmount, categoryId, percent }) {
    return `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">${taxableAmount}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">${taxAmount}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5305">${categoryId}</cbc:ID>
                <cbc:Percent>${percent}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5153">VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
}

function taxTotal({ totalTaxAmount, taxSubtotalsXml }) {
    return `
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${totalTaxAmount}</cbc:TaxAmount>${taxSubtotalsXml}
    </cac:TaxTotal>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${totalTaxAmount}</cbc:TaxAmount>
    </cac:TaxTotal>`;
}

function legalMonetaryTotal({ lineExtensionAmount, taxExclusiveAmount, taxInclusiveAmount, allowanceTotalAmount, prepaidAmount, payableAmount }) {
    return `
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">${lineExtensionAmount}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">${taxExclusiveAmount}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">${taxInclusiveAmount}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="SAR">${allowanceTotalAmount}</cbc:AllowanceTotalAmount>
        <cbc:PrepaidAmount currencyID="SAR">${prepaidAmount}</cbc:PrepaidAmount>
        <cbc:PayableAmount currencyID="SAR">${payableAmount}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>`;
}

export { taxSubtotal, taxTotal, legalMonetaryTotal };
