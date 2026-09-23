import { Injectable, BadRequestException } from '@nestjs/common';

export interface RenderResult {
  renderedSubject?: string;
  renderedBody: string;
  extractedVariables: string[];
}

@Injectable()
export class TemplateEngineService {
  // INV-460 & INV-461: Safe template rendering rules
  private readonly maxTemplateLength = 65536; // 64 KB
  private readonly maxRenderedLength = 262144; // 256 KB
  private readonly variablePattern = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

  /**
   * Safely extract all variable keys referenced in a template string
   */
  extractVariables(templateStr: string): string[] {
    const matches = new Set<string>();
    let match: RegExpExecArray | null;
    const regex = new RegExp(this.variablePattern);
    while ((match = regex.exec(templateStr)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches);
  }

  /**
   * Validates that template variables conform strictly to registered allowlist (INV-460)
   */
  validateVariableAllowlist(
    referencedVariables: string[],
    allowedVariables: string[],
  ): void {
    if (!allowedVariables || allowedVariables.length === 0) {
      return; // If no allowlist is registered, any alphanumeric dot-path variable is permitted
    }
    const allowedSet = new Set(allowedVariables);
    for (const v of referencedVariables) {
      if (!allowedSet.has(v)) {
        throw new BadRequestException(
          `Variable '{{${v}}}' is not in the registered template variable allowlist: [${allowedVariables.join(', ')}]`,
        );
      }
    }
  }

  /**
   * Safely interpolates variables into template using pure string replacement.
   * Zero JavaScript execution, zero eval, zero code injection (INV-461).
   */
  render(
    body: string,
    variables: Record<string, unknown>,
    subject?: string,
    allowedVariables?: string[],
  ): RenderResult {
    if (!body) {
      throw new BadRequestException('Template body is required');
    }

    if (body.length > this.maxTemplateLength) {
      throw new BadRequestException(
        `Template exceeds maximum permitted size of ${this.maxTemplateLength} bytes`,
      );
    }

    // Reject dangerous runtime injection vectors
    const dangerousPatterns = [
      /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
      /javascript:/gi,
      /onload=/gi,
      /onerror=/gi,
      /__proto__/gi,
      /prototype/gi,
      /process\./gi,
      /require\(/gi,
      /eval\(/gi,
    ];

    for (const dp of dangerousPatterns) {
      if (dp.test(body) || (subject && dp.test(subject))) {
        throw new BadRequestException(
          'Template contains disallowed unsafe code or expression pattern',
        );
      }
    }

    const referenced = this.extractVariables(
      body + (subject ? ' ' + subject : ''),
    );
    if (allowedVariables && allowedVariables.length > 0) {
      this.validateVariableAllowlist(referenced, allowedVariables);
    }

    const resolvePath = (
      path: string,
      obj: Record<string, unknown>,
    ): string => {
      const parts = path.split('.');
      let current: unknown = obj;
      for (const part of parts) {
        if (
          current === null ||
          current === undefined ||
          typeof current !== 'object'
        ) {
          return '';
        }
        current = (current as Record<string, unknown>)[part];
      }
      if (current === null || current === undefined) {
        return '';
      }
      if (typeof current === 'string') {
        return current;
      }
      if (typeof current === 'number' || typeof current === 'boolean') {
        return String(current);
      }
      if (typeof current === 'bigint') {
        return current.toString();
      }
      if (typeof current === 'object') {
        return JSON.stringify(current);
      }
      return '';
    };

    const replaceVars = (text: string): string => {
      return text.replace(this.variablePattern, (_match, varPath: string) => {
        return resolvePath(varPath, variables);
      });
    };

    const renderedBody = replaceVars(body);
    const renderedSubject = subject ? replaceVars(subject) : undefined;

    if (renderedBody.length > this.maxRenderedLength) {
      throw new BadRequestException(
        `Rendered output exceeds maximum permitted size of ${this.maxRenderedLength} bytes`,
      );
    }

    return {
      renderedSubject,
      renderedBody,
      extractedVariables: referenced,
    };
  }
}
