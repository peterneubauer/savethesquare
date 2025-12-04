#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the template file
const templatePath = path.join(__dirname, 'config.template.js');
const outputPath = path.join(__dirname, 'config.js');

console.log('Building config.js from template...');

// Get the STRIPE_TEST_MODE environment variable (defaults to 'false')
const stripeTestMode = process.env.STRIPE_TEST_MODE === 'true' ? 'true' : 'false';

// Get the EMAIL_TEST_MODE environment variable (defaults to same as STRIPE_TEST_MODE)
const emailTestMode = process.env.EMAIL_TEST_MODE !== undefined
    ? (process.env.EMAIL_TEST_MODE === 'true' ? 'true' : 'false')
    : stripeTestMode;

console.log(`STRIPE_TEST_MODE environment variable: ${process.env.STRIPE_TEST_MODE}`);
console.log(`EMAIL_TEST_MODE environment variable: ${process.env.EMAIL_TEST_MODE}`);
console.log(`Setting testMode to: ${stripeTestMode}`);
console.log(`Setting emailTestMode to: ${emailTestMode}`);

// Read template content
let configContent = fs.readFileSync(templatePath, 'utf8');

// Replace the placeholders with the actual values
configContent = configContent.replace('__STRIPE_TEST_MODE__', stripeTestMode);
configContent = configContent.replace('__EMAIL_TEST_MODE__', emailTestMode);

// Write the output file
fs.writeFileSync(outputPath, configContent, 'utf8');

console.log('✅ config.js has been generated successfully!');
