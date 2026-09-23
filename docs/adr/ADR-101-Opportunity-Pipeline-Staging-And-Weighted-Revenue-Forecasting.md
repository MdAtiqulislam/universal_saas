# ADR-101: Opportunity Pipeline Staging & Weighted Revenue Forecasting

## Status

Accepted

## Context

Commercial leadership requires accurate sales pipeline visibility with probability-adjusted revenue projections and sales velocity metrics.

## Decision

1. Implement 7 discrete pipeline stages: `PROSPECTING` (10%), `QUALIFICATION` (25%), `NEEDS_ANALYSIS` (50%), `PROPOSAL` (75%), `NEGOTIATION` (90%), `CLOSED_WON` (100%), and `CLOSED_LOST` (0%).
2. Calculate probability-weighted forecast deterministically:
   $$\text{Weighted Forecast} = \sum (\text{estimatedValue} \times \frac{\text{probability}}{100})$$
3. Compute win rate dynamically as $\frac{\text{Won Count}}{\text{Won Count} + \text{Lost Count}} \times 100$.
4. Track deal aging and sales cycle duration based on timestamps between creation and closed won state.

## Consequences

- Highly accurate revenue forecasts unaffected by subjective rep estimations.
- Real-time pipeline metrics partitioned by tenant and sales representative.
