#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs';

async function approach1() {
  console.log('\n=== APPROACH 1: Wait for specific selector ===');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
    waitUntil: 'networkidle2'
  });

  await page.type('input[name="postcode"]', 'E1W 3PG');
  await page.select('select[name="postcode_radius"]', '50');
  await page.select('select[name="per_page"]', '50');

  console.log('Submitting and waiting for results container...');

  // Click and wait for a results container to appear
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForResponse(response =>
      response.url().includes('registrants') && response.status() === 200,
      { timeout: 90000 }
    ).catch(() => console.log('No API response detected'))
  ]);

  await new Promise(resolve => setTimeout(resolve, 10000));

  const hasResults = await page.evaluate(() => {
    return !document.body.textContent.includes('Searching');
  });

  console.log('Results loaded:', hasResults);
  await page.screenshot({ path: 'approach1.png', fullPage: true });

  await browser.close();
  return hasResults;
}

async function approach2() {
  console.log('\n=== APPROACH 2: Disable JavaScript initially, then enable ===');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
    waitUntil: 'domcontentloaded'
  });

  // Wait for page to be fully loaded
  await new Promise(resolve => setTimeout(resolve, 5000));

  await page.type('input[name="postcode"]', 'E1W 3PG');
  await page.select('select[name="postcode_radius"]', '50');
  await page.select('select[name="per_page"]', '50');

  console.log('Submitting form...');
  await page.click('button[type="submit"]');

  console.log('Waiting 60 seconds for AJAX...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  const text = await page.evaluate(() => document.body.textContent);
  const hasResults = !text.includes('Searching');

  console.log('Results loaded:', hasResults);
  console.log('Text includes "Showing":', text.includes('Showing'));
  await page.screenshot({ path: 'approach2.png', fullPage: true });

  await browser.close();
  return hasResults;
}

async function approach3() {
  console.log('\n=== APPROACH 3: Use evaluate to trigger form submission ===');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
    waitUntil: 'networkidle0'
  });

  // Fill form using JavaScript
  await page.evaluate(() => {
    document.querySelector('input[name="postcode"]').value = 'E1W 3PG';
    document.querySelector('select[name="postcode_radius"]').value = '50';
    document.querySelector('select[name="per_page"]').value = '50';
  });

  console.log('Triggering form submit via JavaScript...');

  // Submit using JavaScript
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.submit();
    } else {
      // Try clicking the button
      document.querySelector('button[type="submit"]').click();
    }
  });

  console.log('Waiting 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  const hasResults = await page.evaluate(() => {
    return !document.body.textContent.includes('Searching');
  });

  console.log('Results loaded:', hasResults);
  await page.screenshot({ path: 'approach3.png', fullPage: true });

  await browser.close();
  return hasResults;
}

async function approach4() {
  console.log('\n=== APPROACH 4: Wait for jQuery and use it ===');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
    waitUntil: 'networkidle0'
  });

  // Check if jQuery is available
  const hasJQuery = await page.evaluate(() => typeof jQuery !== 'undefined');
  console.log('jQuery available:', hasJQuery);

  await page.type('input[name="postcode"]', 'E1W 3PG');
  await page.select('select[name="postcode_radius"]', '50');
  await page.select('select[name="per_page"]', '50');

  // Monitor AJAX requests
  let ajaxCompleted = false;
  page.on('console', msg => console.log('Browser console:', msg.text()));

  await page.evaluate(() => {
    // Set up AJAX monitoring if jQuery is available
    if (typeof jQuery !== 'undefined') {
      jQuery(document).ajaxComplete(function() {
        console.log('AJAX request completed!');
      });
    }
  });

  console.log('Submitting...');
  await page.click('button[type="submit"]');

  console.log('Waiting 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  const hasResults = await page.evaluate(() => {
    return !document.body.textContent.includes('Searching');
  });

  console.log('Results loaded:', hasResults);
  await page.screenshot({ path: 'approach4.png', fullPage: true });

  await browser.close();
  return hasResults;
}

async function approach5() {
  console.log('\n=== APPROACH 5: Use real Chrome with user data ===');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await browser.newPage();

  // Set realistic headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8'
  });

  // Override navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  await page.goto('https://www.associationfornutrition.org/register/search-the-register', {
    waitUntil: 'networkidle0'
  });

  await page.type('input[name="postcode"]', 'E1W 3PG');
  await page.select('select[name="postcode_radius"]', '50');
  await page.select('select[name="per_page"]', '50');

  console.log('Submitting...');
  await page.click('button[type="submit"]');

  console.log('Waiting 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  const hasResults = await page.evaluate(() => {
    return !document.body.textContent.includes('Searching');
  });

  console.log('Results loaded:', hasResults);
  await page.screenshot({ path: 'approach5.png', fullPage: true });

  await browser.close();
  return hasResults;
}

async function main() {
  console.log('Testing different approaches to get JavaScript working...\n');

  const results = {};

  try {
    results.approach1 = await approach1();
  } catch (e) {
    console.error('Approach 1 failed:', e.message);
    results.approach1 = false;
  }

  try {
    results.approach2 = await approach2();
  } catch (e) {
    console.error('Approach 2 failed:', e.message);
    results.approach2 = false;
  }

  try {
    results.approach3 = await approach3();
  } catch (e) {
    console.error('Approach 3 failed:', e.message);
    results.approach3 = false;
  }

  try {
    results.approach4 = await approach4();
  } catch (e) {
    console.error('Approach 4 failed:', e.message);
    results.approach4 = false;
  }

  try {
    results.approach5 = await approach5();
  } catch (e) {
    console.error('Approach 5 failed:', e.message);
    results.approach5 = false;
  }

  console.log('\n=== RESULTS SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));

  const successful = Object.entries(results).filter(([_, success]) => success);
  if (successful.length > 0) {
    console.log(`\n✓ Success! ${successful.map(([name]) => name).join(', ')} worked!`);
  } else {
    console.log('\n✗ All approaches failed to load results');
  }
}

main().catch(console.error);
