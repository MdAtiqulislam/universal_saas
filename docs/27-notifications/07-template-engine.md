# 07. Safe Template Syntax & Rendering

## Zero-Code Execution & SSTI Protection (`INV-457`)

The `TemplateEngineService` implements a safe, pure-regex substitution engine:

- **Syntax**: `{{path.to.variable}}`
- **Allowlisted Identifiers**: Only alphanumeric dot-path identifiers matching `/^[a-zA-Z0-9_.]+$/` are evaluated.
- **Strictly Prohibited**:
  - Code execution blocks (`<% ... %>`, `{{#each}}`, `eval()`, JavaScript expressions).
  - Prototype pollution (`__proto__`, `constructor`, `prototype` are stripped and rejected).
  - Unbounded outputs (rendered size capped at 64KB).
- **Graceful Null Coalescing**:
  - Missing or undefined paths resolve safely to an empty string (`""`) without throwing exceptions.
  - Complex object references are JSON-stringified without dumping `[object Object]`.
