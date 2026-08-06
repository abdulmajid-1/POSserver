/**
 * services/zatca/XMLBuilder.js
 *
 * Ported from ZATCA\ZATCASimplifiedTaxInvoice (PHP) — the invoice-building
 * and invoice-hashing logic. Line-item/tax math is a faithful port of
 * constructLineItem() / constructLineItemTotals() / constructTaxTotal() /
 * constructLegalMonetaryTotal().
 */

import crypto from 'crypto';
import { invoiceLine, classifiedTaxCategory, allowanceCharge } from './templates/invoiceLineTemplate.js';
import { taxSubtotal, taxTotal, legalMonetaryTotal } from './templates/totalsTemplate.js';
import { buildInvoiceSkeleton } from './templates/invoiceTemplate.js';

/** number_format($n, 2, '.', '') equivalent */
function money(n) {
    return (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);
}

/**
 * Computes one line item's XML + running totals.
 * line_item shape:
 * {
 *   id, name, quantity, tax_exclusive_price, VAT_percent (e.g. 0.15),
 *   other_taxes: [{ percent_amount }], discounts: [{ amount, reason }]
 * }
 */
function constructLineItem(lineItem) {
    const discounts = lineItem.discounts || [];
    const otherTaxes = lineItem.other_taxes || [];

    // --- Discounts ---
    let totalDiscounts = 0;
    const allowanceChargesXml = discounts
        .map((d) => {
            totalDiscounts += d.amount;
            return allowanceCharge({ reason: d.reason, amount: money(d.amount) });
        })
        .join('');

    const subtotal = lineItem.tax_exclusive_price * lineItem.quantity - totalDiscounts;

    // --- Taxes ---
    const vatPercent = lineItem.VAT_percent || 0;
    let totalTaxes = subtotal * vatPercent;

    const classifiedTaxCategoriesXml = [
        classifiedTaxCategory({
            id: vatPercent ? 'S' : 'O',
            percent: money(vatPercent ? vatPercent * 100 : 0),
        }),
        ...otherTaxes.map((t) => {
            totalTaxes += Number(t.percent_amount) * subtotal;
            return classifiedTaxCategory({ id: 'S', percent: money(t.percent_amount * 100) });
        }),
    ].join('');

    const lineXml = invoiceLine({
        id: lineItem.id,
        quantity: lineItem.quantity,
        lineExtensionAmount: money(subtotal),
        taxAmount: money(totalTaxes),
        roundingAmount: money(subtotal + totalTaxes),
        name: escapeXml(lineItem.name),
        classifiedTaxCategoriesXml,
        priceAmount: lineItem.tax_exclusive_price,
        allowanceChargesXml,
    });

    return {
        lineXml,
        totals: { subtotal, totalTaxes, totalDiscounts },
    };
}

/** Builds the invoice-level <cac:TaxTotal> block(s) across all line items */
function constructTaxTotal(lineItems) {
    const subtotals = [];
    let taxesTotal = 0;

    lineItems.forEach((lineItem) => {
        const discountTotal = (lineItem.discounts || []).reduce((sum, d) => sum + d.amount, 0);
        const taxableAmount = lineItem.tax_exclusive_price * lineItem.quantity - discountTotal;
        const vatPercent = lineItem.VAT_percent || 0;

        const vatAmount = vatPercent * taxableAmount;
        subtotals.push(
            taxSubtotal({
                taxableAmount: money(taxableAmount),
                taxAmount: money(vatAmount),
                categoryId: vatPercent ? 'S' : 'O',
                percent: money(vatPercent * 100),
            })
        );
        taxesTotal += vatAmount;

        (lineItem.other_taxes || []).forEach((t) => {
            const amt = t.percent_amount * taxableAmount;
            subtotals.push(
                taxSubtotal({
                    taxableAmount: money(taxableAmount),
                    taxAmount: money(amt),
                    categoryId: 'S',
                    percent: money(t.percent_amount * 100),
                })
            );
            taxesTotal += amt;
        });
    });

    return {
        xml: taxTotal({ totalTaxAmount: money(taxesTotal), taxSubtotalsXml: subtotals.join('') }),
        taxesTotal,
    };
}

