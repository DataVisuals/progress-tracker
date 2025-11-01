# Association for Nutrition Register Scraper

This directory contains scripts designed to scrape nutritionist data from the Association for Nutrition (AfN) register using geographical postcode searches to achieve broad coverage across the UK.

## 📋 Overview

**Target Website:** https://www.associationfornutrition.org/register/search-the-register

**Goal:** Build a comprehensive database of registered nutritionists by searching multiple postcodes across the UK with maximum radius (50 miles) to ensure broad geographical coverage.

## 🔍 What We Discovered

### API Structure

The AfN register uses an AJAX-based search system:
- **Endpoint:** `https://www.associationfornutrition.org/wp-json/afn/registrants/search`
- **Method:** POST
- **Content-Type:** application/json

### Form Parameters

```javascript
{
  firstname: '',
  surname: '',
  registrationNumber: '',
  postcode: 'SW1A 1AA',     // Search center
  radius: 50,                 // miles (5, 10, 20, or 50)
  serviceProvided: [],
  areaOfWork: [],
  perPage: 50,               // results per page (10, 20, or 50)
  page: 1                    // current page number
}
```

### Form Fields Identified

- `input[name="postcode"]` - Postcode input
- `select[name="postcode_radius"]` - Radius selector (5, 10, 20, 50 miles)
- `select[name="per_page"]` - Results per page (10, 20, 50)
- `select[name="service_provided"]` - Service filter
- `select[name="area_of_work"]` - Area of work filter
- `button[type="submit"]` - Search submit button

## 🛠️ Scripts Included

### 1. `nutrition-scraper.js` (Original API-based)
Direct API approach using Node.js `https` module.
- **Status:** ❌ API requests timeout
- **Issue:** Cannot connect to API endpoint from this network

### 2. `nutrition-browser-scraper.js` (Puppeteer-based)
Browser automation using Puppeteer to interact with the actual web form.
- **Status:** ⚠️ Partial - Form submission works but AJAX results don't load
- **Issue:** Search API calls timeout even when using real browser

### 3. `debug-nutrition-scraper.js` & `debug-nutrition-scraper-v2.js`
Debug scripts that capture screenshots and detailed logging.
- **Status:** ✅ Successfully identified form structure and API behavior
- **Output:** Screenshots show form fills correctly but search hangs on "Searching..."

## 📍 Geographic Coverage Strategy

The scraper includes 41 strategically selected UK postcodes covering:

### England
- **London & South East:** SW1A 1AA, E1 6AN, N1 9AG, W1A 1AA, SE1 7PB, BR1 1JG, GU1 1AA, RH1 1AA, BN1 1AA
- **South West:** BS1 1AA, EX1 1AA, PL1 1AA, BA1 1AA
- **Midlands:** B1 1AA, NG1 1AA, LE1 1AA, CV1 1AA, DE1 1AA
- **East:** CB1 1AA, IP1 1AA, NR1 1AA, PE1 1AA
- **North West:** M1 1AA, L1 1AA, PR1 1AA, CH1 1AA
- **North East:** LS1 1AA, S1 1AA, NE1 1AA, DL1 1AA, YO1 7AA

### Scotland
- G1 1AA (Glasgow), EH1 1AA (Edinburgh), AB10 1AA (Aberdeen), DD1 1AA (Dundee), IV1 1AA (Inverness)

### Wales
- CF10 1AA (Cardiff), SA1 1AA (Swansea), LL11 1AA (Wrexham)

### Northern Ireland
- BT1 1AA (Belfast), BT48 6AA (Derry)

## ✅ SOLUTION FOUND

### The Problem
The AfN website's AJAX search takes **75-80 seconds** to load results - much longer than typical web applications.

### The Solution
- **Wait Time:** 90 seconds after form submission
- **Results Per Page:** 50 (to minimize pagination - reduces 543 pages to ~109 pages)
- **Pagination:** CRITICAL - Results are paginated and must be iterated through
- **Anti-Detection:** Disable Puppeteer automation flags

## 🚀 Alternative Approaches

