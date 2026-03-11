// Lightweight local stub to run the app without Base44

const LOCAL_STORAGE_USER_KEY = "local_api_user";
const LOCAL_STORAGE_ANALYSES_KEY = "local_api_chart_analyses";
const LOCAL_STORAGE_CONVERSATIONS_KEY = "local_api_tutor_conversations";

function readFromLocalStorage(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : fallback;
	} catch (_e) {
		return fallback;
	}
}

function writeToLocalStorage(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (_e) {
		// ignore
	}
}

function createDefaultUser() {
	return {
		id: "local-user",
		full_name: "Local User",
		email: "local@example.com",
        role: "admin",
		subscription_tier: "expert",
		analyses_today: 0,
		last_analysis_date: null,
	};
}

function generateLocalId(prefix) {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const localApi = {
	auth: {
		async register({ email, full_name, password }) {
		  const user = {
			id: "local-user",
			full_name,
			email,
			role: "user",
			subscription_tier: "free",
			analyses_today: 0,
			last_analysis_date: null,
		  };
		  writeToLocalStorage(LOCAL_STORAGE_USER_KEY, user);
		  return user;
		},
	  
		async login({ email, password }) {
		  const existing = readFromLocalStorage(LOCAL_STORAGE_USER_KEY, null);
		  if (!existing || existing.email !== email) {
			const err = new Error("Invalid credentials");
			err.status = 401;
			throw err;
		  }
		  return existing;
		},
	  
		async me() {
		  const user = readFromLocalStorage(LOCAL_STORAGE_USER_KEY, null);
		  if (!user) {
			const err = new Error("Not authenticated");
			err.status = 401;
			throw err;
		  }
		  return user;
		},
	  
		async list() {
			const user = readFromLocalStorage(LOCAL_STORAGE_USER_KEY, null);
			return user ? [user] : [];
		  },
		  
		  async updateMyUserData(partial) {
			const current = readFromLocalStorage(LOCAL_STORAGE_USER_KEY, null);
			if (!current) {
			  const err = new Error("Not authenticated");
			  err.status = 401;
			  throw err;
			}
			const updated = { ...current, ...partial };
			writeToLocalStorage(LOCAL_STORAGE_USER_KEY, updated);
			return updated;
		  },
		  
		  async update(id, partial) {
			const current = readFromLocalStorage(LOCAL_STORAGE_USER_KEY, null);
			if (!current) {
			  const err = new Error("Not authenticated");
			  err.status = 401;
			  throw err;
			}
			if (current.id !== id) throw new Error("User not found");
			const updated = { ...current, ...partial };
			writeToLocalStorage(LOCAL_STORAGE_USER_KEY, updated);
			return updated;
		  },
		  
		async logout() {
		  try { localStorage.removeItem(LOCAL_STORAGE_USER_KEY); } catch (_e) {}
		},
	  },
	  
	entities: {
		ChartAnalysis: {
			async create(payload) {
				const all = readFromLocalStorage(LOCAL_STORAGE_ANALYSES_KEY, []);
				const record = {
					id: generateLocalId("analysis"),
                    created_at: new Date().toISOString(),
                    created_date: new Date().toISOString(),
					analysis_result: null,
					...payload,
				};
				all.push(record);
				writeToLocalStorage(LOCAL_STORAGE_ANALYSES_KEY, all);
				return record;
			},
			async update(id, partial) {
				const all = readFromLocalStorage(LOCAL_STORAGE_ANALYSES_KEY, []);
				const idx = all.findIndex((r) => r.id === id);
				if (idx === -1) {
					throw new Error("Analysis not found");
				}
				all[idx] = { ...all[idx], ...partial };
				writeToLocalStorage(LOCAL_STORAGE_ANALYSES_KEY, all);
				return all[idx];
			},
			async list(_order = "-created_date", limit = 50) {
				const all = readFromLocalStorage(LOCAL_STORAGE_ANALYSES_KEY, []);
				const sorted = [...all].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
				return sorted.slice(0, limit);
			},
		},
		TutorConversation: {
			async create(payload) {
				const all = readFromLocalStorage(LOCAL_STORAGE_CONVERSATIONS_KEY, []);
				const record = {
					id: generateLocalId("conv"),
					created_date: new Date().toISOString(),
					messages: [],
					...payload,
				};
				all.unshift(record);
				writeToLocalStorage(LOCAL_STORAGE_CONVERSATIONS_KEY, all);
				return record;
			},
			async update(id, partial) {
				const all = readFromLocalStorage(LOCAL_STORAGE_CONVERSATIONS_KEY, []);
				const idx = all.findIndex((r) => r.id === id);
				if (idx === -1) {
					throw new Error("Conversation not found");
				}
				all[idx] = { ...all[idx], ...partial };
				writeToLocalStorage(LOCAL_STORAGE_CONVERSATIONS_KEY, all);
				return all[idx];
			},
			async list(_order = "-created_date", limit = 10) {
				const all = readFromLocalStorage(LOCAL_STORAGE_CONVERSATIONS_KEY, []);
				const sorted = [...all].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
				return sorted.slice(0, limit);
			},
		},
	},
	integrations: {
		Core: {
			async UploadFile({ file }) {
				// Use a blob URL for local preview
				const fileUrl = URL.createObjectURL(file);
				// Compress image client-side to reduce payload size
				const compressImageToDataUrl = (blob, maxDim = 1024, quality = 0.7) => new Promise((resolve, reject) => {
					try {
						const img = new Image();
						img.onload = () => {
							const canvas = document.createElement('canvas');
							let { width, height } = img;
							if (width > height && width > maxDim) {
								height = Math.round((height / width) * maxDim);
								width = maxDim;
							} else if (height > maxDim) {
								width = Math.round((width / height) * maxDim);
								height = maxDim;
							}
							canvas.width = width;
							canvas.height = height;
							const ctx = canvas.getContext('2d');
							ctx.drawImage(img, 0, 0, width, height);
							const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
							const out = canvas.toDataURL(type, quality);
							resolve(out);
						};
						img.onerror = reject;
						img.src = URL.createObjectURL(blob);
					} catch (e) {
						reject(e);
					}
				});
				let dataUrl;
				try {
					dataUrl = await compressImageToDataUrl(file);
				} catch (_e) {
					// Fallback to raw data URL if compression fails
					const toBase64 = (blob) => new Promise((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => resolve(reader.result);
						reader.onerror = reject;
						reader.readAsDataURL(blob);
					});
					dataUrl = await toBase64(file);
				}
				const mime = (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) ? dataUrl.split(';')[0].slice(5) : (file.type || 'image/jpeg');
				return { file_url: fileUrl, file_data_url: dataUrl, mime_type: mime };
			},
			async InvokeLLM({ prompt, file_urls, response_json_schema, image_base64, image_mime_type, temperature }) {
				// Robust env access with trimming and lowercase normalization
				const env = (import.meta && import.meta.env) ? import.meta.env : {};
				const getEnv = (key) => {
					const val = env?.[key];
					return typeof val === "string" ? val.trim() : val;
				};
				const getWithFallback = (key) => {
					const v = getEnv(key);
					if (v != null && v !== "") return v;
					try {
						if (typeof localStorage !== "undefined") {
							const ls = localStorage.getItem(key);
							return typeof ls === "string" ? ls.trim() : ls;
						}
					} catch (_e) {}
					return undefined;
				};
				const explicitProvider = String(getWithFallback("VITE_LLM_PROVIDER") || "").toLowerCase();
				const apiKey = getWithFallback("VITE_ANTHROPIC_API_KEY");
				let proxyUrl = getWithFallback("VITE_LLM_PROXY_URL");
				// Default dev proxy paths to avoid CORS when running locally via Vite
				if (!proxyUrl && env?.DEV) {
					proxyUrl = "/api/anthropic/messages"; // internal dev server middleware
				}
				const resolvedProvider = explicitProvider || (apiKey ? "anthropic" : undefined);
				const useAnthropic = resolvedProvider === "anthropic";
				// Debug: log presence (not values)
				try {
					const masked = apiKey && typeof apiKey === "string" ? `${apiKey.slice(0, 6)}…(${apiKey.length})` : undefined;
					console.debug("[LLM] provider=", resolvedProvider, "proxy=", Boolean(proxyUrl), "apiKeyPresent=", Boolean(apiKey), masked ? `key:${masked}` : "key:absent");
				} catch (_e) {}

				// Helper: convert a blob/data URL to base64 data and mime type
				const extractBase64FromUrl = async (url) => {
					if (!url) return null;
					if (url.startsWith("data:")) {
						// data URL format: data:<mime>;base64,<data>
						const [meta, base64] = url.split(",");
						const mime = meta.split(":")[1].split(";")[0] || "image/png";
						return { base64, mime };
					}
					// blob: or http(s): — try to fetch and convert
					try {
						const res = await fetch(url);
						const blob = await res.blob();
						const toBase64 = (b) => new Promise((resolve, reject) => {
							const reader = new FileReader();
							reader.onload = () => {
								const dataUrl = reader.result; // data:<mime>;base64,<data>
								const [meta, data] = String(dataUrl).split(",");
								const mime = meta.split(":")[1].split(";")[0] || blob.type || "image/png";
								resolve({ base64: data, mime });
							};
							reader.onerror = reject;
							reader.readAsDataURL(b);
						});
						return await toBase64(blob);
					} catch (_e) {
						return null;
					}
				};

				if (useAnthropic || proxyUrl) {
					try {
						const apiKey = getWithFallback("VITE_ANTHROPIC_API_KEY");
						const model = getWithFallback("VITE_ANTHROPIC_MODEL") || "claude-3-5-sonnet-latest";
						const maxTokens = Number(getWithFallback("VITE_ANTHROPIC_MAX_TOKENS") || 1024);
						const configuredTemperature = Number(getWithFallback("VITE_ANTHROPIC_TEMPERATURE") || 0);
						const anthropicVersion = getWithFallback("VITE_ANTHROPIC_VERSION") || "2023-06-01";

						// Build content array with prompt and optional image
						const content = [];
						let finalPrompt = String(prompt || "");
						if (response_json_schema) {
							finalPrompt +=
								"\n\nReturn ONLY a valid JSON object matching this JSON Schema. Do not include any extra text or explanations. " +
								"Do not use markdown or code fences. Output must be raw JSON only. " +
								"If a numeric value is unknown, return null for that field. JSON Schema:" +
								"\n" + JSON.stringify(response_json_schema);
						}
						if (finalPrompt) {
							content.push({ type: "text", text: finalPrompt });
						}

						let imagePayload = null;
						if (image_base64) {
							imagePayload = { base64: image_base64, mime: image_mime_type || "image/png" };
						} else if (file_urls?.length) {
							const img = await extractBase64FromUrl(file_urls[0]);
							if (img) imagePayload = img;
						}

						if (imagePayload) {
							content.push({
								type: "image",
								source: {
									type: "base64",
									media_type: imagePayload.mime || "image/png",
									data: imagePayload.base64,
								},
							});
						}

						const body = {
							model,
							max_tokens: maxTokens,
							temperature: typeof temperature === "number" ? Number(temperature) : configuredTemperature,
							messages: [
								{ role: "user", content },
							],
						};


						// If a proxy URL is provided, send there; otherwise call Anthropic directly
						let res;
						if (proxyUrl) {
							res = await fetch(proxyUrl, {
								method: "POST",
								headers: { "content-type": "application/json" },
								body: JSON.stringify({ provider: "anthropic", body }),
							});
						} else {
							if (!apiKey) {
								throw new Error("Missing VITE_ANTHROPIC_API_KEY");
							}
							res = await fetch("https://api.anthropic.com/v1/messages", {
								method: "POST",
								headers: {
									"content-type": "application/json",
									"x-api-key": apiKey,
									"anthropic-version": anthropicVersion,
								},
								body: JSON.stringify(body),
							});
						}

						if (!res.ok) {
							const text = await res.text();
							throw new Error(`Anthropic error ${res.status}: ${text}`);
						}

						const json = await res.json();
						const allText = Array.isArray(json?.content)
							? json.content.filter((c) => c?.type === "text").map((c) => c.text).join("\n")
							: undefined;
						if (response_json_schema) {
							const tryParse = (s) => {
								if (!s) return null;
								// Strip markdown code fences if present
								const fenced = s.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
								if (fenced && fenced[1]) {
									s = fenced[1];
								}
								// Trim whitespace
								s = s.trim();
								// Attempt direct parse
								try { return JSON.parse(s); } catch (_e) {}
								// Fallback: extract first balanced JSON object
								const extractBalancedJson = (input) => {
									let depth = 0; let start = -1;
									let inStr = false; let esc = false;
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
								if (extracted) {
									try { return JSON.parse(extracted); } catch (_e) {}
								}
								return null;
							};
							const parsed = tryParse(allText);
							if (parsed) return parsed;
							throw new Error("Failed to parse JSON response from model");
						}
						return allText ?? json;
					} catch (err) {
						console.error("LLM provider failed:", err);
						throw err;
					}
				}

				// If we reach here, no provider is configured
				const devMode = Boolean(env?.DEV);
				const baseUrl = env?.BASE_URL || "/";
				throw new Error(`LLM provider not configured. Ensure .env variables load (DEV=${devMode}, BASE_URL=${baseUrl}). Expected VITE_ANTHROPIC_API_KEY or VITE_LLM_PROXY_URL.`);
			},
			async SendEmail() {
				return { ok: true };
			},
			async GenerateImage() {
				return { image_url: "" };
			},
			async ExtractDataFromUploadedFile() {
				return {};
			},
		},
	},
};


