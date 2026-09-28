#!/usr/bin/env node
import { readFile, access } from 'node:fs/promises';

const manifest = JSON.parse(
  await readFile(new URL('../public/recipe-catalog/manifest.json', import.meta.url), 'utf8'),
);
const errors = [];
if (manifest.count !== manifest.recipes?.length) errors.push('manifest count mismatch');
const names = new Set();
let ingredientRich = 0;
for (const recipe of manifest.recipes || []) {
  if (!recipe.name || !recipe.image || !recipe.url) errors.push(`missing key fields: ${recipe.id}`);
  const key = recipe.name.trim().toLowerCase();
  if (names.has(key)) errors.push(`duplicate name: ${recipe.name}`);
  names.add(key);
  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length >= 2) ingredientRich += 1;
  try {
    await access(new URL(`../public${recipe.image}`, import.meta.url));
  } catch {
    errors.push(`missing local image: ${recipe.image}`);
  }
}
if (errors.length) {
  console.error(errors.slice(0, 50).join('\n'));
  process.exit(1);
}
console.log(`Recipe catalog OK: ${manifest.count} unique recipes with local images and URLs.`);
console.log(`Ingredient-rich recipes available for local-first matching: ${ingredientRich}.`);
if (ingredientRich < 300) {
  console.warn('Warning: local-first matching coverage is low; expected hundreds of ingredient-rich recipes.');
}
