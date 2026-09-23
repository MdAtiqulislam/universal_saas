import { BadRequestException } from '@nestjs/common';

/**
 * RFC 4180 compliant CSV parsing utility.
 * Handles quoted fields, embedded commas, escaped quotes, newlines within quotes,
 * and UTF-8 Byte Order Marks (BOM).
 */
export class CsvParserUtil {
  static parse(csvContent: string): {
    headers: string[];
    rows: Record<string, string>[];
  } {
    if (!csvContent || typeof csvContent !== 'string') {
      throw new BadRequestException('CSV file content is empty or invalid.');
    }

    // Strip UTF-8 BOM if present
    const cleaned =
      csvContent.charCodeAt(0) === 0xfeff ? csvContent.slice(1) : csvContent;

    const parsedLines = this.parseCsvLines(cleaned);
    if (parsedLines.length === 0) {
      throw new BadRequestException('CSV file contains no data rows.');
    }

    const headers = parsedLines[0].map((h) => h.trim());
    if (headers.length === 0 || headers.every((h) => h === '')) {
      throw new BadRequestException('CSV header row is missing or empty.');
    }

    // Check for duplicate header names
    const headerSet = new Set<string>();
    for (const header of headers) {
      if (!header) {
        throw new BadRequestException(
          'CSV contains an empty header column name.',
        );
      }
      if (headerSet.has(header)) {
        throw new BadRequestException(
          `Duplicate column header "${header}" detected in CSV.`,
        );
      }
      headerSet.add(header);
    }

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < parsedLines.length; i++) {
      const line = parsedLines[i];
      // Skip trailing empty lines
      if (line.length === 1 && line[0].trim() === '') {
        continue;
      }

      const rowObj: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        rowObj[headers[j]] = line[j] !== undefined ? line[j] : '';
      }
      rows.push(rowObj);
    }

    return { headers, rows };
  }

  private static parseCsvLines(text: string): string[][] {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
          i++;
          continue;
        }
      }

      if (!insideQuotes && char === ',') {
        currentLine.push(currentField);
        currentField = '';
        i++;
        continue;
      }

      if (!insideQuotes && (char === '\r' || char === '\n')) {
        currentLine.push(currentField);
        currentField = '';
        lines.push(currentLine);
        currentLine = [];

        if (char === '\r' && nextChar === '\n') {
          i += 2;
        } else {
          i++;
        }
        continue;
      }

      currentField += char;
      i++;
    }

    if (currentField.length > 0 || currentLine.length > 0) {
      currentLine.push(currentField);
      lines.push(currentLine);
    }

    return lines;
  }
}
