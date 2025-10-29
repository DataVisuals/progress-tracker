#!/usr/bin/env node

/**
 * Association for Nutrition Register Scraper
 *
 * This script searches the AfN register by postcode proximity to build
 * a comprehensive database of registered nutritionists across the UK.
 *
 * API Endpoint: https://www.associationfornutrition.org/wp-json/afn/registrants/search
 *
 * NOTE: The AfN register states it should not be used for commercial purposes.
 * This scraper is for educational/research purposes only.
 */

import https from 'https';
import fs from 'fs';

// Configuration
const CONFIG = {
  apiUrl: 'www.associationfornutrition.org',
  apiPath: '/wp-json/afn/registrants/search',
  radius: 50, // miles - use maximum to get broadest coverage
  perPage: 50, // results per page - use maximum
  outputFile: 'nutritionists.json',
  coverageFile: 'coverage-stats.json',
  delay: 1000 // delay between requests in ms to be polite
};

// UK postcodes for geographical spread
// These cover major regions across the UK
const UK_POSTCODES = [
  // England - London and South East
  'SW1A 1AA', // London Central
  'E1 6AN',    // East London
  'N1 9AG',    // North London
  'W1A 1AA',   // West London
  'SE1 7PB',   // South London
  'BR1 1JG',   // Bromley
  'GU1 1AA',   // Guildford
  'RH1 1AA',   // Redhill
  'BN1 1AA',   // Brighton

  // England - South West
  'BS1 1AA',   // Bristol
  'EX1 1AA',   // Exeter
  'PL1 1AA',   // Plymouth
  'BA1 1AA',   // Bath

  // England - Midlands
  'B1 1AA',    // Birmingham
  'NG1 1AA',   // Nottingham
  'LE1 1AA',   // Leicester
  'CV1 1AA',   // Coventry
  'DE1 1AA',   // Derby

  // England - East
  'CB1 1AA',   // Cambridge
  'IP1 1AA',   // Ipswich
  'NR1 1AA',   // Norwich
  'PE1 1AA',   // Peterborough

  // England - North West
  'M1 1AA',    // Manchester
  'L1 1AA',    // Liverpool
  'PR1 1AA',   // Preston
  'CH1 1AA',   // Chester

  // England - North East
  'LS1 1AA',   // Leeds
  'S1 1AA',    // Sheffield
  'NE1 1AA',   // Newcastle
  'DL1 1AA',   // Darlington
  'YO1 7AA',   // York

  // Scotland
  'G1 1AA',    // Glasgow
  'EH1 1AA',   // Edinburgh
  'AB10 1AA',  // Aberdeen
  'DD1 1AA',   // Dundee
  'IV1 1AA',   // Inverness

  // Wales
  'CF10 1AA',  // Cardiff
  'SA1 1AA',   // Swansea
  'LL11 1AA',  // Wrexham

  // Northern Ireland
  'BT1 1AA',   // Belfast
  'BT48 6AA',  // Derry
];

// Store all unique nutritionists (keyed by registration number)
const nutritionists = new Map();

// Coverage statistics
const stats = {
  totalSearches: 0,
  totalResults: 0,
  uniqueNutritionists: 0,
  postcodesSearched: [],
  errors: []
};

/**
 * Make API request to search for nutritionists
 */
function searchByPostcode(postcode, radius, page = 1) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      firstname: '',
      surname: '',
      registrationNumber: '',
      postcode: postcode,
      radius: radius,
      serviceProvided: [],
      areaOfWork: [],
      perPage: CONFIG.perPage,
      page: page
    });

    const options = {
      hostname: CONFIG.apiUrl,
      path: CONFIG.apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Process search results and add to our collection
 */
function processResults(results) {
  if (!results || !results.registrants) {
    return 0;
  }

  let newCount = 0;
  results.registrants.forEach(person => {
    if (person.registrationNumber && !nutritionists.has(person.registrationNumber)) {
      nutritionists.set(person.registrationNumber, person);
      newCount++;
    }
  });

  return newCount;
}

/**
 * Search all pages for a given postcode
 */
async function searchAllPages(postcode) {
  console.log(`\nSearching postcode: ${postcode} (${CONFIG.radius} mile radius)`);

  let page = 1;
  let totalForPostcode = 0;
  let newForPostcode = 0;

  try {
    // Get first page to determine total pages
    const firstResult = await searchByPostcode(postcode, CONFIG.radius, page);

    if (firstResult.error) {
      console.log(`  ⚠️  Error: ${firstResult.error}`);
      stats.errors.push({ postcode, error: firstResult.error });
      return;
    }

    const totalPages = firstResult.totalPages || 1;
    totalForPostcode = firstResult.total || 0;

    console.log(`  Found ${totalForPostcode} results across ${totalPages} page(s)`);

    // Process first page
    const newInPage = processResults(firstResult);
    newForPostcode += newInPage;

    // Get remaining pages
    for (page = 2; page <= totalPages; page++) {
      await sleep(CONFIG.delay);
      const result = await searchByPostcode(postcode, CONFIG.radius, page);
      const newInPage = processResults(result);
      newForPostcode += newInPage;
    }

    console.log(`  Added ${newForPostcode} new nutritionists (${totalForPostcode - newForPostcode} duplicates)`);

    stats.totalResults += totalForPostcode;
    stats.postcodesSearched.push(postcode);

  } catch (error) {
    console.error(`  ❌ Error searching ${postcode}:`, error.message);
    stats.errors.push({ postcode, error: error.message });
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Save results to files
 */
function saveResults() {
  // Save nutritionists data
  const data = Array.from(nutritionists.values());
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(data, null, 2));

  // Update and save stats
  stats.uniqueNutritionists = nutritionists.size;
  stats.totalSearches = stats.postcodesSearched.length;
  fs.writeFileSync(CONFIG.coverageFile, JSON.stringify(stats, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`✓ Postcodes searched: ${stats.totalSearches}`);
  console.log(`✓ Total results found: ${stats.totalResults}`);
  console.log(`✓ Unique nutritionists: ${stats.uniqueNutritionists}`);
  console.log(`✓ Duplicate entries: ${stats.totalResults - stats.uniqueNutritionists}`);
  console.log(`✓ Errors: ${stats.errors.length}`);
  console.log(`\nData saved to: ${CONFIG.outputFile}`);
  console.log(`Stats saved to: ${CONFIG.coverageFile}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('Association for Nutrition Register Scraper');
  console.log('='.repeat(60));
  console.log(`Configuration:`);
  console.log(`  - Radius: ${CONFIG.radius} miles`);
  console.log(`  - Results per page: ${CONFIG.perPage}`);
  console.log(`  - Postcodes to search: ${UK_POSTCODES.length}`);
  console.log(`  - Delay between requests: ${CONFIG.delay}ms`);

  // Test mode: search just one postcode if --test flag is provided
  const testMode = process.argv.includes('--test');
  const postcodesToSearch = testMode ? [UK_POSTCODES[0]] : UK_POSTCODES;

  if (testMode) {
    console.log('\n🧪 TEST MODE: Searching only first postcode');
  }

  // Search each postcode
  for (const postcode of postcodesToSearch) {
    await searchAllPages(postcode);
    if (testMode) break; // Only one in test mode
  }

  // Save results
  saveResults();
}

// Run the scraper
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
