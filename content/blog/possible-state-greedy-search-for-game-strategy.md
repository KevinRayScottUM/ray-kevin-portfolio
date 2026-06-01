+++
title = "Possible-State Greedy Search for Game Strategy"
date = 2026-06-01

description = "A technical reflection on using possible-state filtering, transition-aware updates, and greedy quantile guessing for a moving-number game."

[extra]
tldr = "The strategy is not just guessing a number. It keeps a belief set over (N, P), updates that set after every server response, and chooses guesses that reduce uncertainty while accounting for the fact that N moves after low guesses."
thumbnail = "img/blog/greedy-search-game.svg"
likes = 149
+++

The interesting part of the possible-state greedy search strategy is that it treats the game as a partially observed state-tracking problem rather than a simple binary search. The hidden state is not only the current number `N`; it is the pair `(N, P)`, where `P` determines how the number moves after a low guess. This changes the shape of the search problem because one kind of wrong answer is passive while another changes the world.

In the current implementation, the initial belief set is:

<div class="math-block">S0 = {(N, P) : 1 <= N <= 1000, 1 <= P <= 200}</div>

After a guess `g`, the server response filters and transforms the possible states. If the guess is too high, the current number must satisfy `N < g`, so the new set keeps only states below the guess. If the guess is too low, the state must satisfy `N > g`, but then the game advances:

<div class="math-block">S_{t+1} = {(N + P, P) : (N, P) in S_t and N > g}</div>

This is why ordinary midpoint binary search is not quite right. Guessing too low is more expensive than guessing too high because it does not merely reveal information; it also moves the target. The current heuristic chooses a value around the 60 percent quantile of possible `N` values, leaning above the median to avoid repeated low guesses.

The high-to-low fallback when the possible range is small is also reasonable. Once the remaining range is narrow, an overly large guess does not advance `N`, so descending search becomes safer than repeatedly undershooting and pushing the state forward.

A stronger version of the idea would score candidate guesses by expected posterior size plus transition cost:

<div class="math-block">score(g) = E[|S_{t+1}(g, r)|] + lambda * P(response = "+") * E[P | N > g]</div>

This turns the heuristic into a transition-aware search policy. The goal is not only to split the current possibilities, but to avoid responses that make future states drift faster. In small games, this score could be computed exactly over all candidate guesses. In larger games, it could be approximated by sampling the belief set.

The broader lesson is useful beyond this assignment-style game. When an action changes the hidden state, search should not optimize only information gain. It should also model the cost of how the environment evolves after each action.
