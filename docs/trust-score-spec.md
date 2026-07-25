# LabourLink Trust Score Specification

The Trust Score (0–100 Index) is a computed, versioned, and auditable numeric value representing worker reliability and skill authenticity. It is owned and calculated exclusively by the **Trust Agent** in response to platform transactions.

## Trust Score Formula

The trust score is derived from the weighted sum of several factors, normalized and clamped between 0 and 100:

$$\text{Trust Score} = \text{Clamp}\left(\sum \text{Factors} - \text{Penalties}, 0, 100\right)$$

### Contributing Factors
1. **Completed Jobs Factor (Max 10 pts)**:
   - +2 points per verified completed job (status = `'COMPLETED'`), capped at 5 jobs.
2. **On-Time Rate Factor (Max 15 pts)**:
   - Calculated as the ratio of on-time completions (`actual_completion` $\le$ `scheduled_end`) multiplied by 15.
3. **Payment Integrity Factor (Max 15 pts)**:
   - Confirmed payment transaction ratio (payment status = `'CONFIRMED'`) multiplied by 15.
4. **Average Rating Factor (Max 30 pts)**:
   - Average contractor rating score (1.0 to 5.0 scale) scaled by 6.
5. **Contractor Endorsement Factor (Max 10 pts)**:
   - +2 points per endorsement from distinct contractors, capped at 10.
6. **Verification Audit Factor (Max 20 pts)**:
   - ID document (Aadhaar) verified: +10 points
   - Skill certificate verified: +7 points
   - Employer attestation verified: +3 points

### System Deductible Penalties
- **Availability Volatility penalty**: -5 points if the worker changes availability status too frequently (exceeding 10 status updates in a short window).
- **Dispute Arbitrage outcome**: -10 points per dispute resolved in favor of the contractor (dispute status = `'RESOLVED_CONTRACTOR'`).
- **Fraud Agent Penalty**:
  - `CRITICAL` severity (Identity Farming): -30 points
  - `HIGH` severity (Location Conflict): -20 points
  - `MEDIUM` severity (Rating Collusion): -10 points
  - `LOW` severity (Payment Mismatch): -5 points

---

## Technical Guardrails

1. **Evidentiary Threshold**:
   - The Trust Score is `NULL` (renders as **"Not yet established"**) until the worker has completed at least 1 job AND has 1 confirmed payment record.
2. **Auditing**:
   - Every recompute inserts a new row in `trust_score_history` capturing the exact contributing factors JSON payload.
3. **Guardrail**:
   - Voice engagement metrics and language selections are explicitly excluded from scoring to prevent language-based bias.
