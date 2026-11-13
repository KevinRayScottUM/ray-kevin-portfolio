## 研究项目

### 面向时间序列变化的预测几何引导依赖校准

**与 Zhuangzhuang Pan、Bohan Guo、Yan Xia 合作。** Zhuangzhuang Pan 与我为同等贡献。

- 从预测形状构建半正定核，特征包括离散程度、相对水平、相邻变化与尾部宽度。在不改变各预测时域边缘分布、也不重新调用预测器的前提下，调整跨时域相关性。
- 在六个数据集和两个冻结预测器上，相较参数量匹配的纯时间核，归一化变化 CRPS 降低 **0.2005%**。正确对齐的特征在汇总评分上优于全部 47 个独立重新拟合的循环移位对照。
- 对于预测形状差异较大的时域对，90% 区间评分降低 **3.59%**，覆盖率由 **82.70% 提升至 85.68%**，但仍未达到名义上的 90%。

[研究笔记：变化的不确定性为何取决于两端预测](/blog/forecast-horizon-dependence/) · [GitHub 项目代码](https://github.com/panzhzh/beyond-time-distance)

### 未知曲率下用于序梯度恢复的结构化查询

**与 Zhuangzhuang Pan 合作，同等贡献。**

- 为偶数维度 *d* ≥ 8 设计单轮环形查询。6*d* 次评估仅暴露 3*d* − 1 个线性与二次系数，不要求 Hessian 稀疏。
- 证明当查询基下每个梯度坐标均非零时，连通的坐标圆可通过连续排序识别梯度方向；不连通的支撑集可能让不同方向产生相同排序。
- 在 768 个二次目标上，二次解码器的角度 RMSE 为 **0.97°**，相同查询上的排序加权为 **10.04°**。在 128 个独立匹配目标上，相比同预算、同解码器的镜像正交框架，环形设计将角度 **MSE 降低 19.0%**。

[研究笔记：一圈坐标查询能看见什么](/blog/coordinate-circles-and-curvature/) · [GitHub 项目代码](https://github.com/panzhzh/ordinal-gradient-query-designs)

### 排序何时优于符号？偶对称干扰下的梯度方向恢复

- 刻画一批对向查询点的完整排序包含哪些梯度信息。短环可以消除未知偶对称偏移，而完整排序还能排除短环仍认为可行的方向。
- 当查询球面上的偶对称项相对线性信号变化较小时，建立近最优单轮恢复界。若不存在统一的相对曲率界，为达到角误差 ε，最坏情形评估复杂度在单轮中为 Θ(*d*/ε)，在允许足够自适应轮数时为 Θ(*d* log(1/ε))。
- 在最多 16 轮的设置中，短环更新相较 ZO-RankSGD，将平均剩余相对**训练**差距在 **Airfoil 上降低 62.6%**、在 **Concrete 上降低 35.5%**。实验尚未证明拟合更长环能带来额外优化收益。

[研究笔记：反馈轮数紧张时，排序带来什么](/blog/rankings-and-feedback-rounds/)

### 评分准则无法裁决时：LLM 评估中的隐式价值补全

- 构建 TradeoffBench，检验当精确的分项分数发生冲突、而准则未给出权衡规则时，评判模型是否会暂缓裁决。该设置将“执行规则”与“估计规则所用分数”区分开。
- 六种非推理评判配置在 1,345 个冲突中，给出无依据胜者的比例为 **8.85% 至 81.12%**。另一项审计中，三种开启推理的配置在 **9,720** 次冲突判断中仅给出 **2 次无依据选择**。
- 在 HUMAINE 上，显式权衡使决策覆盖率增加 **2.5 个百分点**。在 MultiPref 的同一组 2,707 个双方均作出决策的比较上，以同伴平均分替代目标评分者本人的分数，使分歧率由 **0.6% 升至 28.8%**。

[研究笔记：评分准则何时无法选出胜者](/blog/when-rubrics-cannot-decide/)

## 工程项目

### TensorTalk：马来亚大学 FSKTM 手册 Agentic RAG 系统

**时间：** 2026 年 3 月至 5 月

**项目地址：** [TensorCat/TensorTalk](https://huggingface.co/TensorCat/TensorTalk)

- 面向马来亚大学 FSKTM 手册问答构建 TensorTalk，结合微调大模型、RAG、PPO 式优化与用于智能体工作流控制的 Harness 工程。
- 构建从手册到 SFT 数据集的流程，包含 PDF/Markdown 预处理、来源分块、手工索引对齐、证据匹配、元数据保留及可用于训练的 QA JSONL 生成。
- 在整理后的手册 QA 数据上对 Qwen3-8B 进行 LoRA/SFT 微调，并保留来源手册、受众范围、章节、证据与错误分析元数据。
- 设计 Agent + Harness 工程层，包含 UM/FSKTM 白名单、官方网页发现、证据评判、伪造 URL 过滤、RAG 回退、证据支撑检查和轨迹日志。
- 实现轻量聊天界面，提供证据面板、可折叠推理轨迹、稳健的模型加载回退与 RAG 知识库自动初始化。

### TensorSign：马来西亚手语识别系统

**时间：** 2025 年 9 月至 10 月

**项目地址：** [KevinRayScottUM/Malaysian_Sign_Language](https://github.com/KevinRayScottUM/Malaysian_Sign_Language)

- 基于关键点时序建模，构建支持 90 类手势的实时马来西亚手语识别系统 TensorSign。
- 从姿态和双手关键点提取 258 维 MediaPipe Holistic 特征，将视频转为归一化的 30 帧序列张量。
- 设计完整数据流程，包括 6:2:2 划分、NPY 生成、标签映射、归一化与类别不平衡处理。
- 设计 BiLSTM-Attention 和因果扩张 TCN，结合注意力池化、残差时序模块、仅使用训练集拟合的归一化及考虑类别不平衡的训练，捕捉关键点时序动态。
- 测试准确率达 **91.79%**，宏平均 F1 为 **0.9138**，加权 F1 为 **0.9172**，并实现摄像头与视频实时推理。

### 马来西亚 CHIRPS 降雨与洪水风险分析

**时间：** 2026 年 3 月至 5 月

**项目地址：** [KevinRayScottUM/Malaysia-Flood-Rainfall-Dashboard](https://github.com/KevinRayScottUM/Malaysia-Flood-Rainfall-Dashboard)

- 将 CHIRPS 每日 NetCDF 气候文件转为结构化的 2000—2026 年马来西亚城市级降雨数据集，用于后续探索分析与建模。
- 手工定义 25 个研究城市的经纬度与半径锚点，通过 Haversine 地理网格掩膜提取城市降雨。
- 从网格数据构建平均、最大、最小和中位降雨量，以及降雨、强降雨、特强降雨网格比例与基于降雨的洪水风险代理标签。
- 完成相关性分析、PCA、聚类和 XGBoost 降雨回归，测试 R² 最高达 **0.91**；并实验性使用 PatchTST Transformer 预测次日降雨与洪水风险代理指标。
- 构建 Streamlit 交互仪表板，提供动态筛选、自适应聚合、时间轴动画、热力图动画与洪水风险监测视图。

### TensorHome：基于 ROS 的多模态智能家居控制系统

**时间：** 2026 年 4 月至 5 月

**项目地址：** [KevinRayScottUM/House-Controling-System](https://github.com/KevinRayScottUM/House-Controling-System)

- 开发 ROS1 Noetic 智能家居控制系统，集成手势识别、离线 Vosk ASR、ROS 话题路由、状态管理、Pygame GUI 与音频反馈。
- 设计规则式手势协议：左手选择房间，右手控制设备与动作，并通过“选择锁定 + 待机”状态机减少误触发。
- 构建离线语音流程，包含 Vosk ASR、语法扩展命令解析，以及设备级、房间级、多房间和全局关闭命令。
- 通过 `/home_assistant/gesture_raw -> /home_assistant/gesture_selection -> /home_assistant/command` 与 `/recognizer/output -> /home_assistant/command` 统一手势和语音输入，实现一致的多模态控制。
- 交付可部署的机器人工作流，包含 launch 文件、冷却与超时参数、三房间动画 GUI、设备音效反馈、Jupiter/WSL 配置和 rqt_graph 验证。
