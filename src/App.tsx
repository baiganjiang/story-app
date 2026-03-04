import React, { useState, useEffect, useRef } from 'react';
import { 
  Book, 
  Users, 
  Globe, 
  Plus, 
  Save, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  Settings,
  History,
  Trash2,
  Edit3,
  Search,
  BookOpen,
  Download,
  Wand2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  generateStoryContent, 
  summarizeChapter, 
  extractLore, 
  generateOutline,
  testAIConnection,
  type Character, 
  type LoreItem,
  type AIModelConfig
} from './services/geminiService';
import { cn } from './lib/utils';

// Add type declaration for AI Studio platform APIs
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Types
interface Story {
  id: number;
  title: string;
  description: string;
  outline?: string;
}

interface Chapter {
  id: number;
  title: string;
  content: string;
  summary: string;
  order_index: number;
}

export default function App() {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [lore, setLore] = useState<LoreItem[]>([]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'chapters' | 'characters' | 'lore' | 'outline'>('chapters');
  const [isSummarizingBatch, setIsSummarizingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isAutoSummarizing, setIsAutoSummarizing] = useState(false);
  const [autoSummarizeProgress, setAutoSummarizeProgress] = useState({ current: 0, total: 0 });
  const [isBatchSummarizeModalOpen, setIsBatchSummarizeModalOpen] = useState(false);
  const [selectedBatchChapters, setSelectedBatchChapters] = useState<number[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportChapters, setSelectedExportChapters] = useState<number[]>([]);
  const [exportOptions, setExportOptions] = useState({ summaries: false, characters: false, lore: false });
  const [chapterGroupSize, setChapterGroupSize] = useState(20);
  const [expandedGroups, setExpandedGroups] = useState<number[]>([0]);
  const [aiGenerateModal, setAiGenerateModal] = useState<'character' | 'lore' | null>(null);
  const [selectedAiGenerateChapters, setSelectedAiGenerateChapters] = useState<number[]>([]);
  const [aiGeneratePrompt, setAiGeneratePrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  const [batchGenerateModal, setBatchGenerateModal] = useState<'character' | 'lore' | null>(null);
  const [batchGenerateConfig, setBatchGenerateConfig] = useState({ start: 1, end: 100, size: 5 });
  const [batchGenerateProgress, setBatchGenerateProgress] = useState({ current: 0, total: 0, isRunning: false });

  const [mergeModal, setMergeModal] = useState<'character' | 'lore' | null>(null);
  const [selectedMergeItems, setSelectedMergeItems] = useState<number[]>([]);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');

  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
    isOpen: false,
    message: '',
    onConfirm: () => {}
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryTemplates, setSummaryTemplates] = useState<{id: number, name: string, content: string}[]>([]);
  const [styleTags, setStyleTags] = useState<{id: number, name: string, description: string}[]>([]);
  const [selectedSummaryTemplate, setSelectedSummaryTemplate] = useState<number | null>(null);
  const [selectedContextStyleTags, setSelectedContextStyleTags] = useState<number[]>([]);

  const confirmAction = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  };
  const [aiPrompt, setAiPrompt] = useState('');
  
  // New States for UI Modals/Inputs
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<number | null>(null);
  const [editCharacter, setEditCharacter] = useState<{id?: number, name: string, description: string, personality: string, appearance: string} | null>(null);
  const [newCharacter, setNewCharacter] = useState({ name: '', description: '', personality: '', appearance: '' });
  const [isCreatingLore, setIsCreatingLore] = useState(false);
  const [editingLoreId, setEditingLoreId] = useState<number | null>(null);
  const [editLore, setEditLore] = useState<{id?: number, key: string, content: string, category: string} | null>(null);
  const [newLore, setNewLore] = useState({ key: '', content: '', category: '一般' });

  // Settings State
  const [customModels, setCustomModels] = useState<AIModelConfig[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
  const [selectedContextChapters, setSelectedContextChapters] = useState<number[]>([]);
  const [selectedContextCharacters, setSelectedContextCharacters] = useState<number[]>([]);
  const [selectedContextLore, setSelectedContextLore] = useState<number[]>([]);
  const [selectedContextOutline, setSelectedContextOutline] = useState(false);
  
  const [activeModelId, setActiveModelId] = useState<number | 'default'>(() => {
    const saved = localStorage.getItem('muse_active_model_id');
    if (saved === 'default' || !saved) return 'default';
    return parseInt(saved);
  });
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [editingModelId, setEditingModelId] = useState<number | null>(null);
  const [editModel, setEditModel] = useState<AIModelConfig | null>(null);
  const [newModel, setNewModel] = useState<AIModelConfig>({
    name: '',
    protocol: 'openai',
    api_key: '',
    base_url: '',
    model_id: ''
  });
  
  const [settingsTab, setSettingsTab] = useState<'models' | 'templates' | 'tags'>('models');
  
  // Template Management State
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editTemplate, setEditTemplate] = useState<{id?: number, name: string, content: string} | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '' });

  // Tag Management State
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editTag, setEditTag] = useState<{id?: number, name: string, description: string} | null>(null);
  const [newTag, setNewTag] = useState({ name: '', description: '' });
  const [testStatus, setTestStatus] = useState<{[key: string]: { status: 'testing' | 'success' | 'error' | null, message?: string, debug_url?: string, debug_model?: string, debug_status?: number }}>({});

  const [aiConfig, setAiConfig] = useState({
    temperature: 0.8,
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Check API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      }
    };
    checkKey();
    
    // Fetch custom models and settings
    fetch('/api/models').then(res => res.json()).then(setCustomModels);
    fetch('/api/summary_templates').then(res => res.json()).then(data => {
      setSummaryTemplates(data);
      if (data.length > 0) setSelectedSummaryTemplate(data[0].id);
    });
    fetch('/api/style_tags').then(res => res.json()).then(setStyleTags);
  }, []);

  useEffect(() => {
    localStorage.setItem('muse_active_model_id', activeModelId.toString());
  }, [activeModelId]);

  const handleAddModel = async () => {
    if (!newModel.name || !newModel.model_id) return;
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newModel)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCustomModels([...customModels, { ...newModel, id: data.id }]);
      setIsAddingModel(false);
      setNewModel({ name: '', protocol: 'openai', api_key: '', base_url: '', model_id: '' });
    } catch (error) {
      alert("添加模型失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleDeleteModel = async (id: number) => {
    confirmAction('确定要删除这个自定义模型吗？', async () => {
      await fetch(`/api/models/${id}`, { method: 'DELETE' });
      setCustomModels(customModels.filter(m => m.id !== id));
      if (activeModelId === id) setActiveModelId('default');
    });
  };

  // Template Handlers
  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) return;
    try {
      const res = await fetch('/api/summary_templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSummaryTemplates([...summaryTemplates, { ...newTemplate, id: data.id }]);
      setIsAddingTemplate(false);
      setNewTemplate({ name: '', content: '' });
    } catch (error) {
      alert("添加模板失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editTemplate || !editTemplate.id) return;
    try {
      const res = await fetch(`/api/summary_templates/${editTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTemplate)
      });
      if (!res.ok) throw new Error(await res.text());
      setSummaryTemplates(summaryTemplates.map(t => t.id === editTemplate.id ? editTemplate as any : t));
      setEditingTemplateId(null);
      setEditTemplate(null);
    } catch (error) {
      alert("更新模板失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    confirmAction('确定要删除这个摘要模板吗？', async () => {
      await fetch(`/api/summary_templates/${id}`, { method: 'DELETE' });
      setSummaryTemplates(summaryTemplates.filter(t => t.id !== id));
      if (selectedSummaryTemplate === id) setSelectedSummaryTemplate(null);
    });
  };

  // Tag Handlers
  const handleAddTag = async () => {
    if (!newTag.name) return;
    try {
      const res = await fetch('/api/style_tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTag)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStyleTags([...styleTags, { ...newTag, id: data.id }]);
      setIsAddingTag(false);
      setNewTag({ name: '', description: '' });
    } catch (error) {
      alert("添加标签失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleUpdateTag = async () => {
    if (!editTag || !editTag.id) return;
    try {
      const res = await fetch(`/api/style_tags/${editTag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTag)
      });
      if (!res.ok) throw new Error(await res.text());
      setStyleTags(styleTags.map(t => t.id === editTag.id ? editTag as any : t));
      setEditingTagId(null);
      setEditTag(null);
    } catch (error) {
      alert("更新标签失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleDeleteTag = async (id: number) => {
    confirmAction('确定要删除这个风格标签吗？', async () => {
      await fetch(`/api/style_tags/${id}`, { method: 'DELETE' });
      setStyleTags(styleTags.filter(t => t.id !== id));
      setSelectedContextStyleTags(prev => prev.filter(tagId => tagId !== id));
    });
  };

  const handleStartEdit = (model: AIModelConfig) => {
    setEditingModelId(model.id!);
    setEditModel({ ...model });
  };

  const handleUpdateModel = async () => {
    if (!editModel || !editModel.id) return;
    try {
      const res = await fetch(`/api/models/${editModel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editModel)
      });
      if (!res.ok) throw new Error(await res.text());
      setCustomModels(customModels.map(m => m.id === editModel.id ? editModel : m));
      setEditingModelId(null);
      setEditModel(null);
    } catch (error) {
      alert("更新模型失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleTestConnection = async (model: AIModelConfig) => {
    const key = model.id?.toString() || 'default';
    setTestStatus({ ...testStatus, [key]: { status: 'testing' } });
    try {
      const success = await testAIConnection(model);
      setTestStatus({ ...testStatus, [key]: { status: success ? 'success' : 'error' } });
    } catch (e: any) {
      const message = e.message || "未知错误";
      setTestStatus({ ...testStatus, [key]: { 
        status: 'error', 
        message,
        debug_url: e.debug_url,
        debug_model: e.debug_model,
        debug_status: e.debug_status
      } });
    }
  };

  const getActiveModelConfig = () => {
    if (activeModelId === 'default') {
      return { name: '默认 Gemini', protocol: 'gemini', model_id: 'gemini-3-flash-preview' } as AIModelConfig;
    }
    return customModels.find(m => m.id === activeModelId);
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // Fetch stories on mount
  useEffect(() => {
    fetch('/api/stories')
      .then(res => res.json())
      .then(setStories)
      .catch(err => console.error("Failed to fetch stories:", err));
  }, []);

  // Fetch story details when currentStory changes
  useEffect(() => {
    if (currentStory) {
      fetch(`/api/stories/${currentStory.id}/chapters`).then(res => res.json()).then(setChapters);
      fetch(`/api/stories/${currentStory.id}/characters`).then(res => res.json()).then(setCharacters);
      fetch(`/api/stories/${currentStory.id}/lore`).then(res => res.json()).then(setLore);
    }
  }, [currentStory]);

  const [isImporting, setIsImporting] = useState(false);

  const handleCreateStory = async () => {
    if (!newStoryTitle.trim()) return;
    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newStoryTitle, description: '' })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const newStory = { id: data.id, title: newStoryTitle, description: '' };
      setStories([newStory, ...stories]);
      setCurrentStory(newStory);
      setIsCreatingStory(false);
      setNewStoryTitle('');
    } catch (error) {
      alert("创建失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleImportTxt = async (file: File) => {
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) return;

        // Split by chapter markers
        const chapterRegex = /(第[一二三四五六七八九十百千万0-9]+[章节回].*)/g;
        const parts = text.split(chapterRegex);
        
        const storyTitle = file.name.replace('.txt', '');
        const res = await fetch('/api/stories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: storyTitle, description: '从 TXT 导入的作品' })
        });
        if (!res.ok) throw new Error(await res.text());
        const storyData = await res.json();
        const story = { id: storyData.id, title: storyTitle, description: '从 TXT 导入的作品' };

        let currentTitle = "前言";
        let orderIndex = 0;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i].trim();
          if (!part) continue;

          if (part.match(chapterRegex)) {
            currentTitle = part;
          } else {
            const chapRes = await fetch(`/api/stories/${story.id}/chapters`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: currentTitle,
                content: part,
                order_index: orderIndex++
              })
            });
            if (!chapRes.ok) throw new Error(await chapRes.text());
          }
        }

        setStories([story, ...stories]);
        setCurrentStory(story);
      } catch (error) {
        alert("导入失败: " + (error instanceof Error ? error.message : "未知错误"));
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateStory = async (storyToUpdate?: Story) => {
    const story = storyToUpdate || currentStory;
    if (!story) return;
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(story)
      });
      if (!res.ok) throw new Error(await res.text());
      setStories(stories.map(s => s.id === story.id ? story : s));
    } catch (error) {
      alert("更新故事失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleGenerateOutline = async () => {
    if (!currentStory || isGenerating) return;
    setIsGenerating(true);
    try {
      const context = {
        title: currentStory.title,
        description: currentStory.description,
        outline: selectedContextOutline ? currentStory.outline : undefined,
        characters: characters.filter(c => selectedContextCharacters.includes(c.id!)),
        lore: lore.filter(l => selectedContextLore.includes(l.id!)),
        styleTags: styleTags.filter(t => selectedContextStyleTags.includes(t.id!)),
        previousSummary: chapters
          .filter(c => selectedContextChapters.includes(c.id!))
          .map(c => `[${c.title}]: ${c.summary}`)
          .join("\n\n"),
        config: {
          modelConfig: getActiveModelConfig(),
          temperature: aiConfig.temperature
        }
      };
      
      const outline = await generateOutline(aiPrompt || "请为我的故事生成一份详细的大纲。", context);
      if (outline) {
        const updated = { ...currentStory, outline };
        setCurrentStory(updated);
        handleUpdateStory(updated);
        setAiPrompt('');
      }
    } catch (error) {
      alert("大纲生成失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBatchSummarize = async () => {
    if (isSummarizingBatch || selectedBatchChapters.length === 0 || !currentStory) return;
    const idsToProcess = selectedBatchChapters.slice(0, 5); // Limit to 5
    setIsSummarizingBatch(true);
    setBatchProgress({ current: 0, total: idsToProcess.length });
    setIsBatchSummarizeModalOpen(false);

    try {
      const context = {
        title: currentStory.title,
        description: currentStory.description,
        characters: characters.filter(c => selectedContextCharacters.includes(c.id!)),
        lore: lore.filter(l => selectedContextLore.includes(l.id!)),
        styleTags: styleTags.filter(t => selectedContextStyleTags.includes(t.id!)),
        summaryTemplate: summaryTemplates.find(t => t.id === selectedSummaryTemplate)?.content,
        config: {
          modelConfig: getActiveModelConfig(),
          temperature: aiConfig.temperature
        }
      };

      for (let i = 0; i < idsToProcess.length; i++) {
        const id = idsToProcess[i];
        const chapter = chapters.find(c => c.id === id);
        if (chapter && chapter.content) {
          setBatchProgress({ current: i + 1, total: idsToProcess.length });
          const summary = await summarizeChapter(chapter.content, context);
          if (summary) {
            const updated = { ...chapter, summary };
            const res = await fetch(`/api/chapters/${chapter.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated)
            });
            if (!res.ok) throw new Error(await res.text());
            // Update local state
            setChapters(prev => prev.map(c => c.id === id ? updated : c));
            if (currentChapter?.id === id) setCurrentChapter(updated);
          }
        }
      }
    } catch (error) {
      alert("批量总结过程中发生错误: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsSummarizingBatch(false);
      setSelectedBatchChapters([]);
    }
  };

  const handleAutoSummarizeAll = async () => {
    if (isAutoSummarizing || !currentStory) return;
    const chaptersToProcess = chapters.filter(c => !c.summary).sort((a, b) => a.order_index - b.order_index);
    if (chaptersToProcess.length === 0) {
      alert("所有章节都已有摘要。");
      return;
    }
    
    setIsAutoSummarizing(true);
    setAutoSummarizeProgress({ current: 0, total: chaptersToProcess.length });
    
    try {
      const context = {
        title: currentStory.title,
        description: currentStory.description,
        characters: characters.filter(c => selectedContextCharacters.includes(c.id!)),
        lore: lore.filter(l => selectedContextLore.includes(l.id!)),
        styleTags: styleTags.filter(t => selectedContextStyleTags.includes(t.id!)),
        summaryTemplate: summaryTemplates.find(t => t.id === selectedSummaryTemplate)?.content,
        config: {
          modelConfig: getActiveModelConfig(),
          temperature: aiConfig.temperature
        }
      };

      for (let i = 0; i < chaptersToProcess.length; i++) {
        const chapter = chaptersToProcess[i];
        if (chapter && chapter.content) {
          setAutoSummarizeProgress({ current: i + 1, total: chaptersToProcess.length });
          const summary = await summarizeChapter(chapter.content, context);
          if (summary) {
            const updated = { ...chapter, summary };
            const res = await fetch(`/api/chapters/${chapter.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated)
            });
            if (res.ok) {
              setChapters(prev => prev.map(c => c.id === chapter.id ? updated : c));
              if (currentChapter?.id === chapter.id) setCurrentChapter(updated);
            }
          }
        }
      }
    } catch (error) {
      console.error("一键整理摘要过程中发生错误:", error);
      alert("一键整理摘要过程中发生错误: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsAutoSummarizing(false);
    }
  };

  const handleExport = () => {
    if (selectedExportChapters.length === 0 || !currentStory) return;
    
    const chaptersToExport = chapters
      .filter(c => selectedExportChapters.includes(c.id!))
      .sort((a, b) => a.order_index - b.order_index);
      
    let content = `# ${currentStory.title}\n\n`;
    
    if (exportOptions.characters && characters.length > 0) {
      content += `## 角色设定\n\n`;
      characters.forEach(c => {
        content += `### ${c.name}\n${c.description}\n\n`;
      });
    }
    
    if (exportOptions.lore && lore.length > 0) {
      content += `## 世界设定\n\n`;
      lore.forEach(l => {
        content += `### ${l.key}\n${l.content}\n\n`;
      });
    }
    
    content += `## 正文内容\n\n`;
    chaptersToExport.forEach(c => {
      content += `### ${c.title}\n\n`;
      if (exportOptions.summaries && c.summary) {
        content += `> **摘要**：${c.summary}\n\n`;
      }
      content += `${c.content}\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentStory.title}_导出.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  const handleGenerateStoryFromOutline = async () => {
    if (!currentStory || isGenerating) return;
    setIsGenerating(true);
    try {
      // 1. Create a new chapter
      const nextOrder = chapters.length;
      const titleRes = await fetch(`/api/stories/${currentStory.id}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `第 ${nextOrder + 1} 章`, content: '', order_index: nextOrder })
      });
      const titleData = await titleRes.json();
      const newChapter = { id: titleData.id, title: `第 ${nextOrder + 1} 章`, content: '', summary: '', order_index: nextOrder };
      
      // 2. Prepare context
      const context = {
        title: currentStory.title,
        description: currentStory.description,
        outline: currentStory.outline,
        characters: characters.filter(c => selectedContextCharacters.includes(c.id!)),
        lore: lore.filter(l => selectedContextLore.includes(l.id!)),
        styleTags: styleTags.filter(t => selectedContextStyleTags.includes(t.id!)),
        previousSummary: chapters
          .filter(c => selectedContextChapters.includes(c.id!))
          .map(c => `[${c.title}]: ${c.summary}`)
          .join("\n\n"),
        config: {
          modelConfig: getActiveModelConfig(),
          temperature: aiConfig.temperature
        }
      };

      // 3. Generate content
      const generated = await generateStoryContent(aiPrompt || "请根据大纲和上下文开始创作这一章节。", context, "");
      if (generated) {
        newChapter.content = generated;
        const res = await fetch(`/api/chapters/${newChapter.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newChapter)
        });
        if (!res.ok) throw new Error(await res.text());
        setChapters([...chapters, newChapter]);
        setCurrentChapter(newChapter);
        setActiveTab('chapters');
        setAiPrompt('');
      }
    } catch (error) {
      alert("故事生成失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateChapter = async () => {
    if (!currentStory || !newChapterTitle.trim()) return;
    try {
      const res = await fetch(`/api/stories/${currentStory.id}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChapterTitle, content: '', order_index: chapters.length })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const newChapter = { id: data.id, title: newChapterTitle, content: '', summary: '', order_index: chapters.length };
      setChapters([...chapters, newChapter]);
      setCurrentChapter(newChapter);
      setIsCreatingChapter(false);
      setNewChapterTitle('');
    } catch (error) {
      alert("创建章节失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleSaveChapter = async (chapterToSave?: Chapter) => {
    const chapter = chapterToSave || currentChapter;
    if (!chapter) return;
    try {
      const res = await fetch(`/api/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chapter)
      });
      if (!res.ok) throw new Error(await res.text());
      // Update chapters list
      setChapters(chapters.map(c => c.id === chapter.id ? chapter : c));
    } catch (error) {
      alert("保存章节失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleUpdateChapterTitle = async (chapterId: number) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;
    try {
      const updatedChapter = { ...chapter, title: editChapterTitle };
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedChapter)
      });
      if (!res.ok) throw new Error(await res.text());
      setChapters(chapters.map(c => c.id === chapterId ? updatedChapter : c));
      if (currentChapter?.id === chapterId) {
        setCurrentChapter(updatedChapter);
      }
      setEditingChapterId(null);
    } catch (error) {
      alert("更新章节标题失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleAiGenerate = async () => {
    if (!currentStory || !aiGenerateModal) return;
    if (selectedAiGenerateChapters.length === 0 && !aiGeneratePrompt.trim()) {
      alert("请选择至少一个章节，或输入自定义描述。");
      return;
    }
    
    setIsAiGenerating(true);
    try {
      const summaries = chapters
        .filter(c => selectedAiGenerateChapters.includes(c.id!))
        .map(c => `[${c.title}]: ${c.summary || c.content.substring(0, 500)}`)
        .join("\n\n");

      let prompt = '';
      const customPromptText = aiGeneratePrompt.trim() ? `\n\n用户自定义要求：\n${aiGeneratePrompt}` : '';
      const summariesText = summaries ? `\n\n参考摘要内容：\n${summaries}` : '';
      
      if (aiGenerateModal === 'character') {
        prompt = `请你根据我发送的内容总结角色信息。
必须严格返回一个 JSON 数组，格式如下：
[
  { "name": "角色姓名", "description": "角色描述" }
]
请确保只输出 JSON，不要包含任何其他文字或 Markdown 标记。
${customPromptText}${summariesText}`;
      } else {
        prompt = `请你根据我发送的内容总结剧情的一些设定。
必须严格返回一个 JSON 数组，格式如下：
[
  { "key": "设定名称", "content": "设定详情" }
]
请确保只输出 JSON，不要包含任何其他文字或 Markdown 标记。
${customPromptText}${summariesText}`;
      }

      const context = {
        title: currentStory.title,
        description: currentStory.description,
        characters: characters || [],
        lore: lore || [],
        config: {
          modelConfig: getActiveModelConfig(),
          temperature: aiConfig.temperature
        }
      };

      const generated = await generateStoryContent(prompt, context, '');
      if (generated) {
        let newItems: any[] = [];
        
        // Try to parse JSON from the response
        const jsonMatch = generated.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              newItems = parsed;
            }
          } catch (e) {
            console.error("JSON parse error:", e);
          }
        }

        // Fallback to regex if JSON parsing fails
        if (newItems.length === 0) {
          const regex = /\{([^}]+)\}/g;
          let match;
          while ((match = regex.exec(generated)) !== null) {
            const content = match[1];
            if (aiGenerateModal === 'character') {
              const nameMatch = content.match(/角色姓名\s*[：:]\s*([^；;,，\n]+)/);
              const descMatch = content.match(/角色描述\s*[：:]\s*(.+)/);
              if (nameMatch && descMatch) {
                newItems.push({ name: nameMatch[1].trim(), description: descMatch[1].trim() });
              }
            } else {
              const nameMatch = content.match(/设定名称\s*[：:]\s*([^；;,，\n]+)/);
              const descMatch = content.match(/设定详情\s*[：:]\s*(.+)/);
              if (nameMatch && descMatch) {
                newItems.push({ key: nameMatch[1].trim(), content: descMatch[1].trim(), category: '一般' });
              }
            }
          }
        }

        if (newItems.length > 0) {
          for (const item of newItems) {
            if (aiGenerateModal === 'character') {
              const res = await fetch(`/api/stories/${currentStory.id}/characters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: item.name || '未知角色',
                  description: item.description || ''
                })
              });
              if (res.ok) {
                const data = await res.json();
                setCharacters(prev => [...prev, data]);
              }
            } else {
              const res = await fetch(`/api/stories/${currentStory.id}/lore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  key: item.key || '未知设定',
                  content: item.content || '',
                  category: item.category || '一般'
                })
              });
              if (res.ok) {
                const data = await res.json();
                setLore(prev => [...prev, data]);
              }
            }
          }
          alert(`成功生成并添加了 ${newItems.length} 个${aiGenerateModal === 'character' ? '角色' : '设定'}！`);
        } else {
          alert(`未能从 AI 回复中解析出有效内容，请检查 AI 回复格式是否正确。\n\nAI 原始回复：\n${generated}`);
        }
      }
    } catch (error) {
      console.error(error);
      alert("AI 生成失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsAiGenerating(false);
      setAiGenerateModal(null);
      setSelectedAiGenerateChapters([]);
      setAiGeneratePrompt('');
    }
  };

  const handleStartBatchGenerate = async () => {
    if (!currentStory || !batchGenerateModal) return;
    
    const { start, end, size } = batchGenerateConfig;
    
    // Filter chapters within the range
    const targetChapters = chapters.filter(c => 
      (c.order_index + 1) >= start && (c.order_index + 1) <= end
    );
    
    if (targetChapters.length === 0) {
      alert("没有找到符合条件的章节。");
      return;
    }

    const batches = [];
    for (let i = 0; i < targetChapters.length; i += size) {
      batches.push(targetChapters.slice(i, i + size));
    }

    setBatchGenerateProgress({ current: 0, total: batches.length, isRunning: true });

    let totalAdded = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      setBatchGenerateProgress(prev => ({ ...prev, current: i + 1 }));
      
      const summaries = batch
        .map(c => `[${c.title}]: ${c.summary || c.content.substring(0, 500)}`)
        .join("\n\n");

      let prompt = '';
      if (batchGenerateModal === 'character') {
        prompt = `请你根据我发送的内容总结角色信息。
必须严格返回一个 JSON 数组，格式如下：
[
  { "name": "角色姓名", "description": "角色描述" }
]
请确保只输出 JSON，不要包含任何其他文字或 Markdown 标记。

参考摘要内容：
${summaries}`;
      } else {
        prompt = `请你根据我发送的内容总结剧情的一些设定。
必须严格返回一个 JSON 数组，格式如下：
[
  { "key": "设定名称", "content": "设定详情" }
]
请确保只输出 JSON，不要包含任何其他文字或 Markdown 标记。

参考摘要内容：
${summaries}`;
      }

      const context = {
        title: currentStory.title,
        description: currentStory.description,
        characters: [],
        lore: [],
        config: {
          modelConfig: getActiveModelConfig(),
          temperature: aiConfig.temperature
        }
      };

      try {
        const generated = await generateStoryContent(prompt, context, '');
        if (generated) {
          let newItems: any[] = [];
          
          let jsonStr = generated;
          const jsonMatch = generated.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1];
          } else {
            const arrayMatch = generated.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (arrayMatch) {
              jsonStr = arrayMatch[0];
            }
          }

          try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) newItems = parsed;
          } catch (e) {
            console.error("JSON parse error:", e);
          }

          if (newItems.length === 0) {
            const regex = /\{([^}]+)\}/g;
            let match;
            while ((match = regex.exec(generated)) !== null) {
              const content = match[1];
              if (batchGenerateModal === 'character') {
                const nameMatch = content.match(/角色姓名\s*[：:]\s*([^；;,，\n]+)/);
                const descMatch = content.match(/角色描述\s*[：:]\s*(.+)/);
                if (nameMatch && descMatch) {
                  newItems.push({ name: nameMatch[1].trim(), description: descMatch[1].trim() });
                }
              } else {
                const nameMatch = content.match(/设定名称\s*[：:]\s*([^；;,，\n]+)/);
                const descMatch = content.match(/设定详情\s*[：:]\s*(.+)/);
                if (nameMatch && descMatch) {
                  newItems.push({ key: nameMatch[1].trim(), content: descMatch[1].trim(), category: '一般' });
                }
              }
            }
          }

          if (newItems.length > 0) {
            for (const item of newItems) {
              if (batchGenerateModal === 'character') {
                const res = await fetch(`/api/stories/${currentStory.id}/characters`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: item.name || '未知角色',
                    description: item.description || ''
                  })
                });
                if (res.ok) {
                  const data = await res.json();
                  setCharacters(prev => [...prev, data]);
                  totalAdded++;
                }
              } else {
                const res = await fetch(`/api/stories/${currentStory.id}/lore`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    key: item.key || '未知设定',
                    content: item.content || '',
                    category: item.category || '一般'
                  })
                });
                if (res.ok) {
                  const data = await res.json();
                  setLore(prev => [...prev, data]);
                  totalAdded++;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Batch generate error:", error);
      }
    }

    setBatchGenerateProgress(prev => ({ ...prev, isRunning: false }));
    alert(`批量生成完成！共添加了 ${totalAdded} 个${batchGenerateModal === 'character' ? '角色' : '设定'}。`);
    setBatchGenerateModal(null);
  };

  const handleAiMerge = async () => {
    if (!currentStory || !mergeModal || selectedMergeItems.length === 0) return;
    
    const type = mergeModal;
    const allItems = type === 'character' ? characters : lore;
    const itemsToMerge = allItems.filter(item => selectedMergeItems.includes(item.id!));
    
    if (itemsToMerge.length === 0) {
      alert(`没有选择可合并的${type === 'character' ? '角色' : '设定'}。`);
      return;
    }

    setIsAiGenerating(true);
    try {
      let prompt = '';
      if (type === 'character') {
        prompt = `这里有一些角色设定，其中可能存在同名或指代同一角色的重复设定（因为剧情发展导致设定更新）。请你将指代同一角色的设定合并，保留最全面、最准确的信息。
必须严格返回一个 JSON 数组，格式如下：
[
  { "name": "角色姓名", "description": "角色描述" }
]
请确保只输出 JSON，不要包含任何其他文字或 Markdown 标记。

当前选中需要合并的角色列表：
${itemsToMerge.map((c: any) => `姓名：${c.name}\n描述：${c.description}`).join('\n\n')}`;
      } else {
        prompt = `这里有一些世界观设定，其中可能存在同名或指代同一事物的重复设定。请你将指代同一事物的设定合并，保留最全面、最准确的信息。
必须严格返回一个 JSON 数组，格式如下：
[
  { "key": "设定名称", "content": "设定详情" }
]
请确保只输出 JSON，不要包含任何其他文字或 Markdown 标记。

当前选中需要合并的设定列表：
${itemsToMerge.map((l: any) => `名称：${l.key}\n详情：${l.content}`).join('\n\n')}`;
      }

      const context = {
        title: currentStory.title,
        description: currentStory.description,
        characters: [],
        lore: [],
        config: {
          modelConfig: getActiveModelConfig(),
          temperature: aiConfig.temperature
        }
      };

      const generated = await generateStoryContent(prompt, context, '');
      if (generated) {
        let newItems: any[] = [];
        
        // Try to extract JSON from markdown code blocks or raw text
        let jsonStr = generated;
        const jsonMatch = generated.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        } else {
          // Fallback to finding array brackets
          const arrayMatch = generated.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (arrayMatch) {
            jsonStr = arrayMatch[0];
          }
        }

        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) newItems = parsed;
        } catch (e) {
          console.error("JSON parse error:", e);
        }

        if (newItems.length > 0) {
          // Delete old merged items
          for (const item of itemsToMerge) {
            await fetch(`/api/${type === 'character' ? 'characters' : 'lore'}/${item.id}`, { method: 'DELETE' });
          }

          // Add new items
          const addedItems = [];
          for (const item of newItems) {
            const res = await fetch(`/api/stories/${currentStory.id}/${type === 'character' ? 'characters' : 'lore'}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(
                type === 'character' 
                  ? { name: item.name || '未知角色', description: item.description || '' }
                  : { key: item.key || '未知设定', content: item.content || '', category: '一般' }
              )
            });
            if (res.ok) {
              addedItems.push(await res.json());
            }
          }

          if (type === 'character') {
            const remainingCharacters = characters.filter(c => !selectedMergeItems.includes(c.id!));
            setCharacters([...remainingCharacters, ...addedItems]);
          } else {
            const remainingLore = lore.filter(l => !selectedMergeItems.includes(l.id!));
            setLore([...remainingLore, ...addedItems]);
          }
          alert(`合并完成！成功合并了 ${itemsToMerge.length} 个项目，生成了 ${addedItems.length} 个新项目。`);
          setMergeModal(null);
          setSelectedMergeItems([]);
        } else {
          alert(`未能从 AI 回复中解析出有效内容，请检查 AI 回复格式是否正确。\n\nAI 原始回复：\n${generated}`);
        }
      }
    } catch (error) {
      console.error(error);
      alert("AI 合并失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAiAssist = async () => {
    if (!currentStory || !currentChapter || isGenerating) return;
    setIsGenerating(true);
    try {
      const context = {
        title: currentStory.title,
        description: currentStory.description,
        outline: selectedContextOutline ? currentStory.outline : undefined,
        characters: characters.filter(c => selectedContextCharacters.includes(c.id!)),
        lore: lore.filter(l => selectedContextLore.includes(l.id!)),
        styleTags: styleTags.filter(t => selectedContextStyleTags.includes(t.id!)),
        previousSummary: chapters
          .filter(c => selectedContextChapters.includes(c.id!))
          .map(c => `[${c.title}]: ${c.summary}`)
          .join("\n\n"),
        config: {
          modelConfig: getActiveModelConfig(),
          temperature: aiConfig.temperature
        }
      };
      
      const generated = await generateStoryContent(aiPrompt, context, currentChapter.content);
      if (generated) {
        setCurrentChapter({
          ...currentChapter,
          content: currentChapter.content + "\n\n" + generated
        });
        setAiPrompt('');
      }
    } catch (error) {
      console.error(error);
      alert("AI 调用失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSummarize = async (chapterId?: number) => {
    const targetChapter = chapterId ? chapters.find(c => c.id === chapterId) : currentChapter;
    if (!targetChapter || !currentStory || isGenerating) return;
    setIsGenerating(true);
    try {
      const context = {
        title: currentStory.title,
        description: currentStory.description,
        characters: characters.filter(c => selectedContextCharacters.includes(c.id!)),
        lore: lore.filter(l => selectedContextLore.includes(l.id!)),
        styleTags: styleTags.filter(t => selectedContextStyleTags.includes(t.id!)),
        summaryTemplate: summaryTemplates.find(t => t.id === selectedSummaryTemplate)?.content,
        config: {
          modelConfig: getActiveModelConfig(),
          temperature: aiConfig.temperature
        }
      };

      const summary = await summarizeChapter(targetChapter.content, context);
      if (summary) {
        const updated = { ...targetChapter, summary };
        const res = await fetch(`/api/chapters/${targetChapter.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
        if (!res.ok) throw new Error(await res.text());
        setChapters(chapters.map(c => c.id === targetChapter.id ? updated : c));
        if (currentChapter?.id === targetChapter.id) {
          setCurrentChapter(updated);
        }
      }
    } catch (error) {
      alert("总结失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExtractLore = async () => {
    if (!currentChapter || !currentStory || isGenerating) return;
    setIsGenerating(true);
    try {
      const newLore = await extractLore(currentChapter.content, getActiveModelConfig());
      for (const item of newLore) {
        const res = await fetch(`/api/stories/${currentStory.id}/lore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (!res.ok) throw new Error(await res.text());
      }
      // Refresh lore
      fetch(`/api/stories/${currentStory.id}/lore`).then(res => res.json()).then(setLore);
    } catch (error) {
      alert("提取失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddCharacter = async () => {
    if (!currentStory || !newCharacter.name.trim()) return;
    try {
      const res = await fetch(`/api/stories/${currentStory.id}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCharacter)
      });
      if (!res.ok) throw new Error(await res.text());
      fetch(`/api/stories/${currentStory.id}/characters`).then(res => res.json()).then(setCharacters);
      setIsCreatingCharacter(false);
      setNewCharacter({ name: '', description: '', personality: '', appearance: '' });
    } catch (error) {
      alert("添加角色失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleUpdateCharacter = async () => {
    if (!currentStory || !editCharacter || !editCharacter.id) return;
    try {
      const res = await fetch(`/api/characters/${editCharacter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCharacter)
      });
      if (!res.ok) throw new Error(await res.text());
      fetch(`/api/stories/${currentStory.id}/characters`).then(res => res.json()).then(setCharacters);
      setEditingCharacterId(null);
      setEditCharacter(null);
    } catch (error) {
      alert("更新角色失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleAddLore = async () => {
    if (!currentStory || !newLore.key.trim()) return;
    try {
      const res = await fetch(`/api/stories/${currentStory.id}/lore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLore)
      });
      if (!res.ok) throw new Error(await res.text());
      fetch(`/api/stories/${currentStory.id}/lore`).then(res => res.json()).then(setLore);
      setIsCreatingLore(false);
      setNewLore({ key: '', content: '', category: '一般' });
    } catch (error) {
      alert("添加设定失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleUpdateLore = async () => {
    if (!currentStory || !editLore || !editLore.id) return;
    try {
      const res = await fetch(`/api/lore/${editLore.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editLore)
      });
      if (!res.ok) throw new Error(await res.text());
      fetch(`/api/stories/${currentStory.id}/lore`).then(res => res.json()).then(setLore);
      setEditingLoreId(null);
      setEditLore(null);
    } catch (error) {
      alert("更新设定失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const renderSettingsModal = () => (
    <AnimatePresence>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSettingsOpen(false)}
            className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-lg bg-[#E4E3E0] rounded-3xl shadow-2xl overflow-hidden border border-[#141414]/10"
          >
            <div className="p-6 border-b border-[#141414]/10 flex flex-col gap-4 bg-white/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5" /> 缪斯设置
                </h3>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-[#141414]/5 rounded-full">
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <div className="flex gap-4 border-b border-[#141414]/10">
                <button 
                  onClick={() => setSettingsTab('models')}
                  className={cn("pb-2 text-sm font-bold transition-colors border-b-2", settingsTab === 'models' ? "border-[#141414] text-[#141414]" : "border-transparent text-[#141414]/50 hover:text-[#141414]")}
                >
                  AI 模型
                </button>
                <button 
                  onClick={() => setSettingsTab('templates')}
                  className={cn("pb-2 text-sm font-bold transition-colors border-b-2", settingsTab === 'templates' ? "border-[#141414] text-[#141414]" : "border-transparent text-[#141414]/50 hover:text-[#141414]")}
                >
                  摘要模板
                </button>
                <button 
                  onClick={() => setSettingsTab('tags')}
                  className={cn("pb-2 text-sm font-bold transition-colors border-b-2", settingsTab === 'tags' ? "border-[#141414] text-[#141414]" : "border-transparent text-[#141414]/50 hover:text-[#141414]")}
                >
                  风格标签
                </button>
              </div>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {settingsTab === 'models' && (
                <>
                  {/* API Key Section */}
                  <section className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">内置 Gemini 连接</h4>
                <div className="p-4 bg-white rounded-2xl border border-[#141414]/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Gemini API 状态</span>
                    <span className={cn("text-xs px-2 py-1 rounded-full font-bold", hasApiKey ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                      {hasApiKey ? "已连接" : "未配置付费密钥"}
                    </span>
                  </div>
                  <button 
                    onClick={handleOpenKeySelector}
                    className="w-full py-2 bg-[#141414] text-[#E4E3E0] rounded-xl text-sm font-bold hover:scale-[1.02] transition-transform"
                  >
                    {hasApiKey ? "更换 API 密钥" : "选择 API 密钥"}
                  </button>
                </div>
              </section>

              {/* Custom Models Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">自定义模型 (OpenAI 兼容)</h4>
                  <button 
                    onClick={() => setIsAddingModel(!isAddingModel)}
                    className="p-1 hover:bg-[#141414]/5 rounded text-[#141414]/60"
                  >
                    <Plus className={cn("w-4 h-4 transition-transform", isAddingModel && "rotate-45")} />
                  </button>
                </div>

                {isAddingModel && (
                  <div className="p-4 bg-white rounded-2xl border border-[#141414]/10 space-y-3">
                    <input 
                      placeholder="模型显示名称 (如: 我的 GPT-4)"
                      value={newModel.name}
                      onChange={e => setNewModel({...newModel, name: e.target.value})}
                      className="w-full p-2 text-sm border rounded-lg"
                    />
                    <input 
                      placeholder="Base URL (如: https://api.openai.com/v1/chat/completions)"
                      value={newModel.base_url}
                      onChange={e => setNewModel({...newModel, base_url: e.target.value})}
                      className="w-full p-2 text-sm border rounded-lg"
                    />
                    <input 
                      placeholder="API Key"
                      type="password"
                      value={newModel.api_key}
                      onChange={e => setNewModel({...newModel, api_key: e.target.value})}
                      className="w-full p-2 text-sm border rounded-lg"
                    />
                    <input 
                      placeholder="模型 ID (如: nvidia/llama-3.1-8b-instruct)"
                      value={newModel.model_id}
                      onChange={e => setNewModel({...newModel, model_id: e.target.value})}
                      className="w-full p-2 text-sm border rounded-lg"
                    />
                    <p className="text-[10px] opacity-50 px-1">提示: 模型 ID 通常不包含空格，请确保格式正确。</p>
                    <button 
                      onClick={handleAddModel}
                      className="w-full py-2 bg-[#141414] text-[#E4E3E0] rounded-xl text-sm font-bold"
                    >
                      保存模型
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <div 
                    onClick={() => setActiveModelId('default')}
                    className={cn(
                      "p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between",
                      activeModelId === 'default' ? "bg-[#141414] text-[#E4E3E0] border-transparent shadow-lg" : "bg-white border-[#141414]/5 hover:border-[#141414]/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-bold text-sm">默认 Gemini</div>
                        <div className="text-[10px] opacity-50 uppercase tracking-tighter">Gemini 3 Flash</div>
                      </div>
                      {activeModelId === 'default' && (
                        <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">当前使用</span>
                      )}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleTestConnection({ name: 'Gemini', protocol: 'gemini', model_id: 'gemini-3-flash-preview' } as any); }}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold",
                        testStatus['default']?.status === 'testing' ? "animate-pulse bg-blue-100 text-blue-700" :
                        testStatus['default']?.status === 'success' ? "bg-emerald-100 text-emerald-700" :
                        testStatus['default']?.status === 'error' ? "bg-red-100 text-red-700" :
                        "bg-[#141414]/10 text-[#141414]"
                      )}
                    >
                      {testStatus['default']?.status === 'testing' ? '测试中...' : 
                       testStatus['default']?.status === 'success' ? '连接成功' : 
                       testStatus['default']?.status === 'error' ? '连接失败' : '测试连接'}
                    </button>
                  </div>
                  {testStatus['default']?.status === 'error' && (
                    <div className="px-4 pb-2 text-[10px] text-red-500 font-medium">
                      错误: {testStatus['default']?.message}
                    </div>
                  )}

                  {customModels.map(model => (
                    <div key={model.id} className="space-y-1">
                      {editingModelId === model.id ? (
                        <div className="p-4 bg-white rounded-2xl border border-[#141414]/20 space-y-3">
                          <input 
                            placeholder="模型显示名称"
                            value={editModel?.name}
                            onChange={e => setEditModel({...editModel!, name: e.target.value})}
                            className="w-full p-2 text-sm border rounded-lg"
                          />
                          <input 
                            placeholder="Base URL"
                            value={editModel?.base_url}
                            onChange={e => setEditModel({...editModel!, base_url: e.target.value})}
                            className="w-full p-2 text-sm border rounded-lg"
                          />
                          <input 
                            placeholder="API Key"
                            type="password"
                            value={editModel?.api_key}
                            onChange={e => setEditModel({...editModel!, api_key: e.target.value})}
                            className="w-full p-2 text-sm border rounded-lg"
                          />
                          <input 
                            placeholder="模型 ID (如: nvidia/llama-3.1-8b-instruct)"
                            value={editModel?.model_id}
                            onChange={e => setEditModel({...editModel!, model_id: e.target.value})}
                            className="w-full p-2 text-sm border rounded-lg"
                          />
                          <p className="text-[10px] opacity-50 px-1">提示: 模型 ID 通常不包含空格，请确保格式正确。</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={handleUpdateModel}
                              className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] rounded-xl text-sm font-bold"
                            >
                              保存修改
                            </button>
                            <button 
                              onClick={() => setEditingModelId(null)}
                              className="px-4 py-2 border border-[#141414]/10 rounded-xl text-sm"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => setActiveModelId(model.id!)}
                          className={cn(
                            "p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group",
                            activeModelId === model.id ? "bg-[#141414] text-[#E4E3E0] border-transparent shadow-lg" : "bg-white border-[#141414]/5 hover:border-[#141414]/20"
                          )}
                        >
                          <div className="flex-1 flex items-center gap-3">
                            <div>
                              <div className="font-bold text-sm">{model.name}</div>
                              <div className="text-[10px] opacity-50 uppercase tracking-tighter">{model.model_id}</div>
                            </div>
                            {activeModelId === model.id && (
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", activeModelId === model.id ? "bg-white/20 text-white" : "bg-[#141414]/10 text-[#141414]")}>
                                当前使用
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleTestConnection(model); }}
                              className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold",
                                testStatus[model.id!]?.status === 'testing' ? "animate-pulse bg-blue-100 text-blue-700" :
                                testStatus[model.id!]?.status === 'success' ? "bg-emerald-100 text-emerald-700" :
                                testStatus[model.id!]?.status === 'error' ? "bg-red-100 text-red-700" :
                                activeModelId === model.id ? "bg-white/20 text-white" : "bg-[#141414]/10 text-[#141414]"
                              )}
                            >
                              {testStatus[model.id!]?.status === 'testing' ? '测试中...' : 
                               testStatus[model.id!]?.status === 'success' ? '连接成功' : 
                               testStatus[model.id!]?.status === 'error' ? '连接失败' : '测试连接'}
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleStartEdit(model); }}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:text-[#141414] transition-all"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteModel(model.id!); }}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:text-[#141414] transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    {testStatus[model.id!]?.status === 'error' && (
                      <div className="px-4 pb-2 text-[10px] text-red-500 font-medium space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="bg-red-500 text-white px-1 rounded">状态 {testStatus[model.id!]?.debug_status || 'ERR'}</span>
                          <span>{testStatus[model.id!]?.message}</span>
                        </div>
                        {testStatus[model.id!]?.debug_url && (
                          <div className="opacity-60 break-all">请求地址: {testStatus[model.id!]?.debug_url}</div>
                        )}
                        {testStatus[model.id!]?.debug_model && (
                          <div className="opacity-60">模型 ID: {testStatus[model.id!]?.debug_model}</div>
                        )}
                      </div>
                    )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Model Config Section */}
              <section className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">通用参数</h4>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex justify-between">
                      <span>Temperature (随机性)</span>
                      <span className="text-xs font-mono font-bold">{aiConfig.temperature}</span>
                    </label>
                    <input 
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={aiConfig.temperature}
                      onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-[#141414]"
                    />
                    <div className="flex justify-between text-[10px] opacity-40 uppercase tracking-tighter">
                      <span>严谨 (0.0)</span>
                      <span>平衡 (1.0)</span>
                      <span>疯狂 (2.0)</span>
                    </div>
                  </div>
                </div>
              </section>
                </>
              )}

              {settingsTab === 'templates' && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">自定义摘要模板</h4>
                    <button 
                      onClick={() => setIsAddingTemplate(!isAddingTemplate)}
                      className="p-1 hover:bg-[#141414]/5 rounded text-[#141414]/60"
                    >
                      <Plus className={cn("w-4 h-4 transition-transform", isAddingTemplate && "rotate-45")} />
                    </button>
                  </div>

                  {isAddingTemplate && (
                    <div className="p-4 bg-white rounded-2xl border border-[#141414]/10 space-y-3">
                      <input 
                        placeholder="模板名称 (如: 详细总结)"
                        value={newTemplate.name}
                        onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                        className="w-full p-2 text-sm border rounded-lg"
                      />
                      <textarea 
                        placeholder="模板内容 (指导 AI 如何总结)"
                        value={newTemplate.content}
                        onChange={e => setNewTemplate({...newTemplate, content: e.target.value})}
                        className="w-full p-2 text-sm border rounded-lg h-32 resize-none"
                      />
                      <button 
                        onClick={handleAddTemplate}
                        className="w-full py-2 bg-[#141414] text-[#E4E3E0] rounded-xl text-sm font-bold"
                      >
                        保存模板
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {summaryTemplates.map(template => (
                      <div key={template.id} className="space-y-1">
                        {editingTemplateId === template.id ? (
                          <div className="p-4 bg-white rounded-2xl border border-[#141414]/20 space-y-3">
                            <input 
                              value={editTemplate?.name}
                              onChange={e => setEditTemplate({...editTemplate!, name: e.target.value})}
                              className="w-full p-2 text-sm border rounded-lg"
                            />
                            <textarea 
                              value={editTemplate?.content}
                              onChange={e => setEditTemplate({...editTemplate!, content: e.target.value})}
                              className="w-full p-2 text-sm border rounded-lg h-32 resize-none"
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={handleUpdateTemplate}
                                className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] rounded-xl text-sm font-bold"
                              >
                                保存修改
                              </button>
                              <button 
                                onClick={() => setEditingTemplateId(null)}
                                className="px-4 py-2 border border-[#141414]/10 rounded-xl text-sm"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl border bg-white border-[#141414]/5 hover:border-[#141414]/20 transition-all group">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-bold text-sm">{template.name}</div>
                                <div className="text-xs opacity-60 mt-1 line-clamp-2">{template.content}</div>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={() => { setEditingTemplateId(template.id!); setEditTemplate(template); }}
                                  className="p-1 hover:text-[#141414]"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTemplate(template.id!)}
                                  className="p-1 hover:text-[#141414]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {settingsTab === 'tags' && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">风格标签</h4>
                    <button 
                      onClick={() => setIsAddingTag(!isAddingTag)}
                      className="p-1 hover:bg-[#141414]/5 rounded text-[#141414]/60"
                    >
                      <Plus className={cn("w-4 h-4 transition-transform", isAddingTag && "rotate-45")} />
                    </button>
                  </div>

                  {isAddingTag && (
                    <div className="p-4 bg-white rounded-2xl border border-[#141414]/10 space-y-3">
                      <input 
                        placeholder="标签名称 (如: 悬疑)"
                        value={newTag.name}
                        onChange={e => setNewTag({...newTag, name: e.target.value})}
                        className="w-full p-2 text-sm border rounded-lg"
                      />
                      <input 
                        placeholder="标签描述 (如: 充满悬念和未知的氛围)"
                        value={newTag.description}
                        onChange={e => setNewTag({...newTag, description: e.target.value})}
                        className="w-full p-2 text-sm border rounded-lg"
                      />
                      <button 
                        onClick={handleAddTag}
                        className="w-full py-2 bg-[#141414] text-[#E4E3E0] rounded-xl text-sm font-bold"
                      >
                        保存标签
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {styleTags.map(tag => (
                      <div key={tag.id} className="space-y-1">
                        {editingTagId === tag.id ? (
                          <div className="p-4 bg-white rounded-2xl border border-[#141414]/20 space-y-3">
                            <input 
                              value={editTag?.name}
                              onChange={e => setEditTag({...editTag!, name: e.target.value})}
                              className="w-full p-2 text-sm border rounded-lg"
                            />
                            <input 
                              value={editTag?.description}
                              onChange={e => setEditTag({...editTag!, description: e.target.value})}
                              className="w-full p-2 text-sm border rounded-lg"
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={handleUpdateTag}
                                className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] rounded-xl text-sm font-bold"
                              >
                                保存修改
                              </button>
                              <button 
                                onClick={() => setEditingTagId(null)}
                                className="px-4 py-2 border border-[#141414]/10 rounded-xl text-sm"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl border bg-white border-[#141414]/5 hover:border-[#141414]/20 transition-all group">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-bold text-sm">{tag.name}</div>
                                <div className="text-xs opacity-60 mt-1">{tag.description}</div>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={() => { setEditingTagId(tag.id!); setEditTag(tag); }}
                                  className="p-1 hover:text-[#141414]"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTag(tag.id!)}
                                  className="p-1 hover:text-[#141414]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="p-6 bg-white/50 border-t border-[#141414]/10 flex justify-end">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-8 py-3 bg-[#141414] text-[#E4E3E0] rounded-xl font-bold hover:scale-105 transition-transform"
              >
                完成设置
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  const renderConfirmDialog = () => (
    <AnimatePresence>
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-sm bg-[#E4E3E0] rounded-2xl shadow-2xl overflow-hidden border border-[#141414]/10 p-6"
          >
            <h3 className="text-lg font-bold mb-4 text-[#141414]">确认操作</h3>
            <p className="text-sm opacity-80 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-[#141414]/10 rounded-xl font-bold hover:bg-[#141414]/5 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                确认删除
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!currentStory) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex flex-col items-center justify-center p-8 font-sans relative">
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="absolute top-8 right-8 p-3 bg-white border border-[#141414]/10 rounded-full hover:bg-[#141414]/5 transition-all shadow-sm"
          title="设置 AI 模型"
        >
          <Settings className="w-6 h-6" />
        </button>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center"
        >
          <h1 className="text-6xl font-serif italic mb-4 text-[#141414]">灵感酒馆</h1>
          <p className="text-xl text-[#141414]/60 mb-12">您的创作避风港，拥有永不褪色的记忆。</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 border-2 border-[#141414] rounded-2xl bg-white/50 text-left">
              <Plus className="w-8 h-8 mb-4" />
              <h3 className="text-xl font-bold mb-4">开启新篇章</h3>
              {isCreatingStory ? (
                <div className="space-y-4">
                  <input 
                    autoFocus
                    value={newStoryTitle}
                    onChange={(e) => setNewStoryTitle(e.target.value)}
                    placeholder="输入作品标题..."
                    className="w-full p-3 bg-white border border-[#141414]/20 rounded-lg focus:outline-none focus:ring-2 ring-[#141414]/10"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateStory()}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleCreateStory}
                      className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] rounded-lg font-bold"
                    >
                      创建
                    </button>
                    <button 
                      onClick={() => setIsCreatingStory(false)}
                      className="px-4 py-2 border border-[#141414]/10 rounded-lg"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button 
                    onClick={() => setIsCreatingStory(true)}
                    className="w-full py-3 bg-[#141414] text-[#E4E3E0] rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> 创建新作品
                  </button>
                  <label className="w-full py-3 border-2 border-dashed border-[#141414]/20 rounded-xl font-bold hover:border-[#141414]/40 transition-all flex items-center justify-center gap-2 cursor-pointer opacity-70 hover:opacity-100">
                    <Globe className="w-5 h-5" /> 导入并拆分 TXT
                    <input 
                      type="file" 
                      accept=".txt" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportTxt(file);
                      }} 
                    />
                  </label>
                </div>
              )}
            </div>
            
            <div className="p-8 border-2 border-[#141414]/10 rounded-2xl text-left bg-white/50">
              <History className="w-8 h-8 mb-4 opacity-40" />
              <h3 className="text-xl font-bold mb-2">最近手稿</h3>
              <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
                {stories.map(s => (
                  <div key={s.id} className="group flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentStory(s)}
                      className="flex-1 text-left p-2 hover:bg-[#141414]/5 rounded flex items-center justify-between transition-all"
                    >
                      <span className="truncate">{s.title}</span>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmAction('确定要删除这部作品吗？此操作不可撤销。', () => {
                          fetch(`/api/stories/${s.id}`, { method: 'DELETE' })
                            .then(() => setStories(stories.filter(st => st.id !== s.id)));
                        });
                      }}
                      className="p-2 text-[#141414]/60 opacity-0 group-hover:opacity-100 hover:bg-[#141414]/10 hover:text-[#141414] rounded transition-all"
                      title="删除作品"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {stories.length === 0 && <p className="text-sm opacity-40 italic">暂无历史作品。</p>}
              </div>
            </div>
          </div>
        </motion.div>
        
        {isImporting && (
          <div className="fixed inset-0 bg-[#141414]/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-[#E4E3E0]">
            <div className="w-16 h-16 border-4 border-[#E4E3E0]/20 border-t-[#E4E3E0] rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-serif italic mb-2">正在拆分章节...</h2>
            <p className="text-sm opacity-60">缪斯正在为您整理手稿，请稍候。</p>
          </div>
        )}
        {renderSettingsModal()}
        {renderConfirmDialog()}
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#E4E3E0] flex overflow-hidden font-sans text-[#141414]">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 320 : 0 }}
        className="bg-white border-r border-[#141414]/10 flex flex-col overflow-hidden relative"
      >
        <div className="p-4 border-b border-[#141414]/10 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <button 
              onClick={() => setCurrentStory(null)} 
              className="p-2 hover:bg-[#141414]/5 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold shrink-0"
              title="返回主页"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>返回</span>
            </button>
            <h2 className="font-serif italic text-xl truncate">{currentStory.title}</h2>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setIsSettingsOpen(true)} className="p-1 hover:bg-[#141414]/5 rounded" title="设置">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-[#141414]/10">
          <button 
            onClick={() => setActiveTab('chapters')}
            className={cn("flex-1 p-3 text-[10px] uppercase tracking-widest font-bold", activeTab === 'chapters' && "bg-[#141414] text-[#E4E3E0]")}
          >
            章节
          </button>
          <button 
            onClick={() => setActiveTab('outline')}
            className={cn("flex-1 p-3 text-[10px] uppercase tracking-widest font-bold", activeTab === 'outline' && "bg-[#141414] text-[#E4E3E0]")}
          >
            大纲
          </button>
          <button 
            onClick={() => setActiveTab('characters')}
            className={cn("flex-1 p-3 text-[10px] uppercase tracking-widest font-bold", activeTab === 'characters' && "bg-[#141414] text-[#E4E3E0]")}
          >
            角色
          </button>
          <button 
            onClick={() => setActiveTab('lore')}
            className={cn("flex-1 p-3 text-[10px] uppercase tracking-widest font-bold", activeTab === 'lore' && "bg-[#141414] text-[#E4E3E0]")}
          >
            世界
          </button>
        </div>

        <div className="flex-1 flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'chapters' && (
              <motion.div 
                key="chapters"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex flex-col h-full"
              >
                <div className="sticky top-0 bg-white z-10 p-4 border-b border-[#141414]/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40">章节列表</h4>
                    <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                      <span className="text-[10px]">每组</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="100" 
                        value={chapterGroupSize}
                        onChange={(e) => setChapterGroupSize(Math.max(1, parseInt(e.target.value) || 20))}
                        className="w-10 bg-transparent border-b border-[#141414]/20 text-[10px] text-center focus:outline-none focus:border-[#141414]"
                      />
                      <span className="text-[10px]">章</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setSelectedExportChapters(chapters.map(c => c.id!));
                        setIsExportModalOpen(true);
                      }}
                      className="px-2 py-1 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> 导出
                    </button>
                    <button 
                      disabled={isAutoSummarizing}
                      onClick={handleAutoSummarizeAll}
                      className="px-2 py-1 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="一键为所有没有摘要的章节生成摘要"
                    >
                      {isAutoSummarizing ? (
                        `一键整理中 ${autoSummarizeProgress.current}/${autoSummarizeProgress.total}`
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" /> 一键整理</>
                      )}
                    </button>
                    <button 
                      disabled={isSummarizingBatch}
                      onClick={() => {
                        setSelectedBatchChapters(chapters.filter(c => !c.summary).map(c => c.id).slice(0, 5));
                        setIsBatchSummarizeModalOpen(true);
                      }}
                      className="px-2 py-1 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isSummarizingBatch ? (
                        `总结中 ${batchProgress.current}/${batchProgress.total}`
                      ) : (
                        <><History className="w-3.5 h-3.5" /> 批量总结</>
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-2 flex-1 overflow-y-auto">
                {Array.from({ length: Math.ceil(chapters.length / chapterGroupSize) }).map((_, groupIndex) => {
                  const start = groupIndex * chapterGroupSize;
                  const end = start + chapterGroupSize;
                  const groupChapters = chapters.slice(start, end);
                  const isExpanded = expandedGroups.includes(groupIndex);
                  
                  return (
                    <div key={groupIndex} className="mb-2">
                      <button 
                        onClick={() => setExpandedGroups(prev => prev.includes(groupIndex) ? prev.filter(i => i !== groupIndex) : [...prev, groupIndex])}
                        className="w-full flex items-center justify-between p-2 bg-[#141414]/5 rounded-lg hover:bg-[#141414]/10 transition-colors"
                      >
                        <span className="text-xs font-bold">第 {start + 1} - {Math.min(end, chapters.length)} 章</span>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-1 space-y-1"
                          >
                            {groupChapters.map(c => (
                              <div key={c.id} className="group flex items-center gap-1">
                                {editingChapterId === c.id ? (
                                  <div className="flex-1 min-w-0 p-2 rounded-lg border border-[#141414]/20 bg-white flex flex-col gap-2">
                                    <input 
                                      autoFocus
                                      value={editChapterTitle}
                                      onChange={(e) => setEditChapterTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateChapterTitle(c.id!);
                                        if (e.key === 'Escape') setEditingChapterId(null);
                                      }}
                                      className="w-full text-sm font-medium focus:outline-none bg-transparent"
                                    />
                                    <div className="flex gap-1 justify-end">
                                      <button onClick={() => handleUpdateChapterTitle(c.id!)} className="px-2 py-1 bg-[#141414] text-[#E4E3E0] text-[10px] rounded">保存</button>
                                      <button onClick={() => setEditingChapterId(null)} className="px-2 py-1 border border-[#141414]/20 text-[10px] rounded">取消</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => setCurrentChapter(c)}
                                      className={cn(
                                        "flex-1 min-w-0 text-left p-3 rounded-lg border border-transparent transition-all",
                                        currentChapter?.id === c.id ? "bg-[#141414] text-[#E4E3E0]" : "hover:border-[#141414]/20"
                                      )}
                                    >
                                      <div className="text-xs opacity-50 mb-1">第 {c.order_index + 1} 章</div>
                                      <div className="font-medium truncate" title={c.title}>{c.title}</div>
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditChapterTitle(c.title);
                                        setEditingChapterId(c.id!);
                                      }}
                                      className="p-2 text-[#141414]/60 opacity-0 group-hover:opacity-100 hover:bg-[#141414]/10 hover:text-[#141414] rounded transition-all shrink-0"
                                      title="编辑标题"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSummarize(c.id);
                                      }}
                                      className="p-2 text-[#141414]/60 opacity-0 group-hover:opacity-100 hover:bg-[#141414]/10 hover:text-[#141414] rounded transition-all shrink-0"
                                      title="总结此章"
                                    >
                                      <Sparkles className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        confirmAction('确定要删除这一章吗？', () => {
                                          fetch(`/api/chapters/${c.id}`, { method: 'DELETE' })
                                            .then(() => {
                                              setChapters(chapters.filter(ch => ch.id !== c.id));
                                              if (currentChapter?.id === c.id) setCurrentChapter(null);
                                            });
                                        });
                                      }}
                                      className="p-2 text-[#141414]/60 opacity-0 group-hover:opacity-100 hover:bg-[#141414]/10 hover:text-[#141414] rounded transition-all shrink-0"
                                      title="删除章节"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                
                {isCreatingChapter ? (
                  <div className="p-3 border border-[#141414]/20 rounded-lg space-y-2">
                    <input 
                      autoFocus
                      value={newChapterTitle}
                      onChange={(e) => setNewChapterTitle(e.target.value)}
                      placeholder="章节标题..."
                      className="w-full p-2 text-sm bg-white border border-[#141414]/10 rounded focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateChapter()}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleCreateChapter} className="flex-1 py-1 bg-[#141414] text-[#E4E3E0] text-xs rounded">确定</button>
                      <button onClick={() => setIsCreatingChapter(false)} className="px-2 py-1 text-xs border border-[#141414]/10 rounded">取消</button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsCreatingChapter(true)}
                    className="w-full p-3 border-2 border-dashed border-[#141414]/20 rounded-lg hover:border-[#141414]/40 flex items-center justify-center gap-2 opacity-60"
                  >
                    <Plus className="w-4 h-4" /> 新建章节
                  </button>
                )}
                </div>
              </motion.div>
            )}

            {activeTab === 'outline' && (
              <motion.div 
                key="outline"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex flex-col h-full"
              >
                <div className="sticky top-0 bg-white z-10 p-4 border-b border-[#141414]/10 flex items-center justify-between">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40">故事大纲</h4>
                  <button 
                    onClick={() => handleUpdateStory()}
                    className="p-1.5 hover:bg-[#141414]/5 rounded text-[#141414]/60 hover:text-[#141414]"
                    title="保存大纲"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                <textarea 
                  value={currentStory.outline || ''}
                  onChange={(e) => setCurrentStory({ ...currentStory, outline: e.target.value })}
                  placeholder="在这里构思您的宏大蓝图..."
                  className="w-full h-[60vh] bg-white/50 border border-[#141414]/5 rounded-xl p-4 text-sm leading-relaxed focus:outline-none focus:ring-1 ring-[#141414]/10 resize-none font-serif"
                />
                <div className="p-4 bg-[#141414]/5 rounded-xl border border-[#141414]/10">
                  <p className="text-[10px] text-[#141414]/80 leading-relaxed">
                    💡 提示：在下方 AI 助手栏中输入您的构思要求，点击“生成大纲”让缪斯为您提供灵感。
                  </p>
                </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'characters' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex flex-col h-full"
              >
                <div className="sticky top-0 bg-white z-10 p-4 border-b border-[#141414]/10 flex items-center justify-between">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40">角色列表</h4>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsCreatingCharacter(true)}
                      className="px-2 py-1.5 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors"
                      title="添加角色"
                    >
                      <Plus className="w-3.5 h-3.5" /> 添加
                    </button>
                    <button 
                      onClick={() => setAiGenerateModal('character')}
                      className="px-2 py-1.5 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors"
                      title="AI 生成角色"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> 生成
                    </button>
                    <button 
                      onClick={() => setBatchGenerateModal('character')}
                      className="px-2 py-1.5 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors"
                      title="批量读取摘要生成角色"
                    >
                      <History className="w-3.5 h-3.5" /> 批量生成
                    </button>
                    <button 
                      onClick={() => {
                        setMergeModal('character');
                        setSelectedMergeItems([]);
                      }}
                      disabled={isAiGenerating || characters.length === 0}
                      className="px-2 py-1.5 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="选择同名或重复的角色设定进行合并"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> 去重
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {isCreatingCharacter && (
                  <div className="p-4 border border-[#141414]/20 rounded-xl space-y-3 bg-white">
                    <input 
                      placeholder="角色姓名"
                      value={newCharacter.name}
                      onChange={e => setNewCharacter({...newCharacter, name: e.target.value})}
                      className="w-full p-2 text-sm border rounded"
                    />
                    <textarea 
                      placeholder="角色描述"
                      value={newCharacter.description}
                      onChange={e => setNewCharacter({...newCharacter, description: e.target.value})}
                      className="w-full p-2 text-sm border rounded h-20"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleAddCharacter} className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] text-xs rounded font-bold">保存角色</button>
                      <button onClick={() => setIsCreatingCharacter(false)} className="px-3 py-2 text-xs border rounded">取消</button>
                    </div>
                  </div>
                )}

                {characters.map((char, idx) => (
                  <div key={idx} className="space-y-1">
                    {editingCharacterId === char.id ? (
                      <div className="p-4 border border-[#141414]/20 rounded-xl space-y-3 bg-white">
                        <input 
                          placeholder="角色姓名"
                          value={editCharacter?.name}
                          onChange={e => setEditCharacter({...editCharacter!, name: e.target.value})}
                          className="w-full p-2 text-sm border rounded"
                        />
                        <textarea 
                          placeholder="角色描述"
                          value={editCharacter?.description}
                          onChange={e => setEditCharacter({...editCharacter!, description: e.target.value})}
                          className="w-full p-2 text-sm border rounded h-20"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleUpdateCharacter} className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] text-xs rounded font-bold">保存修改</button>
                          <button onClick={() => setEditingCharacterId(null)} className="px-3 py-2 text-xs border rounded">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-[#141414]/5 rounded-xl border border-[#141414]/10 relative group">
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCharacterId(char.id!);
                              setEditCharacter(char);
                            }}
                            className="p-1 text-[#141414]/60 hover:bg-[#141414]/10 hover:text-[#141414] rounded"
                            title="编辑角色"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmAction('确定要删除这个角色吗？', () => {
                                fetch(`/api/characters/${char.id}`, { method: 'DELETE' })
                                  .then(() => setCharacters(characters.filter(c => c.id !== char.id)));
                              });
                            }}
                            className="p-1 text-[#141414]/60 hover:bg-[#141414]/10 hover:text-[#141414] rounded"
                            title="删除角色"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h4 className="font-bold text-lg pr-16">{char.name}</h4>
                        <p className="text-sm opacity-70 mt-1 line-clamp-2">{char.description}</p>
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'lore' && (
              <motion.div 
                key="lore"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex flex-col h-full"
              >
                <div className="sticky top-0 bg-white z-10 p-4 border-b border-[#141414]/10 flex items-center justify-between">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40">世界观列表</h4>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsCreatingLore(true)}
                      className="px-2 py-1.5 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors"
                      title="添加设定"
                    >
                      <Plus className="w-3.5 h-3.5" /> 添加
                    </button>
                    <button 
                      onClick={() => setAiGenerateModal('lore')}
                      className="px-2 py-1.5 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors"
                      title="AI 生成设定"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> 生成
                    </button>
                    <button 
                      onClick={() => setBatchGenerateModal('lore')}
                      className="px-2 py-1.5 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors"
                      title="批量读取摘要生成设定"
                    >
                      <History className="w-3.5 h-3.5" /> 批量生成
                    </button>
                    <button 
                      onClick={() => {
                        setMergeModal('lore');
                        setSelectedMergeItems([]);
                      }}
                      disabled={isAiGenerating || lore.length === 0}
                      className="px-2 py-1.5 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-md text-xs font-bold text-[#141414]/80 hover:text-[#141414] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="选择同名或重复的世界观设定进行合并"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> 去重
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {isCreatingLore && (
                  <div className="p-4 border border-[#141414]/20 rounded-xl space-y-3 bg-white">
                    <input 
                      placeholder="设定名称 (如: 魔法体系)"
                      value={newLore.key}
                      onChange={e => setNewLore({...newLore, key: e.target.value})}
                      className="w-full p-2 text-sm border rounded"
                    />
                    <textarea 
                      placeholder="设定详情..."
                      value={newLore.content}
                      onChange={e => setNewLore({...newLore, content: e.target.value})}
                      className="w-full p-2 text-sm border rounded h-24"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleAddLore} className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] text-xs rounded font-bold">保存设定</button>
                      <button onClick={() => setIsCreatingLore(false)} className="px-3 py-2 text-xs border rounded">取消</button>
                    </div>
                  </div>
                )}

                {lore.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    {editingLoreId === item.id ? (
                      <div className="p-4 border border-[#141414]/20 rounded-xl space-y-3 bg-white">
                        <input 
                          placeholder="设定名称 (如: 魔法体系)"
                          value={editLore?.key}
                          onChange={e => setEditLore({...editLore!, key: e.target.value})}
                          className="w-full p-2 text-sm border rounded"
                        />
                        <textarea 
                          placeholder="设定详情..."
                          value={editLore?.content}
                          onChange={e => setEditLore({...editLore!, content: e.target.value})}
                          className="w-full p-2 text-sm border rounded h-24"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleUpdateLore} className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] text-xs rounded font-bold">保存修改</button>
                          <button onClick={() => setEditingLoreId(null)} className="px-3 py-2 text-xs border rounded">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-[#141414]/5 rounded-xl border border-[#141414]/10 relative group">
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLoreId(item.id!);
                              setEditLore(item);
                            }}
                            className="p-1 text-[#141414]/60 hover:bg-[#141414]/10 hover:text-[#141414] rounded"
                            title="编辑设定"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmAction('确定要删除这个设定吗？', () => {
                                fetch(`/api/lore/${item.id}`, { method: 'DELETE' })
                                  .then(() => setLore(lore.filter(l => l.id !== item.id)));
                              });
                            }}
                            className="p-1 text-[#141414]/60 hover:bg-[#141414]/10 hover:text-[#141414] rounded"
                            title="删除设定"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mb-2 pr-16">
                          <span className="text-[10px] uppercase tracking-widest bg-[#141414] text-[#E4E3E0] px-2 py-0.5 rounded-full">{item.category}</span>
                          <span className="font-mono text-xs font-bold">{item.key}</span>
                        </div>
                        <p className="text-sm opacity-70">{item.content}</p>
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Main Editor */}
      <main className="flex-1 flex flex-col relative bg-[#F5F5F3]">
        <header className="h-16 border-b border-[#141414]/10 flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#141414]/5 rounded"
            >
              {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            {currentChapter && (
              <div className="flex-1 flex items-center gap-2 mx-4 min-w-0">
                <textarea 
                  value={currentChapter.title}
                  onChange={(e) => {
                    setCurrentChapter({ ...currentChapter, title: e.target.value });
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onFocus={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  rows={1}
                  className="bg-transparent font-serif italic text-xl focus:outline-none border-b border-transparent focus:border-[#141414]/20 w-full resize-none overflow-hidden py-1"
                  style={{ height: 'auto', minHeight: '36px' }}
                  title={currentChapter.title}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleSaveChapter()}
              className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-[#E4E3E0] rounded-full text-sm font-bold hover:scale-105 transition-transform"
            >
              <Save className="w-4 h-4" /> 保存
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex">
          {currentChapter ? (
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Original Content */}
              <div className="flex-1 overflow-y-auto p-12 border-r border-[#141414]/5 bg-white">
                <div className="max-w-2xl mx-auto">
                  <textarea 
                    ref={editorRef}
                    value={currentChapter.content}
                    onChange={(e) => setCurrentChapter({ ...currentChapter, content: e.target.value })}
                    placeholder="很久很久以前..."
                    className="w-full h-full min-h-[70vh] bg-transparent font-serif text-xl leading-relaxed focus:outline-none resize-none placeholder:opacity-20"
                  />
                </div>
              </div>
              
              {/* Right: Summary/Abstract */}
              <div className="w-80 bg-[#F5F5F3] overflow-y-auto p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">章节摘要</h4>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleSaveChapter()}
                      className="p-1.5 hover:bg-[#141414]/5 rounded text-[#141414]/60 hover:text-[#141414]"
                      title="保存摘要"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleSummarize(currentChapter.id)}
                      className="p-1.5 hover:bg-[#141414]/5 rounded text-[#141414]/60 hover:text-[#141414]"
                      title="AI 生成摘要"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <textarea 
                  value={currentChapter.summary || ''}
                  onChange={(e) => setCurrentChapter({ ...currentChapter, summary: e.target.value })}
                  placeholder="本章主要讲述了..."
                  className="w-full flex-1 bg-white/50 border border-[#141414]/5 rounded-xl p-4 text-sm leading-relaxed focus:outline-none focus:ring-1 ring-[#141414]/10 resize-none"
                />
                <p className="text-[10px] opacity-40 italic">摘要将作为 AI 的长期记忆，帮助保持故事连贯性。</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#141414]/20">
              <Book className="w-24 h-24 mb-4" />
              <p className="text-2xl font-serif italic">选择或创建一个章节开始创作。</p>
            </div>
          )}
        </div>

        {/* AI Assistant Bar */}
        <AnimatePresence>
          {currentStory && (
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="p-6 bg-white border-t border-[#141414]/10 shadow-2xl"
            >
              <div className="max-w-4xl mx-auto space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-xs font-bold opacity-60">
                    <Sparkles className="w-3 h-3" />
                    <span>当前模型:</span>
                    <span className="bg-[#141414] text-[#E4E3E0] px-2 py-0.5 rounded">
                      {getActiveModelConfig()?.name || '默认 Gemini'}
                    </span>
                    {(selectedContextChapters.length > 0 || selectedContextCharacters.length > 0 || selectedContextLore.length > 0) && (
                      <button 
                        onClick={() => {
                          setSelectedContextChapters([]);
                          setSelectedContextCharacters([]);
                          setSelectedContextLore([]);
                        }}
                        className="ml-2 text-[#141414]/60 hover:text-[#141414] hover:underline"
                      >
                        清除已选上下文 ({selectedContextChapters.length + selectedContextCharacters.length + selectedContextLore.length})
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-[10px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 transition-opacity"
                  >
                    切换模型/设置
                  </button>
                </div>
                
                <div className="flex items-end gap-4">
                  <div className="flex-1 relative">
                    <textarea 
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder={activeTab === 'outline' ? "描述您想要的大纲要求..." : "向缪斯寻求灵感、续写或润色..."}
                      className="w-full p-4 pr-12 bg-[#141414]/5 rounded-2xl focus:outline-none focus:ring-2 ring-[#141414]/10 resize-none h-24"
                    />
                    <div className="absolute top-4 right-4 text-[#141414]/20">
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setIsContextSelectorOpen(true)}
                      title="选择上下文（摘要、角色等）"
                      className={cn(
                        "p-3 rounded-xl transition-colors",
                        (selectedContextChapters.length > 0 || selectedContextCharacters.length > 0 || selectedContextLore.length > 0)
                          ? "bg-[#141414] text-[#E4E3E0]" 
                          : "bg-[#141414]/5 hover:bg-[#141414]/10"
                      )}
                    >
                      <History className="w-5 h-5" />
                    </button>
                    {activeTab === 'chapters' && currentChapter && (
                      <button 
                        onClick={handleExtractLore}
                        title="提取世界观设定"
                        className="p-3 bg-[#141414]/5 hover:bg-[#141414]/10 rounded-xl transition-colors"
                      >
                        <Globe className="w-5 h-5" />
                      </button>
                    )}
                    <button 
                      disabled={isGenerating}
                      onClick={activeTab === 'outline' ? handleGenerateOutline : handleAiAssist}
                      className={cn(
                        "p-4 bg-[#141414] text-[#E4E3E0] rounded-2xl font-bold flex items-center gap-2 transition-all",
                        isGenerating ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
                      )}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          思考中...
                        </>
                      ) : (
                        activeTab === 'outline' ? <><Plus className="w-5 h-5" /> 生成大纲</> : <><Sparkles className="w-5 h-5" /> 召唤缪斯</>
                      )}
                    </button>
                    {activeTab === 'outline' && (
                      <button 
                        disabled={isGenerating}
                        onClick={handleGenerateStoryFromOutline}
                        className={cn(
                          "p-4 border-2 border-[#141414] text-[#141414] rounded-2xl font-bold flex items-center gap-2 transition-all",
                          isGenerating ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
                        )}
                      >
                        {isGenerating ? (
                          <>
                            <div className="w-5 h-5 border-2 border-[#141414]/20 border-t-[#141414] rounded-full animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <><BookOpen className="w-5 h-5" /> 直接生成故事</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {renderSettingsModal()}

      {/* AI Generate Modal */}
      <AnimatePresence>
        {aiGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAiGenerateModal(null)}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#E4E3E0] rounded-3xl shadow-2xl overflow-hidden border border-[#141414]/10"
            >
              <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between bg-white/50">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5" /> AI 辅助生成{aiGenerateModal === 'character' ? '角色' : '设定'}
                </h3>
                <button onClick={() => setAiGenerateModal(null)} className="p-2 hover:bg-[#141414]/5 rounded-full">
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4" /> 附加提示词/自定义描述 (可选)
                    </h4>
                    <textarea
                      placeholder={`例如：生成一个使用火焰魔法的反派角色...`}
                      value={aiGeneratePrompt}
                      onChange={(e) => setAiGeneratePrompt(e.target.value)}
                      className="w-full p-3 text-sm border border-[#141414]/20 rounded-xl h-24 focus:outline-none focus:border-[#141414]/50 transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> 选择要参考的章节摘要 (可选)
                      </h4>
                      <button 
                        onClick={() => setSelectedAiGenerateChapters(selectedAiGenerateChapters.length === chapters.length ? [] : chapters.map(c => c.id!))}
                        className="text-[10px] font-bold opacity-40 hover:opacity-100"
                      >
                        {selectedAiGenerateChapters.length === chapters.length ? '取消全选' : '全选'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {chapters.map(c => (
                        <label key={c.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#141414]/10 cursor-pointer hover:border-[#141414]/30 transition-all">
                          <input 
                            type="checkbox"
                            checked={selectedAiGenerateChapters.includes(c.id!)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAiGenerateChapters([...selectedAiGenerateChapters, c.id!]);
                              } else {
                                setSelectedAiGenerateChapters(selectedAiGenerateChapters.filter(id => id !== c.id));
                              }
                            }}
                            className="w-4 h-4 accent-[#141414]"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">第 {c.order_index + 1} 章: {c.title}</div>
                            {c.summary ? (
                              <div className="text-xs opacity-60 mt-1 line-clamp-1">{c.summary}</div>
                            ) : (
                              <div className="text-xs text-red-500 mt-1">无摘要，将使用正文前500字</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/50 border-t border-[#141414]/10 flex justify-end gap-3">
                <button 
                  onClick={() => setAiGenerateModal(null)}
                  className="px-6 py-2 border border-[#141414]/10 rounded-xl font-bold hover:bg-[#141414]/5 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleAiGenerate}
                  disabled={(selectedAiGenerateChapters.length === 0 && !aiGeneratePrompt.trim()) || isAiGenerating}
                  className="px-6 py-2 bg-[#141414] text-[#E4E3E0] rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                  {isAiGenerating ? (
                    <><div className="w-4 h-4 border-2 border-[#E4E3E0]/20 border-t-[#E4E3E0] rounded-full animate-spin"></div> 生成中...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> 开始生成</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Generate Modal */}
      <AnimatePresence>
        {batchGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !batchGenerateProgress.isRunning && setBatchGenerateModal(null)}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#E4E3E0] rounded-3xl shadow-2xl overflow-hidden border border-[#141414]/10"
            >
              <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between bg-white/50">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <History className="w-5 h-5" /> 批量生成{batchGenerateModal === 'character' ? '角色' : '设定'}
                </h3>
                {!batchGenerateProgress.isRunning && (
                  <button onClick={() => setBatchGenerateModal(null)} className="p-2 hover:bg-[#141414]/5 rounded-full">
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                )}
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">开始章节 (第几章)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max={chapters.length} 
                      value={batchGenerateConfig.start}
                      onChange={(e) => setBatchGenerateConfig({...batchGenerateConfig, start: parseInt(e.target.value) || 1})}
                      className="w-full p-3 bg-white border border-[#141414]/20 rounded-xl focus:outline-none focus:border-[#141414]"
                      disabled={batchGenerateProgress.isRunning}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">结束章节 (第几章)</label>
                    <input 
                      type="number" 
                      min={batchGenerateConfig.start} 
                      max={chapters.length} 
                      value={batchGenerateConfig.end}
                      onChange={(e) => setBatchGenerateConfig({...batchGenerateConfig, end: parseInt(e.target.value) || chapters.length})}
                      className="w-full p-3 bg-white border border-[#141414]/20 rounded-xl focus:outline-none focus:border-[#141414]"
                      disabled={batchGenerateProgress.isRunning}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">每批处理章节数</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="20" 
                      value={batchGenerateConfig.size}
                      onChange={(e) => setBatchGenerateConfig({...batchGenerateConfig, size: parseInt(e.target.value) || 5})}
                      className="w-full p-3 bg-white border border-[#141414]/20 rounded-xl focus:outline-none focus:border-[#141414]"
                      disabled={batchGenerateProgress.isRunning}
                    />
                    <p className="text-xs opacity-60 mt-2">
                      系统将把选定范围内的章节，每 {batchGenerateConfig.size} 章合并在一起发送给 AI 进行总结。
                    </p>
                  </div>
                </div>

                {batchGenerateProgress.isRunning && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span>处理进度</span>
                      <span>{batchGenerateProgress.current} / {batchGenerateProgress.total} 批</span>
                    </div>
                    <div className="h-2 bg-[#141414]/10 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-[#141414]"
                        initial={{ width: 0 }}
                        animate={{ width: `${(batchGenerateProgress.current / batchGenerateProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white/50 border-t border-[#141414]/10 flex justify-end gap-3">
                <button 
                  onClick={() => setBatchGenerateModal(null)}
                  disabled={batchGenerateProgress.isRunning}
                  className="px-6 py-2 border border-[#141414]/10 rounded-xl font-bold hover:bg-[#141414]/5 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button 
                  onClick={handleStartBatchGenerate}
                  disabled={batchGenerateProgress.isRunning}
                  className="px-6 py-2 bg-[#141414] text-[#E4E3E0] rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                  {batchGenerateProgress.isRunning ? (
                    <><div className="w-4 h-4 border-2 border-[#E4E3E0]/20 border-t-[#E4E3E0] rounded-full animate-spin"></div> 处理中...</>
                  ) : (
                    <><History className="w-4 h-4" /> 开始批量生成</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Merge Modal */}
      <AnimatePresence>
        {mergeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isAiGenerating && setMergeModal(null)}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#E4E3E0] rounded-3xl shadow-2xl overflow-hidden border border-[#141414]/10 flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between bg-white/50 shrink-0">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Wand2 className="w-5 h-5" /> 选择要合并的重复{mergeModal === 'character' ? '角色' : '设定'}
                </h3>
                {!isAiGenerating && (
                  <button onClick={() => setMergeModal(null)} className="p-2 hover:bg-[#141414]/5 rounded-full">
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                )}
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-[#F5F5F3]">
                <div className="mb-4 space-y-4">
                  <p className="text-sm opacity-60">请勾选需要合并的重复项，AI 将提取它们的信息并合并为一个完整的设定。</p>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                      <input 
                        type="text"
                        placeholder={`搜索${mergeModal === 'character' ? '角色' : '设定'}名称...`}
                        value={mergeSearchQuery}
                        onChange={(e) => setMergeSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-[#141414]/10 rounded-xl focus:outline-none focus:border-[#141414]/30"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const items = mergeModal === 'character' ? characters : lore;
                        const nameCount = new Map<string, number>();
                        items.forEach((item: any) => {
                          const name = mergeModal === 'character' ? item.name : item.key;
                          nameCount.set(name, (nameCount.get(name) || 0) + 1);
                        });
                        const duplicateIds = items.filter((item: any) => {
                          const name = mergeModal === 'character' ? item.name : item.key;
                          return nameCount.get(name)! > 1;
                        }).map((item: any) => item.id!);
                        
                        const newSelection = new Set([...selectedMergeItems, ...duplicateIds]);
                        setSelectedMergeItems(Array.from(newSelection));
                      }}
                      className="text-xs font-bold text-[#141414] px-3 py-2 bg-[#141414]/5 hover:bg-[#141414]/10 border border-[#141414]/10 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1"
                      title="自动找出并勾选所有名称完全相同的项目"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      一键选中重名项
                    </button>
                    <button 
                      onClick={() => {
                        const items = mergeModal === 'character' ? characters : lore;
                        const filteredItems = items.filter((item: any) => {
                          const name = mergeModal === 'character' ? item.name : item.key;
                          return name.toLowerCase().includes(mergeSearchQuery.toLowerCase());
                        });
                        const allFilteredIds = filteredItems.map(i => i.id!);
                        
                        // Check if all filtered items are already selected
                        const allSelected = allFilteredIds.every(id => selectedMergeItems.includes(id));
                        
                        if (allSelected) {
                          // Deselect all filtered items
                          setSelectedMergeItems(selectedMergeItems.filter(id => !allFilteredIds.includes(id)));
                        } else {
                          // Select all filtered items (keeping previously selected ones)
                          const newSelection = new Set([...selectedMergeItems, ...allFilteredIds]);
                          setSelectedMergeItems(Array.from(newSelection));
                        }
                      }}
                      className="text-xs font-bold opacity-60 hover:opacity-100 px-3 py-2 bg-white border border-[#141414]/10 rounded-xl whitespace-nowrap"
                    >
                      全选/取消全选 (当前列表)
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(mergeModal === 'character' ? characters : lore)
                    .filter((item: any) => {
                      if (!mergeSearchQuery) return true;
                      const name = mergeModal === 'character' ? item.name : item.key;
                      return name.toLowerCase().includes(mergeSearchQuery.toLowerCase());
                    })
                    .sort((a: any, b: any) => {
                      // If there's a search query, sort by exact match first, then by name similarity
                      if (mergeSearchQuery) {
                        const nameA = (mergeModal === 'character' ? a.name : a.key).toLowerCase();
                        const nameB = (mergeModal === 'character' ? b.name : b.key).toLowerCase();
                        const query = mergeSearchQuery.toLowerCase();
                        
                        if (nameA === query && nameB !== query) return -1;
                        if (nameB === query && nameA !== query) return 1;
                        
                        // Group similar names together
                        return nameA.localeCompare(nameB);
                      }
                      // Default: keep original order (chronological)
                      return 0;
                    })
                    .map((item: any) => (
                    <label 
                      key={item.id} 
                      className={cn(
                        "flex items-start gap-3 p-4 bg-white rounded-xl border cursor-pointer transition-all",
                        selectedMergeItems.includes(item.id) 
                          ? "border-[#141414] shadow-md" 
                          : "border-[#141414]/10 hover:border-[#141414]/30"
                      )}
                    >
                      <input 
                        type="checkbox"
                        checked={selectedMergeItems.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMergeItems([...selectedMergeItems, item.id]);
                          } else {
                            setSelectedMergeItems(selectedMergeItems.filter(id => id !== item.id));
                          }
                        }}
                        className="mt-1 w-4 h-4 accent-[#141414]"
                        disabled={isAiGenerating}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">
                          {mergeModal === 'character' ? item.name : item.key}
                        </div>
                        <div className="text-xs opacity-60 mt-1 line-clamp-3">
                          {mergeModal === 'character' ? item.description : item.content}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-white/50 border-t border-[#141414]/10 flex justify-between items-center shrink-0">
                <div className="text-sm font-bold opacity-60">
                  已选择 {selectedMergeItems.length} 项
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setMergeModal(null)}
                    disabled={isAiGenerating}
                    className="px-6 py-2 border border-[#141414]/10 rounded-xl font-bold hover:bg-[#141414]/5 transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleAiMerge}
                    disabled={isAiGenerating || selectedMergeItems.length < 2}
                    className="px-6 py-2 bg-[#141414] text-[#E4E3E0] rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                  >
                    {isAiGenerating ? (
                      <><div className="w-4 h-4 border-2 border-[#E4E3E0]/20 border-t-[#E4E3E0] rounded-full animate-spin"></div> 合并中...</>
                    ) : (
                      <><Wand2 className="w-4 h-4" /> 开始合并</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#E4E3E0] rounded-3xl shadow-2xl overflow-hidden border border-[#141414]/10"
            >
              <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between bg-white/50">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Download className="w-5 h-5" /> 导出章节
                </h3>
                <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-[#141414]/5 rounded-full">
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2 mb-2">
                      <Settings className="w-4 h-4" /> 导出选项
                    </h4>
                    <div className="space-y-2 mb-6">
                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#141414]/10 cursor-pointer hover:border-[#141414]/30 transition-all">
                        <input 
                          type="checkbox"
                          checked={exportOptions.summaries}
                          onChange={(e) => setExportOptions({...exportOptions, summaries: e.target.checked})}
                          className="w-4 h-4 accent-[#141414]"
                        />
                        <div className="font-medium text-sm">包含章节摘要</div>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#141414]/10 cursor-pointer hover:border-[#141414]/30 transition-all">
                        <input 
                          type="checkbox"
                          checked={exportOptions.characters}
                          onChange={(e) => setExportOptions({...exportOptions, characters: e.target.checked})}
                          className="w-4 h-4 accent-[#141414]"
                        />
                        <div className="font-medium text-sm">包含角色设定</div>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#141414]/10 cursor-pointer hover:border-[#141414]/30 transition-all">
                        <input 
                          type="checkbox"
                          checked={exportOptions.lore}
                          onChange={(e) => setExportOptions({...exportOptions, lore: e.target.checked})}
                          className="w-4 h-4 accent-[#141414]"
                        />
                        <div className="font-medium text-sm">包含世界设定</div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> 选择要导出的章节
                      </h4>
                      <button 
                        onClick={() => setSelectedExportChapters(selectedExportChapters.length === chapters.length ? [] : chapters.map(c => c.id!))}
                        className="text-[10px] font-bold opacity-40 hover:opacity-100"
                      >
                        {selectedExportChapters.length === chapters.length ? '取消全选' : '全选'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {chapters.map(c => (
                        <label key={c.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#141414]/10 cursor-pointer hover:border-[#141414]/30 transition-all">
                          <input 
                            type="checkbox"
                            checked={selectedExportChapters.includes(c.id!)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExportChapters([...selectedExportChapters, c.id!]);
                              } else {
                                setSelectedExportChapters(selectedExportChapters.filter(id => id !== c.id));
                              }
                            }}
                            className="w-4 h-4 accent-[#141414]"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">第 {c.order_index + 1} 章: {c.title}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/50 border-t border-[#141414]/10 flex justify-end gap-3">
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-6 py-2 border border-[#141414]/10 rounded-xl font-bold hover:bg-[#141414]/5 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleExport}
                  disabled={selectedExportChapters.length === 0}
                  className="px-6 py-2 bg-[#141414] text-[#E4E3E0] rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  导出 ({selectedExportChapters.length})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Summarize Modal */}
      <AnimatePresence>
        {isBatchSummarizeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBatchSummarizeModalOpen(false)}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#E4E3E0] rounded-3xl shadow-2xl overflow-hidden border border-[#141414]/10"
            >
              <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between bg-white/50">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5" /> 批量总结章节
                </h3>
                <button onClick={() => setIsBatchSummarizeModalOpen(false)} className="p-2 hover:bg-[#141414]/5 rounded-full">
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold mb-2 text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> 选择要总结的章节（最多 5 章）
                    </h4>
                    <div className="space-y-2">
                      {chapters.map(c => (
                        <label key={c.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#141414]/10 cursor-pointer hover:border-[#141414]/30 transition-all">
                          <input 
                            type="checkbox"
                            checked={selectedBatchChapters.includes(c.id!)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (selectedBatchChapters.length < 5) {
                                  setSelectedBatchChapters([...selectedBatchChapters, c.id!]);
                                } else {
                                  alert("最多只能选择 5 个章节进行批量总结。");
                                }
                              } else {
                                setSelectedBatchChapters(selectedBatchChapters.filter(id => id !== c.id));
                              }
                            }}
                            className="w-4 h-4 accent-[#141414]"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">第 {c.order_index + 1} 章: {c.title}</div>
                            {c.summary && <div className="text-[10px] text-emerald-600 font-bold mt-1">已有摘要</div>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Context Selection for Summary */}
                  <div className="pt-4 border-t border-[#141414]/10">
                    <h4 className="font-bold mb-2 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> 附加参考上下文 (提高摘要准确度)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <div className="text-xs font-bold opacity-60 mb-2">选择摘要模板</div>
                        <select 
                          value={selectedSummaryTemplate || ''} 
                          onChange={(e) => setSelectedSummaryTemplate(Number(e.target.value))}
                          className="w-full p-2 text-sm border border-[#141414]/10 rounded-lg bg-white"
                        >
                          <option value="" disabled>选择一个模板...</option>
                          {summaryTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs font-bold opacity-60 mb-2">角色特性</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
                          {characters.map(c => (
                            <label key={c.id} className="flex items-center gap-2 text-sm p-1 hover:bg-white rounded cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={selectedContextCharacters.includes(c.id!)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedContextCharacters([...selectedContextCharacters, c.id!]);
                                  else setSelectedContextCharacters(selectedContextCharacters.filter(id => id !== c.id));
                                }}
                                className="accent-[#141414]"
                              />
                              <span className="truncate">{c.name}</span>
                            </label>
                          ))}
                          {characters.length === 0 && <span className="text-xs opacity-40">暂无角色</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold opacity-60 mb-2">世界设定</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
                          {lore.map(l => (
                            <label key={l.id} className="flex items-center gap-2 text-sm p-1 hover:bg-white rounded cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={selectedContextLore.includes(l.id!)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedContextLore([...selectedContextLore, l.id!]);
                                  else setSelectedContextLore(selectedContextLore.filter(id => id !== l.id));
                                }}
                                className="accent-[#141414]"
                              />
                              <span className="truncate">{l.key}</span>
                            </label>
                          ))}
                          {lore.length === 0 && <span className="text-xs opacity-40">暂无设定</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/50 border-t border-[#141414]/10 flex justify-end gap-3">
                <button 
                  onClick={() => setIsBatchSummarizeModalOpen(false)}
                  className="px-6 py-2 border border-[#141414]/10 rounded-xl font-bold hover:bg-[#141414]/5 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleBatchSummarize}
                  disabled={selectedBatchChapters.length === 0}
                  className="px-6 py-2 bg-[#141414] text-[#E4E3E0] rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  开始总结 ({selectedBatchChapters.length})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Context Selector Modal */}
      <AnimatePresence>
        {isContextSelectorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsContextSelectorOpen(false)}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#E4E3E0] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-[#141414]/10 flex items-center justify-between bg-white/50">
                <div>
                  <h2 className="text-2xl font-serif italic">上下文选择器</h2>
                  <p className="text-xs opacity-50 uppercase tracking-widest mt-1">选择要导入 AI 提示词的背景信息</p>
                </div>
                <button 
                  onClick={() => setIsContextSelectorOpen(false)}
                  className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Outline Section */}
                <section className="space-y-4">
                  <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">故事大纲</h4>
                  <div 
                    onClick={() => setSelectedContextOutline(!selectedContextOutline)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all text-sm",
                      selectedContextOutline ? "bg-[#141414] text-[#E4E3E0] border-transparent shadow-lg" : "bg-white border-[#141414]/5 hover:border-[#141414]/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold">导入故事大纲</div>
                      {selectedContextOutline && <Sparkles className="w-4 h-4" />}
                    </div>
                    <p className="text-xs opacity-50 mt-1 line-clamp-2">{currentStory.outline || '暂无大纲'}</p>
                  </div>
                </section>

                {/* Chapters Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">章节摘要 (长期记忆)</h4>
                    <button 
                      onClick={() => setSelectedContextChapters(selectedContextChapters.length === chapters.length ? [] : chapters.map(c => c.id))}
                      className="text-[10px] font-bold opacity-40 hover:opacity-100"
                    >
                      {selectedContextChapters.length === chapters.length ? '取消全选' : '全选'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {chapters.map(c => (
                      <div 
                        key={c.id}
                        onClick={() => setSelectedContextChapters(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                        className={cn(
                          "p-3 rounded-xl border cursor-pointer transition-all text-sm",
                          selectedContextChapters.includes(c.id) ? "bg-[#141414] text-[#E4E3E0] border-transparent" : "bg-white border-[#141414]/5 hover:border-[#141414]/20"
                        )}
                      >
                        <div className="font-bold truncate">{c.title}</div>
                        <div className="text-[10px] opacity-50 truncate">{c.summary || '暂无摘要'}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Characters Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">角色设定</h4>
                    <button 
                      onClick={() => setSelectedContextCharacters(selectedContextCharacters.length === characters.length ? [] : characters.map(c => c.id!))}
                      className="text-[10px] font-bold opacity-40 hover:opacity-100"
                    >
                      {selectedContextCharacters.length === characters.length ? '取消全选' : '全选'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {characters.map(c => (
                      <button 
                        key={c.id}
                        onClick={() => setSelectedContextCharacters(prev => prev.includes(c.id!) ? prev.filter(id => id !== c.id) : [...prev, c.id!])}
                        className={cn(
                          "px-4 py-2 rounded-full border text-xs font-bold transition-all",
                          selectedContextCharacters.includes(c.id!) ? "bg-[#141414] text-[#E4E3E0] border-transparent" : "bg-white border-[#141414]/5 hover:border-[#141414]/20"
                        )}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Lore Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">世界观设定</h4>
                    <button 
                      onClick={() => setSelectedContextLore(selectedContextLore.length === lore.length ? [] : lore.map(l => l.id!))}
                      className="text-[10px] font-bold opacity-40 hover:opacity-100"
                    >
                      {selectedContextLore.length === lore.length ? '取消全选' : '全选'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lore.map(l => (
                      <button 
                        key={l.id}
                        onClick={() => setSelectedContextLore(prev => prev.includes(l.id!) ? prev.filter(id => id !== l.id) : [...prev, l.id!])}
                        className={cn(
                          "px-4 py-2 rounded-full border text-xs font-bold transition-all",
                          selectedContextLore.includes(l.id!) ? "bg-[#141414] text-[#E4E3E0] border-transparent" : "bg-white border-[#141414]/5 hover:border-[#141414]/20"
                        )}
                      >
                        {l.key}
                      </button>
                    ))}
                  </div>
                </section>
                {/* Style Tags Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-widest font-bold opacity-40">风格标签</h4>
                    <button 
                      onClick={() => setSelectedContextStyleTags(selectedContextStyleTags.length === styleTags.length ? [] : styleTags.map(t => t.id!))}
                      className="text-[10px] font-bold opacity-40 hover:opacity-100"
                    >
                      {selectedContextStyleTags.length === styleTags.length ? '取消全选' : '全选'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {styleTags.map(t => (
                      <button 
                        key={t.id}
                        onClick={() => setSelectedContextStyleTags(prev => prev.includes(t.id!) ? prev.filter(id => id !== t.id) : [...prev, t.id!])}
                        className={cn(
                          "px-4 py-2 rounded-full border text-xs font-bold transition-all",
                          selectedContextStyleTags.includes(t.id!) ? "bg-[#141414] text-[#E4E3E0] border-transparent" : "bg-white border-[#141414]/5 hover:border-[#141414]/20"
                        )}
                        title={t.description}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-6 bg-white/50 border-t border-[#141414]/10 flex justify-end">
                <button 
                  onClick={() => setIsContextSelectorOpen(false)}
                  className="px-8 py-3 bg-[#141414] text-[#E4E3E0] rounded-xl font-bold hover:scale-105 transition-transform"
                >
                  确认选择
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {renderConfirmDialog()}
    </div>
  );
}
