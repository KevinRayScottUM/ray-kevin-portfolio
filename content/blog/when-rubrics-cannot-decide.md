+++
title = "When a rubric cannot pick a winner"
date = 2026-11-09
description = "A judge can agree with a human and still make a decision the rubric never authorized. TradeoffBench separates applying a rule from supplying a missing preference."

[extra]
likes = 173
thumbnail = "img/blog/rubric-score-substitution.webp"
figure_alt = "For 2,707 fixed MultiPref comparisons, own-score decisions disagree with the rater 16 times and peer-mean decisions 780 times, a paired increase of 28.223 percentage points."
figure_caption = "Figure 3 from the manuscript. Rows and columns track the same comparisons under two score sources. The target rater and strict-Pareto rule are held fixed; the whisker is a paired 95% interval."
+++

One answer to a travel question offers two routes and compares costs. Another gives a single concise recommendation. A rubric that rewards both completeness and brevity can score each answer precisely without saying which should win. Picking the answer that passes more criteria sounds reasonable, but it introduces a voting rule. If the rubric did not authorize one, a confident verdict hides a choice about values.

## Test the rule without asking the model to score prose

TradeoffBench supplies exact pass/fail vectors on five criteria. A response wins under strict Pareto dominance only when it is no worse on every criterion and better on at least one. Identical vectors call for equality. If each response wins somewhere, the correct output under this rubric is to **defer**, not to call it a tie.

Six non-reasoning judge configurations passed every dominance and equality control. Yet they chose unsupported winners on **8.85% to 81.12%** of 1,345 conflicts in the vector/disjoint condition. In a separate audit, three reasoning-enabled configurations returned only **2 unsupported winners in 9,720 conflict judgments**. These are distinct audits, not a paired estimate of the effect of reasoning. Deferral shows the model executed the rule; it does not tell us what the intended reader prefers.

## Whose scores enter the decision?

The human-data experiments ask a different question and use no LLM judge. On **2,707 MultiPref comparisons** with a strict target preference and a decision under both score sources, the same Pareto rule disagreed with the intended rater **16 times** using the rater's own component scores and **780 times** using peer means. Changing the score source alone took disagreement from **0.6% to 28.8%**. This rate pertains to those jointly decided cases, not all MultiPref records.

In HUMAINE, declaring partial trade-offs made another **2.5 percentage points** of comparisons decidable. Among strict rater preferences, disagreement was **3.9%** on the newly decided cases versus **0.9%** on Pareto decisions. A useful evaluation report therefore needs three separate entries: what the original rubric decides, which extra premise resolves the remaining cases, and how often those additional decisions disagree with the intended rater.

*Source: “When Rubrics Do Not Decide: Silent Value Completion in LLM Evaluation,” Sections 3–5, Figure 3, and Table 14.* [Project experience](@/project-experience.md#when-rubrics-do-not-decide-silent-value-completion-in-llm-evaluation)
