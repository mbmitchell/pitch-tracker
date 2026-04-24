# Bullpen Planner Recommendation Model Note

This note describes the current Phase 1 recommendation model at a high level.

## Phase 1 Model

- Recommendations are deterministic and rules-based.
- The engine does not use AI, machine learning, or external services.
- Default workload anchors are Pitch Smart-informed, but they are adapted for bullpen planning rather than treated as strict game-usage compliance rules.

## Main Variables

Phase 1 recommendations currently use these main inputs:

- age group
- development phase
- recent workload
- last game outing
- high-intensity recency
- arm feel
- bullpen focus

These inputs drive the recommended pitch count, intensity, pitch mix, work blocks, coaching notes, caution notes, and applied rules.

## Design Intent

- Keep the recommendation path explainable to coaches and developers.
- Keep default safety behavior conservative when data is missing.
- Preserve guarded age-based workload limits even as the model evolves.

## Future Extension Notes

- Organization-level configurable rule sets can be layered on top of the Phase 1 defaults later.
- Pitching director controlled settings can be added as an administrative override layer.
- Team-level overrides can be introduced later, but should not silently bypass guarded age-based safety limits.
- Age-based safety limits should remain protected even if future configuration becomes more flexible.
