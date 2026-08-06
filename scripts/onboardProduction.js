/**
 * scripts/onboardProduction.js
 *
 * ZATCA Phase 2 — Full Production Onboarding Flow
 *
 * Usage: node scripts/onboardProduction.js --otp <OTP>
 *
 * Steps:
 *  1. Generate EC private key + CSR
 *  2. Issue Compliance CSID (uses OTP)
 *  3. Run 4 compliance check scenarios (B2C, B2B, Credit Note, Debit Note)
 *  4. Issue Production CSID
 *  5. Write production credentials to .env
 */

import 'dotenv/config';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.resolve(__dirname, '..', '.env');

// ── Parse CLI args ──────────────────────────────────────────────────────────
const otpArg = process.argv.indexOf('--otp');
if (otpArg === -1 || !process.argv[otpArg + 1]) {
    console.error('Usage: node scripts/onboardProduction.js --otp <OTP>');
    process.exit(1);
}
const OTP = process.argv[otpArg + 1];

// ── Force production environment ────────────────────────────────────────────
process.env.ZATCA_ENV = 'production';

import EGS from '../services/zatca/EGS.js';

// ── EGS config from .env ────────────────────────────────────────────────────
const egsConfig = {
    uuid:           process.env.ZATCA_EGS_UUID,
    custom_id:      process.env.ZATCA_CUSTOM_ID,
    model:          process.env.ZATCA_EGS_MODEL      || '1.0',
    CRN_number:     process.env.ZATCA_CRN_NUMBER,
    VAT_name:       process.env.ZATCA_VAT_NAME,
    VAT_number:     process.env.ZATCA_VAT_NUMBER,
    invoice_type:   process.env.CSR_INVOICE_TYPE     || '1100',
    location: {
        city:             process.env.ZATCA_LOCATION_CITY,
        city_subdivision: process.env.ZATCA_LOCATION_SUBDIVISION,
        street:           process.env.ZATCA_LOCATION_STREET,
        plot_identification: process.env.ZATCA_LOCATION_PLOT  || '0000',
        building:         process.env.ZATCA_LOCATION_BUILDING || '0000',
        postal_zone:      process.env.ZATCA_LOCATION_POSTAL_ZONE,
    },
    branch_name:     process.env.ZATCA_BRANCH_NAME     || 'Main Branch',
    branch_industry: process.env.ZATCA_BRANCH_INDUSTRY || 'Retail',
    cancelation: { cancelation_type: 'INVOICE', canceled_invoice_number: '' },
};

const SEED_PIH = process.env.ZATCA_INITIAL_PIH;

import { getSaudiDateTime } from '../services/zatca/Signer.js';

// ── Helper: build test invoice ───────────────────────────────────────────────
function buildInvoice({ subType, icv, pih, cancelType, canceledRef }) {
    const isB2B = subType === 'B2B';
    const { date: issue_date, time: issue_time } = getSaudiDateTime();
    const inv = {
        invoice_serial_number: `${egsConfig.custom_id}-OB-${icv}`,
        issue_date,
        issue_time,
        invoice_counter_number: icv,
        previous_invoice_hash:  pih,
        invoiceSubType: subType,
        buyer: isB2B ? {
            name: 'Test Business Customer',
            vatNumber: '300000000000003',
            street: 'King Fahd Road', buildingNumber: '1234',
            citySubdivision: 'Al Olaya', city: 'Riyadh',
            postalZone: '11461', countryCode: 'SA',
        } : null,
        line_items: [{
            id: '1',
            name: cancelType === 'CREDIT_NOTE' ? 'Returned Item' : 'Sale Item',
            quantity: 1,
            tax_exclusive_price: 100.0,
            VAT_percent: 0.15,
            other_taxes: [],
            discounts: [],
        }],
    };
    if (canceledRef) {
        inv.cancelation = { cancelation_type: cancelType, canceled_invoice_number: canceledRef };
    }
    return inv;
}

// ── Helper: write / replace a key in .env ────────────────────────────────────
function setEnvVar(content, key, value) {
    const escaped = value.replace(/\n/g, '\\n');
    const regex   = new RegExp(`^${key}=.*$`, 'm');
    return regex.test(content)
        ? content.replace(regex, `${key}=${escaped}`)
        : content + `\n${key}=${escaped}`;
}

