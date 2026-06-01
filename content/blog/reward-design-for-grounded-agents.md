+++
title = "Reward Design for Grounded AI Agents"
date = 2021-11-14

description = "Why reliable agents need reward signals for evidence use, refusal, tool discipline, and recovery rather than only final-task success."

[extra]
tldr = "If the reward only scores final answers, an agent can learn shortcuts. A better reward model should include evidence grounding, tool discipline, uncertainty handling, and recoverability."
thumbnail = "img/blog/reward-design.svg"
likes = 154
+++

For intelligent agents, reward design is more than a reinforcement learning detail. It defines what kind of behavior the system is encouraged to repeat. If the reward only measures whether the final answer looks correct, the agent may learn shortcuts: unsupported claims, unnecessary tool calls, brittle reasoning, or confident answers when it should refuse.

A more useful reward signal decomposes behavior:

<div class="math-block">R = R_answer + alpha R_evidence + beta R_tool - gamma R_unsupported - eta R_unsafe</div>

This is still a simplification, but it points in the right direction. The agent should be rewarded for answering correctly, but also for using evidence, selecting appropriate tools, and staying within allowed actions. It should be penalized for unsupported claims, fake citations, unsafe operations, or failure to recover from missing context.

For RAG and tool-using agents, one useful distinction is between outcome reward and process reward. Outcome reward asks whether the final answer is right. Process reward asks whether the path was controlled:

- Did the agent retrieve the right source?
- Did it quote or cite evidence faithfully?
- Did it call a tool only when the tool was needed?
- Did it stop when the evidence was insufficient?
- Did it recover from failed retrieval or invalid URLs?

This matters because a deployed agent is not a single prediction. It is a workflow. The harness around the model should record traces, score intermediate behavior, and use that signal to improve routing, prompts, retrieval, and evaluation.

In practice, the reward model should be paired with a harness. The harness supplies constraints and observations; the reward model turns those traces into feedback. This combination is what makes agent improvement more reliable than simply asking the model to "be careful."
