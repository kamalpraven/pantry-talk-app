# PantryTalk — five new features

Everything already built stays as it is: the same look, the ingredient chips, the five recipes, the recipe pages, cooking mode and the Cooking Vibe music control. This adds five things on top.

## 1. Real voice input

The microphone stops being a simulation. Tapping it records from the device microphone and sends the audio to a transcription service, then turns the words into ingredient chips exactly as it does today. If the microphone is blocked or the recording fails, a short message appears and typing ingredients by hand still works.

## 2. Time limit and diet choices

On the first screen, below the mood pills:

- Cooking time: Under 15 min / Under 30 min / No rush (default No rush)
- Goals (pick as many as apply): High Protein, Vegetarian, Low Carb, Dairy Free, Gluten Free

These choices reorder the results: dishes that fit the time limit and every chosen goal come first, higher-protein dishes rank higher when High Protein is on. Nothing is hidden outright — a slightly slower dish just drops down the list.

## 3. A second voice question

Once the chips exist, a smaller microphone appears with "What are you in the mood for?". Saying "something high protein under twenty minutes" ticks High Protein and Under 30 min for you, and the ticked choices are shown so you can change them before searching. If the sentence can't be understood, a short note says so and the buttons keep working normally.

## 4. Richer recipe cards

Each card gains, in one clean line: time, estimated calories and protein per serving, plus the existing pantry match and readiness badge. Below that, one short sentence explaining why it was suggested — for example "Uses 5 of your 6 ingredients and takes only 12 minutes." Up to two small labels (e.g. High Protein, Vegetarian) appear per card, no more.

Calorie and protein figures are written in as sensible estimates for now, clearly labelled as estimates, and sit in the same place where live recipe data will later come from.

## 5. Substitutions

When a dish is missing exactly one key ingredient and a fair swap exists, the card shows a small "1 easy substitute" badge and the recipe page shows the swap, e.g. Mayonnaise → Greek yogurt + lemon. Swaps are offered as suggestions only, and never for an ingredient the dish is named after.

## 6. Cooking timers

In cooking mode, a step that mentions a time ("cook the onions for 4 minutes") gets a "Start 4-minute timer" button. Tapping it starts a large countdown with Pause, Resume and Reset. At zero it turns into a clear finished state and plays a short chime if sound is on. Timers never start on their own, steps without a time show no button, and the timer is completely separate from the music control.

## Technical notes

- Recipe objects gain `dietaryTags`, `nutrition` (kcal + protein per serving, estimated), and `substitutions` (missing ingredient → suggestion, with an `essential` flag that blocks swaps for defining ingredients). Timed steps and the "why this" sentence are derived from existing data, so Linkup can later supply recipes plus source URLs and images without reshaping the UI.
- `findRecipes()` keeps its role as the single ranking entry point; it takes the new filter object (time limit, goals) and returns match, reason and label data per recipe.
- Speech-to-text runs through a TanStack server function that calls the Lovable AI transcription endpoint with the server-side key; the browser records WAV audio via Web Audio and uploads it. `src/lib/speech.ts` keeps its current function signatures.
- Preference parsing uses one Lovable AI call with a strict schema returning time limit + goal flags, with a keyword fallback if the call fails.
- Step time detection is a regex over the existing step text (minutes/seconds, digits and words); the timer is a local hook with its own short WebAudio chime, independent of the vibe store.
