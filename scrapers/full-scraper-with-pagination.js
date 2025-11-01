#!/usr/bin/env node

/**
 * Full Scraper with Pagination Support
 *
 * Handles pagination to get ALL results from each postcode search
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const CONFIG = {
  radius: '50',
  perPage: '50', // Use 50 to minimize number of pages (543 pages -> 109 pages)
  outputFile: 'nutritionists-full.json',
  csvFile: 'nutritionists-full.csv',
  statsFile: 'scraper-stats-full.json',
  waitTime: 90000, // 90 seconds for results
  delayBetweenPages: 5000, // 5 seconds between pages
  delayBetweenSearches: 10000 // 10 seconds between postcodes
};

// UK postcodes - strategic selection for coverage
const UK_POSTCODES = [
  'E1W 3PG', 'SW1A 1AA', 'N1 9AG', 'W1A 1AA', 'SE1 7PB',
  'BS1 1AA', 'EX1 1AA', 'PL1 1AA', 'BA1 1AA',
  'B1 1AA', 'NG1 1AA', 'LE1 1AA', 'CV1 1AA',
  'CB1 1AA', 'IP1 1AA', 'NR1 1AA',
  'M1 1AA', 'L1 1AA', 'PR1 1AA',
  'LS1 1AA', 'S1 1AA', 'NE1 1AA', 'YO1 7AA',
  'G1 1AA', 'EH1 1AA', 'AB10 1AA',
  'CF10 1AA', 'SA1 1AA',
  'BT1 1AA'
];

const nutritionists = new Map();
const stats = {
  postcodesSearched: 0,
  pagesScraped: 0,
  totalResults: 0,
  uniqueNutritionists: 0,
  errors: []
};

/**
 * Extract pagination info from page
 */
async function getPaginationInfo(page) {
  return await page.evaluate(() => {
    const text = document.body.textContent;

    // Look for "Showing page X of Y"
    const match = text.match(/Showing page\s+(\d+)\s+of\s+(\d+)/i);
    if (match) {
      return {
        currentPage: parseInt(match[1]),
        totalPages: parseInt(match[2]),
        hasNext: text.includes('Next >')
      };
    }

    // Also check for total results
    const resultsMatch = text.match(/(\d+)\s+results found/i);
    return {
      currentPage: 1,
      totalPages: 1,
      hasNext: false,
      totalResults: resultsMatch ? parseInt(resultsMatch[1]) : 0
    };
  });
}

/**
 * Extract nutritionist data from page
 */
async function extractNutritionists(page) {
  return await page.evaluate(() => {
    const results = [];
    const text = document.body.textContent;

    // Split by "Registration category:" to find each nutritionist
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
        phone: '',
        address: ''
      };

      // Extract category (first line)
      const lines = section.split('\n').map(l => l.trim()).filter(l => l);
      if (lines[0]) {
        nutritionist.category = lines[0];
      }

      // Extract registration number
      const regMatch = section.match(/Registration\s+(?:number|#)?\s*:?\s*(\d{4,})/i);
      if (regMatch) nutritionist.registrationNumber = regMatch[1];

      // Extract email
      const emailMatch = section.match(/Email:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
      if (emailMatch) nutritionist.email = emailMatch[1];

      // Extract website
      const websiteMatch = section.match(/Website:\s*(https?:\/\/[^\s]+)/i);
      if (websiteMatch) nutritionist.website = websiteMatch[1];

      // Extract phone
      const phoneMatch = section.match(/(?:Phone|Tel|Telephone):\s*([0-9\s\+\(\)-]+)/i);
      if (phoneMatch) nutritionist.phone = phoneMatch[1].trim();

      // Extract services
      const servicesMatch = section.match(/Services provided:\s*([^\n]+(?:\n(?!Areas of work:|Specialism:|Email:|Website:)[^\n]+)*)/i);
      if (servicesMatch) nutritionist.services = servicesMatch[1].trim();

      // Extract areas
      const areasMatch = section.match(/Areas of work:\s*([^\n]+(?:\n(?!Specialism:|Email:|Website:)[^\n]+)*)/i);
      if (areasMatch) nutritionist.areas = areasMatch[1].trim();

      // Extract specialism
      const specialismMatch = section.match(/Specialism:\s*([^\n]+)/i);
      if (specialismMatch) nutritionist.specialism = specialismMatch[1].trim();

      // Only add if we have meaningful data
      if (nutritionist.email || nutritionist.website || nutritionist.registrationNumber) {
        results.push(nutritionist);
      }
    });

    return results;
  });
}

/**
 * Click next page button and wait for results
 */
async function goToNextPage(page) {
  console.log('    Clicking Next...');

  // Click the Next button
  await page.evaluate(() => {
    const nextButtons = Array.from(document.querySelectorAll('button, input, a'))
      .filter(el => el.textContent.includes('Next >') || el.textContent.includes('Next'));
    if (nextButtons.length > 0) {
      nextButtons[0].click();
    }
  });

  // Wait for new results
  console.log('    Waiting for next page to load...');
  await new Promise(resolve => setTimeout(resolve, CONFIG.waitTime));
}

/**
 * Search a single postcode with pagination
 */
