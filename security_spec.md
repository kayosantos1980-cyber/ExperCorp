# Security Specification for ClimaFlow

## Data Invariants
1. A feedback document must always be linked to a valid `employeeId` matching the `request.auth.uid`.
2. Only users with the `manager` role can list all feedbacks.
3. Employees can only read their own feedbacks.
4. Terminal state: Once a feedback for a specific date is submitted, it cannot be modified by the employee.

## The Dirty Dozen Payloads (Rejects)
1. Anonymous write attempt to `/feedbacks`.
2. Employee attempt to read another employee's feedback.
3. Employee attempt to update their role to `manager`.
4. Feedback submission with missing mandatory fields (e.g., missing `generalClimate`).
5. Feedback submission for a future date.
6. Feedback submission with out-of-range integer scores (e.g., score of 10).
7. Feedback submission with a massive string in the comment field (>1000 chars).
8. Feedback submission with a fake/spoofed `employeeId` that isn't the logged-in user.
9. Manager attempt to delete industrial-confidential employee data.
10. Update attempt to a terminal record (yesterday's feedback).
11. Injection of metadata fields (e.g., `__debug__: true`) into a feedback doc.
12. List query by employee without a `where('employeeId', '==', uid)` clause.

## Validation logic will be implemented in firestore.rules
