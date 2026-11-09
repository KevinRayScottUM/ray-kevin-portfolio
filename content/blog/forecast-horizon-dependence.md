+++
title = "Why the uncertainty of a change depends on both forecasts"
date = 2026-11-09
description = "Two horizons can have identical marginal uncertainty and very different uncertainty about their difference. A fixed-marginal experiment isolates what forecast shape contributes."

[extra]
likes = 158
thumbnail = "img/blog/forecast-horizon-shape.webp"
figure_alt = "Two horizon pairs have the same time lag but different forecast-shape distances; three matrices show how the shape factor modifies the reference correlation."
figure_caption = "Figure 1 from the manuscript. The curves and matrices are schematic. Equal time separation need not mean equal separation in forecast shape."
+++

Suppose two forecasts each have variance one. If their errors are uncorrelated, the variance of their difference is two. If their errors have correlation 0.9, it is only 0.2. Neither individual forecast has changed. For someone asking how much a signal will rise or fall, those are two very different predictions.

## Change the dependence, keep the forecasts

In our study, Chronos-Bolt Small and FlowState r1.1 supplied cached quantiles at 48 horizons. Each horizon got four coordinates: spread, median relative to the forecast as a whole, change from the preceding median, and outer width relative to inner width. Two points twelve steps apart can be close in these coordinates on a plateau and far apart across a ramp.

We turned coordinate distances into a positive semidefinite similarity matrix and multiplied a temporal correlation matrix by a mixture of that similarity and an all-ones matrix, entry by entry. The result is still a valid correlation matrix with ones on the diagonal. In a Gaussian copula this lets us change how the horizons move together while keeping each marginal forecast fixed.

## Does the shape have to be in the right place?

A fair control needs the same fitting flexibility. Across six datasets and both backbones, the shape-aware model reduced normalized change CRPS (a distributional error score; lower is better) by **0.2005%** against a parameter-matched time-only kernel. We also rotated the shape features along the horizon axis and refitted the model for every nonzero shift. The true alignment ranked first out of 48. The effect was small, but adding parameters alone does not explain that ordering.

The more useful result is where the correction mattered. For horizon pairs far apart in shape, the **90% interval score fell by 3.59%** and empirical coverage rose from **82.70% to 85.68%**. These groups were defined within each lag, so the comparison is not just short versus long forecasts. Coverage still missed 90%, and low-distance pairs showed little benefit. I would check those conditional results before treating the aggregate gain as a reason to deploy.

*Source: “Forecast-Geometry-Guided Dependence Calibration for Time-Series Changes,” Figure 1 and Tables I–III. Kaiwen Lei and Zhuangzhuang Pan contributed equally, with Bohan Guo and Yan Xia.* [Project code](https://github.com/panzhzh/beyond-time-distance) · [Project experience](@/project-experience.md#forecast-geometry-guided-dependence-calibration-for-time-series-changes)