async function searchPostcode(page, postcode) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Searching: ${postcode}`);
  console.log('='.repeat(60));

  try {
    // Navigate to search page
    await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fill form
    console.log('  Filling form...');
    await page.type('input[name="postcode"]', postcode, { delay: 100 });
    await page.select('select[name="postcode_radius"]', CONFIG.radius);
    await page.select('select[name="per_page"]', CONFIG.perPage);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit
    console.log('  Submitting search...');
    await page.click('button[type="submit"]');

    console.log(`  Waiting ${CONFIG.waitTime / 1000}s for initial results...`);
    await new Promise(resolve => setTimeout(resolve, CONFIG.waitTime));

    // Get pagination info
    const pagination = await getPaginationInfo(page);
    console.log(`  Found ${pagination.totalResults || 'unknown'} results`);
    console.log(`  Pages: ${pagination.currentPage} of ${pagination.totalPages}`);

    let allResults = [];
    let pageNum = 1;

    // Process all pages
    while (pageNum <= pagination.totalPages) {
      console.log(`  Processing page ${pageNum}/${pagination.totalPages}...`);

      const pageResults = await extractNutritionists(page);
      console.log(`    Extracted ${pageResults.length} nutritionists from this page`);
      allResults = allResults.concat(pageResults);

      stats.pagesScraped++;

      // Check if there's a next page
      if (pageNum < pagination.totalPages) {
        await goToNextPage(page);
        pageNum++;
      } else {
        break;
      }

      // Safety limit
      if (pageNum > 200) {
        console.log('    ⚠️ Reached page limit of 200, stopping');
        break;
      }
    }

    // Add to collection (dedupe by email or registration number)
    let newCount = 0;
    allResults.forEach(person => {
      const key = person.registrationNumber || person.email || person.website || JSON.stringify(person);
      if (key && !nutritionists.has(key)) {
        nutritionists.set(key, person);
        newCount++;
      }
    });

    console.log(`  Total from ${postcode}: ${allResults.length} found, ${newCount} new, ${allResults.length - newCount} duplicates`);

    stats.postcodesSearched++;
    stats.totalResults += allResults.length;

    // Save progress after each postcode
    saveResults();

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    stats.errors.push({ postcode, error: error.message });
  }
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data) {
  if (data.length === 0) return '';

  // CSV headers
  const headers = [
    'Registration Number',
    'Category',
    'Name',
    'Email',
    'Website',
    'Phone',
    'Services Provided',
    'Areas of Work',
    'Specialism',
    'Address'
  ];

  // Escape CSV value
  const escapeCSV = (value) => {
    if (!value) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV
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
      escapeCSV(person.specialism),
      escapeCSV(person.address)
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
}

/**
 * Save results to files (JSON and CSV)
 */
function saveResults() {
  const data = Array.from(nutritionists.values());

  // Save JSON
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(data, null, 2));

  // Save CSV
  const csv = convertToCSV(data);
  fs.writeFileSync(CONFIG.csvFile, csv);

  // Save stats
  stats.uniqueNutritionists = data.length;
  fs.writeFileSync(CONFIG.statsFile, JSON.stringify(stats, null, 2));
}

/**
 * Main function
 */
async function main() {
  console.log('Association for Nutrition Scraper - FULL WITH PAGINATION');
  console.log('='.repeat(60));
  console.log(`Config:`);
  console.log(`  - Results per page: ${CONFIG.perPage}`);
  console.log(`  - Search radius: ${CONFIG.radius} miles`);
  console.log(`  - Wait time: ${CONFIG.waitTime/1000}s`);
  console.log(`  - Delay between pages: ${CONFIG.delayBetweenPages/1000}s`);
  console.log(`  - Delay between postcodes: ${CONFIG.delayBetweenSearches/1000}s`);

  const testMode = process.argv.includes('--test');
  const postcodesToSearch = testMode ? [UK_POSTCODES[0]] : UK_POSTCODES;

  if (testMode) {
    console.log('\n🧪 TEST MODE: Single postcode with full pagination');
  }

  console.log(`\nWill search ${postcodesToSearch.length} postcodes\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await browser.newPage();

  // Hide webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // Search each postcode
  for (let i = 0; i < postcodesToSearch.length; i++) {
    const postcode = postcodesToSearch[i];
    console.log(`\n[${i + 1}/${postcodesToSearch.length}]`);

    await searchPostcode(page, postcode);

    if (i < postcodesToSearch.length - 1 && !testMode) {
      console.log(`\n  Waiting ${CONFIG.delayBetweenSearches/1000}s before next postcode...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenSearches));
    }
  }

  await browser.close();

  // Final save and summary
  saveResults();

  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Postcodes searched: ${stats.postcodesSearched}`);
  console.log(`Pages scraped: ${stats.pagesScraped}`);
  console.log(`Total results found: ${stats.totalResults}`);
  console.log(`Unique nutritionists: ${stats.uniqueNutritionists}`);
  console.log(`Duplicates filtered: ${stats.totalResults - stats.uniqueNutritionists}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`\nData saved to:`);
  console.log(`  - JSON: ${CONFIG.outputFile}`);
  console.log(`  - CSV: ${CONFIG.csvFile}`);
  console.log(`  - Stats: ${CONFIG.statsFile}`);

  // Calculate estimated total time
  const avgTimePerPostcode = (stats.pagesScraped * CONFIG.waitTime + stats.postcodesSearched * CONFIG.delayBetweenSearches) / 1000 / 60;
  console.log(`\nNote: With current settings, full scrape of all ${UK_POSTCODES.length} postcodes`);
  console.log(`will take approximately ${Math.round(avgTimePerPostcode * UK_POSTCODES.length / stats.postcodesSearched)} minutes`);
}

main().catch(console.error);
