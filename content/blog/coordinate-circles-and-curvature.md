+++
title = "What a cycle of coordinate queries can see"
date = 2026-11-09
description = "For a quadratic objective observed only through rankings, choosing where to query controls how much of a dense Hessian the decoder ever has to represent."

[extra]
likes = 137
thumbnail = "img/blog/ordinal-query-cycle.webp"
figure_alt = "An eight-coordinate cycle joins primary and bridge edges. A separate plot shows four distinguishable ranking states on the finite cycle versus one on two disconnected cycles."
figure_caption = "Figure 1 from the manuscript. Bridges distinguish four rankings in the illustrated family, but even the connected finite design leaves a range of directions with the same ranking."
+++

Consider a quadratic objective observed at a fixed radius. We get the order of the values, not the values themselves. Comparing a point with its opposite cancels the quadratic term. Comparing points on different lines gives more information, but also brings unknown curvature back into the problem. Our question was whether a better choice of measurement locations could make that curvature manageable.

## Restrict the measurements, not the Hessian

On a circle in the plane of coordinates *i* and *j*, only two diagonal Hessian entries and one cross term affect the quadratic part. The other entries need not be small; the measurement simply does not see them. Link such planes in a cycle and adjacent planes share a coordinate. On the continuous circles, if every gradient coordinate is nonzero, that common coordinate ties the relative scales together. With disconnected components, distinct gradient directions can preserve exactly the same order.

For even dimensions *d* ≥ 8, the discrete design uses **6*d* endpoints in one batch**. After removing a constant invisible to rankings, the measurements have an exact representation with **3*d* − 1 coefficients**, including the linear part. This is a statement about what the measurements can represent. It does **not** mean that one finite ranking identifies a direction exactly.

## Separate what the decoder buys from what the design buys

On 768 quadratic targets at three radii, rank weighting gave **10.04° angular RMSE** on the cycle queries. Fitting a quadratic consistent with the very same order reduced that to **0.97°**. That comparison changes the decoder, not the measurement locations.

To test the design, we instead fixed the quadratic decoder and the evaluation budget. Against mirrored orthogonal frames, the cycle reduced mean squared angular error by **19.0%** on 128 fresh, condition-matched targets; the adjusted interval was **1.44% to 32.22%**. This does not isolate connectivity as the cause. In particular, the controls did not establish that connectivity or phase alone reliably improves finite-budget accuracy. A proof of identifiability and evidence of lower finite-sample error answer different questions.

*Source: “Structured Queries for Ordinal Gradient Recovery Under Unknown Curvature,” Figure 1, Table I, and Section V. Joint work by Zhuangzhuang Pan and Kaiwen Lei, with equal contribution.* [Project code](https://github.com/panzhzh/ordinal-gradient-query-designs) · [Project experience](@/project-experience.md#structured-queries-for-ordinal-gradient-recovery-under-unknown-curvature)
