+++
title = "Project Experience"
template = "page.html"
path = "project-experience"
+++

## Research Projects

### Forecast-Geometry-Guided Dependence Calibration for Time-Series Changes

**Joint work with Zhuangzhuang Pan, Bohan Guo, and Yan Xia.** Zhuangzhuang Pan and I contributed equally.

- Built a positive semidefinite kernel from the shape of a forecast: its spread, relative level, adjacent changes, and tail width. It adjusts correlations across forecast horizons without changing their marginal distributions or calling the forecaster again.
- Across six datasets and two frozen forecasters, normalized change CRPS fell by **0.2005%** against a parameter-matched time-only kernel. The correctly aligned features scored better in aggregate than all 47 independently refitted circular shifts.
- For horizon pairs far apart in forecast shape, the 90% interval score fell by **3.59%** and coverage rose from **82.70% to 85.68%**, still short of the nominal 90%.

[Research note: Why the uncertainty of a change depends on both forecasts](@/blog/forecast-horizon-dependence.md) · [Project code on GitHub](https://github.com/panzhzh/beyond-time-distance)

### Structured Queries for Ordinal Gradient Recovery Under Unknown Curvature

**Joint work with Zhuangzhuang Pan; equal contribution.**

- Designed a one-round cycle for even dimensions *d* ≥ 8. Its 6*d* evaluations expose just 3*d* − 1 linear and quadratic coefficients, without assuming that the Hessian is sparse.
- Proved that connected coordinate circles identify the gradient direction from continuous rankings when each gradient coordinate in the query basis is nonzero. Disconnected supports can give identical rankings for distinct directions.
- On 768 quadratic targets, a quadratic decoder achieved **0.97° angular RMSE**, versus **10.04°** for rank weighting on the same queries. On 128 independent matched targets, the cycle reduced angular **MSE by 19.0%** versus mirrored orthogonal frames at the same budget and with the same decoder.

[Research note: What a cycle of coordinate queries can see](@/blog/coordinate-circles-and-curvature.md) · [Project code on GitHub](https://github.com/panzhzh/ordinal-gradient-query-designs)

### When Do Rankings Beat Signs? Gradient Direction Recovery under Even Nuisance

- Characterized what a ranked batch of opposite query points reveals about a gradient. Short cycles cancel unknown even offsets; the full ranking can rule out directions that shorter cycles leave feasible.
- Established a near-optimal one-round recovery bound when the even term varies little across the query sphere relative to the linear signal. Without a common relative-curvature bound, worst-case evaluation cost for angular error ε is Θ(*d*/ε) in one round and Θ(*d* log(1/ε)) with enough adaptive rounds.
- Under a 16-round cap, short-cycle updates reduced the mean remaining relative **training** gap versus ZO-RankSGD by **62.6% on Airfoil** and **35.5% on Concrete**. The experiments did not establish an additional optimization benefit from fitting longer cycles.

[Research note: What a ranking buys when feedback rounds are scarce](@/blog/rankings-and-feedback-rounds.md)

### When Rubrics Do Not Decide: Silent Value Completion in LLM Evaluation

- Built TradeoffBench to test whether judges defer when exact criterion scores conflict and the rubric supplies no trade-off. This isolates applying a rule from estimating the scores that enter it.
- Six non-reasoning judge configurations selected unsupported winners on **8.85% to 81.12%** of 1,345 conflicts. In a separate audit, three reasoning-enabled configurations made **2 unsupported choices in 9,720** conflict judgments.
- On HUMAINE, explicit trade-offs added **2.5 percentage points** of decision coverage. On MultiPref, substituting peer-mean scores for the intended rater's own scores raised disagreement from **0.6% to 28.8%** on the same 2,707 jointly decided comparisons.

[Research note: When a rubric cannot pick a winner](@/blog/when-rubrics-cannot-decide.md)

## Engineering Projects

### TensorTalk: UM FSKTM Handbook Agentic RAG System

**Date:** Mar 2026 - May 2026

**Project link:** [TensorCat/TensorTalk](https://huggingface.co/TensorCat/TensorTalk)

- Built TensorTalk, an agentic AI system for FSKTM, Universiti Malaya handbook Q&A, combining fine-tuned LLMs, RAG, PPO-style optimization, and Harness Engineering for agent workflow control.
- Built a handbook-to-SFT dataset pipeline with PDF/Markdown preprocessing, source chunking, manual index alignment, evidence matching, metadata preservation, and training-ready QA JSONL generation.
- Fine-tuned Qwen3-8B with LoRA/SFT on curated handbook QA data, supported by metadata for source handbook, audience scope, section, evidence, and error analysis.
- Designed an Agent + Harness Engineering layer with UM/FSKTM whitelisting, official web discovery, evidence judging, fake URL filtering, RAG fallback, grounding checks, and trace logging.
- Implemented a lightweight chat UI with evidence panels, collapsed reasoning traces, robust model-loading fallback, and automatic RAG knowledge-base bootstrap.

### TensorSign: Malay Sign Language Recognition System

**Date:** Sep 2025 - Oct 2025

**Project link:** [KevinRayScottUM/Malaysian_Sign_Language](https://github.com/KevinRayScottUM/Malaysian_Sign_Language)

- Built TensorSign, a real-time Malay Sign Language recognition system for 90 gesture classes using landmark-based temporal modeling.
- Extracted 258-D MediaPipe Holistic features from pose and hand landmarks, converting videos into normalized 30-frame sequence tensors.
- Designed a complete data pipeline for 6:2:2 splitting, NPY generation, label mapping, normalization, and class-imbalance handling.
- Designed BiLSTM-Attention and causal dilated TCN architectures to capture temporal landmark dynamics, with attention pooling, residual temporal blocks, train-only normalization, and imbalance-aware training.
- Reached 91.79% test accuracy, 0.9138 macro F1, and 0.9172 weighted F1, and implemented live prediction with webcam/video inference.

### Malaysia CHIRPS Rainfall & Flood Risk Analytics

**Date:** Mar 2026 - May 2026

**Project link:** [KevinRayScottUM/Malaysia-Flood-Rainfall-Dashboard](https://github.com/KevinRayScottUM/Malaysia-Flood-Rainfall-Dashboard)

- Converted CHIRPS daily NetCDF climate files into a structured 2000-2026 Malaysia city-level rainfall dataset for downstream EDA and modeling.
- Manually defined 25 research city anchor points with latitude, longitude, and radius, then extracted city rainfall using geospatial Haversine grid masking.
- Engineered rainfall indicators from gridded data, including avg/max/min/median rainfall, rainy/heavy/very-heavy grid ratios, and rainfall-based flood-risk proxy labels.
- Performed EDA and modeling, including correlation analysis, PCA, clustering, XGBoost rainfall regression with test R-squared up to 0.91, and experimental PatchTST Transformer forecasting for next-day rainfall and flood-risk proxy prediction.
- Built an interactive Streamlit dashboard with dynamic filters, adaptive aggregation, animated timeline charts, heatmap animation, and flood-risk monitoring views.

### TensorHome: ROS-Based Multi-Modal Smart Home Control System

**Date:** Apr 2026 - May 2026

**Project link:** [KevinRayScottUM/House-Controling-System](https://github.com/KevinRayScottUM/House-Controling-System)

- Developed a ROS1 Noetic smart-home control system with gesture recognition, offline Vosk ASR, ROS topic routing, state management, Pygame GUI, and audio feedback.
- Designed a rule-based gesture protocol with left-hand room selection, right-hand device/action control, and a selection-lock + standby state machine to prevent false triggers.
- Built an offline voice-control pipeline with Vosk ASR, grammar-expanded command parsing, and support for device-level, room-level, multi-room, and global shutdown commands.
- Unified gesture and voice inputs through `/home_assistant/gesture_raw -> /home_assistant/gesture_selection -> /home_assistant/command` and `/recognizer/output -> /home_assistant/command`, enabling consistent multi-modal control.
- Delivered a deployable robotics workflow with launch files, cooldown/timeout parameters, 3-room animated GUI, device sound feedback, Jupiter/WSL setup, and rqt_graph validation.
