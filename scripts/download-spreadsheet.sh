#!/bin/bash
# Download HF4A card spreadsheet data as CSV files

SPREADSHEET_ID="1DItaALEldFCHqnehydBHAWEeCI3wNpSu1pEdZ3DSHLM"
OUTPUT_DIR="$(dirname "$0")/../data/spreadsheet"

mkdir -p "$OUTPUT_DIR"

echo "Downloading HF4A card spreadsheet data..."

download_sheet() {
  local filename="$1"
  local gid="$2"
  local url="https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}"
  local output="$OUTPUT_DIR/$filename"

  echo "  Downloading $filename (gid=$gid)..."
  curl -sL "$url" -o "$output"

  if [ -s "$output" ]; then
    lines=$(wc -l < "$output")
    echo "    ✓ Downloaded ($lines lines)"
  else
    echo "    ✗ Failed or empty"
  fi
}

download_sheet "thrusters.csv" "1447100825"
download_sheet "robonauts.csv" "453344219"
download_sheet "refineries.csv" "1041601986"
download_sheet "reactors.csv" "1111245965"
download_sheet "radiators.csv" "1514446156"
download_sheet "generators.csv" "652335996"
download_sheet "gw-thrusters.csv" "0"
download_sheet "freighters.csv" "1052027913"
download_sheet "bernals.csv" "952463543"
download_sheet "colonists.csv" "1186557531"

echo ""
echo "Done! Files saved to: $OUTPUT_DIR"
echo ""
echo "Next step: Run 'node scripts/import-spreadsheet.js' to merge data"
