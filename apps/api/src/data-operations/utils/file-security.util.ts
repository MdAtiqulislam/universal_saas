import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

/**
 * INV-534 / INV-535: File security, path traversal protection,
 * and spreadsheet formula injection sanitization.
 */

const UNSAFE_FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export class FileSecurityUtil {
  /**
   * Sanitizes cell values to prevent CSV / Excel formula injection (CSV Injection / DDE).
   * If a string value starts with =, +, -, @, \t, or \r, it is prefixed with a single quote (').
   */
  static sanitizeFormulaInjection(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (str.length > 0 && UNSAFE_FORMULA_PREFIXES.includes(str[0])) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Sanitizes filename to prevent directory traversal and null-byte injection.
   * Strips path elements, null bytes, and restricts characters.
   */
  static sanitizeFilename(rawFilename: string): string {
    if (!rawFilename || typeof rawFilename !== 'string') {
      return 'data_operation_file';
    }

    // Strip path traversal attempts and extract basename
    const base = path.basename(rawFilename);

    // Remove null bytes and control characters
    let cleaned = base.replace(/[\x00-\x1f\x7f]/g, '');

    // Strip dangerous characters while preserving safe extension
    cleaned = cleaned.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Prevent hidden files or double dots
    cleaned = cleaned.replace(/^\.+/, '').replace(/\.{2,}/g, '.');

    if (!cleaned) {
      return 'data_operation_file';
    }

    return cleaned.slice(0, 200);
  }

  /**
   * Validates file extension and MIME type against allowed formats.
   * INV-535: Server-side format enforcement.
   */
  static validateFormat(
    filename: string,
    mimeType?: string,
    allowedFormats: ('CSV' | 'JSON')[] = ['CSV', 'JSON'],
  ): 'CSV' | 'JSON' {
    const ext = path.extname(filename).toLowerCase();

    let detectedFormat: 'CSV' | 'JSON' | null = null;
    if (ext === '.csv') {
      detectedFormat = 'CSV';
    } else if (ext === '.json') {
      detectedFormat = 'JSON';
    }

    if (!detectedFormat) {
      throw new BadRequestException(
        `Unsupported file extension "${ext}". Allowed extensions: ${allowedFormats.map((f) => `.${f.toLowerCase()}`).join(', ')}`,
      );
    }

    if (!allowedFormats.includes(detectedFormat)) {
      throw new BadRequestException(
        `Format "${detectedFormat}" is not permitted for this operation. Allowed: ${allowedFormats.join(', ')}`,
      );
    }

    if (mimeType) {
      const lowerMime = mimeType.toLowerCase();
      const validCsvMimes = [
        'text/csv',
        'application/csv',
        'text/plain',
        'application/vnd.ms-excel',
        'application/octet-stream',
      ];
      const validJsonMimes = [
        'application/json',
        'text/json',
        'text/plain',
        'application/octet-stream',
      ];

      if (
        detectedFormat === 'CSV' &&
        !validCsvMimes.some((m) => lowerMime.includes(m))
      ) {
        throw new BadRequestException(
          `Invalid MIME type "${mimeType}" for CSV file format.`,
        );
      }
      if (
        detectedFormat === 'JSON' &&
        !validJsonMimes.some((m) => lowerMime.includes(m))
      ) {
        throw new BadRequestException(
          `Invalid MIME type "${mimeType}" for JSON file format.`,
        );
      }
    }

    return detectedFormat;
  }

  /**
   * Enforces server-side file size, row, and column limits.
   * INV-535: Server-side limit enforcement.
   */
  static enforceLimits(params: {
    fileSizeBytes?: number;
    maxFileSize: number;
    totalRows?: number;
    maxRows: number;
    columnCount?: number;
    maxColumns: number;
  }): void {
    if (
      params.fileSizeBytes !== undefined &&
      params.fileSizeBytes > params.maxFileSize
    ) {
      throw new BadRequestException(
        `File size (${params.fileSizeBytes} bytes) exceeds maximum permitted limit (${params.maxFileSize} bytes).`,
      );
    }

    if (
      params.columnCount !== undefined &&
      params.columnCount > params.maxColumns
    ) {
      throw new BadRequestException(
        `Column count (${params.columnCount}) exceeds maximum permitted limit (${params.maxColumns} columns).`,
      );
    }

    if (params.totalRows !== undefined && params.totalRows > params.maxRows) {
      throw new BadRequestException(
        `Row count (${params.totalRows}) exceeds maximum permitted limit (${params.maxRows} rows).`,
      );
    }
  }
}
