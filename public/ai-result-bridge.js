(() => {
  const originalFetch = window.fetch.bind(window);

  function normalizeImageResult(data) {
    if (!data || typeof data !== 'object') return data;

    const image = data.image_result || data.imagem || data.image || null;
    if (!image || typeof image !== 'object') return data;

    let source = image.image_data_url || image.data_url || image.url || '';
    const rawBase64 = image.base64 || image.b64_json || image.data || '';
    const mimeType = image.mimeType || image.mime_type || 'image/png';

    if (!source && typeof rawBase64 === 'string' && rawBase64.length > 100) {
      source = rawBase64.startsWith('data:')
        ? rawBase64
        : `data:${mimeType};base64,${rawBase64}`;
    }

    if (source) {
      data.image_result = {
        ...image,
        image_data_url: source,
        image_url: image.url || null,
        codigo: image.codigo || data.codigo || 'IMAGE_GENERATED'
      };
    }

    return data;
  }

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const request = args[0];
    const url = typeof request === 'string' ? request : request?.url || '';

    if (!url.includes('/api/drafts/analyze-image-n8n')) return response;

    try {
      const payload = await response.clone().json();
      const normalized = normalizeImageResult(payload);
      return new Response(JSON.stringify(normalized), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch {
      return response;
    }
  };
})();