// ── Main flow ────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n========================================');
    console.log('  ZATCA Phase 2 — Production Onboarding');
    console.log('========================================\n');

    const egs = new EGS(egsConfig);

    // ── Step 1: Keys + CSR ──────────────────────────────────────────────────
    console.log('── Step 1: Generating Production EC Private Key + CSR...');
    const { privateKey, csr } = egs.generateNewKeysAndCSR('ABTradersPOS', true);
    console.log('   ✔ Private key & CSR generated\n');

    // ── Step 2: Compliance CSID ─────────────────────────────────────────────
    console.log(`── Step 2: Requesting Compliance CSID (OTP: ${OTP})...`);
    const { requestID, binarySecurityToken: compCert, secret: compSecret, rawToken: compRaw }
        = await egs.issueComplianceCertificate(OTP, csr);
    console.log('   ✔ Compliance CSID issued');
    console.log(`   ✔ requestID: ${requestID}\n`);

    // Save session so we can retry step 3/4 if needed
    fs.writeFileSync(
        path.resolve(__dirname, '..', 'tempComplianceSession.json'),
        JSON.stringify({ complianceCert: compCert, complianceSecret: compSecret,
                         complianceRequestID: requestID, privateKey, complianceRawToken: compRaw }, null, 2),
        'utf8'
    );

    // ── Step 3: Compliance Check (4 scenarios) ──────────────────────────────
    console.log('── Step 3: Running ZATCA Compliance Check Scenarios...');

    let lastHash = SEED_PIH;

    // 3a — B2C Simplified
    console.log('   [1/4] B2C Simplified Tax Invoice...');
    egsConfig.cancelation = { cancelation_type: 'INVOICE', canceled_invoice_number: '' };
    const b2cInv = buildInvoice({ subType: 'B2C', icv: 1, pih: lastHash });
    const { signedInvoiceXml: b2cXml, invoiceHash: b2cHash } =
        egs.signInvoice(b2cInv, compCert, privateKey, compRaw);
    await egs.checkInvoiceCompliance(b2cXml, b2cHash, compCert, compSecret);
    lastHash = b2cHash;
    console.log('         ✔ PASS\n');

    // 3b — B2B Standard
    console.log('   [2/4] B2B Standard Tax Invoice...');
    try {
        const b2bInv = buildInvoice({ subType: 'B2B', icv: 2, pih: lastHash });
        const { signedInvoiceXml: b2bXml, invoiceHash: b2bHash } =
            egs.signInvoice(b2bInv, compCert, privateKey, compRaw);
        await egs.checkInvoiceCompliance(b2bXml, b2bHash, compCert, compSecret);
        lastHash = b2bHash;
        console.log('         ✔ PASS\n');
    } catch (err) {
        if (err.message && err.message.includes('does not cover Standard documents')) {
            console.log('         ✔ SKIPPED (CSID is 0100 Simplified Only)\n');
        } else {
            throw err;
        }
    }

    // 3c — Credit Note
    console.log('   [3/4] Credit Note (Refund)...');
    egsConfig.cancelation = { cancelation_type: 'CREDIT_NOTE', canceled_invoice_number: b2cInv.invoice_serial_number };
    const creditInv = buildInvoice({ subType: 'B2C', icv: 3, pih: lastHash,
                                     cancelType: 'CREDIT_NOTE', canceledRef: b2cInv.invoice_serial_number,
                                     cancelReason: 'Return of goods' });
    const { signedInvoiceXml: creditXml, invoiceHash: creditHash } =
        egs.signInvoice(creditInv, compCert, privateKey, compRaw);
    await egs.checkInvoiceCompliance(creditXml, creditHash, compCert, compSecret);
    lastHash = creditHash;
    console.log('         ✔ PASS\n');

    // 3d — Debit Note
    console.log('   [4/4] Debit Note...');
    egsConfig.cancelation = { cancelation_type: 'DEBIT_NOTE', canceled_invoice_number: b2cInv.invoice_serial_number };
    const debitInv = buildInvoice({ subType: 'B2C', icv: 4, pih: lastHash,
                                    cancelType: 'DEBIT_NOTE', canceledRef: b2cInv.invoice_serial_number,
                                    cancelReason: 'Price adjustment' });
    const { signedInvoiceXml: debitXml, invoiceHash: debitHash } =
        egs.signInvoice(debitInv, compCert, privateKey, compRaw);
    await egs.checkInvoiceCompliance(debitXml, debitHash, compCert, compSecret);
    lastHash = debitHash;
    console.log('         ✔ PASS\n');

    // ── Step 4: Production CSID ─────────────────────────────────────────────
    console.log('── Step 4: Requesting Production CSID (PCSID)...');
    const { binarySecurityToken: prodCert, secret: prodSecret, rawToken: prodRaw }
        = await egs.issueProductionCertificate(requestID, compCert, compSecret);
    console.log('   ✔ Production CSID issued!\n');

    // ── Step 5: Write .env ──────────────────────────────────────────────────
    console.log('── Step 5: Writing Production Credentials to .env...');
    let env = fs.readFileSync(envPath, 'utf8');
    env = setEnvVar(env, 'ZATCA_ENV',             'production');
    env = setEnvVar(env, 'ZATCA_CERTIFICATE_PEM',  prodCert);
    env = setEnvVar(env, 'ZATCA_SECRET',           prodSecret);
    env = setEnvVar(env, 'ZATCA_RAW_TOKEN',        prodRaw);
    env = setEnvVar(env, 'ZATCA_PRIVATE_KEY_PEM',  privateKey);
    fs.writeFileSync(envPath, env, 'utf8');
    console.log('   ✔ .env updated with Production Credentials');

    // Clean up temp session
    try { fs.unlinkSync(path.resolve(__dirname, '..', 'tempComplianceSession.json')); } catch (_) {}

    console.log('\n========================================');
    console.log(' 🎉 PRODUCTION ONBOARDING COMPLETE!');
    console.log('========================================\n');
    console.log('Your server is now authorized for ZATCA production reporting.');
    console.log('Restart your server (npm run dev) to load the new credentials.\n');
}

main().catch(err => {
    console.error(`\n❌  Onboarding FAILED: ${err.message}\n`);
    process.exit(1);
});
