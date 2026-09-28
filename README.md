# Pantry Pal

Build a polished responsive web app called PantryTalk.

Core problem: users often have ingredients at home but do not know what to cook. PantryTalk lets them speak or enter the key ingredients they have, then recommends the best dishes they can realistically make.

Product flow

Screen 1 — Ingredient input

Create a clean landing screen with the headline:

“What’s in your kitchen?”

Supporting text:

“Tell me what ingredients you have, and I’ll find something worth cooking.”

Add a large central microphone button labeled:

“Tell me what you have”

For now, the microphone can use mock behavior. When clicked, simulate the transcript:

“avocado, lemon, eggs, bread, tomatoes, cheddar”

Convert those into editable ingredient chips:

 Avocado

 Lemon

 Eggs

 Bread

 Tomatoes

 Cheddar

Allow users to:

 remove an ingredient chip

 manually add another ingredient

The app should assume common pantry staples are already available and should not ask the user to list them.

Default assumed pantry staples:

 cooking oil / olive oil

 salt

 black pepper

 water

 common dried spices

Do not treat those as key ingredients when determining recipe compatibility.

Meal preference

Under the ingredients, show selectable pill buttons:

 Anything

 Quick

 High Protein

 Healthy

 Breakfast

 Lunch

 Dinner

Default to Anything.

Add a large primary CTA:

“Find recipes”

Screen 2 — Recipe recommendations

After clicking “Find recipes”, show exactly 5 recipe recommendations.

Use realistic mock data based on:

avocado, lemon, eggs, bread, tomatoes, cheddar

Use these five recipes:

 Avocado Egg Toast

 Cheesy Tomato Omelette

 Egg Salad Sandwich

 Shakshuka-Style Eggs

 Tomato Cheddar Breakfast Toast

Each recipe must appear as a large, visually appealing card containing:

 food image

 dish name

 total cooking time

 ingredients from the user's pantry that are used

 important missing ingredients, if any

 a readiness badge

 a “Cook this” button

Example readiness statuses:

Ready now

or:

Missing 1 ingredient

Do not penalize recipes for assumed staples such as salt, pepper, oil, water, or basic spices.

Example mock card:

Avocado Egg Toast

15 min

Uses:
Avocado · Egg · Bread · Lemon · Tomato

Assumed:
Salt · Pepper · Olive oil

Ready now

Add a small compatibility indicator such as:

95% pantry match

Make recipe cards strongly visual, with the food photo occupying significant space.

Screen 3 — Recipe detail

When the user clicks “Cook this”, open a detailed recipe view.

Include:

 large hero food image

 recipe title

 total time

 servings

 pantry match

 ingredients the user already has

 assumed pantry staples

 missing ingredients if applicable

 numbered cooking instructions

Add a prominent button:

“Start cooking”

Include a smaller button:

“Back to recipes”

Screen 4 — Cooking mode

Clicking “Start cooking” enters a distraction-free cooking interface.

Show one instruction at a time.

Example:

Step 2 of 6

Mash the avocado with lemon juice, salt and black pepper.

Add large controls:

 Previous

 Repeat

 Next

Include a progress bar for the recipe.

Design this screen so it can be read easily from several feet away while cooking.

Cooking Vibe music control

Create a compact persistent music control in the top-left area of the app.

Label:

Cooking Vibe

Include:

 dropdown menu

 play / pause button

 mute / unmute button

Dropdown options:

 Lo-fi

 EDM

 Techno

 Slow

 Acoustic

 Jazz

 Classical

 Upbeat

Default to Lo-fi.

For now, use mock local behavior:

 pressing Play visually changes the control to Pause

 pressing Mute toggles to Unmute

 changing genre updates the selected vibe

The music control should remain accessible throughout the app, especially in cooking mode.

Mock recipe data

Create complete mock ingredient lists and cooking steps for all five dishes so every card and button works.

Use sensible, realistic recipes.

Keep recipes simple and achievable.

The five recipe examples should make intelligent use of subsets of the user's ingredients rather than forcing every ingredient into every dish.

Design

Aim for a premium modern cooking-app aesthetic.

Use:

 warm off-white background

 dark readable typography

 subtle green accent

 rounded cards

 high-quality food imagery

 generous white space

 large tap targets

 simple icons

Avoid:

 cluttered dashboards

 excessive gradients

 tiny text

 overly technical UI

The app should feel approachable and consumer-friendly.

Make it mobile-first, but make desktop look polished too.

Important implementation requirement

Build the app as a complete working mock product first.

Do not integrate external APIs yet.

Structure the code so we can later replace:

 mock speech input with ElevenLabs Speech-to-Text

 mock recipe data with Linkup live recipe discovery

 mock cooking narration with ElevenLabs Text-to-Speech

 mock music with real audio playback or ElevenLabs-generated music

Make all navigation and controls functional now.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pantry-talk-app.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2cb079b8-2431-49e3-a4ba-00c7b5976440).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
