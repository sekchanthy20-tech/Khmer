import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload, FileText, Table as TableIcon, BrainCircuit, Download, Trash2, Plus, Minus,
  ChevronRight, BookOpen, Calculator, Languages, History, Loader2, CheckCircle2,
  Settings, Edit3, Share2, X, Menu, Zap, Book, FolderOpen, CheckSquare, Triangle,
  BarChart, Hash, Activity, FlaskConical, Dna, Map, Heart
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Markdown from 'react-markdown';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==========================================
//  KEY ROTATION HELPERS
// ==========================================
const getGeminiKeys = (): string[] => {
    const metaEnv = (import.meta as any).env;
    // Looks for VITE_GEMINI_API_KEYS first, then fallback to VITE_GEMINI_API_KEY
    const envKeys = metaEnv.VITE_GEMINI_API_KEYS || metaEnv.VITE_GEMINI_API_KEY || "";
    return envKeys.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
};

function isQuotaError(error: any): boolean {
    const msg = error?.message?.toLowerCase() || "";
    return msg.includes("quota") || msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("limit");
}

// --- Types ---
type ExerciseType = 'MCQ' | 'Critical Thinking' | 'Fill-in-blank' | 'Complete the sentences' | 'Math' | 'Speaking';
interface ExerciseConfig { id: string; label: string; rule: string; description?: string; selected: boolean; active?: boolean; itemCount: number; columns: number; subject: string; icon?: string; }
interface Question { id: string; type: string; module_label: string; question: string; options?: string[]; answer: string; explanation?: string; layout_columns: number; options_layout?: 'single' | 'double' | 'vertical'; image_prompt?: string; image_url?: string; }
interface MasterProtocol { id: string; title: string; description: string; category: 'General' | 'Grammar' | 'Vocabulary' | 'Reading'; active: boolean; level: 'Low' | 'Medium' | 'High'; }
interface StrictRule { id: string; title: string; description: string; active: boolean; }
interface TestConfig { numberStyle: 'Khmer' | 'Roman'; showAnswerKeys: boolean; font: string; fontSize: string; exerciseConfigs: ExerciseConfig[]; strictRules: StrictRule[]; protocols: MasterProtocol[]; }
interface TestData { id?: string; title: string; subject: string; grade: string; language: string; config: TestConfig; questions: Question[]; source_text?: string; created_at?: string; }
interface BrandSettings { schoolName: string; schoolAddress: string; fontSize: number; fontWeight: string; letterSpacing: number; textTransform: string; logoWidth: number; logoData: string; }

