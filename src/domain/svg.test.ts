import test from 'node:test';
import assert from 'node:assert/strict';
import { exportProjectSvg } from './svg';
import type { Project } from './model';

function project(): Project {
  return {
    schemaVersion: 1, id: 'p', name: 'Proyecto & <principal> "x"', type: 'flow', updated: 0,
    nodes: [
      { id: 'a', label: 'A <script>&"\'x\'</script>', detail: '', x: 50, y: 50, tone: 'blue', shape: 'card' },
      { id: 'b', label: 'B & C', detail: '', x: 50, y: 50, tone: 'green', shape: 'circle' },
      { id: 'c', label: 'C', detail: '', x: 1e100, y: -1e100, tone: 'blue', shape: 'pill', colorHex: 'url(javascript:alert(1))' },
      { id: 'd', label: 'D', detail: '', x: 25, y: 75, tone: 'rose', shape: 'diamond', colorHex: '#abc' },
      { id: 'e', label: 'E', detail: '', x: 75, y: 25, tone: 'yellow', shape: 'hexagon' },
      { id: 'f', label: 'F', detail: '', x: 10, y: 90, tone: 'blue', shape: 'not-a-shape' as never, colorHex: '#12zz00' },
    ],
    edges: [
      { id: 'fwd', from: 'a', to: 'c', direction: 'forward', label: '<script>&"\'' },
      { id: 'back', from: 'b', to: 'd', direction: 'backward', label: ' назад' },
      { id: 'both', from: 'c', to: 'e', direction: 'both' },
      { id: 'none', from: 'd', to: 'f', direction: 'none' },
    ], groups: [], pages: [], sources: [],
  };
}

test('exporta un documento SVG XML válido y escapa nombres, identificadores y labels peligrosas', () => {
  const svg = exportProjectSvg(project());
  assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<title id="project-title">Proyecto &amp; &lt;principal&gt; &quot;x&quot;<\/title>/);
  assert.match(svg, /A &lt;script&gt;&amp;&quot;&apos;x&apos;&lt;\/script&gt;/);
  assert.match(svg, /&lt;script&gt;&amp;&quot;&apos;/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /data-node-id="a"/);
});

test('renderiza todas las formas y conserva nodos con coordenadas repetidas', () => {
  const svg = exportProjectSvg(project());
  assert.equal((svg.match(/class="node"/g) ?? []).length, 6);
  assert.match(svg, /<rect x="[\d.]+" y="[\d.]+" width="168" height="92" rx="14"/);
  assert.match(svg, /<ellipse cx="[\d.]+" cy="[\d.]+"/);
  assert.match(svg, /rx="46"/);
  assert.match(svg, /<polygon points=/);
  assert.equal((svg.match(/<polygon points=/g) ?? []).length, 2);
  assert.match(svg, /<ellipse cx="600" cy="400"/);
  assert.match(svg, /x1="[\d.]+" y1="[\d.]+"/);
});

test('expresa direcciones de flecha explícitamente y conserva labels de conexión', () => {
  const svg = exportProjectSvg(project());
  assert.match(svg, /marker-end="url\(#arrow\)"/);
  assert.match(svg, /marker-start="url\(#arrow\)"/);
  assert.match(svg, /marker-start="url\(#arrow\)" marker-end="url\(#arrow\)"/);
  assert.equal((svg.match(/<line /g) ?? []).length, 4);
  assert.match(svg, /> назад<\/text>/);
  assert.match(svg, /fill="#abc"/);
  assert.doesNotMatch(svg, /fill="url\(javascript:/);
  assert.doesNotMatch(svg, /fill="#12zz00"/);
  assert.match(svg, /fill="#dbeafe"/);
  assert.match(svg, /x="1008" y="24"/);
  assert.match(svg, /x="122\.4" y="618"/);
});

test('exporta extremos de conector en los puertos cardinales elegidos', () => {
  const input = project();
  input.nodes = input.nodes.slice(0, 2);
  input.edges = [{ id: 'ports', from: 'a', to: 'b', direction: 'forward', fromPort: 'right', toPort: 'left' }];
  const svg = exportProjectSvg(input);
  assert.match(svg, /<line x1="684" y1="400" x2="516" y2="400"/);
});
