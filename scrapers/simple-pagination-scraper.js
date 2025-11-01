#!/usr/bin/env node

/**
 * Simple Single-Search Scraper with Pagination
 *
 * Strategy: ONE search, paginate through ALL results
 * - No postcode filtering (it doesn't work anyway - returns everyone)
 * - Just page through all 109 pages once
 * - Total time: 109 pages × 90s = ~2.7 hours
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const CONFIG = {
  perPage: '50', // Max results per page
  outputFile: 'nutritionists-all.json',
  csvFile: 'nutritionists-all.csv',
  statsFile: 'scraper-stats-all.json',
  waitTime: 90000, // 90 seconds per page
  maxPages: 200 // Safety limit
};

const nutritionists = new Map();
const stats = {
  pagesScraped: 0,
  totalResults: 0,
  uniqueNutritionists: 0,
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
 * Get pagination info
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

    // Look for total results
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
 * Click next page
 */
async function clickNext(page) {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, input, a'));
    const nextButton = buttons.find(b => b.textContent.includes('Next >'));
    if (nextButton) {
      nextButton.click();
    }
  });
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
 * Main function
 */
async function main() {
  console.log('Simple Pagination Scraper - Get EVERYONE');
  console.log('='.repeat(60));
  console.log('Strategy: ONE search, paginate through all results');
  console.log(`Estimated time: ~2.7 hours (109 pages × 90s each)\n`);

  const testMode = process.argv.includes('--test');
  const maxPagesToScrape = testMode ? 3 : CONFIG.maxPages;

  if (testMode) {
    console.log('🧪 TEST MODE: First 3 pages only\n');
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

  try {
    console.log('Loading search page...');
    await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Submit search with just results per page (no postcode - get everyone)
    console.log('Setting results per page to 50...');
    await page.select('select[name="per_page"]', CONFIG.perPage);

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Submitting search...\n');
    await page.click('button[type="submit"]');

    console.log(`Waiting ${CONFIG.waitTime / 1000}s for initial results...\n`);
    await new Promise(resolve => setTimeout(resolve, CONFIG.waitTime));

    // Get pagination info
    const initialInfo = await getPaginationInfo(page);
    console.log(`Total results: ${initialInfo.totalResults}`);
    console.log(`Total pages: ${initialInfo.totalPages}`);
    console.log(`Pages to scrape: ${Math.min(initialInfo.totalPages, maxPagesToScrape)}\n`);

    let currentPage = 1;

    // Paginate through all results
    while (currentPage <= Math.min(initialInfo.totalPages, maxPagesToScrape)) {
      console.log(`${'='.repeat(60)}`);
      console.log(`Page ${currentPage}/${initialInfo.totalPages}`);
      console.log('='.repeat(60));

      // Extract data from current page
      const results = await extractNutritionists(page);
      console.log(`Extracted: ${results.length} nutritionists`);

      // Add to collection
      let newCount = 0;
      results.forEach(person => {
        const key = person.registrationNumber || person.email || person.website || JSON.stringify(person);
        if (key && !nutritionists.has(key)) {
          nutritionists.set(key, person);
          newCount++;
        }
      });

      console.log(`New: ${newCount}, Duplicates: ${results.length - newCount}`);
      console.log(`Total unique so far: ${nutritionists.size}`);

      stats.pagesScraped++;
      stats.totalResults += results.length;

      // Save progress every page (so you can see results immediately)
      saveResults();
      if (currentPage % 10 === 0) {
        console.log('💾 Progress checkpoint (page 10)');
      }

      // Check if there's a next page
      const pageInfo = await getPaginationInfo(page);
      if (currentPage >= Math.min(initialInfo.totalPages, maxPagesToScrape)) {
        console.log('\n✅ Reached final page');
        break;
      }

      // Click next
      console.log('\nClicking Next...');
      await clickNext(page);

      console.log(`Waiting ${CONFIG.waitTime / 1000}s for next page...\n`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.waitTime));

      currentPage++;
    }

  } catch (error) {
    console.error('Error:', error.message);
    stats.errors.push({ error: error.message });
  }

  await browser.close();

  // Final save
  saveResults();

  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Pages scraped: ${stats.pagesScraped}`);
  console.log(`Total results extracted: ${stats.totalResults}`);
  console.log(`Unique nutritionists: ${stats.uniqueNutritionists}`);
  console.log(`Duplicates filtered: ${stats.totalResults - stats.uniqueNutritionists}`);
  console.log(`Coverage: ${Math.round(stats.uniqueNutritionists / 5426 * 100)}% of 5,426 total`);
  console.log(`\nFiles saved:`);
  console.log(`  - ${CONFIG.outputFile}`);
  console.log(`  - ${CONFIG.csvFile}`);
  console.log(`  - ${CONFIG.statsFile}`);

  const timeSpent = stats.pagesScraped * CONFIG.waitTime / 1000 / 60;
  console.log(`\nTime spent: ${Math.round(timeSpent)} minutes`);
}

main().catch(console.error);
