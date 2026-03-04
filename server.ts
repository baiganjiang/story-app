import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

const DB_FILE = "muse_tavern_data.json";

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

let db: DBState = {
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

if (fs.existsSync(DB_FILE)) {
  try {
    const loadedDb = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    db = { ...db, ...loadedDb };
    if (!db.summary_templates) db.summary_templates = [
      { id: generateId(), name: "默认总结", content: "请总结以下章节内容，用于长期记忆追踪。总结必须包含以下三个部分：\n1. 发生了什么内容：简述本章节的主要情节。\n2. 有哪一些角色：列出本章节出现或被提及的关键角色。\n3. 角色的关系：描述本章节中角色之间互动的性质或关系的变化。\n\n把你总结的内容放在大括号里面类似这样\n以下是我总结的内容{*****}\n" }
    ];
    if (!db.style_tags) db.style_tags = [
      { id: generateId(), name: "悬疑", description: "充满悬念和未知的氛围，节奏紧凑" },
      { id: generateId(), name: "紧张", description: "让人感到压迫和急迫的情境描写" },
      { id: generateId(), name: "轻松", description: "幽默风趣，氛围愉悦" }
    ];
  } catch (e) {
    console.error("Failed to parse database file, starting fresh.");
  }
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateId() {
  const id = db._idCounter++;
  saveDb();
  return id;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Stories
  app.get("/api/stories", (req, res) => {
    const stories = [...db.stories].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(stories);
  });

  app.post("/api/stories", (req, res) => {
    const { title, description, outline } = req.body;
    const id = generateId();
    db.stories.push({
      id, title, description: description || null, outline: outline || null, created_at: new Date().toISOString()
    });
    saveDb();
    res.json({ id });
  });

  app.put("/api/stories/:id", (req, res) => {
    const { title, description, outline } = req.body;
    const id = parseInt(req.params.id);
    const story = db.stories.find(s => s.id === id);
    if (story) {
      story.title = title;
      story.description = description || null;
      story.outline = outline || null;
      saveDb();
    }
    res.json({ success: true });
  });

  app.delete("/api/stories/:id", (req, res) => {
    const storyId = parseInt(req.params.id);
    db.characters = db.characters.filter(c => c.story_id !== storyId);
    db.lore = db.lore.filter(l => l.story_id !== storyId);
    db.chapters = db.chapters.filter(c => c.story_id !== storyId);
    db.stories = db.stories.filter(s => s.id !== storyId);
    saveDb();
    res.json({ success: true });
  });

  // Characters
  app.get("/api/stories/:storyId/characters", (req, res) => {
    const storyId = parseInt(req.params.storyId);
    const characters = db.characters.filter(c => c.story_id === storyId);
    res.json(characters);
  });

  app.post("/api/stories/:storyId/characters", (req, res) => {
    const { name, description, personality, appearance } = req.body;
    const story_id = parseInt(req.params.storyId);
    const id = generateId();
    db.characters.push({
      id, story_id, name, description: description || null, personality: personality || null, appearance: appearance || null
    });
    saveDb();
    res.json({ id });
  });

  app.put("/api/characters/:id", (req, res) => {
    const { name, description, personality, appearance } = req.body;
    const id = parseInt(req.params.id);
    const character = db.characters.find(c => c.id === id);
    if (character) {
      character.name = name;
      character.description = description || null;
      character.personality = personality || null;
      character.appearance = appearance || null;
      saveDb();
    }
    res.json({ success: true });
  });

  app.delete("/api/characters/:id", (req, res) => {
    const id = parseInt(req.params.id);
    db.characters = db.characters.filter(c => c.id !== id);
    saveDb();
    res.json({ success: true });
  });

  // Lore
  app.get("/api/stories/:storyId/lore", (req, res) => {
    const storyId = parseInt(req.params.storyId);
    const lore = db.lore.filter(l => l.story_id === storyId);
    res.json(lore);
  });

  app.post("/api/stories/:storyId/lore", (req, res) => {
    const { key, content, category } = req.body;
    const story_id = parseInt(req.params.storyId);
    const id = generateId();
    db.lore.push({
      id, story_id, key, content: content || null, category: category || 'general'
    });
    saveDb();
    res.json({ id });
  });

  app.put("/api/lore/:id", (req, res) => {
    const { key, content, category } = req.body;
    const id = parseInt(req.params.id);
    const lore = db.lore.find(l => l.id === id);
    if (lore) {
      lore.key = key;
      lore.content = content || null;
      lore.category = category || 'general';
      saveDb();
    }
    res.json({ success: true });
  });

  app.delete("/api/lore/:id", (req, res) => {
    const id = parseInt(req.params.id);
    db.lore = db.lore.filter(l => l.id !== id);
    saveDb();
    res.json({ success: true });
  });

  // Chapters
  app.get("/api/stories/:storyId/chapters", (req, res) => {
    const storyId = parseInt(req.params.storyId);
    const chapters = db.chapters.filter(c => c.story_id === storyId).sort((a, b) => a.order_index - b.order_index);
    res.json(chapters);
  });

  app.post("/api/stories/:storyId/chapters", (req, res) => {
    const { title, content, order_index } = req.body;
    const story_id = parseInt(req.params.storyId);
    const id = generateId();
    db.chapters.push({
      id, story_id, title, content: content || '', order_index: order_index ?? 0, summary: null
    });
    saveDb();
    res.json({ id });
  });

  app.put("/api/chapters/:id", (req, res) => {
    const { title, content, summary } = req.body;
    const id = parseInt(req.params.id);
    const chapter = db.chapters.find(c => c.id === id);
    if (chapter) {
      chapter.title = title;
      chapter.content = content || '';
      chapter.summary = summary || null;
      saveDb();
    }
    res.json({ success: true });
  });

  app.delete("/api/chapters/:id", (req, res) => {
    const id = parseInt(req.params.id);
    db.chapters = db.chapters.filter(c => c.id !== id);
    saveDb();
    res.json({ success: true });
  });

  // Summary Templates
  app.get("/api/summary_templates", (req, res) => {
    res.json(db.summary_templates);
  });

  app.post("/api/summary_templates", (req, res) => {
    const { name, content } = req.body;
    const id = generateId();
    db.summary_templates.push({ id, name, content });
    saveDb();
    res.json({ id });
  });

  app.put("/api/summary_templates/:id", (req, res) => {
    const { name, content } = req.body;
    const id = parseInt(req.params.id);
    const template = db.summary_templates.find(t => t.id === id);
    if (template) {
      template.name = name;
      template.content = content;
      saveDb();
    }
    res.json({ success: true });
  });

  app.delete("/api/summary_templates/:id", (req, res) => {
    const id = parseInt(req.params.id);
    db.summary_templates = db.summary_templates.filter(t => t.id !== id);
    saveDb();
    res.json({ success: true });
  });

  // Style Tags
  app.get("/api/style_tags", (req, res) => {
    res.json(db.style_tags);
  });

  app.post("/api/style_tags", (req, res) => {
    const { name, description } = req.body;
    const id = generateId();
    db.style_tags.push({ id, name, description: description || "" });
    saveDb();
    res.json({ id });
  });

  app.put("/api/style_tags/:id", (req, res) => {
    const { name, description } = req.body;
    const id = parseInt(req.params.id);
    const tag = db.style_tags.find(t => t.id === id);
    if (tag) {
      tag.name = name;
      tag.description = description || "";
      saveDb();
    }
    res.json({ success: true });
  });

  app.delete("/api/style_tags/:id", (req, res) => {
    const id = parseInt(req.params.id);
    db.style_tags = db.style_tags.filter(t => t.id !== id);
    saveDb();
    res.json({ success: true });
  });

  // AI Models
  app.get("/api/models", (req, res) => {
    res.json(db.ai_models);
  });

  app.post("/api/models", (req, res) => {
    const { name, protocol, api_key, base_url, model_id } = req.body;
    const id = generateId();
    db.ai_models.push({
      id, name, protocol, api_key: api_key || null, base_url: base_url || null, model_id
    });
    saveDb();
    res.json({ id });
  });

  app.put("/api/models/:id", (req, res) => {
    const { name, protocol, api_key, base_url, model_id } = req.body;
    const id = parseInt(req.params.id);
    const model = db.ai_models.find(m => m.id === id);
    if (model) {
      model.name = name;
      model.protocol = protocol;
      model.api_key = api_key || null;
      model.base_url = base_url || null;
      model.model_id = model_id;
      saveDb();
    }
    res.json({ success: true });
  });

  app.delete("/api/models/:id", (req, res) => {
    const id = parseInt(req.params.id);
    db.ai_models = db.ai_models.filter(m => m.id !== id);
    saveDb();
    res.json({ success: true });
  });

  // AI Proxy for OpenAI-compatible APIs
  app.post("/api/ai/proxy", async (req, res) => {
    const { config, systemInstruction, prompt, temperature, max_tokens } = req.body;
    
    if (!config || config.protocol !== 'openai') {
      return res.status(400).json({ error: "Invalid configuration" });
    }

    let url = config.base_url || "https://api.openai.com/v1/chat/completions";
    
    // More robust URL handling
    url = url.trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    const originalUrl = url;
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
    
    const finalUrl = url;
    const modelId = config.model_id.replace(/\s+/g, '');
    
    console.log(`[AI Proxy] Requesting: ${finalUrl}`);
    console.log(`[AI Proxy] Model: ${modelId}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 300 seconds timeout

    try {
      const response = await fetch(finalUrl, {
        method: 'POST',
        signal: controller.signal,
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

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Proxy] Provider Error (${response.status}):`, errorText);
        try {
          const errorData = JSON.parse(errorText);
          errorData.debug_url = finalUrl;
          errorData.debug_model = modelId;
          errorData.debug_status = response.status;
          return res.status(response.status).json(errorData);
        } catch (e) {
          return res.status(response.status).json({ 
            error: errorText, 
            debug_url: finalUrl,
            debug_model: modelId,
            debug_status: response.status
          });
        }
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send an initial ping to keep the connection alive
      res.write(': ping\n\n');

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        
        // Keep-alive interval
        const keepAliveInterval = setInterval(() => {
          res.write(': ping\n\n');
        }, 15000); // Every 15 seconds
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
          }
        } finally {
          clearInterval(keepAliveInterval);
          res.end();
        }
      } else {
        res.end();
      }
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        return res.status(504).json({ error: "请求超时。该模型（如 MiniMax）推理时间较长，请稍后再试或检查网络。", debug_url: finalUrl });
      }
      console.error("[AI Proxy] Network Error:", error);
      res.status(500).json({ error: `与 AI 供应商通信时发生网络错误。请检查 URL: ${finalUrl}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
