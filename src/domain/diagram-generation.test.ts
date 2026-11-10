import assert from 'node:assert/strict';
import test from 'node:test';
import { populateProjectFromAnalysis } from './diagram-generation';
import type { Project } from './model';
import type { LocalAnalysisResult } from '../workers/analysis.worker';

function project(type = 'mindmap'): Project {
  return {
    schemaVersion: 1,
    id: 'project-test',
    name: 'Prueba',
    type,
    updated: 1,
    nodes: [],
    edges: [],
    groups: [],
    pages: [],
    sources: [],
  };
}

function analysis(): LocalAnalysisResult {
  return {
    title: 'Privacidad local',
    summary: 'Los datos se quedan en el dispositivo.',
    sections: [],
    paragraphs: [],
    keywords: ['privacidad'],
    keySentences: [
      'Los proyectos permanecen guardados en el navegador del usuario.',
      'La persona revisa los hallazgos antes de compartir su trabajo.',
    ],
    evidence: [],
    modelUsed: true,
    modelId: 'Xenova/multilingual-e5-small',
  };
}

test('convierte frases seleccionadas en tarjetas editables con evidencia y relaciones', () => {
  const generated = populateProjectFromAnalysis(project(), analysis());
  assert.equal(generated.nodes.length, 3);
  assert.equal(generated.edges.length, 2);
  assert.equal(generated.sources.length, 3);
  assert.equal(generated.nodes[0].label, 'Privacidad local');
  assert.equal(generated.nodes[1].detail, analysis().keySentences[0]);
  assert.equal(generated.nodes[1].inference, 'local-model');
  assert.equal(generated.sources[1].nodeIds?.[0], generated.nodes[1].id);
  assert.deepEqual(generated.pages[0].nodeIds, generated.nodes.map((node) => node.id));
});

test('mantiene orden de fuente en flujo y utiliza reglas si el modelo no estuvo disponible', () => {
  const input = { ...analysis(), modelUsed: false, keySentences: [], paragraphs: ['Primera etapa inicia con una revisión del caso antes de decidir. Segunda etapa compara las opciones y determina el camino adecuado.'] };
  const generated = populateProjectFromAnalysis(project('flow'), input);
  assert.equal(generated.nodes[0].x, 8);
  assert.equal(generated.nodes[1].inference, 'rules');
  assert.equal(generated.edges[0].from, generated.nodes[0].id);
  assert.equal(generated.sources[1].generatedBy, 'rules');
});

test('rechaza material sin frases utilizables en lugar de crear cajas vacías', () => {
  assert.throws(() => populateProjectFromAnalysis(project(), { ...analysis(), keySentences: [], paragraphs: [], summary: 'Breve' }), /No encontré frases completas/);
});

test('no duplica como tarjeta la primera frase usada como título del mapa', () => {
  const input: LocalAnalysisResult = {
    ...analysis(),
    title: 'El programa de tutoría relaciona a estudiantes',
    keySentences: [
      'El programa de tutoría relaciona a estudiantes con mentores.',
      'Cada estudiante registra una meta de aprendizaje al inicio.',
      'Los mentores revisan avances durante reuniones periódicas.',
    ],
  };
  const generated = populateProjectFromAnalysis(project(), input);
  assert.equal(generated.nodes.length, 3);
  assert.equal(generated.nodes.some((node) => node.detail === input.keySentences[0]), false);
});
