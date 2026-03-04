import { GoogleGenAI, Type } from "@google/genai";

let geminiAI: GoogleGenAI | null = null;

const getGeminiAI = () => {
  if (!geminiAI) {
    geminiAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy_key" });
  }
  return geminiAI;
};

export interface AIModelConfig {
  id?: number;
  name: string;
  protocol: 'gemini' | 'openai';
  api_key?: string;
  base_url?: string;
  model_id: string;
}

export interface Character {
  id?: number;
  name: string;
  description: string;
  personality: string;
  appearance: string;
}

export interface LoreItem {
  id?: number;
  key: string;
  content: string;
  category: string;
}

export interface StyleTag {
  id?: number;
  name: string;
  description: string;
}

export interface StoryContext {
  title: string;
  description: string;
  outline?: string;
  characters: Character[];
  lore: LoreItem[];
  styleTags?: StyleTag[];
  summaryTemplate?: string;
  previousSummary?: string;
  config?: {
    modelConfig?: AIModelConfig;
    temperature?: number;
  };
}

const cleanText = (text: string | undefined): string => {
  if (!text) return "";
  // Remove continuous # and *
  return text.replace(/[#*]+/g, '').trim();
};

const callOpenAI = async (config: AIModelConfig, systemInstruction: string, prompt: string, temperature: number, maxTokens?: number) => {
  const response = await fetch("/api/ai/proxy", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      config,
      systemInstruction,
      prompt,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    let errorMsg = "AI 代理调用失败";
    try {
      const error = await response.json();
      errorMsg = error.error?.message || error.error || errorMsg;
    } catch (e) {
      errorMsg = await response.text();
    }
    throw new Error(errorMsg);
  }

  if (!response.body) {
    throw new Error("未能获取 AI 响应流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullContent = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
        try {
          const data = JSON.parse(trimmedLine.slice(6));
          if (data.choices && data.choices.length > 0 && data.choices[0].delta) {
            const delta = data.choices[0].delta;
            if (delta.content) {
              fullContent += delta.content;
            }
            // Some models like DeepSeek R1 return reasoning_content
            if (delta.reasoning_content) {
              fullContent += delta.reasoning_content;
            }
          }
        } catch (e) {
          // Ignore parse errors for incomplete JSON
        }
      }
    }
  }

  return fullContent;
};

export const testAIConnection = async (config: AIModelConfig) => {
  try {
    if (config.protocol === 'gemini') {
      const response = await getGeminiAI().models.generateContent({
        model: config.model_id as any,
        contents: [{ text: "ping" }],
      });
      return !!response.text;
    } else {
      // Use callOpenAI directly but catch to pass through debug info
      // Limit maxTokens to 50 for connection test to speed up reasoning models
      await callOpenAI(config, "You are a tester.", "ping", 0.1, 50);
      return true;
    }
  } catch (error) {
    console.error("Connection test failed:", error);
    throw error;
  }
};

export const generateStoryContent = async (
  prompt: string,
  context: StoryContext,
  currentText: string
) => {
  const systemInstruction = `
    你是一位专业的小说创作助手。
    当前故事：${context.title}
    描述：${context.description}
    
    角色设定：
    ${context.characters.map(c => `- ${c.name}：${c.description}。性格：${c.personality}`).join("\n")}
    
    世界观设定：
    ${context.lore.map(l => `- ${l.key}：${l.content}`).join("\n")}
    
    前文剧情摘要：${context.previousSummary || "无"}
    
    故事大纲：
    ${context.outline || "无"}
    
    ${context.styleTags && context.styleTags.length > 0 ? `
    写作风格要求：
    ${context.styleTags.map(t => `- ${t.name}：${t.description}`).join("\n")}
    ` : ''}
    
    你的任务是帮助作者继续创作。请保持文风一致，确保角色行为和世界观设定的一致性。
    不要重复已有的文本。仅提供新生成的故事情节。请使用中文创作。
  `;

  const modelConfig = context.config?.modelConfig;
  const temperature = context.config?.temperature ?? 0.8;

  if (!modelConfig || modelConfig.protocol === 'gemini') {
    const modelId = modelConfig?.model_id || "gemini-3-flash-preview";
    const response = await getGeminiAI().models.generateContent({
      model: modelId as any,
      contents: [
        { text: `现有文本：\n${currentText}\n\n作者的要求：${prompt}` }
      ],
      config: {
        systemInstruction,
        temperature: temperature,
      },
    });
    return cleanText(response.text);
  } else {
    const result = await callOpenAI(
      modelConfig,
      systemInstruction,
      `现有文本：\n${currentText}\n\n作者的要求：${prompt}`,
      temperature
    );
    return cleanText(result);
  }
};

export const generateOutline = async (
  prompt: string,
  context: StoryContext
) => {
  const systemInstruction = `
    你是一位专业的小说大纲策划专家。
    当前故事：${context.title}
    描述：${context.description}
    
    角色设定：
    ${context.characters.map(c => `- ${c.name}：${c.description}。性格：${c.personality}`).join("\n")}
    
    世界观设定：
    ${context.lore.map(l => `- ${l.key}：${l.content}`).join("\n")}
    
    前文剧情摘要：${context.previousSummary || "无"}
    
    ${context.styleTags && context.styleTags.length > 0 ? `
    写作风格要求：
    ${context.styleTags.map(t => `- ${t.name}：${t.description}`).join("\n")}
    ` : ''}
    
    你的任务是根据作者的要求，策划一份详细的故事大纲。大纲应包含：
    1. 整体剧情走向
    2. 关键冲突与转折点
    3. 角色弧光发展
    请使用中文创作。
  `;

  const modelConfig = context.config?.modelConfig;
  const temperature = context.config?.temperature ?? 0.8;

  if (!modelConfig || modelConfig.protocol === 'gemini') {
    const modelId = modelConfig?.model_id || "gemini-3-flash-preview";
    const response = await getGeminiAI().models.generateContent({
      model: modelId as any,
      contents: [{ text: `作者的大纲要求：${prompt}` }],
      config: {
        systemInstruction,
        temperature: temperature,
      },
    });
    return cleanText(response.text);
  } else {
    const result = await callOpenAI(
      modelConfig,
      systemInstruction,
      `作者的大纲要求：${prompt}`,
      temperature
    );
    return cleanText(result);
  }
};

const cleanSummaryText = (text: string | undefined): string => {
  if (!text) return "";
  let extracted = text;
  const match = text.match(/\{([\s\S]*?)\}/);
  if (match) {
    extracted = match[1];
  }
  // Remove continuous * and #
  return extracted.replace(/\*{2,}/g, '').replace(/#{2,}/g, '').trim();
};

export const summarizeChapter = async (content: string, context: StoryContext) => {
  const systemInstruction = `
    你是一位专业的剧情总结助手。
    当前故事：${context.title}
    描述：${context.description}
    
    ${context.characters && context.characters.length > 0 ? `
    已选角色设定（供参考）：
    ${context.characters.map(c => `- ${c.name}：${c.description}。性格：${c.personality}`).join("\n")}
    ` : ''}
    
    ${context.lore && context.lore.length > 0 ? `
    已选世界观设定（供参考）：
    ${context.lore.map(l => `- ${l.key}：${l.content}`).join("\n")}
    ` : ''}
    
    ${context.summaryTemplate || `请总结以下章节内容，用于长期记忆追踪。
    总结必须包含以下三个部分：
    1. 发生了什么内容：简述本章节的主要情节。
    2. 有哪一些角色：列出本章节出现或被提及的关键角色。
    3. 角色的关系：描述本章节中角色之间互动的性质或关系的变化。
    
    把你总结的内容放在大括号里面类似这样
    以下是我总结的内容{*****}`}
    
    请使用中文创作。
    注意：你返回的内容格式必须严格按照以下格式：
    以下是我总结的内容{你的总结内容}
  `;

  const modelConfig = context.config?.modelConfig;
  const temperature = context.config?.temperature ?? 0.8;

  if (!modelConfig || modelConfig.protocol === 'gemini') {
    const modelId = modelConfig?.model_id || "gemini-3-flash-preview";
    const response = await getGeminiAI().models.generateContent({
      model: modelId as any,
      contents: [{ text: `章节内容：\n${content}` }],
      config: {
        systemInstruction,
        temperature: temperature,
      },
    });
    return cleanSummaryText(response.text);
  } else {
    const result = await callOpenAI(
      modelConfig,
      systemInstruction,
      `章节内容：\n${content}`,
      temperature
    );
    return cleanSummaryText(result);
  }
};

export const extractLore = async (content: string, modelConfig?: AIModelConfig) => {
  const prompt = `从这段文本中提取关键的世界观事实或角色细节。以 JSON 数组形式返回，包含 'key' (名称), 'content' (内容), 和 'category' (类别)。\n\n文本：\n${content}`;
  
  if (!modelConfig || modelConfig.protocol === 'gemini') {
    const modelId = modelConfig?.model_id || "gemini-3-flash-preview";
    const response = await getGeminiAI().models.generateContent({
      model: modelId as any,
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING },
              content: { type: Type.STRING },
              category: { type: Type.STRING },
            },
            required: ["key", "content", "category"],
          },
        },
      },
    });
    return JSON.parse(response.text || "[]");
  } else {
    const result = await callOpenAI(modelConfig, "你是一个信息提取专家，请只返回 JSON 数组。", prompt, 0.1);
    try {
      const jsonStr = result.match(/\[.*\]/s)?.[0] || result;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse extracted lore:", e);
      return [];
    }
  }
};
