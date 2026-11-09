+++
title = "What a ranking buys when feedback rounds are scarce"
date = 2026-11-09
description = "A ranked batch of opposite points contains comparisons that cancel a shared nuisance. Whether that information pays off depends on how often the next batch can adapt."

[extra]
thumbnail = "img/blog/ranked-query-rounds.webp"
figure_alt = "Airfoil and Concrete training-gap curves over sixteen feedback rounds, with paired terminal ratios comparing full-ranking recovery to external controls."
figure_caption = "Figure 4 from the manuscript. The trajectories compare training gaps under endpoint and round caps. The ratio panel compares the full-ranking method to controls; the separate short-cycle results below are from Table 2."
+++

An evaluation and a round of feedback are different resources. A lab may be able to run fifty settings together but have to wait until tomorrow to choose the next fifty. In that setting, keeping only the winner of each opposite-point comparison throws away some information already paid for.

## A cancellation you can read off the order

Write the local objective as a linear signal plus an even term: opposite points have opposite linear contributions but the same nuisance offset. Suppose the ranking puts *xⱼ* above *xᵢ* and *−xᵢ* above *−xⱼ*. Add the two inequalities. Each nuisance offset appears on both sides, leaving a comparison between the two linear projections. No numerical objective values or Hessian estimate are needed.

This separates three kinds of information. **Mirror** keeps only the signs within opposite pairs. **Reverse** also keeps short cycles such as the one above. **Full** keeps every direction for which some choice of nuisance offsets explains the entire order. Its feasible set can be strictly smaller. But ruling out a direction need not improve the next optimization step.

## The resource constraint changes the result

When the even term varies sufficiently little across the query sphere relative to the linear signal, short cycles can localize the direction in one round at near-optimal evaluation cost. Without a common bound on relative curvature, the worst-case cost for angular error ε is Θ(*d*/ε) in one round and Θ(*d* log(1/ε)) given enough adaptive rounds. Evenness makes cancellation valid; it does not, by itself, guarantee a useful one-round estimate.

On two ridge-regression tasks with at most **16 feedback rounds**, the independently tuned short-cycle method left **0.374 times** the mean relative training gap of ZO-RankSGD on Airfoil and **0.645 times** on Concrete. Fitting longer cycles did not yield an established additional optimization gain. And when the round cap was removed, sequential three-point search and CMA-ES finished with smaller mean gaps than the full-ranking method on both tasks. The practical argument here is for spending a scarce round well, not for ranking-based updates in every setting.

*Source: “When Do Rankings Beat Signs? Gradient Direction Recovery under Even Nuisance,” Figure 4 and Tables 1–3. Results concern optimization of the training objective, not a comparable improvement in test prediction.* [Project experience](@/project-experience.md#when-do-rankings-beat-signs-gradient-direction-recovery-under-even-nuisance)
