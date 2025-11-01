#!/usr/bin/env node

/**
 * Working Association for Nutrition Register Scraper
 *
 * Key findings:
 * - AJAX calls take 75-80 seconds to complete
 * - Must use 10 results per page for faster loading
 * - Anti-automation detection must be disabled
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const CONFIG = {
  radius: '50',
  perPage: '10', // Smaller pages load faster
  outputFile: 'nutritionists.json',
  statsFile: 'scraper-stats.json',
  waitTime: 90000, // 90 seconds to be safe
  delayBetweenSearches: 5000
};

// UK postcodes for coverage
const UK_POSTCODES = [
  'SW1A 1AA', 'E1W 3PG', 'N1 9AG', 'W1A 1AA', 'SE1 7PB',
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

    // Split by "Registration category:" to find each nutritionist
    const sections = text.split('Registration category:');

    sections.slice(1).forEach(section => {
      const lines = section.split('\n').map(l => l.trim()).filter(l => l);

      const nutritionist = {
        category: '',
        services: '',
        areas: '',
        specialism: '',
        email: '',
        website: '',
        rawText: section.substring(0, 500)
      };

      // Extract category (first line)
      if (lines[0]) {
        nutritionist.category = lines[0];
      }

      // Find email
      const emailMatch = section.match(/Email:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) nutritionist.email = emailMatch[1];

      // Find website
      const websiteMatch = section.match(/Website:\s*(https?:\/\/[^\s]+)/);
      if (websiteMatch) nutritionist.website = websiteMatch[1];

      // Find services
      const servicesMatch = section.match(/Services provided:\s*([^\n]+(?:\n(?!Areas of work:)[^\n]+)*)/);
      if (servicesMatch) nutritionist.services = servicesMatch[1].trim();

      // Find areas
      const areasMatch = section.match(/Areas of work:\s*([^\n]+(?:\n(?!Specialism:)[^\n]+)*)/);
      if (areasMatch) nutritionist.areas = areasMatch[1].trim();

      // Find specialism
      const specialismMatch = section.match(/Specialism:\s*([^\n]+)/);
      if (specialismMatch) nutritionist.specialism = specialismMatch[1].trim();

      // Only add if we have meaningful data
      if (nutritionist.email || nutritionist.website || nutritionist.services) {
        results.push(nutritionist);
      }
    });

    return results;
  });
}

/**
 * Search a single postcode
 */
async function searchPostcode(page, postcode) {
  console.log(`\nSearching: ${postcode}`);

  try {
    // Navigate to search page
    await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fill form
    await page.type('input[name="postcode"]', postcode, { delay: 100 });
    await page.select('select[name="postcode_radius"]', CONFIG.radius);
    await page.select('select[name="per_page"]', CONFIG.perPage);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit
    await page.click('button[type="submit"]');

    console.log(`  Waiting ${CONFIG.waitTime / 1000} seconds for results...`);

    // Wait for results with progress updates
    const startTime = Date.now();
    let lastLength = 0;

    while (Date.now() - startTime < CONFIG.waitTime) {
      await new Promise(resolve => setTimeout(resolve, 10000));

      const currentLength = await page.evaluate(() => document.body.textContent.length);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      if (currentLength !== lastLength) {
        console.log(`  ${elapsed}s: Page growing (${currentLength} chars)`);
        lastLength = currentLength;
      }

      // If content has grown significantly and stabilized, results might be ready
      if (currentLength > 35000 && currentLength === lastLength) {
        console.log(`  Results appear loaded at ${elapsed}s`);
        break;
      }
    }

    // Extract data
    const results = await extractNutritionists(page);
    console.log(`  Found ${results.length} nutritionists`);

    // Add to collection (dedupe by email)
    let newCount = 0;
    results.forEach(person => {
      const key = person.email || person.website || JSON.stringify(person);
      if (key && !nutritionists.has(key)) {
        nutritionists.set(key, person);
        newCount++;
      }
    });

    console.log(`  Added ${newCount} new (${results.length - newCount} duplicates)`);

    stats.postcodesSearched++;
    stats.totalResults += results.length;

  } catch (error) {
    console.error(`  Error: ${error.message}`);
    stats.errors.push({ postcode, error: error.message });
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Association for Nutrition Scraper - WORKING VERSION');
  console.log('='.repeat(60));
  console.log(`Config: ${CONFIG.perPage} results/page, ${CONFIG.radius} mile radius, ${CONFIG.waitTime/1000}s wait`);

  const testMode = process.argv.includes('--test');
  const postcodesToSearch = testMode ? [UK_POSTCODES[0]] : UK_POSTCODES;

  if (testMode) {
    console.log('\n🧪 TEST MODE: Single postcode only');
  }

  console.log(`\nSearching ${postcodesToSearch.length} postcodes...\n`);

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
  for (const postcode of postcodesToSearch) {
    await searchPostcode(page, postcode);

    if (!testMode) {
      console.log(`  Waiting ${CONFIG.delayBetweenSearches/1000}s before next search...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenSearches));
    }
  }

  await browser.close();

  // Save results
  const data = Array.from(nutritionists.values());
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(data, null, 2));

  stats.uniqueNutritionists = data.length;
  fs.writeFileSync(CONFIG.statsFile, JSON.stringify(stats, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE');
  console.log('='.repeat(60));
  console.log(`Postcodes searched: ${stats.postcodesSearched}`);
  console.log(`Total results found: ${stats.totalResults}`);
  console.log(`Unique nutritionists: ${stats.uniqueNutritionists}`);
  console.log(`Duplicates filtered: ${stats.totalResults - stats.uniqueNutritionists}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`\nData saved to: ${CONFIG.outputFile}`);
  console.log(`Stats saved to: ${CONFIG.statsFile}`);
}

main().catch(console.error);
