import type { Project } from './model';
import { exportExcalidraw, exportMermaid, importExcalidraw, importMarkdown, importMermaid } from './formats';

export type FormatAdapter = {
  id: string;
  name: string;
  extensions: string[];
  mime: string;
  parse?: (source: string, filename: string) => Project;
  serialize?: (project: Project) => string;
};

const validId = (value: string) => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value);
const validExtension = (value: string) => /^[a-z0-9]{1,12}$/i.test(value);

/** Registry for trusted, application-bundled adapters. Never build adapters from imported JSON. */
export class FormatAdapterRegistry {
  private readonly adapters = new Map<string, FormatAdapter>();
  private readonly extensionOwners = new Map<string, { id: string; parse: boolean }[]>();

  register(adapter: FormatAdapter): () => void {
    if (!validId(adapter.id) || !adapter.name.trim() || adapter.name.length > 100 || !adapter.extensions.length || adapter.extensions.some((ext) => !validExtension(ext))) throw new TypeError('Descriptor de formato inválido');
    if (!adapter.parse && !adapter.serialize) throw new TypeError('El adaptador requiere parser o serializador');
    if (this.adapters.has(adapter.id)) throw new Error(`Ya existe el adaptador ${adapter.id}`);
    const extensions = [...new Set(adapter.extensions.map((ext) => ext.toLowerCase()))];
    for (const extension of extensions) {
      const owners = this.extensionOwners.get(extension) ?? [];
      if ((adapter.parse && owners.some((owner) => owner.parse)) || (adapter.serialize && owners.some((owner) => !owner.parse))) throw new Error(`La extensión .${extension} ya tiene un adaptador para esa operación`);
    }
    const stored = { ...adapter, extensions };
    this.adapters.set(stored.id, stored);
    for (const extension of extensions) {
      const owners = [...(this.extensionOwners.get(extension) ?? [])];
      if (stored.parse) owners.push({ id: stored.id, parse: true });
      if (stored.serialize) owners.push({ id: stored.id, parse: false });
      this.extensionOwners.set(extension, owners);
    }
    return () => this.unregister(stored.id);
  }

  unregister(id: string): void {
    const adapter = this.adapters.get(id);
    if (!adapter) return;
    this.adapters.delete(id);
    for (const extension of adapter.extensions) {
      const owners = (this.extensionOwners.get(extension) ?? []).filter((owner) => owner.id !== id);
      if (owners.length) this.extensionOwners.set(extension, owners); else this.extensionOwners.delete(extension);
    }
  }

  get(id: string): FormatAdapter | undefined { return this.adapters.get(id); }
  byExtension(extension: string, operation: 'parse' | 'serialize' = 'parse'): FormatAdapter | undefined {
    const ext = extension.replace(/^\./, '').toLowerCase();
    const owner = this.extensionOwners.get(ext)?.find((entry) => operation === 'parse' ? entry.parse : !entry.parse);
    const adapter = owner ? this.adapters.get(owner.id) : undefined;
    return adapter && (operation === 'parse' ? adapter.parse : adapter.serialize) ? adapter : undefined;
  }
  list(): FormatAdapter[] { return [...this.adapters.values()].map((adapter) => ({ ...adapter, extensions: [...adapter.extensions] })); }
}

export const formatAdapterRegistry = new FormatAdapterRegistry();
formatAdapterRegistry.register({ id: 'mermaid', name: 'Mermaid', extensions: ['mmd', 'mermaid'], mime: 'text/plain;charset=utf-8', parse: (source, filename) => importMermaid(source, filename.replace(/\.(mmd|mermaid)$/i, '')), serialize: exportMermaid });
formatAdapterRegistry.register({ id: 'markdown-import', name: 'Markdown', extensions: ['md', 'markdown'], mime: 'text/markdown;charset=utf-8', parse: importMarkdown });
formatAdapterRegistry.register({ id: 'excalidraw', name: 'Excalidraw', extensions: ['excalidraw'], mime: 'application/json;charset=utf-8', parse: importExcalidraw, serialize: exportExcalidraw });