// --- Constants ---
const SUBJECTS = ['Khmer', 'Math', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Moral-Civics', 'English', 'ICT'];
const LANGUAGES = ['English', 'Khmer', 'Chinese', 'Korean', 'French'];
const KHMER_FONTS = ['Khmer OS Siemreap', 'Khmer OS Muol Light', 'Khmer OS Battambang', 'Khmer OS Freehand', 'Khmer OS Fasthand'];
const DEFAULT_BRAND_SETTINGS: BrandSettings = { schoolName: "DPSS ULTIMATE TEST BUILDER", schoolAddress: "Developing Potential for Success School", fontSize: 12, fontWeight: "800", letterSpacing: 0, textTransform: "none", logoWidth: 300, logoData: "" };

const INITIAL_EXERCISE_TYPES: ExerciseConfig[] = [
  { id: 'kh_reading', subject: 'Khmer', label: 'អំណាន (Reading)', rule: 'Comprehension questions.', selected: true, itemCount: 5, columns: 1 },
  { id: 'kh_vocab', subject: 'Khmer', label: 'វាក្យសព្ទ (Vocabulary)', rule: 'Synonyms, antonyms.', selected: true, itemCount: 5, columns: 1 },
  { id: 'kh_grammar', subject: 'Khmer', label: 'វេយ្យាករណ៍ (Grammar)', rule: 'Parts of speech.', selected: true, itemCount: 5, columns: 1 },
  { id: 'ma_calc', subject: 'Math', label: 'គណនា (Calculation)', rule: 'Arithmetic using LaTeX.', selected: true, itemCount: 10, columns: 1 },
  { id: 'ma_prob', subject: 'Math', label: 'ចំណោទ (Word Problems)', rule: 'Real-world math problems.', selected: true, itemCount: 5, columns: 1 },
  { id: 'ma_mcq', subject: 'Math', label: 'ជ្រើសរើសចម្លើយ (MCQ)', rule: 'Math MCQ with LaTeX.', selected: true, itemCount: 10, columns: 1 }
];

const INITIAL_PROTOCOLS: MasterProtocol[] = [
  { id: 'p1', title: 'HIGH-FIDELITY POOLING', description: 'GENERATE NEAR-MISS DISTRACTORS.', category: 'General', active: true, level: 'Medium' },
  { id: 'p4', title: 'SEMANTIC PRECISION', description: 'MATCH MoEYS TERMINOLOGY EXACTLY.', category: 'Reading', active: true, level: 'High' }
];

const INITIAL_STRICT_RULES: StrictRule[] = [
  { id: 'r1', title: 'NO DUPLICATES', description: 'Unique questions only.', active: true },
  { id: 'r4', title: 'KHMER NAMES POLICY', description: 'Use proper Khmer names.', active: true }
];

const getOptionLabel = (index: number, style: 'Khmer' | 'Roman') => {
  const KHMER_MCQ_LABELS = ['ក', 'ខ', 'គ', 'ឃ', 'ង', 'ច'];
  return style === 'Khmer' ? (KHMER_MCQ_LABELS[index] || String.fromCharCode(65 + index)) : String.fromCharCode(65 + index);
};

const cleanOptionText = (text: string) => text.replace(/^[A-Zក-ឃ0-9][\.\)]\s*/i, '').trim();

function generateHumanBalancedKey(count: number): string[] {
  const letters = ['A', 'B', 'C', 'D'];
  const pool = Array.from({ length: count }, (_, i) => letters[i % 4]);
  return pool.sort(() => Math.random() - 0.5);
}

// ==========================================
//  ROTATED AI GENERATION SERVICE
// ==========================================
const generateTest = async (
  subject: string, grade: string, language: string, config: TestConfig,
  sourceContent: { text?: string; inlineData?: { data: string; mimeType: string }[] }
) => {
  const availableKeys = getGeminiKeys();
  if (availableKeys.length === 0) throw new Error("API Keys missing. Add VITE_GEMINI_API_KEYS to Vercel.");

  const activeProtocols = config.protocols.filter(p => p.active).map(p => `- ${p.title}`).join('\n');
  const moduleRequirements = config.exerciseConfigs.map(ex => `- ${ex.label}: ${ex.itemCount} items.`).join('\n');
  const totalItems = config.exerciseConfigs.reduce((sum, ex) => sum + ex.itemCount, 0);
  const balancedKeys = generateHumanBalancedKey(totalItems);

  const prompt = `SUBJECT: ${subject}, GRADE: ${grade}. Generate ${totalItems} items. MoEYS Standard. 
    Use these answer keys in order: ${balancedKeys.join(', ')}.
    ${moduleRequirements}
    ${activeProtocols}`;

  const parts: any[] = [{ text: prompt }];
  if (sourceContent.inlineData) sourceContent.inlineData.forEach(d => parts.push({ inlineData: d }));
  else if (sourceContent.text) parts.push({ text: `SOURCE: ${sourceContent.text}` });

  // --- ROTATION LOOP ---
  for (let i = 0; i < availableKeys.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: availableKeys[i] });
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

      const response = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              source_text: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING },
                    module_label: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    layout_columns: { type: Type.NUMBER },
                    options_layout: { type: Type.STRING },
                    image_prompt: { type: Type.STRING }
                  },
                  required: ["id", "question", "answer"]
                }
              }
            },
            required: ["title", "questions"]
          }
        }
      });

      const resText = response.response.text();
      return JSON.parse(resText);

    } catch (error: any) {
      if (isQuotaError(error) && i < availableKeys.length - 1) {
        console.warn(`Key #${i+1} exhausted. Rotating...`);
        continue;
      }
      throw new Error(`AI Generation Failed: ${error.message}`);
    }
  }
};

