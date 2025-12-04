#!/bin/bash

# Launch Chrome with remote debugging enabled
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --remote-allow-origins=* \
  --user-data-dir="/tmp/chrome-debug-profile" \
  --no-first-run \
  --no-default-browser-check \
  "http://localhost:5173" &

echo "Chrome launched with remote debugging on port 9222"
echo ""
echo "To watch console logs, run:"
echo "  chrome-cli console"
echo ""
echo "Or use these commands:"
echo "  chrome-cli list tabs      # List all tabs"
echo "  chrome-cli reload         # Reload current tab"
echo "  chrome-cli console        # Watch console logs"
