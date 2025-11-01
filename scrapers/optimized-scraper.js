#!/usr/bin/env node

/**
 * Optimized Scraper - NO PAGINATION Strategy
 *
 * Instead of paginating (which takes 90s per page), we use:
 * - MANY postcodes with smaller radius
 * - Get first 50 results only from each
 * - Deduplication handles overlaps
 *
 * This is MUCH faster: 200 postcodes × 90s = 5 hours
 * vs. 30 postcodes × 109 pages × 90s = 82 hours!
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const CONFIG = {
  radius: '10', // Reduced to 10 miles - no pagination needed
  perPage: '50',
  outputFile: 'nutritionists-optimized.json',
  csvFile: 'nutritionists-optimized.csv',
  statsFile: 'scraper-stats-optimized.json',
  waitTime: 90000,
  delayBetweenSearches: 3000 // 3s between postcodes
};

// COMPREHENSIVE postcode list - major towns/cities across UK
// Strategy: Dense coverage with 10-mile radius, minimal overlap
const UK_POSTCODES = [
  // London (dense grid)
  'E1 6AN', 'E14 5AB', 'EC1A 1BB', 'N1 9AG', 'NW1 2DB',
  'SE1 7PB', 'SW1A 1AA', 'W1A 1AA', 'W6 7HB', 'WC2N 5DU',

  // Greater London
  'BR1 1JG', 'CR0 1EA', 'DA1 1BP', 'EN1 1FA', 'HA0 1HB',
  'IG1 1AZ', 'KT1 1EU', 'RM1 1AU', 'SM1 1EA', 'TW1 1DY',
  'UB1 1AA', 'WD17 1AP',

  // South East
  'BN1 1AA', 'BN2 1JQ', 'BN11 1AA', 'CT1 1AA', 'GU1 1AA',
  'ME1 1AA', 'MK9 1AA', 'OX1 1AA', 'PO1 1AA', 'RG1 1AA',
  'RH1 1AA', 'SL1 1AA', 'SO14 2AJ', 'TN1 1AA',

  // South West
  'BA1 1AA', 'BA21 5AX', 'BS1 1AA', 'DT1 1AA', 'EX1 1AA',
  'GL1 1AA', 'PL1 1AA', 'SN1 1AA', 'TA1 1AA', 'TQ1 1AA',
  'TR1 1AA',

  // East of England
  'CB1 1AA', 'CB5 8AA', 'CM1 1AA', 'CO1 1AA', 'IP1 1AA',
  'LU1 1AA', 'NR1 1AA', 'PE1 1AA', 'SG1 1AA', 'SS1 1AA',

  // East Midlands
  'DE1 1AA', 'LE1 1AA', 'LN1 1AA', 'NG1 1AA', 'NN1 1AA',
  'S1 1AA', 'S40 1AA', 'S70 1AA',

  // West Midlands
  'B1 1AA', 'B91 3AA', 'CV1 1AA', 'DY1 1AA', 'HR1 1AA',
  'ST1 1AA', 'SY1 1AA', 'TF1 1AA', 'WR1 1AA', 'WS1 1AA',
  'WV1 1AA',

  // Yorkshire & Humber
  'BD1 1AA', 'DN1 1AA', 'HD1 1AA', 'HG1 1AA', 'HU1 1AA',
  'LS1 1AA', 'S1 1AA', 'WF1 1AA', 'YO1 1AA',

  // North West
  'BB1 1AA', 'BL1 1AA', 'CA1 1AA', 'CH1 1AA', 'CW1 1AA',
  'FY1 1AA', 'L1 1AA', 'LA1 1AA', 'M1 1AA', 'OL1 1AA',
  'PR1 1AA', 'SK1 1AA', 'WA1 1AA', 'WN1 1AA',

  // North East
  'DH1 1AA', 'DL1 1AA', 'NE1 1AA', 'NE23 1AA', 'SR1 1AA',
  'TS1 1AA',

  // Scotland - Major cities
  'AB10 1AA', 'AB25 1AA', 'DD1 1AA', 'DG1 1AA', 'EH1 1AA',
  'EH6 5NP', 'FK1 1AA', 'G1 1AA', 'G73 1AA', 'IV1 1AA',
  'KA1 1AA', 'KY1 1AA', 'PA1 1AA', 'PH1 1AA',

  // Wales
  'CF10 1AA', 'CF24 1AA', 'CF31 1AA', 'LL11 1AA', 'LL13 7AA',
  'NP20 1AA', 'SA1 1AA', 'SA31 1AA', 'SA61 1AA',

  // Northern Ireland
  'BT1 1AA', 'BT48 6AA', 'BT74 6AA'
];

console.log(`Total postcodes: ${UK_POSTCODES.length}`);

const nutritionists = new Map();
const stats = {
  postcodesSearched: 0,
  totalResults: 0,
  uniqueNutritionists: 0,
  postcodesWithResults: [],
  postcodesWithNoResults: [],
  errors: []
};

/**
 * Extract nutritionist data from page
 */