/** Builds <cac:LegalMonetaryTotal> */
function constructLegalMonetaryTotal(totalSubtotal, totalTaxes) {
    return legalMonetaryTotal({
        lineExtensionAmount: money(totalSubtotal),
        taxExclusiveAmount: money(totalSubtotal),
        taxInclusiveAmount: money(totalSubtotal + totalTaxes),
        allowanceTotalAmount: money(0),
        prepaidAmount: money(0),
        payableAmount: money(totalSubtotal + totalTaxes),
    });
}

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Builds the complete unsigned invoice XML (UBLExtensions and QR left as
 * placeholders) plus the aggregated totals needed for the QR code later.
 *
 * @param {object} invoice - { invoice_serial_number, issue_date, issue_time,
 *   invoice_counter_number, previous_invoice_hash, line_items, cancelation? }
 * @param {object} egsUnit - { uuid, CRN_number, VAT_number, VAT_name,
 *   location: {...}, cancelation: { cancelation_type, canceled_invoice_number } }
 */
function buildInvoiceXml(invoice, egsUnit) {
    let totalSubtotal = 0;
    let totalTaxes = 0;
    const lineXmls = [];

    invoice.line_items.forEach((li) => {
        const { lineXml, totals } = constructLineItem(li);
        lineXmls.push(lineXml);
        totalSubtotal += totals.subtotal;
        totalTaxes += totals.totalTaxes;
    });

    const { xml: taxTotalXml } = constructTaxTotal(invoice.line_items);
    const legalMonetaryTotalXml = constructLegalMonetaryTotal(totalSubtotal, totalTaxes);

    const lineItemsXml = `${taxTotalXml}${legalMonetaryTotalXml}${lineXmls.join('')}`;

    const cancelation = egsUnit.cancelation || { cancelation_type: 'INVOICE' };

    const xml = buildInvoiceSkeleton({
        invoiceTypeName: cancelation.cancelation_type,
        invoiceSubType: invoice.invoiceSubType || 'B2C',   // 'B2C' | 'B2B'
        buyer: invoice.buyer || null,                       // B2B buyer details
        canceledInvoiceNumber: cancelation.canceled_invoice_number,
        cancelReason: cancelation.reason || (invoice.cancelation && invoice.cancelation.reason) || invoice.cancelReason || 'Return of goods',
        invoiceSerialNumber: invoice.invoice_serial_number,
        terminalUuid: egsUnit.uuid,
        issueDate: invoice.issue_date,
        issueTime: invoice.issue_time,
        invoiceCounterNumber: invoice.invoice_counter_number,
        previousInvoiceHash: invoice.previous_invoice_hash,
        crnNumber: egsUnit.CRN_number,
        street: escapeXml(egsUnit.location.street),
        buildingNumber: egsUnit.location.building,
        plotIdentification: egsUnit.location.plot_identification,
        citySubdivision: escapeXml(egsUnit.location.city_subdivision),
        city: escapeXml(egsUnit.location.city),
        postalZone: egsUnit.location.postal_zone,
        vatNumber: egsUnit.VAT_number,
        vatName: escapeXml(egsUnit.VAT_name),
        lineItemsXml,
    });

    return {
        xml,
        totals: {
            totalSubtotal,
            totalTaxes,
            totalPayable: totalSubtotal + totalTaxes,
        },
    };
}

/**
 * Computes the invoice hash per ZATCA spec: SHA-256 over the invoice XML
 * with the UBLExtensions, Signature, and QR AdditionalDocumentReference
 * blocks removed, base64-encoded.
 */
function getInvoiceHash(unsignedInvoiceXml) {
    let xml = unsignedInvoiceXml;

    // Strip the XML declaration line.
    xml = xml.replace(/^<\?xml[^>]*\?>\s*/, '');

    // Remove the <ext:UBLExtensions>...</ext:UBLExtensions> block entirely.
    xml = xml.replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/, '');

    // Remove the <cac:Signature>...</cac:Signature> block entirely.
    xml = xml.replace(/<cac:Signature>[\s\S]*?<\/cac:Signature>/, '');

    // Remove the QR <cac:AdditionalDocumentReference> block (the one
    // whose <cbc:ID>QR</cbc:ID> child identifies it as the QR entry —
    // ICV and PIH references must remain).
    xml = xml.replace(
        /<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/,
        ''
    );

    // Normalize a self-closed AccountingCustomerParty to the open/close
    // form (matches PHP's explicit str_replace for this exact case).
    xml = xml.replace('<cac:AccountingCustomerParty/>', '<cac:AccountingCustomerParty></cac:AccountingCustomerParty>');

    const hashBuffer = crypto.createHash('sha256').update(xml.trim(), 'utf8').digest();
    return hashBuffer.toString('base64');
}

export {
    buildInvoiceXml,
    getInvoiceHash,
    money,
    escapeXml,
};
