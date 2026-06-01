+++
title = "Ferrari: Federated Feature Unlearning via Feature Sensitivity"
date = 2026-05-25

description = "A technical reading note on the NeurIPS 2024 Ferrari paper, which studies feature-level unlearning in federated learning through sensitivity minimization."

[extra]
tldr = "Ferrari reframes federated unlearning from removing clients, samples, or classes to removing a specific feature. Its key move is to minimize feature sensitivity, so the model becomes less responsive to perturbations on the feature requested for unlearning."
thumbnail = "img/blog/federated-learning.svg"
likes = 162
+++

This note summarizes my reading of *Ferrari: Federated Feature Unlearning via Optimizing Feature Sensitivity*, a NeurIPS 2024 paper on federated unlearning. The paper focuses on a more fine-grained problem than ordinary client, class, or sample unlearning: a client may want the global model to forget one feature while remaining part of the federated system.

That setting matters. In federated learning, data stays distributed across clients, so a centralized feature-unlearning method that requires access to all remaining data is not practical. Ferrari is designed for the case where only the unlearning client participates. The client requests removal of feature `F`, performs local optimization, and uploads an updated model back to the server.

The paper's central technical idea is **feature sensitivity**. Instead of constructing a new dataset where the feature has been removed by Gaussian noise or black masking, Ferrari asks a more local question: how much does the model output change when only the target feature is perturbed?

<div class="math-block">s = E_deltaF ||f(x) - f(x + deltaF)||_2 / ||deltaF||_2</div>

A small sensitivity score means the model is less responsive to that feature. This is a neat design choice because it turns feature unlearning into a bounded optimization problem inspired by Lipschitz continuity. The unlearning client samples perturbations on `F`, estimates the output-change ratio, and updates the model to reduce that sensitivity:

<div class="math-block">theta_u = arg min_theta E_(x,y) E_deltaF ||f_theta(x) - f_theta(x + deltaF)||_2 / ||deltaF||_2</div>

The formulation is useful because it avoids a common trap in feature unlearning. If we literally erase a visual region with noise or a black patch, the resulting data distribution may become unnatural, and the model's utility can collapse. Ferrari instead tries to make the model insensitive to the target feature while preserving useful behavior on the rest of the input.

The experiments are broad: sensitive feature unlearning, backdoor feature unlearning, and biased feature unlearning. The evaluation is also more convincing than accuracy alone. The paper uses feature sensitivity, model inversion attack success rate, retained/unlearned dataset accuracy, GradCAM attention maps, runtime, and FLOPs. That matters because unlearning is easy to fake if we only report final accuracy.

The results suggest that Ferrari keeps much more utility than exact retraining-style feature removal and avoids the catastrophic forgetting seen in non-Lipschitz variants. In backdoor settings, the important signal is not only high clean accuracy, but low accuracy on the backdoored client data after unlearning. In biased settings, the goal becomes fairness-like alignment: retained and unlearned client accuracies should become similar rather than one side dominating.

My reading is that Ferrari's main strength is its engineering realism. It does not assume every client will come back online to help with unlearning, and it does not require rebuilding a clean feature-removed dataset. The paper also admits an important limitation: performance is best when the unlearning client still has enough local data. When local data becomes too limited, the sensitivity estimate and the unlearning effect become weaker.

For future work, I think the most interesting direction is extending this idea beyond classification. Feature-level unlearning for generative models, multimodal systems, and LLM agents would be much harder because "feature" is no longer a simple input region or tabular attribute. Still, the conceptual lesson is strong: reliable unlearning needs a measurable behavioral target. Ferrari's target is not "forget because we say so," but "reduce sensitivity to the requested feature while preserving the rest of the model."
