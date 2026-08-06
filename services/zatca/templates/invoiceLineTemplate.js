/**
 * Templates for <cac:InvoiceLine> blocks.
 * Ported 1:1 from ZATCA/templates/invoice_line_template.php
 */

function invoiceLine({ id, quantity, lineExtensionAmount, taxAmount, roundingAmount, name, classifiedTaxCategoriesXml, priceAmount, allowanceChargesXml }) {
    return `
    <cac:InvoiceLine>
        <cbc:ID>${id}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">${quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">${lineExtensionAmount}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="SAR">${taxAmount}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="SAR">${roundingAmount}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${name}</cbc:Name>${classifiedTaxCategoriesXml}
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">${priceAmount}</cbc:PriceAmount>${allowanceChargesXml}
        </cac:Price>
    </cac:InvoiceLine>`;
}

function classifiedTaxCategory({ id, percent }) {
    return `
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${id}</cbc:ID>
                <cbc:Percent>${percent}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>`;
}

function allowanceCharge({ reason, amount }) {
    return `
            <cac:AllowanceCharge>
                <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
                <cbc:AllowanceChargeReason>${reason}</cbc:AllowanceChargeReason>
                <cbc:Amount currencyID="SAR">${amount}</cbc:Amount>
            </cac:AllowanceCharge>`;
}

export { invoiceLine, classifiedTaxCategory, allowanceCharge };
