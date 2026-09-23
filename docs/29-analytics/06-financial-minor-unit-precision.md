# Minor-Unit Monetary Precision (INV-507)

## Overview

To eliminate IEEE-754 floating point rounding drift, all monetary aggregations operate on integer cents using BigInt accumulators. Currency measures declare isCurrency: true and unit: "cents", completely matching M42 billing and accounting models.
