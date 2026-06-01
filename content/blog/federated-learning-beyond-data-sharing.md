+++
title = "Federated Learning Beyond Data Sharing"
date = 2026-05-25

description = "What federated learning is, why it is useful, and where its privacy, optimization, and systems assumptions become difficult."

[extra]
tldr = "Federated learning keeps data local and moves model updates instead, but privacy, non-IID data, communication cost, and client reliability still determine whether it is actually useful."
thumbnail = "img/blog/federated-learning.svg"
likes = 162
+++

Federated learning is a distributed training method where data stays on local clients and only model updates are sent to a central coordinator. Instead of collecting all data into one training server, each client trains locally and contributes an update to the global model.

A simplified FedAvg round looks like this:

<div class="math-block">w_{t+1} = sum_k (n_k / n) * w_{t+1}^{(k)}</div>

where `w_{t+1}^{(k)}` is the locally trained model from client `k`, `n_k` is the amount of data on that client, and `n` is the total participating data count. This is elegant because it separates learning from raw data movement.

The advantage is clear in domains such as healthcare, finance, mobile keyboards, and edge devices. Data may be sensitive, legally restricted, or too distributed to centralize. Federated learning gives a system a way to learn from many locations without directly copying every local dataset into one place.

But federated learning is not automatic privacy. Gradients can leak information. Client updates may be attacked. Some clients may have biased or low-quality data. Others may be offline, slow, or unreliable. Real federated learning usually needs additional mechanisms such as secure aggregation, differential privacy, client sampling, robust aggregation, and careful evaluation under non-IID distributions.

The central tension is:

<div class="math-block">utility = learning signal - privacy cost - communication cost - heterogeneity error</div>

In clean benchmark settings, federated learning can look like a privacy-preserving version of distributed SGD. In real deployments, it becomes a systems problem. The question is not only whether the model converges, but whether the training loop remains useful when devices differ, data distributions drift, and communication is expensive.

For applied AI, the strongest use case is not "federated learning everywhere." It is federated learning when local data has high value, centralization has high risk, and the learning objective can tolerate noisy, partial, and uneven client participation.
