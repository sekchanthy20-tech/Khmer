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
import { motion, AnimatePresence } from 'framer-motion'; // CHANGED TO STANDARD IMPORT
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Key Rotation Helpers ---
const getGeminiKeys = (): string[] => {
    const metaEnv = (import.meta as any).env;
    const processEnv = (globalThis as any).process?.env || {};
    const envKeys = metaEnv.VITE_GEMINI_API_KEYS || metaEnv.VITE_GEMINI_API_KEY || processEnv.GEMINI_API_KEY || "";
    return envKeys.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
};

function isQuotaError(error: any): boolean {
    const msg = error?.message?.toLowerCase() || "";
    return msg.includes("quota") || msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("limit");
}

// --- Types ---
interface ExerciseConfig { id: string; label: string; rule: string; selected: boolean; itemCount: number; columns: number; subject: string; }
interface Question { id: string; type: string; module_label: string; question: string; options?: string[]; answer: string; explanation?: string; image_url?: string; options_layout?: string; }
interface TestConfig { numberStyle: 'Khmer' | 'Roman'; showAnswerKeys: boolean; font: string; fontSize: string; exerciseConfigs: ExerciseConfig[]; }
interface TestData { title: string; subject: string; grade: string; language: string; config: TestConfig; questions: Question[]; source_text?: string; }

