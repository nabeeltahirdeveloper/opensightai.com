import { localApi } from './localApi';

// Route InvokeLLM through backend to keep Claude API key on server
export const Core = {
  ...localApi.integrations.Core,
  async InvokeLLM({ prompt, file_urls, response_json_schema, image_base64, image_mime_type, temperature }) {
    const content = [];
    let finalPrompt = String(prompt || "");
    if (response_json_schema) {
      finalPrompt +=
        "\n\nReturn ONLY a valid JSON object matching this JSON Schema. Do not include any extra text or explanations. " +
        "Do not use markdown or code fences. Output must be raw JSON only. " +
        "If a numeric value is unknown, return null for that field. JSON Schema:" +
        "\n" + JSON.stringify(response_json_schema);
    }
    if (finalPrompt) content.push({ type: 'text', text: finalPrompt });

    // Ensure we send an image if provided
    let imagePayload = null;
    try {
      if (image_base64) {
        imagePayload = { base64: image_base64, mime: image_mime_type || 'image/png' };
      } else if (file_urls?.length) {
        const res = await fetch(file_urls[0]);
        const blob = await res.blob();
        const toBase64 = (b) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            const [meta, data] = String(dataUrl).split(',');
            const mime = meta.split(':')[1].split(';')[0] || blob.type || 'image/png';
            resolve({ base64: data, mime });
          };
          reader.onerror = reject;
          reader.readAsDataURL(b);
        });
        imagePayload = await toBase64(blob);
      }
    } catch (_e) {}
    if (imagePayload) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: imagePayload.mime || 'image/png', data: imagePayload.base64 },
      });
    }

    const body = { messages: [{ role: 'user', content }], ...(typeof temperature === 'number' ? { temperature: Number(temperature) } : {}) };
    const base = (import.meta && import.meta.env && import.meta.env.VITE_BACKEND_BASE_URL) ? import.meta.env.VITE_BACKEND_BASE_URL.trim() : '';
    let headers = { 'content-type': 'application/json' };
    try {
      const token = localStorage.getItem('vs_auth_token');
      if (token) headers = { ...headers, authorization: `Bearer ${token}` };
    } catch (_e) {}
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(`${base}/api/anthropic/messages`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ provider: 'anthropic', body }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    const json = JSON.parse(text);
    const allText = Array.isArray(json?.content)
      ? json.content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n')
      : undefined;
    if (response_json_schema) {
      const tryParse = (s) => {
        if (!s) return null;
        const fenced = s.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
        if (fenced && fenced[1]) s = fenced[1];
        s = s.trim();
        try { return JSON.parse(s); } catch (_e) {}
        const extractBalancedJson = (input) => {
          let depth = 0; let start = -1; let inStr = false; let esc = false;
          for (let i = 0; i < input.length; i++) {
            const ch = input[i];
            if (inStr) {
              if (esc) { esc = false; continue; }
              if (ch === '\\') { esc = true; continue; }
              if (ch === '"') { inStr = false; }
              continue;
            }
            if (ch === '"') { inStr = true; continue; }
            if (ch === '{') { if (depth === 0) start = i; depth++; }
            else if (ch === '}') { depth--; if (depth === 0 && start !== -1) return input.slice(start, i + 1); }
          }
          return null;
        };
        const extracted = extractBalancedJson(s);
        if (extracted) { try { return JSON.parse(extracted); } catch (_e) {} }
        return null;
      };
      const parsed = tryParse(allText);
      if (parsed) return parsed;
      throw new Error('Failed to parse JSON response from model');
    }
    return allText ?? json;
  },
};

export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;






