import assert from 'node:assert/strict';
import test from 'node:test';
import { selectSemanticSentences, splitSummarySentences } from './semantic-summary';

test('divide el texto en fragmentos con puntuación, conservando la frase literal', () => {
  assert.deepEqual(splitSummarySentences('La app guarda proyectos en IndexedDB. La información permanece en el dispositivo.'),
    ['La app guarda proyectos en IndexedDB.', 'La información permanece en el dispositivo.']);
});

test('elige las frases mejor puntuadas, pero conserva el orden de la fuente', () => {
  const sentences = ['Primera frase literal con detalles importantes.', 'Segunda frase literal con datos relevantes.', 'Tercera frase literal con otra explicación.'];
  assert.deepEqual(selectSemanticSentences(sentences, [0.92, 0.4, 0.98], 2), [sentences[0], sentences[2]]);
});

test('deduplica frases y rechaza vectores incompletos o scores no finitos', () => {
  const sentence = 'Glyphind mantiene los datos y las fuentes en local.';
  assert.deepEqual(selectSemanticSentences([sentence, sentence], [0.7, 0.9], 2), [sentence]);
  assert.deepEqual(selectSemanticSentences([sentence], [], 2), []);
  assert.deepEqual(selectSemanticSentences([sentence], [Number.NaN], 2), []);
});