async function extractNutritionists(page) {
  return await page.evaluate(() => {
    const results = [];
    const text = document.body.textContent;
    const sections = text.split('Registration category:');

    sections.slice(1).forEach(section => {
      const nutritionist = {
        category: '',
        registrationNumber: '',
        name: '',
        services: '',
        areas: '',
        specialism: '',
        email: '',
        website: '',
        phone: ''
      };

      const lines = section.split('\n').map(l => l.trim()).filter(l => l);
      if (lines[0]) nutritionist.category = lines[0];

      const regMatch = section.match(/Registration\s+(?:number|#)?\s*:?\s*(\d{4,})/i);
      if (regMatch) nutritionist.registrationNumber = regMatch[1];

      const emailMatch = section.match(/Email:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
      if (emailMatch) nutritionist.email = emailMatch[1];

      const websiteMatch = section.match(/Website:\s*(https?:\/\/[^\s]+)/i);
      if (websiteMatch) nutritionist.website = websiteMatch[1];

      const phoneMatch = section.match(/(?:Phone|Tel):\s*([0-9\s\+\(\)-]+)/i);
      if (phoneMatch) nutritionist.phone = phoneMatch[1].trim();

      const servicesMatch = section.match(/Services provided:\s*([^\n]+(?:\n(?!Areas of work:|Specialism:)[^\n]+)*)/i);
      if (servicesMatch) nutritionist.services = servicesMatch[1].trim();

      const areasMatch = section.match(/Areas of work:\s*([^\n]+(?:\n(?!Specialism:)[^\n]+)*)/i);
      if (areasMatch) nutritionist.areas = areasMatch[1].trim();

      const specialismMatch = section.match(/Specialism:\s*([^\n]+)/i);
      if (specialismMatch) nutritionist.specialism = specialismMatch[1].trim();

      if (nutritionist.email || nutritionist.website || nutritionist.registrationNumber) {
        results.push(nutritionist);
      }
    });

    return results;
  });
}

/**
 * Get result count
 */
async function getResultCount(page) {
  return await page.evaluate(() => {
    const text = document.body.textContent;
    const match = text.match(/(\d+)\s+results found/i);
    return match ? parseInt(match[1]) : 0;
  });
}

/**
 * Search single postcode (first page only!)
 */
async function searchPostcode(page, postcode, index, total) {
  console.log(`\n[${index}/${total}] Searching: ${postcode} (${CONFIG.radius} miles)`);

  try {
    await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.type('input[name="postcode"]', postcode, { delay: 100 });
    await page.select('select[name="postcode_radius"]', CONFIG.radius);
    await page.select('select[name="per_page"]', CONFIG.perPage);

    await new Promise(resolve => setTimeout(resolve, 500));
    await page.click('button[type="submit"]');

    console.log(`  Waiting ${CONFIG.waitTime / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, CONFIG.waitTime));

    const resultCount = await getResultCount(page);
    console.log(`  Found: ${resultCount} total results`);

    const results = await extractNutritionists(page);
    console.log(`  Extracted: ${results.length} from first page`);

    let newCount = 0;
    results.forEach(person => {
      const key = person.registrationNumber || person.email || person.website || JSON.stringify(person);
      if (key && !nutritionists.has(key)) {
        nutritionists.set(key, person);
        newCount++;
      }
    });

    console.log(`  New: ${newCount}, Duplicates: ${results.length - newCount}`);

    stats.postcodesSearched++;
    stats.totalResults += results.length;

    if (resultCount > 0) {
      stats.postcodesWithResults.push(postcode);
    } else {
      stats.postcodesWithNoResults.push(postcode);
    }

    // Save after every 10 postcodes
    if (index % 10 === 0) {
      saveResults();
      console.log(`  💾 Progress saved (${nutritionists.size} unique so far)`);
    }

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    stats.errors.push({ postcode, error: error.message });
  }
}

/**
 * Convert to CSV
 */
function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = ['Registration Number', 'Category', 'Name', 'Email', 'Website', 'Phone', 'Services Provided', 'Areas of Work', 'Specialism'];

  const escapeCSV = (value) => {
    if (!value) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  let csv = headers.join(',') + '\n';
  data.forEach(person => {
    const row = [
      escapeCSV(person.registrationNumber),
      escapeCSV(person.category),
      escapeCSV(person.name),
      escapeCSV(person.email),
      escapeCSV(person.website),
      escapeCSV(person.phone),
      escapeCSV(person.services),
      escapeCSV(person.areas),
      escapeCSV(person.specialism)
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
}

/**
 * Save results
 */
function saveResults() {
  const data = Array.from(nutritionists.values());
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(data, null, 2));

  const csv = convertToCSV(data);
  fs.writeFileSync(CONFIG.csvFile, csv);

  stats.uniqueNutritionists = data.length;
  fs.writeFileSync(CONFIG.statsFile, JSON.stringify(stats, null, 2));
}

/**
 * Main
 */
async function main() {
  console.log('OPTIMIZED SCRAPER - No Pagination Strategy');
  console.log('='.repeat(60));
  console.log(`Strategy: ${UK_POSTCODES.length} postcodes × ${CONFIG.radius} miles`);
  console.log(`Time estimate: ${UK_POSTCODES.length} × ${CONFIG.waitTime/1000}s = ${Math.round(UK_POSTCODES.length * CONFIG.waitTime / 1000 / 60)} minutes`);

  const testMode = process.argv.includes('--test');
  const postcodesToSearch = testMode ? UK_POSTCODES.slice(0, 5) : UK_POSTCODES;

  if (testMode) {
    console.log(`\n🧪 TEST MODE: First 5 postcodes only`);
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  for (let i = 0; i < postcodesToSearch.length; i++) {
    await searchPostcode(page, postcodesToSearch[i], i + 1, postcodesToSearch.length);

    if (i < postcodesToSearch.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenSearches));
    }
  }

  await browser.close();

  saveResults();

  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE');
  console.log('='.repeat(60));
  console.log(`Postcodes searched: ${stats.postcodesSearched}`);
  console.log(`Postcodes with results: ${stats.postcodesWithResults.length}`);
  console.log(`Postcodes with no results: ${stats.postcodesWithNoResults.length}`);
  console.log(`Total results extracted: ${stats.totalResults}`);
  console.log(`Unique nutritionists: ${stats.uniqueNutritionists}`);
  console.log(`Duplicates filtered: ${stats.totalResults - stats.uniqueNutritionists}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`\nCoverage: ${Math.round(stats.uniqueNutritionists / 5426 * 100)}% of known 5,426 nutritionists`);
  console.log(`\nFiles saved:`);
  console.log(`  - ${CONFIG.outputFile}`);
  console.log(`  - ${CONFIG.csvFile}`);
  console.log(`  - ${CONFIG.statsFile}`);
}

main().catch(console.error);
