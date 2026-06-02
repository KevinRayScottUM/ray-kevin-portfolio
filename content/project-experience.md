+++
title = "Project Experience"
template = "page.html"
path = "project-experience"
+++

## TensorTalk: UM FSKTM Handbook Agentic RAG System

**Date:** Mar 2026 - May 2026

**Project link:** [TensorCat/TensorTalk](https://huggingface.co/TensorCat/TensorTalk)

- Built TensorTalk, an agentic AI system for FSKTM, Universiti Malaya handbook Q&A, combining fine-tuned LLMs, RAG, PPO-style optimization, and Harness Engineering for agent workflow control.
- Built a handbook-to-SFT dataset pipeline with PDF/Markdown preprocessing, source chunking, manual index alignment, evidence matching, metadata preservation, and training-ready QA JSONL generation.
- Fine-tuned Qwen3-8B with LoRA/SFT on curated handbook QA data, supported by metadata for source handbook, audience scope, section, evidence, and error analysis.
- Designed an Agent + Harness Engineering layer with UM/FSKTM whitelisting, official web discovery, evidence judging, fake URL filtering, RAG fallback, grounding checks, and trace logging.
- Implemented a lightweight chat UI with evidence panels, collapsed reasoning traces, robust model-loading fallback, and automatic RAG knowledge-base bootstrap.

## TensorSign: Malay Sign Language Recognition System

**Date:** Sep 2025 - Oct 2025

**Project link:** [KevinRayScottUM/Malaysian_Sign_Language](https://github.com/KevinRayScottUM/Malaysian_Sign_Language)

- Built TensorSign, a real-time Malay Sign Language recognition system for 90 gesture classes using landmark-based temporal modeling.
- Extracted 258-D MediaPipe Holistic features from pose and hand landmarks, converting videos into normalized 30-frame sequence tensors.
- Designed a complete data pipeline for 6:2:2 splitting, NPY generation, label mapping, normalization, and class-imbalance handling.
- Designed BiLSTM-Attention and causal dilated TCN architectures to capture temporal landmark dynamics, with attention pooling, residual temporal blocks, train-only normalization, and imbalance-aware training.
- Reached 91.79% test accuracy, 0.9138 macro F1, and 0.9172 weighted F1, and implemented live prediction with webcam/video inference.

## Malaysia CHIRPS Rainfall & Flood Risk Analytics

**Date:** Mar 2026 - May 2026

**Project link:** [KevinRayScottUM/Malaysia-Flood-Rainfall-Dashboard](https://github.com/KevinRayScottUM/Malaysia-Flood-Rainfall-Dashboard)

- Converted CHIRPS daily NetCDF climate files into a structured 2000-2026 Malaysia city-level rainfall dataset for downstream EDA and modeling.
- Manually defined 25 research city anchor points with latitude, longitude, and radius, then extracted city rainfall using geospatial Haversine grid masking.
- Engineered rainfall indicators from gridded data, including avg/max/min/median rainfall, rainy/heavy/very-heavy grid ratios, and rainfall-based flood-risk proxy labels.
- Performed EDA and modeling, including correlation analysis, PCA, clustering, XGBoost rainfall regression with test R-squared up to 0.91, and experimental PatchTST Transformer forecasting for next-day rainfall and flood-risk proxy prediction.
- Built an interactive Streamlit dashboard with dynamic filters, adaptive aggregation, animated timeline charts, heatmap animation, and flood-risk monitoring views.

## TensorHome: ROS-Based Multi-Modal Smart Home Control System

**Date:** Apr 2026 - May 2026

**Project link:** [KevinRayScottUM/House-Controling-System](https://github.com/KevinRayScottUM/House-Controling-System)

- Developed a ROS1 Noetic smart-home control system with gesture recognition, offline Vosk ASR, ROS topic routing, state management, Pygame GUI, and audio feedback.
- Designed a rule-based gesture protocol with left-hand room selection, right-hand device/action control, and a selection-lock + standby state machine to prevent false triggers.
- Built an offline voice-control pipeline with Vosk ASR, grammar-expanded command parsing, and support for device-level, room-level, multi-room, and global shutdown commands.
- Unified gesture and voice inputs through `/home_assistant/gesture_raw -> /home_assistant/gesture_selection -> /home_assistant/command` and `/recognizer/output -> /home_assistant/command`, enabling consistent multi-modal control.
- Delivered a deployable robotics workflow with launch files, cooldown/timeout parameters, 3-room animated GUI, device sound feedback, Jupiter/WSL setup, and rqt_graph validation.
