import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

// Ensure we are connecting to live production gateway (/e-invoicing/core)
process.env.ZATCA_ENV = 'production';

import EGS from './services/zatca/EGS.js';

const session = JSON.parse(fs.readFileSync('./tempComplianceSession.json', 'utf8'));
const { complianceCert, complianceSecret, complianceRequestID, privateKey, complianceRawToken } = session;

const egsConfig = {
    uuid: process.env.ZATCA_EGS_UUID,
    custom_id: process.env.ZATCA_CUSTOM_ID,
    model: process.env.ZATCA_EGS_MODEL || '1.0',
    CRN_number: process.env.ZATCA_CRN_NUMBER,
    VAT_name: process.env.ZATCA_VAT_NAME,
    VAT_number: process.env.ZATCA_VAT_NUMBER,
    invoice_type: '0100',
    location: {
        city: process.env.ZATCA_LOCATION_CITY,
        city_subdivision: process.env.ZATCA_LOCATION_SUBDIVISION,
        street: process.env.ZATCA_LOCATION_STREET,
        plot_identification: process.env.ZATCA_LOCATION_PLOT || '0000',
        building: process.env.ZATCA_LOCATION_BUILDING || '0000',
        postal_zone: process.env.ZATCA_LOCATION_POSTAL_ZONE,
    },
    branch_name: process.env.ZATCA_BRANCH_NAME || 'Main Branch',
    branch_industry: process.env.ZATCA_BRANCH_INDUSTRY || 'Retail',
    cancelation: { cancelation_type: 'INVOICE', canceled_invoice_number: '' },
};

const egs = new EGS(egsConfig);
const SEED_PIH = process.env.ZATCA_INITIAL_PIH;

import { getSaudiDateTime } from './services/zatca/Signer.js';

function buildInvoice({ type, subType, icv, pih, canceledRef, cancelReason, buyer }) {
    const isB2B = subType === 'B2B';
    const { date: issue_date, time: issue_time } = getSaudiDateTime();
    const invoice = {
        invoice_serial_number: `${egsConfig.custom_id}-OB-${icv}`,
        issue_date,
        issue_time,
        invoice_counter_number: icv,
        previous_invoice_hash: pih,
        invoiceSubType: subType,
        buyer: isB2B ? buyer : null,
        line_items: [
            {
                id: '1',
                name: type === 'CREDIT_NOTE' ? 'Returned Item' : 'Sale Item',
                quantity: 1,
                tax_exclusive_price: 100.0,
                VAT_percent: 0.15,
                other_taxes: [],
                discounts: [],
            },
        ],
    };
    if (canceledRef) {
        invoice.cancelation = {
            cancelation_type: type,
            canceled_invoice_number: canceledRef,
            reason: cancelReason || 'Return of goods',
        };
        invoice.cancelReason = cancelReason || 'Return of goods';
    }
    return invoice;
}

function setEnvVar(content, key, value) {
    const escaped = value.replace(/\n/g, '\\n');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
        return content.replace(regex, `${key}=${escaped}`);
    }
    return content + `\n${key}=${escaped}`;
}

