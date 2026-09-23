# Report Execution Lifecycle (INV-509)

## Overview

Every saved report execution creates an immutable ReportExecution record tracking status (RUNNING -> COMPLETED | FAILED), durationMs, rowCount, execution ID, and snapshot preview data.
