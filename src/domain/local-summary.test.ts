import assert from 'node:assert/strict';
import test from 'node:test';
import { selectGroundedSummary } from './local-summary';

test('quita prefijos de prompt y conserva sólo oraciones ancladas en la fuente', () => {
  const source = 'Los humedales mantienen biodiversidad, almacenan carbono y reducen inundaciones. La restauración requiere colaboración comunitaria y monitoreo de especies.';
  const output = 'Texto: Información es especial. Los humedales mantienen biodiversidad, almacenan carbono y reducen inundaciones.';
  assert.equal(selectGroundedSummary(output, source), 'Los humedales mantienen biodiversidad, almacenan carbono y reducen inundaciones.');
});

test('rechaza salida vacía o sin solapamiento léxico suficiente con la fuente', () => {
  assert.equal(selectGroundedSummary('', 'Un texto fuente sobre humedales y biodiversidad.'), null);
  assert.equal(selectGroundedSummary('La economía mundial cambiará radicalmente. Nada puede evitar ese futuro.', 'Los humedales protegen especies y reducen inundaciones.'), null);
});

test('devuelve hasta dos frases sustentadas y sin anteponer etiquetas de tarea', () => {
  const source = 'La lectura mejora el vocabulario y la comprensión. Practicar diariamente facilita el aprendizaje de nuevas palabras.';
  assert.equal(selectGroundedSummary('Resumen en español: La lectura mejora el vocabulario y la comprensión. Practicar diariamente facilita el aprendizaje de nuevas palabras.', source), 'La lectura mejora el vocabulario y la comprensión. Practicar diariamente facilita el aprendizaje de nuevas palabras.');
});
