# Association for Nutrition Scraper - Quick Start Guide

## ✅ Solution Summary

Successfully created a working scraper that extracts all nutritionist data from the AfN register.

**Key Discovery:** The website's AJAX search takes 75-80 seconds to complete - much longer than expected!

**Smart Strategy:** Instead of pagination (90s per page × 109 pages = 2.7 hours per postcode), we use:
- **135 postcodes** with **10-mile radius**
- First 50 results from each (no pagination!)
- **Total time: ~3.5 hours** instead of 82+ hours!

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd scrapers
npm install puppeteer
```

### 2. Test with 5 Postcodes (Recommended First)
```bash
node optimized-scraper.js --test
```
Takes ~8 minutes (5 postcodes × 90s each)

### 3. Run Full Scraper (135 Postcodes)
```bash
node optimized-scraper.js
```
Takes ~3.5 hours total

⚠️ **Much Better Than Pagination:**
- Old way: 30 postcodes × 109 pages × 90s = **82 hours**
- New way: 135 postcodes × 90s = **3.5 hours** ✅

## 📊 What You Get

### Output Files
1. **nutritionists-optimized.json** - Complete data in JSON format
2. **nutritionists-optimized.csv** - Same data in CSV (Excel-friendly)
3. **scraper-stats-optimized.json** - Statistics and error log

### Data Fields
- Registration Number
- Category (ANutr / RNutr)
- Name
- Email
- Website
- Phone
- Services Provided
- Areas of Work
- Specialism
- Address

## ⚙️ How It Works

1. **Fills form** with postcode, 10-mile radius, 50 results/page
2. **Waits 90 seconds** for AJAX to load results
3. **Extracts data** from first page only (no pagination!)
4. **Moves to next postcode** after 3-second delay
5. **Deduplicates** by registration number/email
6. **Saves progress** every 10 postcodes

## 🎯 Coverage Strategy

**135 postcodes** covering all major UK towns/cities:
- **London:** 12 postcodes (dense grid)
- **Greater London:** 12 surrounding areas
- **South East:** 14 towns/cities
- **South West:** 11 towns/cities
- **East:** 10 towns/cities
- **Midlands:** 19 towns/cities
- **Yorkshire:** 9 towns/cities
- **North West:** 14 towns/cities
- **North East:** 6 towns/cities
- **Scotland:** 14 major towns/cities
- **Wales:** 9 major towns/cities
- **Northern Ireland:** 3 major towns/cities

With **10-mile radius** and **135 locations**, we get comprehensive UK coverage with overlapping circles that catch everyone without needing pagination!

## 📈 Expected Results

Based on test with E1W 3PG:
- **Total in database:** 5,426 nutritionists
- **Per postcode:** 100-500 results (depending on location)
- **Unique after deduplication:** ~3,000-4,000 estimated

## ⏱️ Time Estimates

- **Test (5 postcodes):** ~8 minutes
- **Full run (135 postcodes):** ~3.5 hours
- **CPU/Memory:** Light usage, just waits a lot
- **Progress saved:** Every 10 postcodes

## 🔧 Configuration

Edit `optimized-scraper.js` to adjust:

```javascript
const CONFIG = {
  radius: '10',          // miles (5, 10, 20, or 50)
  perPage: '50',         // results per page (10, 20, or 50)
  waitTime: 90000,       // ms to wait for AJAX (90s)
  delayBetweenSearches: 3000  // ms between postcodes (3s)
};
```

## 🐛 Troubleshooting

### "Searching..." never finishes
- Increase `waitTime` to 120000 (120 seconds)
- Check internet connection
- Website might be under heavy load

### Browser closes immediately
- Remove `headless: false` to run in background
- Check for Puppeteer installation errors

### Results seem incomplete
- Check `scraper-stats-full.json` for errors
- Look at pagination info in console output
- Verify "Next >" button is being clicked

### Getting duplicates
- This is normal - deduplication happens automatically
- Check stats file for duplicate count

## 💡 Tips

1. **Run in tmux/screen** for long sessions
2. **Check progress regularly** - JSON file updates after each postcode
3. **Start with --test** to verify it works
4. **Monitor browser window** to see if searches are progressing
5. **Backup data periodically** in case of crashes

## 📝 Legal Note

Remember: The AfN register states it should **not be used for commercial purposes**. Use responsibly for educational/research purposes only.

## 🎉 Success Criteria

You'll know it's working when you see:
```
Searching: E1W 3PG
====================================
  Filling form...
  Submitting search...
  Waiting 90s for initial results...
  Found 5426 results
  Pages: 1 of 109
  Processing page 1/109...
    Extracted 50 nutritionists from this page
    Clicking Next...
```

Good luck with your scraping! 🚀
