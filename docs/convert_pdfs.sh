#!/bin/bash

# Find all markdown files and convert them
find . -name "*.md" | while read -r file; do
    echo "Processing $file..."
    
    # Define filenames
    html_file="${file%.md}.html"
    pdf_file="${file%.md}.pdf"
    
    # 1. Convert Markdown to HTML using pandoc
    pandoc "$file" -s -c "style.css" -o "$html_file" --metadata title="${file}"
    
    # 2. Convert HTML to PDF using Headless Chrome
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --print-to-pdf="$pdf_file" "file://$(pwd)/${html_file#./}" 2>/dev/null
    
    # 3. Clean up HTML file
    rm "$html_file"
done

echo "All files converted successfully!"
