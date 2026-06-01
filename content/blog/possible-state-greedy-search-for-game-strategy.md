+++
title = "Possible-State Greedy Search for Game Strategy"
date = 2026-06-01

description = "A technical reflection from my WQF7003 number-guessing game assignment, where a 60% greedy baseline was strengthened with explicit (N, P) state tracking."

[extra]
tldr = "The game is single-player, stochastic, and imperfect-information: after a low guess, the hidden number N moves upward by an unknown P. The improved strategy keeps all possible (N, P) states, filters them after feedback, and combines 60% greedy guessing with safe downward scanning."
thumbnail = "img/blog/greedy-search-game.svg"
likes = 149
+++

This note is based on my WQF7003 number-guessing game assignment. The game looks simple from the outside, but its structure is closer to a partially observed search problem than a normal binary-search exercise. It is single-player, stochastic, and imperfect-information: the player does not know the current hidden number `N`, and also does not know the movement parameter `P`.

The key rule is asymmetric. If a guess is too high, `N` does not change and the search range can be reduced safely. If a guess is too low, however, the server adds `P` to `N`, so the target moves upward. That means a wrong low guess is not only an information signal; it also changes the state of the game.

Our first baseline was a Greedy Search with a 60% heuristic. Instead of choosing the midpoint of the current range, it guesses around the 60% position. The reason is practical: guessing slightly higher than the median reduces the chance of undershooting and pushing `N` forward. This baseline is better aligned with the game rule than ordinary binary search, but it still tracks only a rough low-high interval. It does not know which `(N, P)` combinations are still possible.

In the current implementation, the initial belief set is:

<div class="math-block">S0 = {(N, P) : 1 <= N <= 1000, 1 <= P <= 200}</div>

The improved strategy is Possible State Greedy Search. It stores every candidate state at the beginning, then removes impossible states after each server response. After a guess `g`, if the guess is too large, every state with `N >= g` is removed. If the guess is too small, every state with `N <= g` is removed, and the remaining states are advanced:

<div class="math-block">S_{t+1} = {(N + P, P) : (N, P) in S_t and N > g}</div>

After the update, the algorithm extracts the remaining possible `N` values, sorts them, and chooses the 60% position as the next guess. This preserves the intuition of the baseline while making it state-aware. The guess is no longer selected from a rough interval; it is selected from the actual surviving state set.

When the possible range becomes small, the strategy switches to a high-to-low scan. This is important because, in a narrow range, a too-high guess is safer than a too-low guess: it narrows the possibilities without moving `N`. The algorithm therefore becomes more conservative near the end, avoiding repeated undershoots that would make the hidden value drift.

In the assignment report, the 10-round result had a maximum of 63 attempts, a minimum of 5 attempts, and an average of 29 attempts. The variability is still visible because the game can produce difficult hidden `(N, P)` combinations, but the method is more controlled than the simple baseline because it explicitly models how the game state evolves.

A natural next improvement would be to score each candidate guess by posterior uncertainty and transition cost:

<div class="math-block">score(g) = E[|S_{t+1}(g, r)|] + lambda * P(response = "+") * E[P | N > g]</div>

This would turn the heuristic into a transition-aware policy. The goal would not only be to reduce the number of possible states, but also to avoid guesses that are likely to trigger upward movement. In this sense, the algorithm is a small example of a broader AI idea: when an action changes the hidden state, search should optimize both information gain and state-transition risk.

My main takeaway is that the assignment rewards thinking beyond a fixed formula. The 60% greedy rule is a useful prior, but the stronger idea is to maintain a belief state and update it faithfully. Once the environment moves in response to mistakes, the search strategy has to become a model of the game, not only a sequence of guesses.
