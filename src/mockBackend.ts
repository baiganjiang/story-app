// src/mockBackend.ts
// This file intercepts fetch requests to /api/* and handles them locally using localStorage.
// This allows the app to run completely offline on Android/iOS via Capacitor.

const DB_KEY = 'muse_tavern_local_db';

interface DBState {
  stories: any[];
  characters: any[];
  lore: any[];
  chapters: any[];
  ai_models: any[];
  summary_templates: any[];
  style_tags: any[];
  _idCounter: number;
}

const defaultDb: DBState = {
  stories: [],
  characters: [],
  lore: [],
  chapters: [],
  ai_models: [],
  summary_templates: [
    { id: 1, name: "默认总结", content: "请总结以下章节内容，用于长期记忆追踪。总结必须包含以下三个部分：\n1. 发生了什么内容：简述本章节的主要情节。\n2. 有哪一些角色：列出本章节出现或被提及的关键角色。\n3. 角色的关系：描述本章节中角色之间互动的性质或关系的变化。\n\n把你总结的内容放在大括号里面类似这样\n以下是我总结的内容{*****}\n" }
  ],
  style_tags: [
    { id: 1, name: "悬疑", description: "充满悬念和未知的氛围，节奏紧凑" },
    { id: 2, name: "紧张", description: "让人感到压迫和急迫的情境描写" },
    { id: 3, name: "轻松", description: "幽默风趣，氛围愉悦" }
  ],
  _idCounter: 4
};

function getDb(): DBState {
  const stored = localStorage.getItem(DB_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return { ...defaultDb, ...parsed };
    } catch (e) {
      console.error("Failed to parse local DB", e);
    }
  }
  return { ...defaultDb };
}

function saveDb(db: DBState) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function generateId(db: DBState) {
  const id = db._idCounter++;
  saveDb(db);
  return id;
}

function createResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
  
  // Only intercept /api/ requests
  if (!urlStr.startsWith('/api/')) {
    return originalFetch(input, init);
  }

  const method = init?.method || 'GET';
  const db = getDb();
  let body: any = {};
  
  if (init?.body && typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch (e) {}
  }

  // AI Proxy
  if (urlStr === '/api/ai/proxy' && method === 'POST') {
    const { config, systemInstruction, prompt, temperature, max_tokens } = body;
    
    if (!config || config.protocol !== 'openai') {
      return createResponse({ error: "Invalid configuration" }, 400);
    }

    let url = config.base_url || "https://api.openai.com/v1/chat/completions";
    url = url.trim();
    if (!url.startsWith('http')) url = 'https://' + url;

    if (!url.toLowerCase().includes('/chat/completions') && !url.toLowerCase().includes('/completions')) {
      url = url.replace(/\/$/, '');
      if (url.endsWith('/v1')) {
        url += '/chat/completions';
      } else {
        if (!url.includes('/v1')) {
          url += '/v1/chat/completions';
        } else {
          url += '/chat/completions';
        }
      }
    }
    
    const modelId = config.model_id.replace(/\s+/g, '');
    
    try {
      // Make the actual request directly from the browser/Capacitor
      const response = await originalFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${config.api_key}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 4096,
          stream: true
        })
      });
      
      return response; // Return the stream directly!
    } catch (error: any) {
      console.error("[Mock AI Proxy] Network Error:", error);
      return createResponse({ error: `与 AI 供应商通信时发生网络错误。请检查 URL: ${url}` }, 500);
    }
  }

  // --- STORIES ---
  if (urlStr === '/api/stories') {
    if (method === 'GET') {
      const stories = [...db.stories].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return createResponse(stories);
    }
    if (method === 'POST') {
      const { title, description, outline } = body;
      const id = generateId(db);
      db.stories.push({ id, title, description: description || null, outline: outline || null, created_at: new Date().toISOString() });
      saveDb(db);
      return createResponse({ id });
    }
  }
  
  const storyMatch = urlStr.match(/^\/api\/stories\/(\d+)$/);
  if (storyMatch) {
    const id = parseInt(storyMatch[1]);
    if (method === 'PUT') {
      const { title, description, outline } = body;
      const story = db.stories.find(s => s.id === id);
      if (story) {
        story.title = title;
        story.description = description || null;
        story.outline = outline || null;
        saveDb(db);
      }
      return createResponse({ success: true });
    }
    if (method === 'DELETE') {
      db.characters = db.characters.filter(c => c.story_id !== id);
      db.lore = db.lore.filter(l => l.story_id !== id);
      db.chapters = db.chapters.filter(c => c.story_id !== id);
      db.stories = db.stories.filter(s => s.id !== id);
      saveDb(db);
      return createResponse({ success: true });
    }
  }

  // --- CHARACTERS ---
  const charsMatch = urlStr.match(/^\/api\/stories\/(\d+)\/characters$/);
  if (charsMatch) {
    const storyId = parseInt(charsMatch[1]);
    if (method === 'GET') {
      return createResponse(db.characters.filter(c => c.story_id === storyId));
    }
    if (method === 'POST') {
      const { name, description, personality, appearance } = body;
      const id = generateId(db);
      db.characters.push({ id, story_id: storyId, name, description: description || null, personality: personality || null, appearance: appearance || null });
      saveDb(db);
      return createResponse({ id });
    }
  }

  const charMatch = urlStr.match(/^\/api\/characters\/(\d+)$/);
  if (charMatch) {
    const id = parseInt(charMatch[1]);
    if (method === 'PUT') {
      const { name, description, personality, appearance } = body;
      const character = db.characters.find(c => c.id === id);
      if (character) {
        character.name = name;
        character.description = description || null;
        character.personality = personality || null;
        character.appearance = appearance || null;
        saveDb(db);
      }
      return createResponse({ success: true });
    }
    if (method === 'DELETE') {
      db.characters = db.characters.filter(c => c.id !== id);
      saveDb(db);
      return createResponse({ success: true });
    }
  }

  // --- LORE ---
  const loresMatch = urlStr.match(/^\/api\/stories\/(\d+)\/lore$/);
  if (loresMatch) {
    const storyId = parseInt(loresMatch[1]);
    if (method === 'GET') {
      return createResponse(db.lore.filter(l => l.story_id === storyId));
    }
    if (method === 'POST') {
      const { key, content, category } = body;
      const id = generateId(db);
      db.lore.push({ id, story_id: storyId, key, content: content || null, category: category || 'general' });
      saveDb(db);
      return createResponse({ id });
    }
  }

  const loreMatch = urlStr.match(/^\/api\/lore\/(\d+)$/);
  if (loreMatch) {
    const id = parseInt(loreMatch[1]);
    if (method === 'PUT') {
      const { key, content, category } = body;
      const lore = db.lore.find(l => l.id === id);
      if (lore) {
        lore.key = key;
        lore.content = content || null;
        lore.category = category || 'general';
        saveDb(db);
      }
      return createResponse({ success: true });
    }
    if (method === 'DELETE') {
      db.lore = db.lore.filter(l => l.id !== id);
      saveDb(db);
      return createResponse({ success: true });
    }
  }

  // --- CHAPTERS ---
  const chapsMatch = urlStr.match(/^\/api\/stories\/(\d+)\/chapters$/);
  if (chapsMatch) {
    const storyId = parseInt(chapsMatch[1]);
    if (method === 'GET') {
      const chapters = db.chapters.filter(c => c.story_id === storyId).sort((a, b) => a.order_index - b.order_index);
      return createResponse(chapters);
    }
    if (method === 'POST') {
      const { title, content, order_index } = body;
      const id = generateId(db);
      db.chapters.push({ id, story_id: storyId, title, content: content || '', order_index: order_index ?? 0, summary: null });
      saveDb(db);
      return createResponse({ id });
    }
  }

  const chapMatch = urlStr.match(/^\/api\/chapters\/(\d+)$/);
  if (chapMatch) {
    const id = parseInt(chapMatch[1]);
    if (method === 'PUT') {
      const { title, content, summary } = body;
      const chapter = db.chapters.find(c => c.id === id);
      if (chapter) {
        chapter.title = title;
        chapter.content = content || '';
        chapter.summary = summary || null;
        saveDb(db);
      }
      return createResponse({ success: true });
    }
    if (method === 'DELETE') {
      db.chapters = db.chapters.filter(c => c.id !== id);
      saveDb(db);
      return createResponse({ success: true });
    }
  }

  // --- SUMMARY TEMPLATES ---
  if (urlStr === '/api/summary_templates') {
    if (method === 'GET') return createResponse(db.summary_templates);
    if (method === 'POST') {
      const { name, content } = body;
      const id = generateId(db);
      db.summary_templates.push({ id, name, content });
      saveDb(db);
      return createResponse({ id });
    }
  }
  const tplMatch = urlStr.match(/^\/api\/summary_templates\/(\d+)$/);
  if (tplMatch) {
    const id = parseInt(tplMatch[1]);
    if (method === 'PUT') {
      const { name, content } = body;
      const template = db.summary_templates.find(t => t.id === id);
      if (template) {
        template.name = name;
        template.content = content;
        saveDb(db);
      }
      return createResponse({ success: true });
    }
    if (method === 'DELETE') {
      db.summary_templates = db.summary_templates.filter(t => t.id !== id);
      saveDb(db);
      return createResponse({ success: true });
    }
  }

  // --- STYLE TAGS ---
  if (urlStr === '/api/style_tags') {
    if (method === 'GET') return createResponse(db.style_tags);
    if (method === 'POST') {
      const { name, description } = body;
      const id = generateId(db);
      db.style_tags.push({ id, name, description: description || "" });
      saveDb(db);
      return createResponse({ id });
    }
  }
  const tagMatch = urlStr.match(/^\/api\/style_tags\/(\d+)$/);
  if (tagMatch) {
    const id = parseInt(tagMatch[1]);
    if (method === 'PUT') {
      const { name, description } = body;
      const tag = db.style_tags.find(t => t.id === id);
      if (tag) {
        tag.name = name;
        tag.description = description || "";
        saveDb(db);
      }
      return createResponse({ success: true });
    }
    if (method === 'DELETE') {
      db.style_tags = db.style_tags.filter(t => t.id !== id);
      saveDb(db);
      return createResponse({ success: true });
    }
  }

  // --- AI MODELS ---
  if (urlStr === '/api/models') {
    if (method === 'GET') return createResponse(db.ai_models);
    if (method === 'POST') {
      const { name, protocol, api_key, base_url, model_id } = body;
      const id = generateId(db);
      db.ai_models.push({ id, name, protocol, api_key: api_key || null, base_url: base_url || null, model_id });
      saveDb(db);
      return createResponse({ id });
    }
  }
  const modelMatch = urlStr.match(/^\/api\/models\/(\d+)$/);
  if (modelMatch) {
    const id = parseInt(modelMatch[1]);
    if (method === 'PUT') {
      const { name, protocol, api_key, base_url, model_id } = body;
      const model = db.ai_models.find(m => m.id === id);
      if (model) {
        model.name = name;
        model.protocol = protocol;
        model.api_key = api_key || null;
        model.base_url = base_url || null;
        model.model_id = model_id;
        saveDb(db);
      }
      return createResponse({ success: true });
    }
    if (method === 'DELETE') {
      db.ai_models = db.ai_models.filter(m => m.id !== id);
      saveDb(db);
      return createResponse({ success: true });
    }
  }

  // Fallback for unhandled /api/ routes
  return createResponse({ error: "Not found" }, 404);
};
