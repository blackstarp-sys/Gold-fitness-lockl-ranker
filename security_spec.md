# Security Specification

## Data Invariants
1. A user profile document ID must strictly match `request.auth.uid`.
2. A business location document must have `userId` matching `request.auth.uid`.
3. Subcollection grid points can only be accessed by the parent location's owner.

## Dirty Dozen Security Test Cases
1. Anonymous write attempt to `/users/abc`.
2. Identity spoofing: Authenticated user attempting to set `userId` to another user's UID.
3. Unverified user attempting write operations when verification is required.
4. Over-sized string injection into document fields (>1000 chars).
5. Attempting to update immutable `createdAt` fields.
6. Accessing another user's private location grid points.
7. Shadow update with unauthorized fields (`isAdmin: true`).
8. Invalid document ID containing special path navigation characters (`../`).
9. List query attempt without owner filter (`allow list: if false`).
10. Unbounded payload size injection.
11. Atomic transaction bypass attempt.
12. Terminal state mutation bypass attempt.
