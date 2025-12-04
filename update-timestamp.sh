#!/bin/bash

# Update BUILD_TIMESTAMP in App.jsx before committing
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
sed -i.bak "s/const BUILD_TIMESTAMP = '.*';/const BUILD_TIMESTAMP = '$TIMESTAMP';/" src/App.jsx
rm -f src/App.jsx.bak

# Add the updated file to the commit
git add src/App.jsx

echo "✅ Updated BUILD_TIMESTAMP to: $TIMESTAMP"
