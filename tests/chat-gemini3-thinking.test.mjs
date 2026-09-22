import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const chat = fs.readFileSync(path.join(root, 'api/chat.js'), 'utf8');

// Gemini 3.x (gemini-3.5-flash, gemini-3.1-flash-lite, etc.) no admite apagar el pensamiento con
// thinkingBudget: hay que usar thinkingLevel, y mandar los dos campos a la vez da error. Los modelos
// 2.5 y anteriores siguen funcionando con thinkingBudget. Antes el código mandaba thinkingBudget:0
// siempre, sin importar el modelo — eso rompía a Subli en cuanto el modelo por defecto pasó a ser 3.x.
test('api/chat.js: usa thinkingLevel para Gemini 3.x y thinkingBudget para modelos anteriores, nunca los dos juntos', () => {
  const matches = [...chat.matchAll(/thinkingConfig: (\/\^gemini-3\/\.test\(model\) \? \{ thinkingLevel: "low" \} : \{ thinkingBudget: 0 \})/g)];
  assert.equal(matches.length, 2, 'la ruta real (chat/mensajes) y el diagnóstico ?test=1 deben corregirse los dos');
  assert.doesNotMatch(chat, /thinkingConfig: \{ ?thinkingBudget: 0 ?\}(?!\s*:\s*)/, 'no debe quedar ningún thinkingBudget:0 incondicional');
});
