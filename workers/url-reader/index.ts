import { handleUrlProxyRequest, type UrlProxyEnvironment } from '../../src/domain/url-proxy-handler';

export default {
  fetch(request: Request, env: UrlProxyEnvironment): Promise<Response> {
    return handleUrlProxyRequest(request, env);
  },
};
