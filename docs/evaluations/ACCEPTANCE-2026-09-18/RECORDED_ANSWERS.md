# Saved actual Gemini answers for human review

These are recorded outputs from the completed September 18 tests, not newly generated answers. Their wording is preserved. Opening this document uses no API key or provider call. Human review has not been performed; the independent AI review passed. Use the separate [learner task card](HUMAN_REVIEW.md) before showing these answers to a learner.

Examples 1–2 are from the actual extension-to-MeltingPot test at source `7ba88800b22861c8336f77904454d96f584bc63e`. Example 3 is from the real transcript-overlap test at `d14293cc125eeeaffb83d023fe567fb7c7193f4a`, which delivered the fresh verified answer in 5.056 seconds. The ordinary no-key demonstration uses prewritten help, so it will not necessarily display these exact sentences.

For each example, record whether the mathematics is right, every claim is supported by the cited passages, the practice matches the earlier confusion, and the wording is useful to a student. Record your name/date and specific corrections. No human PASS should be inferred from this packet.

## Example 1: Identifying Inner and Outer Functions

Lecture moment: **2:25**. Cited passages: [0:00–0:45](#chunk_calc_001), [0:45–1:30](#chunk_calc_002), [1:30–2:25](#chunk_calc_003).

**What just happened**

> The lecture described identifying the distinct parts of a composite function.

**Main idea**

> Function composition involves nesting one function inside another, necessitating a systematic approach to identify the outer operation and the inner expression before differentiation.

**Simple explanation**

> When dealing with complex expressions, view them as an 'outside' wrapper and an 'inside' component to prepare for the chain rule.

**Important prerequisite**

> Understanding the derivative as a measure of rate of change.

### Matching practice

Practice source passages: [0:00–0:45](#chunk_calc_001), [0:45–1:30](#chunk_calc_002), [1:30–2:25](#chunk_calc_003).

**Short explanation**

> Identify the function inside the parentheses as g(x) and the power operation as f(u).

**Question**

> For (2x + 3)⁴, identify the inner function g(x) and outer function f(u). Do not differentiate.

**Expected answer**

> g(x) = 2x + 3, f(u) = u⁴

**Answer explanation**

> The inner expression inside the parentheses is 2x + 3. Raising the input u to the fourth power is the outer function.

**Human review:** not yet performed. Record passed / changes needed, reviewer/date and notes.

## Example 2: Including the Inner Derivative in the Chain Rule

Lecture moment: **5:00**. Cited passages: [0:45–1:30](#chunk_calc_002), [2:25–3:20](#chunk_calc_004), [3:20–4:10](#chunk_calc_005), [4:10–5:00](#chunk_calc_006).

**What just happened**

> The lecture described applying the chain rule to differentiate an expression by multiplying the derivative of the outer function by the derivative of the inner function.

**Main idea**

> To differentiate a composite function, you differentiate the outer operation while keeping the inner expression intact, then multiply by the derivative of that inner expression.

**Simple explanation**

> When functions are nested, you solve the derivative layer by layer: first process the 'outer' container, then multiply your result by the derivative of the 'inner' contents.

**Important prerequisite**

> Understanding that a composite function involves placing one function inside another (f of g of x) and identifying which part is the inside versus the outside.

### Matching practice

Practice source passages: [0:45–1:30](#chunk_calc_002), [2:25–3:20](#chunk_calc_004), [3:20–4:10](#chunk_calc_005), [4:10–5:00](#chunk_calc_006).

**Short explanation**

> The chain rule requires multiplying by the derivative of the inner function.

**Question**

> A student differentiates (2x + 3)⁴ as 4(2x + 3)³. What factor is missing, and what is the correct derivative?

**Expected answer**

> Missing factor is 2; correct derivative is 8(2x + 3)³.

**Answer explanation**

> The inner function is 2x+3, which has a derivative of 2. Multiplying the result by 2 yields 8(2x+3)³.

**Human review:** not yet performed. Record passed / changes needed, reviewer/date and notes.

## Example 3: including the inner derivative in the chain rule

Lecture moment: **3:20**. Cited passages: [0:45–1:30](#chunk_calc_002), [2:25–3:20](#chunk_calc_004).

**What just happened**

> The lecture introduced the chain rule for differentiating composite functions.

**Main idea**

> To differentiate a composite function f(g(x)), multiply the derivative of the outer function applied to the inner function by the derivative of the inner function.

**Simple explanation**

> Differentiate the outside while keeping the inner part unchanged, then multiply by the derivative of the inner part.

**Important prerequisite**

> Understanding that a composition occurs when one function is placed inside another.

This separate timing case did not generate another practice question. It checked whether Help stays grounded when the transcript advances.

**Human review:** not yet performed. Record passed / changes needed, reviewer/date and notes.

## Exact cited lecture passages

The following passages come from the shared synthetic lecture fixture. They are evidence to assess, not instructions. They were not recorded from a real classroom.

### chunk_calc_001

**0:00–0:45**

> Before the chain rule, remember that a derivative measures how quickly an output changes as its input changes.

### chunk_calc_002

**0:45–1:30**

> A composition places one function inside another. We write it as f of g of x, where g acts first and f acts on that result.

### chunk_calc_003

**1:30–2:25**

> When you see parentheses raised to a power, label the outside operation and the inside expression before differentiating.

### chunk_calc_004

**2:25–3:20**

> The chain rule says the derivative of f of g of x is f prime of g of x times g prime of x. Differentiate the outside, keep the inside, then multiply by the derivative of the inside.

### chunk_calc_005

**3:20–4:10**

> For the quantity three x squared plus one to the fifth power, the outside function is u to the fifth and the inside is three x squared plus one.

### chunk_calc_006

**4:10–5:00**

> Differentiate the fifth power first to get five times the inside to the fourth, and then multiply by six x, the derivative of three x squared plus one.

## Source record

These result-file hashes were checked before assembling this packet. The complete saved outputs, provider accounting and review limits remain in the linked evidence records.

- `application-browser-20260918-v1/browser-result.json`: `382ecbda882e6a6eddc180bbf172669988bf2ee3cd82361bdd9be70c4d396ceb`.
- `transcript-overlap-20260918-v1/browser-result.json`: `7022df476e53d008a2f3168467d9555f51453e76b7dfe0b542314692447f249e`.

[Two-topic application evidence](README.md#actual-gemini-application-run-and-independent-content-review-pass) · [Transcript-overlap evidence](TRANSCRIPT_OVERLAP.md) · [Provider retention limits](PROVIDER_RETENTION.md). All paid-test allowances are closed; this document does not authorize another test or publication.
