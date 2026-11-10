# Selección de IA local para español

## Decisión

La opción anterior, `Xenova/flan-t5-small`, cargaba y ejecutaba inferencia, pero una prueba real con una fuente breve en español produjo una frase sin sentido. El filtro de procedencia la rechazó y el producto volvió a reglas. No es razonable presentar ese checkpoint como generador fiable de resúmenes en español.

Para preservar la privacidad y la trazabilidad, Glyphind usa `Xenova/multilingual-e5-small` como modelo local de embeddings semánticos. La IA puntúa frases literales de la fuente y selecciona hasta dos, sin redactar texto nuevo. Así se evita aceptar una frase inventada y la propuesta queda enlazada a fragmentos verificables. Transformers.js ejecuta el pipeline `feature-extraction` con ONNX Runtime, almacenamiento en caché del navegador y cuantización q8. La ficha original describe cobertura de 100 idiomas y recomienda prefijos `query:`/`passage:` para similitud de consulta-documento.

Prueba práctica en Chromium: se ejecutó la primera selección sobre un texto de cuatro frases en español; el modelo devolvió dos frases exactas y pertinentes en aproximadamente 8 segundos, sin errores JS. La etiqueta de UI distingue esta selección semántica de un resumen generativo. La primera carga del modelo necesita conexión; después se conserva en la caché del navegador.

No se cambió a `Xenova/mt5-small`: su repositorio ONNX incluye pesos de cientos de MB, y la ficha no lo presenta como un modelo ajustado para resumen. Tampoco se adoptó un resumen ONNX sólo en inglés ni la versión española BERT2BERT, que no ofrece una exportación Transformers.js/ONNX en su ficha consultada. Estos hechos hacen más apropiado probar embeddings multilingües para el primer modo IA local de Glyphind, sin prometer resumen generativo.

## Fuentes consultadas

- [Transformers.js — documentación oficial](https://huggingface.co/docs/transformers.js/en/index): ejecución en navegador, ONNX Runtime, pipelines y cuantización.
- [Xenova/multilingual-e5-small](https://huggingface.co/Xenova/multilingual-e5-small): exportación ONNX y ejemplo del pipeline `feature-extraction` para Transformers.js.
- [intfloat/multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small): idiomas compatibles, prefijos `query:`/`passage:` y límite de 512 tokens.
- [Xenova/flan-t5-small](https://huggingface.co/Xenova/flan-t5-small): exportación compatible con Transformers.js que se evaluó inicialmente.
- [Xenova/mt5-small](https://huggingface.co/Xenova/mt5-small): exportación `text2text-generation`; pesos ONNX cuantizados cuyo tamaño requiere descargas de varios cientos de MB.
- [mrm8488/bert2bert_shared-spanish-finetuned-summarization](https://huggingface.co/mrm8488/bert2bert_shared-spanish-finetuned-summarization): modelo específico de resumen en español, pero su ficha consultada no indica exportación Transformers.js/ONNX.
- [onnx-community/text_summarization-ONNX](https://huggingface.co/onnx-community/text_summarization-ONNX): resumen ONNX disponible, etiquetado para inglés.

Esta selección es una decisión de producto, no una afirmación de que un modelo de embeddings sea un generador de texto. La app seguirá diferenciando con claridad la selección semántica local de la redacción generativa y de la extracción basada en reglas.