### Option 1: Run from Different Network
The scripts may work from:
- A cloud server (AWS, Google Cloud, Azure)
- A VPS with different IP range
- A residential proxy service
- Different ISP/location

### Option 2: Manual Browser with DevTools
1. Open the search page in Chrome
2. Open DevTools (Network tab)
3. Perform searches manually for each postcode
4. Copy the JSON responses from the Network tab
5. Compile into a single dataset

### Option 3: Use Proxy/VPN
- Try running the scripts through a UK-based VPN
- Use a proxy service to route requests

### Option 4: Contact AfN Directly
Since the register states it's not for commercial use:
- Contact AfN to explain your use case
- Request bulk data export or API access
- Ensure compliance with their terms of service

### Option 5: Rate Limiting & Headers
Modify the scraper to:
- Add longer delays between requests (5-10 seconds)
- Randomize user agents
- Add more browser-like headers
- Use residential proxies

## 📦 Installation

```bash
npm install puppeteer
```

## 💻 Usage

### RECOMMENDED: Full Scraper with Pagination
```bash
# Test with one postcode (all pages)
node full-scraper-with-pagination.js --test

# Full run across all UK postcodes
node full-scraper-with-pagination.js
```

### Quick Test (Single Page Only)
```bash
node working-scraper.js --test
```

### Time Estimates
- **Single postcode with 50 results/page:** ~3 hours (109 pages × 90s = ~2.7 hours)
- **All 30 postcodes:** Depends on overlap, but could be 20+ hours
- **Recommended:** Run overnight or in multiple sessions

## 📊 Expected Output

### `nutritionists-full.json`
Array of nutritionist objects with fields:
```javascript
{
  "registrationNumber": "12345",
  "category": "RNutr - Registered Nutritionist",
  "name": "Dr. Jane Smith",
  "email": "jane@example.com",
  "website": "https://example.com",
  "phone": "01234 567890",
  "services": "Provide one-to-one dietary advice, ...",
  "areas": "Clinical Nutrition, Diabetes, ...",
  "specialism": "Sports Nutrition",
  "address": ""
}
```

### `nutritionists-full.csv`
Same data in CSV format with headers:
- Registration Number
- Category
- Name
- Email
- Website
- Phone
- Services Provided
- Areas of Work
- Specialism
- Address

### `scraper-stats-full.json`
Statistics about the scraping process:
```javascript
{
  "postcodesSearched": 30,
  "pagesScraped": 250,
  "totalResults": 12000,
  "uniqueNutritionists": 5426,
  "errors": []
}
```

## 📝 Important Notes

### Legal & Ethical Considerations
⚠️ **The AfN register explicitly states:**
> "The Search the Register function is not to be used for commercial purposes"

**Acceptable use cases:**
- Educational research
- Non-commercial analysis
- Personal reference
- Academic study

**Unacceptable use cases:**
- Commercial database building
- Marketing/sales lists
- Unauthorized republishing
- Market analysis for profit

### Data Protection
- Respect GDPR and UK data protection laws
- Only collect publicly available data
- Store data securely
- Don't redistribute without permission

## 🔧 Troubleshooting

### If the scraper hangs on "Searching..."
1. Check your internet connection
2. Try from a different network
3. Increase wait times in the script
4. Check if the website is accessible in your browser

### If you get timeout errors
1. The website may be blocking your IP
2. Try using a VPN
3. Add longer delays between requests
4. Check your firewall/proxy settings

## 📞 Next Steps

Given the current network access limitations, I recommend:

1. **Try from cloud environment** - Deploy to AWS Lambda or similar
2. **Contact AfN** - Request official data access
3. **Use manual approach** - Browser DevTools method (Option 2 above)
4. **Add proxy support** - Implement residential proxy rotation

## 📁 Files

- `nutrition-scraper.js` - Original API-based scraper
- `nutrition-browser-scraper.js` - Puppeteer browser automation
- `debug-nutrition-scraper.js` - Debug version with screenshots
- `debug-nutrition-scraper-v2.js` - Enhanced debug with better AJAX waiting
- `test-api.js` - Simple API connection test
- `README.md` - This file

---

**Created:** 2025-10-29
**Status:** Scripts ready but require network/access resolution