const generateImage = async (prompt: string) => {
  const keys = getGeminiKeys();
  if (keys.length === 0) return null;
  
  for (const key of keys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" }); // Fallback to flash if Pro Vision not avail
      const result = await model.generateContent(prompt);
      // Logic for image data handling would go here if using Imagen
      return null; 
    } catch (e) { continue; }
  }
  return null;
};

// ==========================================
//  MAIN APP COMPONENT
// ==========================================
const MathMarkdown = ({ content }: { content: string }) => {
  if (!content) return null;
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return (
    <div className="markdown-body">
      {parts.map((part, i) => {
        if (part.startsWith('$$')) return <BlockMath key={i} math={part.slice(2, -2)} />;
        if (part.startsWith('$')) return <InlineMath key={i} math={part.slice(1, -1)} />;
        return <Markdown key={i}>{part}</Markdown>;
      })}
    </div>
  );
};

export default function App() {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [grade, setGrade] = useState('1');
  const [language, setLanguage] = useState(LANGUAGES[1]);
  const [exerciseConfigs, setExerciseConfigs] = useState(INITIAL_EXERCISE_TYPES);
  const [sourceText, setSourceText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [testData, setTestData] = useState<TestData | null>(null);
  const [history, setHistory] = useState<TestData[]>([]);
  const [view, setView] = useState<'build' | 'history'>('build');
  const [numberStyle, setNumberStyle] = useState<'Khmer' | 'Roman'>('Khmer');
  const [showAnswerKeys, setShowAnswerKeys] = useState(false);
  const [font, setFont] = useState(KHMER_FONTS[0]);
  const [fontSize, setFontSize] = useState('12pt');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [brandSettings, setBrandSettings] = useState(DEFAULT_BRAND_SETTINGS);

  const handleGenerate = async () => {
    if (!sourceText && files.length === 0) return alert("Add source text or files.");
    setIsGenerating(true);
    try {
      const config: TestConfig = {
        numberStyle, showAnswerKeys, font, fontSize,
        exerciseConfigs: exerciseConfigs.filter(ex => ex.selected),
        strictRules: INITIAL_STRICT_RULES,
        protocols: INITIAL_PROTOCOLS
      };

      let inlineData;
      if (files.length > 0) {
        inlineData = await Promise.all(files.map(async f => {
          const base64 = await new Promise<string>(r => {
            const rd = new FileReader();
            rd.onload = () => r((rd.result as string).split(',')[1]);
            rd.readAsDataURL(f);
          });
          return { data: base64, mimeType: f.type };
        }));
      }

      const result = await generateTest(subject, grade, language, config, { text: sourceText, inlineData });
      const newTest: TestData = { ...result, subject, grade, language, config };
      setTestData(newTest);
      setHistory(prev => [newTest, ...prev]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToPDF = async () => {
    const el = document.getElementById('test-preview');
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    pdf.save(`Test_${Date.now()}.pdf`);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" />}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn("fixed md:sticky top-0 left-0 z-50 w-80 h-screen bg-white border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto transition-transform md:translate-x-0", isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-600 rounded-lg text-white shadow-lg"><Zap size={20}/></div>
          <h1 className="font-black text-xl tracking-tighter">TestBuilder</h1>
        </div>

        <nav className="flex bg-slate-100 p-1 rounded-xl">
           <button onClick={()=>setView('build')} className={cn("flex-1 py-2 text-xs font-bold rounded-lg", view==='build'?'bg-white shadow text-orange-600':'text-slate-500')}>Build</button>
           <button onClick={()=>setView('history')} className={cn
