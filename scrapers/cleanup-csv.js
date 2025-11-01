#!/usr/bin/env node

/**
 * Clean up CSV - Create a proper flat CSV from the scraped JSON
 *
 * Fixes:
 * - Removes embedded newlines and excessive whitespace
 * - Extracts name from embedded data
 * - Cleans up services, areas, specialism fields
 * - Removes HTML artifacts and social media mentions
 * - Flattens to single-line records
 */

import fs from 'fs';

const INPUT_FILE = process.argv[2] || 'nutritionists-all.json';
const OUTPUT_FILE = INPUT_FILE.replace('.json', '-clean.csv');

console.log(`Reading from: ${INPUT_FILE}`);
console.log(`Writing to: ${OUTPUT_FILE}`);

// Read JSON
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

console.log(`\nProcessing ${data.length} records...`);

// Clean a text field - remove newlines, excess whitespace, HTML artifacts
function cleanText(text) {
  if (!text) return '';

  return text
    .replace(/\n/g, ' ')           // Replace newlines with spaces
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .replace(/\s*,\s*/g, ', ')     // Normalize comma spacing
    .trim();
}

// Extract name from messy data
function extractName(record) {
  // Try the name field first
  if (record.name && record.name.trim() && !record.name.includes('Registration')) {
    return cleanText(record.name);
  }

  // Look in services or areas fields for pattern like "Name\nRegistration number:"
  const combined = `${record.services} ${record.areas}`;
  const nameMatch = combined.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*Registration number:/);
  if (nameMatch) {
    return cleanText(nameMatch[1]);
  }

  return '';
}

// Clean services field - remove embedded areas/specialism/email etc
function cleanServices(text) {
  if (!text) return '';

  // Remove everything after first occurrence of these markers
  let cleaned = text
    .replace(/Areas of work:.*$/is, '')
    .replace(/Specialism:.*$/is, '')
    .replace(/Email:.*$/is, '')
    .replace(/Website:.*$/is, '')
    .replace(/Twitter:.*$/is, '')
    .replace(/LinkedIn:.*$/is, '')
    .replace(/Current Sanction.*$/is, '')
    .replace(/Registration number:.*$/is, '')
    .replace(/Registration status:.*$/is, '');

  return cleanText(cleaned);
}

// Clean areas field - extract only areas list
function cleanAreas(text) {
  if (!text) return '';

  // Remove services if present at start
  let cleaned = text.replace(/^.*?Areas of work:\s*/is, '');

  // Remove everything after specialism
  cleaned = cleaned
    .replace(/Specialism:.*$/is, '')
    .replace(/Email:.*$/is, '')
    .replace(/Website:.*$/is, '')
    .replace(/Twitter:.*$/is, '')
    .replace(/LinkedIn:.*$/is, '')
    .replace(/Current Sanction.*$/is, '')
    .replace(/Registration number:.*$/is, '')
    .replace(/Registration status:.*$/is, '');

  return cleanText(cleaned);
}

// Clean specialism field
function cleanSpecialism(text) {
  if (!text) return '';

  // Remove everything before and after specialism
  let cleaned = text.replace(/^.*?Specialism:\s*/is, '');

  cleaned = cleaned
    .replace(/Email:.*$/is, '')
    .replace(/Website:.*$/is, '')
    .replace(/Twitter:.*$/is, '')
    .replace(/LinkedIn:.*$/is, '')
    .replace(/Current Sanction.*$/is, '')
    .replace(/Registration number:.*$/is, '')
    .replace(/Registration status:.*$/is, '');

  return cleanText(cleaned);
}

// Process all records
const cleanedData = data.map(record => {
  const cleaned = {
    registrationNumber: record.registrationNumber || '',
    category: cleanText(record.category),
    name: extractName(record),
    email: record.email || '',
    website: record.website || '',
    phone: cleanText(record.phone),
    services: cleanServices(record.services),
    areas: cleanAreas(record.areas),
    specialism: cleanSpecialism(record.specialism)
  };

  return cleaned;
});

// Convert to CSV
function escapeCSV(value) {
  if (!value) return '';
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const headers = [
  'Registration Number',
  'Category',
  'Name',
  'Email',
  'Website',
  'Phone',
  'Services Provided',
  'Areas of Work',
  'Specialism'
];

let csv = headers.join(',') + '\n';

cleanedData.forEach(record => {
  const row = [
    escapeCSV(record.registrationNumber),
    escapeCSV(record.category),
    escapeCSV(record.name),
    escapeCSV(record.email),
    escapeCSV(record.website),
    escapeCSV(record.phone),
    escapeCSV(record.services),
    escapeCSV(record.areas),
    escapeCSV(record.specialism)
  ];
  csv += row.join(',') + '\n';
});

// Write output
fs.writeFileSync(OUTPUT_FILE, csv);

console.log(`\n✅ Cleaned CSV written to: ${OUTPUT_FILE}`);
console.log(`\nStats:`);
console.log(`  Total records: ${cleanedData.length}`);
console.log(`  With names: ${cleanedData.filter(r => r.name).length}`);
console.log(`  With emails: ${cleanedData.filter(r => r.email).length}`);
console.log(`  With websites: ${cleanedData.filter(r => r.website).length}`);
console.log(`  With services: ${cleanedData.filter(r => r.services).length}`);
console.log(`  With areas: ${cleanedData.filter(r => r.areas).length}`);