// --- Constants ---
const SUBJECTS = ['Khmer', 'Math', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Moral-Civics', 'English', 'ICT'];
const LANGUAGES = ['English', 'Khmer', 'Chinese', 'Korean', 'French'];
const KHMER_FONTS = ['Khmer OS Siemreap', 'Khmer OS Muol Light', 'Khmer OS Battambang'];

const INITIAL_EXERCISES: ExerciseConfig[] = [
  { id: 'kh_reading', subject: 'Khmer', label: 'អំណាន (Reading)', rule: 'Comprehension', selected: true, itemCount: 5, columns: 1 },
  { id: 'ma_calc', subject: 'Math', label: 'គណនា (Calculation)', rule: 'Arithmetic', selected: true, itemCount: 10, columns: 1 },
  { id: 'ma_mcq', subject: 'Math', label: 'ជ្រើសរើសចម្លើយ (MCQ)', rule: 'Math MCQ', selected: true, itemCount: 10, columns: 1 }
];

export default function App() {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [grade, setGrade] = useState('1');
  const [language, setLanguage] = useState(LANGUAGES[1]);
  const [exerciseConfigs, setExerciseConfigs] = useState(INITIAL_EXERCISES);
  const [sourceText, setSourceText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [testData, setTestData] = useState<TestData | null>(null);
  const [history, setHistory] = useState<TestData[]>([]);
  const [view, setView] = useState<'build' | 'history'>('build');
  const [numberStyle, setNumberStyle] = useState<'Khmer' | 'Roman'>('Khmer');
  const [fontSize, setFontSize] = useState('12pt');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [brandSettings, setBrandSettings] = useState({
    schoolName: 'សាលារៀនចំណេះទូទៅ',
    address: 'រាជធានីភ្នំពេញ',
    logo: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('brand_settings');
    if (saved) setBrandSettings(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/tests');
        if (res.ok) {
          const data = await res.json();
          setHistory(data.map((h: any) => ({ ...JSON.parse(h.content), id: h.id })));
        } else {
          throw new Error("API failed");
        }
      } catch (e) {
        console.error("Failed to fetch history from API, using localStorage", e);
        const local = localStorage.getItem('test_history');
        if (local) setHistory(JSON.parse(local));
      }
    };
    fetchHistory();
  }, []);

  const handleGenerate = async () => {
    const keys = getGeminiKeys();
    if (keys.length === 0) return alert("API Key missing! Add VITE_GEMINI_API_KEYS in Vercel settings.");
    
    setIsGenerating(true);
    const activeEx = exerciseConfigs.filter(ex => ex.selected && ex.subject === subject);
    
    // --- ROTATION LOOP ---
    for (let i = 0; i < keys.length; i++) {
      try {
        const ai = new GoogleGenAI({ apiKey: keys[i] });
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
          You are a professional MoEYS Curriculum Test Builder for Grade ${grade}. 
          Create a ${subject} test in ${language}. 
          
          STRICT SUBJECT GUARD:
          - The subject is ${subject}. 
          - DO NOT include any questions, terms, or concepts from other subjects. 
          - If the subject is Khmer, focus on Khmer Literature, Grammar, and Culture. DO NOT include Math problems.
          - If the subject is Math, focus on Arithmetic, Algebra, Geometry. DO NOT include Khmer Literature analysis.
          
          CRITICAL INSTRUCTIONS:
          1. ONLY generate content for ${subject}. 
          2. Generate EXACTLY the following number of items for each module:
             ${activeEx.map(e => `- ${e.label}: ${e.itemCount} items`).join('\n')}
          3. Use Khmer language for all text if language is Khmer.
          4. Context/Source Material: ${sourceText || "General curriculum knowledge"}
          
          OUTPUT FORMAT:
          Return a JSON object with:
          - title: A descriptive title for the test
          - questions: An array of question objects, each with:
            - id: unique string
            - module_label: the label of the module it belongs to
            - question: the question text
            - options: array of 4 strings (for MCQ) or null
            - answer: the correct answer
            - explanation: a brief explanation
        `;

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                module_label: { type: Type.STRING },
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                answer: { type: Type.STRING }
                            },
                            required: ["question", "answer"]
                        }
                    }
                }
            }
          }
        });

        const data = JSON.parse(result.response.text());
        const newTest: TestData = { ...data, subject, grade, language, config: { numberStyle, showAnswerKeys: true, font: KHMER_FONTS[0], fontSize, exerciseConfigs: activeEx } };
        
        try {
          const res = await fetch('/api/tests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: newTest.title,
              subject: newTest.subject,
              grade: newTest.grade,
              language: newTest.language,
              config: newTest.config,
              content: newTest
            })
          });
          if (res.ok) {
            const saved = await res.json();
            (newTest as any).id = saved.id;
          }
        } catch (e) {
          console.error("Failed to save test to API", e);
        }

        setTestData(newTest);
        setHistory(prev => {
          const next = [newTest, ...prev];
          localStorage.setItem('test_history', JSON.stringify(next));
          return next;
        });
        setIsGenerating(false);
        return; // Success!

      } catch (error: any) {
        if (isQuotaError(error) && i < keys.length - 1) continue; // Try next key
        alert("Error: " + error.message);
        break;
      }
    }
    setIsGenerating(false);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop: accepted => setFiles(prev => [...prev, ...accepted]) });

  const exportToCSV = () => {
    if (!testData) return;
    const headers = ["Question ID", "Module Label", "Question", "Options", "Answer"];
    const rows = testData.questions.map((q, i) => [
      i + 1,
      q.module_label,
      q.question,
      q.options?.join(" | ") || "",
      q.answer
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${testData.title}.csv`);
  };

  const exportToDocx = async () => {
    if (!testData) return;
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: brandSettings.schoolName, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: brandSettings.address, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "", spacing: { after: 400 } }),
          new Paragraph({ text: testData.title, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
          ...testData.questions.flatMap((q, i) => [
            new Paragraph({
              children: [
                new TextRun({ text: `${i + 1}. ${q.question}`, bold: true }),
              ],
              spacing: { before: 200 }
            }),
            ...(q.options ? [new Paragraph({ text: q.options.map((o, idx) => `(${idx + 1}) ${o}`).join("    ") })] : [])
          ])
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${testData.title}.docx`);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      <aside className={cn("fixed md:sticky top-0 left-0 z-50 w-80 h-screen bg-white border-r p-6 flex flex-col gap-6 transition-transform md:translate-x-0", isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-3"><Zap className="text-orange-600"/><h1 className="font-black text-xl">TestBuilder</h1></div>
        <nav className="flex bg-slate-100 p-1 rounded-xl">
           <button onClick={()=>setView('build')} className={cn("flex-1 py-2 text-xs font-bold rounded-lg", view==='build'?'bg-white shadow text-orange-600':'text-slate-500')}>Build</button>
           <button onClick={()=>setView('history')} className={cn("flex-1 py-2 text-xs font-bold rounded-lg", view==='history'?'bg-white shadow text-orange-600':'text-slate-500')}>History</button>
        </nav>
        {view === 'build' ? (
          <div className="space-y-4">
            <select value={subject} onChange={e=>setSubject(e.target.value)} className="w-full p-2 border rounded-lg text-sm">{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
            <select value={grade} onChange={e=>setGrade(e.target.value)} className="w-full p-2 border rounded-lg text-sm">{Array.from({length:12},(_,i)=>i+1).map(g=><option key={g}>{g}</option>)}</select>
            <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg hover:bg-orange-700 disabled:opacity-50">
              {isGenerating ? "GENERATING..." : "GENERATE TEST"}
            </button>
            <button onClick={()=>setIsSettingsOpen(true)} className="w-full py-2 border rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50">
              <Settings size={14}/> Settings
            </button>
          </div>
        ) : (
          <div className="space-y-2">{history.map((h,i)=><div key={i} onClick={()=>setTestData(h)} className="p-2 border rounded cursor-pointer text-xs font-bold">{h.title}</div>)}</div>
        )}
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <button onClick={()=>setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 bg-white border rounded mb-4"><Menu/></button>
        {!testData && !isGenerating ? (
          <div className="max-w-2xl mx-auto text-center space-y-6 py-20">
            <h2 className="text-4xl font-black">Create a New Test</h2>
            <textarea value={sourceText} onChange={e=>setSourceText(e.target.value)} placeholder="Paste text here..." className="w-full h-64 p-4 border rounded-2xl shadow-sm" />
            <div {...getRootProps()} className="p-10 border-2 border-dashed rounded-2xl bg-white cursor-pointer hover:bg-slate-50">
              <input {...getInputProps()} /><p className="text-slate-400 font-bold">Drag & drop files here</p>
            </div>
          </div>
        ) : isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full gap-4"><Loader2 className="animate-spin text-orange-600" size={48}/><p className="font-bold">AI is rotating keys and building test...</p></div>
        ) : (
          <div className="max-w-4xl mx-auto bg-white p-12 shadow-2xl border min-h-screen" id="test-preview">
            <div className="flex justify-end gap-2 mb-4 print:hidden">
              <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg font-bold text-xs hover:bg-slate-200">
                <TableIcon size={16}/> CSV
              </button>
              <button onClick={exportToDocx} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg font-bold text-xs hover:bg-slate-200">
                <FileText size={16}/> DOCX
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg font-bold text-xs hover:bg-slate-200">
                <Download size={16}/> Print/PDF
              </button>
            </div>
            <h1 className="text-3xl font-black text-center mb-8">{testData?.title}</h1>
            <div className="space-y-8">
              {testData?.questions.map((q,i)=>(
                <div key={i} className="space-y-2">
                  <p className="font-bold">{i+1}. {q.question}</p>
                  {q.options && <div className="grid grid-cols-2 gap-4 pl-6 text-sm">{q.options.map((opt,idx)=><div key={idx}>({idx+1}) {opt}</div>)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">Settings</h2>
                <button onClick={()=>setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">School Name</label>
                  <input value={brandSettings.schoolName} onChange={e=>setBrandSettings({...brandSettings, schoolName: e.target.value})} className="w-full p-3 border rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Address</label>
                  <input value={brandSettings.address} onChange={e=>setBrandSettings({...brandSettings, address: e.target.value})} className="w-full p-3 border rounded-xl" />
                </div>
                <button onClick={()=>{localStorage.setItem('brand_settings', JSON.stringify(brandSettings)); setIsSettingsOpen(false);}} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black">SAVE CHANGES</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
