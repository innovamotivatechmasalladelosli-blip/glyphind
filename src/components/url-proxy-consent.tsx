import { useEffect, useState } from 'react';

type UrlProxyConsentProps = {
  url: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function UrlProxyConsent({ url, busy, error, onCancel, onConfirm }: UrlProxyConsentProps) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="modal-backdrop url-proxy-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onCancel(); }}>
      <section className="project-modal url-proxy-modal" role="dialog" aria-modal="true" aria-labelledby="url-proxy-title" aria-describedby="url-proxy-description">
        <div className="modal-head">
          <div>
            <span className="section-kicker">Permiso para esta solicitud</span>
            <h2 id="url-proxy-title">¿Leer esta página mediante Cloudflare?</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} disabled={busy} aria-label="Cancelar lectura por proxy">×</button>
        </div>
        <p id="url-proxy-description" className="url-proxy-copy">
          La lectura directa falló, normalmente porque el sitio bloquea CORS. Si continúas, se enviará esta URL a un Worker de Cloudflare; el Worker pedirá la página y devolverá hasta 1 MB de texto a este dispositivo. Glyphind hará el análisis semántico aquí, sin IA remota y sin enviar el texto que hayas pegado. Cloudflare y el sitio visitado procesan la solicitud. El Worker no guarda la página; no uses enlaces privados ni URLs con tokens o datos de acceso.
        </p>
        <div className="url-proxy-target"><span>URL que se enviará</span><code>{url}</code></div>
        {error && <p className="ai-builder-error url-proxy-error" role="alert">{error}</p>}
        <label className="url-proxy-check">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} />
          <span>Autorizo enviar esta URL y solicitar su contenido por el proxy, sólo para este intento.</span>
        </label>
        <div className="modal-foot">
          <span>También puedes cancelar y pegar el texto manualmente.</span>
          <div>
            <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Cancelar</button>
            <button type="button" className="primary-button" onClick={onConfirm} disabled={!accepted || busy}>{busy ? 'Leyendo…' : 'Leer esta URL una vez'}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
