# Gemini last-attempt guard — offline correction, 2026-09-17

**State:** implemented; 152 focused application, transport, ledger and migration tests plus all workspace type checks passed. Sequential review and final-source CI pending. No provider requests or real ledger changes occurred.

The application previously allowed generation with 31 of 32 attempts already spent. The generated answer then needed a separate verification call, which the existing cap correctly rejected. A new regression reproduced one unnecessary fake fetch and no usable answer. The failing evidence was retained outside Git before the correction.

The application meter now checks the remaining attempt count under its existing exclusive ledger lock. `help_generate` and `practice_generate` require at least two remaining slots before reservation. The final slot remains usable for a verification of an already-generated candidate. Ordinary two-call operations still complete at the boundary, as covered by the existing 32-attempt runtime regression.

New tests verify both generation kinds, unchanged ledger entries after rejection, last-slot verification, and zero fetches from the actual app dispatcher before and after a restart. All ledgers and credentials in these tests are synthetic temporary fixtures. The user's real ledger, including failed spending, remains untouched.

This prevents the known single-slot half-operation; it does **not** reserve a whole operation atomically, guarantee sufficient dollar allowance after generation, or replace each call's durable cap/lock enforcement. Competing requests, provider failures, cancellation, insufficient funds and failed verification can still prevent an answer. The trial ledger format and frozen evaluation behavior, model/settings/prices, $1/32-attempt cap, deadline and independent verifier are unchanged. No larger allowance or automatic source rebind is introduced.

External evidence: helper workspace `outputs/gemini-allowance-20260917/before-fix.txt`, `before-fix-fetch.txt`, and `after-fix-focused.txt`. The isolated MeltingPot copy and original repositories were not changed. Default builds remain prewritten Simulation Mode.