async function main() {
    console.log('====================================================');
    console.log(' Resuming Production Onboarding on Live Gateway (/core)');
    console.log('====================================================\n');

    console.log('── Step 3: Running ZATCA Compliance Check Scenarios...');

    async function safeCheckCompliance(label, signedXml, invoiceHash) {
        try {
            await egs.checkInvoiceCompliance(signedXml, invoiceHash, complianceCert, complianceSecret);
            console.log(`         ✔ PASS\n`);
        } catch (err) {
            if (err.message && err.message.includes('already completed')) {
                console.log(`         ✔ ALREADY COMPLETED (PASS)\n`);
            } else {
                throw err;
            }
        }
    }

    // Scenario A: B2C Simplified Tax Invoice
    console.log('   [1/4] B2C Simplified Tax Invoice...');
    egsConfig.cancelation = { cancelation_type: 'INVOICE', canceled_invoice_number: '' };
    const b2cInvoice = buildInvoice({ type: 'INVOICE', subType: 'B2C', icv: 1, pih: SEED_PIH });
    const { signedInvoiceXml: b2cXml, invoiceHash: b2cHash } = egs.signInvoice(b2cInvoice, complianceCert, privateKey);
    await safeCheckCompliance('B2C', b2cXml, b2cHash);

    // Scenario B: B2B Standard Tax Invoice (Only if CSID covers Standard documents '1100' or '1000')
    const isStandardSupported = egsConfig.invoice_type.startsWith('1');
    if (isStandardSupported) {
        console.log('   [2/4] B2B Standard Tax Invoice...');
        const b2bBuyer = {
            name: 'Test Business Customer',
            vatNumber: '300000000000003',
            street: 'King Fahd Road',
            buildingNumber: '1234',
            citySubdivision: 'Al Olaya',
            city: 'Riyadh',
            postalZone: '11461',
            countryCode: 'SA',
        };
        const b2bInvoice = buildInvoice({ type: 'INVOICE', subType: 'B2B', icv: 2, pih: b2cHash, buyer: b2bBuyer });
        const { signedInvoiceXml: b2bXml, invoiceHash: b2bHash } = egs.signInvoice(b2bInvoice, complianceCert, privateKey);
        await safeCheckCompliance('B2B', b2bXml, b2bHash);
    } else {
        console.log('   [2/4] B2B Standard Tax Invoice... (SKIPPED: CSID is 0100 Simplified Only)\n');
    }

    // Scenario C: Credit Note
    console.log('   [3/4] Credit Note (Refund)...');
    egsConfig.cancelation = { cancelation_type: 'CREDIT_NOTE', canceled_invoice_number: b2cInvoice.invoice_serial_number };
    const creditPih = isStandardSupported ? b2bHash : b2cHash;
    const creditInvoice = buildInvoice({ type: 'CREDIT_NOTE', subType: 'B2C', icv: 3, pih: creditPih, canceledRef: b2cInvoice.invoice_serial_number, cancelReason: 'Return of defective goods' });
    const { signedInvoiceXml: creditXml, invoiceHash: creditHash } = egs.signInvoice(creditInvoice, complianceCert, privateKey);
    await safeCheckCompliance('Credit Note', creditXml, creditHash);

    // Scenario D: Debit Note
    console.log('   [4/4] Debit Note...');
    egsConfig.cancelation = { cancelation_type: 'DEBIT_NOTE', canceled_invoice_number: b2cInvoice.invoice_serial_number };
    const debitInvoice = buildInvoice({ type: 'DEBIT_NOTE', subType: 'B2C', icv: 4, pih: creditHash, canceledRef: b2cInvoice.invoice_serial_number, cancelReason: 'Price adjustment undercharge' });
    const { signedInvoiceXml: debitXml, invoiceHash: debitHash } = egs.signInvoice(debitInvoice, complianceCert, privateKey);
    await safeCheckCompliance('Debit Note', debitXml, debitHash);

    // ── STEP 4: Exchange for Production CSID ──────────────────────────────────
    console.log('── Step 4: Requesting Production CSID (PCSID)...');
    const pcsidResult = await egs.issueProductionCertificate(complianceRequestID, complianceCert, complianceSecret);
    const productionCert = pcsidResult.binarySecurityToken;
    const productionSecret = pcsidResult.secret;
    const productionRawToken = pcsidResult.rawToken;
    console.log('   ✔ Production CSID issued successfully!\n');

    // ── STEP 5: Write Credentials to .env ─────────────────────────────────────
    console.log('── Step 5: Writing Production Credentials to .env...');

    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = setEnvVar(envContent, 'ZATCA_ENV', 'production');
    envContent = setEnvVar(envContent, 'ZATCA_CERTIFICATE_PEM', productionCert);
    envContent = setEnvVar(envContent, 'ZATCA_SECRET', productionSecret);
    envContent = setEnvVar(envContent, 'ZATCA_RAW_TOKEN', productionRawToken);
    envContent = setEnvVar(envContent, 'ZATCA_PRIVATE_KEY_PEM', privateKey);

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('   ✔ .env updated with Production Credentials');

    try { fs.unlinkSync('./tempComplianceSession.json'); } catch (_) {}

    console.log('\n====================================================');
    console.log(' 🎉 LIVE PRODUCTION ONBOARDING COMPLETE!');
    console.log('====================================================');
}

main().catch(err => {
    console.error('\n❌ FAILED:', err.message);
    process.exit(1);
});
