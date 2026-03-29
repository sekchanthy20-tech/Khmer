import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload, 
  FileText, 
  BrainCircuit, 
  Download, 
  Trash2, 
  Plus, 
  Minus,
  ChevronRight, 
  BookOpen, 
  Calculator, 
  Languages,
  History,
  Loader2,
  CheckCircle2,
  Mic,
  LogOut,
  Settings,
  Eye,
  Edit3,
  Save,
  Printer,
  Share2,
  MoreVertical,
  X,
  Menu,
  AlertCircle,
  ExternalLink,
  Book,
  FolderOpen,
  CheckSquare,
  Triangle,
  BarChart,
  Hash,
  Activity,
  FlaskConical,
  Dna,
  Map,
  Heart,
  Zap
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

// --- Types ---

type ExerciseType = 'MCQ' | 'Critical Thinking' | 'Fill-in-blank' | 'Complete the sentences' | 'Math' | 'Speaking';

interface ExerciseConfig {
  id: string;
  label: string;
  rule: string;
  description?: string;
  selected: boolean;
  active?: boolean;
  itemCount: number;
  columns: number;
  subject: string;
  icon?: string;
}

interface Question {
  id: string;
  type: string;
  module_label: string;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  layout_columns: number;
  options_layout?: 'single' | 'double' | 'vertical';
  image_prompt?: string;
  image_url?: string;
}

interface MasterProtocol {
  id: string;
  title: string;
  description: string;
  category: 'General' | 'Grammar' | 'Vocabulary' | 'Reading';
  active: boolean;
  level: 'Low' | 'Medium' | 'High';
}

interface StrictRule {
  id: string;
  title: string;
  description: string;
  active: boolean;
}

interface TestConfig {
  numberStyle: 'Khmer' | 'Roman';
  showAnswerKeys: boolean;
  font: string;
  fontSize: string;
  exerciseConfigs: ExerciseConfig[];
  strictRules: StrictRule[];
  protocols: MasterProtocol[];
}

interface TestData {
  id?: string;
  title: string;
  subject: string;
  grade: string;
  language: string;
  config: TestConfig;
  questions: Question[];
  sourceText?: string;
  source_text?: string;
  created_at?: string;
  timestamp?: string;
}

// --- Constants ---

const SUBJECTS = [
  'Khmer', 'Math', 'Physics', 'Chemistry', 'Biology', 
  'History', 'Geography', 'Moral-Civics', 'English', 'ICT'
];

const LANGUAGES = ['English', 'Khmer', 'Chinese', 'Korean', 'French'];

const KHMER_FONTS = [
  'Khmer OS Siemreap', 'Khmer OS Muol Light', 'Khmer OS Battambang', 'Khmer OS Freehand', 'Khmer OS Fasthand'
];

const INITIAL_EXERCISE_TYPES: ExerciseConfig[] = [
  // --- KHMER LANGUAGE ---
  { id: 'kh_reading', subject: 'Khmer', label: 'អំណាន (Reading)', rule: 'Comprehension questions based on a provided text or MoEYS standard literature.', description: 'Reading comprehension and analysis.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'BookOpen' },
  { id: 'kh_vocab', subject: 'Khmer', label: 'វាក្យសព្ទ (Vocabulary)', rule: 'Synonyms, antonyms, and word meanings in context.', description: 'Word study and usage.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'Book' },
  { id: 'kh_grammar', subject: 'Khmer', label: 'វេយ្យាករណ៍ (Grammar)', rule: 'Parts of speech, sentence types, and punctuation rules.', description: 'Grammar and syntax.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'Type' },
  { id: 'kh_spelling', subject: 'Khmer', label: 'អក្ខរាវិរុទ្ធ (Spelling)', rule: 'Identify correctly spelled words or correct spelling errors.', description: 'Orthography and spelling.', selected: false, active: true, itemCount: 5, columns: 1, icon: 'PenTool' },
  { id: 'kh_writing', subject: 'Khmer', label: 'សំណេរ (Writing)', rule: 'Short writing prompts, sentence construction, or paragraph completion.', description: 'Composition and creative writing.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'Edit3' },
  { id: 'kh_mcq', subject: 'Khmer', label: 'ជ្រើសរើសចម្លើយ (MCQ)', rule: 'Standard multiple choice questions with 4 options.', description: 'General multiple choice.', selected: true, active: true, itemCount: 10, columns: 1, icon: 'CheckSquare' },
  { id: 'kh_ct', subject: 'Khmer', label: 'វិភាគ និងត្រិះរិះ (Critical Thinking)', rule: 'Analytical exercises, scenarios, or tasks requiring reasoning and deep thinking. Do not just ask simple questions.', description: 'Deep reasoning and analysis exercises.', selected: true, active: true, itemCount: 10, columns: 1, icon: 'Brain' },
  { id: 'kh_ans', subject: 'Khmer', label: 'សំណួរ និងចម្លើយ (Q&A)', rule: 'Comprehension questions requiring written answers based on text or general knowledge.', description: 'Standard question and answer format.', selected: false, active: true, itemCount: 5, columns: 1, icon: 'FileText' },
  { id: 'kh_disc', subject: 'Khmer', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions for classroom discussion or debate.', description: 'Discussion and debate questions.', selected: true, active: true, itemCount: 10, columns: 1, icon: 'MessageSquare' },
  { id: 'kh_fib', subject: 'Khmer', label: 'បំពេញល្បះ (Fill-in-blank)', rule: 'Complete sentences by filling in missing words or phrases.', description: 'Sentence completion.', selected: false, active: true, itemCount: 5, columns: 1, icon: 'Minus' },

  // --- MATH ---
  { id: 'ma_calc', subject: 'Math', label: 'គណនា (Calculation)', rule: 'Arithmetic operations, algebra, and numerical expressions using LaTeX.', description: 'Basic and advanced calculations.', selected: true, active: true, itemCount: 10, columns: 1, icon: 'Calculator' },
  { id: 'ma_prob', subject: 'Math', label: 'ចំណោទ (Word Problems)', rule: 'Real-world math problems requiring logical steps and solutions.', description: 'Applied mathematics.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'Zap' },
  { id: 'ma_geo', subject: 'Math', label: 'ធរណីមាត្រ (Geometry)', rule: 'Shapes, area, volume, and geometric properties. Use image_prompt for diagrams.', description: 'Geometry and spatial reasoning.', selected: false, active: true, itemCount: 5, columns: 1, icon: 'Triangle' },
  { id: 'ma_stat', subject: 'Math', label: 'ស្ថិតិ (Statistics)', rule: 'Data interpretation, probability, and chart-based questions.', description: 'Data and probability.', selected: false, active: true, itemCount: 5, columns: 1, icon: 'BarChart' },
  { id: 'ma_mcq', subject: 'Math', label: 'ជ្រើសរើសចម្លើយ (MCQ)', rule: 'Math problems with 4 distinct options and LaTeX formulas.', description: 'Math multiple choice.', selected: false, active: true, itemCount: 10, columns: 1, icon: 'Hash' },
  { id: 'ma_disc', subject: 'Math', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions about mathematical concepts or real-world applications.', description: 'Math discussion questions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'MessageSquare' },
  { id: 'ma_deep_exp', subject: 'Math', label: 'ដំណោះស្រាយលម្អិត (Deep Math)', rule: 'Provide deep, step-by-step mathematical explanations in the traditional Khmer MoEYS style (គេមាន, រក, តាមរូបមន្ត, ដូចនេះ). Use LaTeX.', description: 'Detailed step-by-step solutions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'FileText' },

  // --- SCIENCE (Physics, Chemistry, Biology) ---
  { id: 'sci_disc', subject: 'Physics', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions about physical laws, scientific ethics, or real-world applications.', description: 'Physics discussion questions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'MessageSquare' },
  { id: 'sci_theory', subject: 'Physics', label: 'ទ្រឹស្ដី (Theory)', rule: 'Conceptual questions about physical laws and principles.', description: 'Physics theory.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'Activity' },
  { id: 'sci_calc', subject: 'Physics', label: 'លំហាត់គណនា (Calculation)', rule: 'Physics problems requiring formula application and calculation.', description: 'Physics problems.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'Calculator' },
  { id: 'chem_disc', subject: 'Chemistry', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions about chemical reactions, safety, or environmental impact.', description: 'Chemistry discussion questions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'MessageSquare' },
  { id: 'chem_eq', subject: 'Chemistry', label: 'សមីការគីមី (Equations)', rule: 'Balancing chemical equations and reaction types.', description: 'Chemical reactions.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'FlaskConical' },
  { id: 'bio_disc', subject: 'Biology', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions about biological systems, ethics, or health.', description: 'Biology discussion questions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'MessageSquare' },
  { id: 'bio_cell', subject: 'Biology', label: 'ជីវវិទ្យា (Biology)', rule: 'Questions about cells, organisms, and biological systems.', description: 'Biological concepts.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'Dna' },

  // --- SOCIAL STUDIES ---
  { id: 'hist_disc', subject: 'History', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions about historical causes, effects, and lessons.', description: 'History discussion questions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'MessageSquare' },
  { id: 'hist_event', subject: 'History', label: 'ប្រវត្តិវិទ្យា (History)', rule: 'Questions about historical events, dates, and figures in Cambodia and the world.', description: 'Historical knowledge.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'History' },
  { id: 'geo_disc', subject: 'Geography', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions about human-environment interaction or global issues.', description: 'Geography discussion questions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'MessageSquare' },
  { id: 'geo_map', subject: 'Geography', label: 'ភូមិវិទ្យា (Geography)', rule: 'Questions about maps, climate, and physical geography.', description: 'Geographical knowledge.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'Map' },
  { id: 'civ_disc', subject: 'Moral-Civics', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions about ethics, society, and civic duties. Example: "How can we make more friends at school?".', description: 'Civics discussion questions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'MessageSquare' },
  { id: 'civ_moral', subject: 'Moral-Civics', label: 'សីលធម៌-ពលរដ្ឋ (Civics)', rule: 'Questions about ethics, society, and civic duties.', description: 'Moral and civic education.', selected: true, active: true, itemCount: 5, columns: 1, icon: 'Heart' },
  { id: 'eng_disc', subject: 'English', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions in English to practice speaking and critical thinking.', description: 'English discussion questions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'MessageSquare' },
  { id: 'ict_disc', subject: 'ICT', label: 'សំណួរពិភាក្សា (Discussion)', rule: 'Open-ended questions about technology, digital citizenship, and the future of ICT.', description: 'ICT discussion questions.', selected: false, active: true, itemCount: 3, columns: 1, icon: 'MessageSquare' },
];

const INITIAL_PROTOCOLS: MasterProtocol[] = [
  { id: 'p1', title: 'HIGH-FIDELITY POOLING', description: 'FOR MCQ, GENERATE AT LEAST ONE "NEAR-MISS" DISTRACTOR: A GRAMMATICALLY CORRECT OPTION THAT IS CONTEXTUALLY PLAUSIBLE BUT INCORRECT.', category: 'General', active: true, level: 'Medium' },
  { id: 'p2', title: 'PATTERN DESTRUCTION', description: 'ROTATE POLARITY (+/- / ?) AND COMPLEXITY. AVOID REPETITION IN SENTENCE STRUCTURES.', category: 'General', active: true, level: 'Medium' },
  { id: 'p3', title: 'TOPIC DOMINANCE', description: 'THE TOPIC BOX OVERRIDES TEMPLATE DEFAULTS. IF THE TOPIC IS "PAST SIMPLE", ENSURE ALL ITEMS FOCUS ON IT.', category: 'General', active: true, level: 'High' },
  { id: 'p4', title: 'SEMANTIC PRECISION', description: 'ENSURE KHMER TERMINOLOGY MATCHES MoEYS TEXTBOOKS EXACTLY.', category: 'Reading', active: true, level: 'High' },
  { id: 'p5', title: 'KHMER ORTHOGRAPHIC PRECISION (NEAR-MISS)', description: 'GENERATED DISTRACTORS MUST SHARE AT LEAST 80% VISUAL SIMILARITY WITH THE CORRECT ANSWER IN KHMER SCRIPT. FOCUS ON SUBSCRIPT VARIATIONS, DIACRITIC PLACEMENT, AND HOMOPHONES TO ENSURE ONLY ONE TECHNICALLY CORRECT ANSWER EXISTS WHILE TESTING SPELLING MASTERY.', category: 'General', active: true, level: 'High' },
];

const INITIAL_STRICT_RULES: StrictRule[] = [
  { id: 'r1', title: 'NO DUPLICATES', description: 'Ensure no two questions are semantically identical.', active: true },
  { id: 'r2', title: 'GRADE APPROPRIATE', description: 'Vocabulary and syntax must match the target grade level.', active: true },
  { id: 'r3', title: 'BALANCED ANSWERS', description: 'Ensure a random but balanced distribution of correct answer keys (A, B, C, D).', active: true },
  { id: 'r4', title: 'KHMER NAMES POLICY', description: 'Use Khmer names. DO NOT use "មីណា" (Mina). DO NOT use names starting with "មី" (Mi) as it is considered rude.', active: true },
  { id: 'r5', title: 'MoEYS ALIGNMENT', description: 'Ensure all content and pedagogical style align strictly with the Cambodian MoEYS national curriculum standards.', active: true },
  { id: 'r6', title: 'NO THAI LANGUAGE', description: 'Absolutely NO Thai characters or language. Use only Khmer script.', active: true },
  { id: 'r7', title: 'NO MATH IN KHMER', description: 'Khmer language exercises must not contain mathematical calculations or logic puzzles.', active: true },
];
const FONT_SIZES = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt'];
const KHMER_MCQ_LABELS = ['ក', 'ខ', 'គ', 'ឃ', 'ង', 'ច'];

interface BrandSettings {
  schoolName: string;
  schoolAddress: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing: number;
  textTransform: string;
  logoWidth: number;
  logoData: string;
}

const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  schoolName: "DPSS ULTIMATE TEST BUILDER",
  schoolAddress: "Developing Potential for Success School",
  fontSize: 12,
  fontWeight: "800",
  letterSpacing: 0,
  textTransform: "none",
  logoWidth: 300,
  logoData: ""
};

const getOptionLabel = (index: number, style: 'Khmer' | 'Roman') => {
  if (style === 'Khmer') {
    return KHMER_MCQ_LABELS[index] || String.fromCharCode(65 + index);
  }
  return String.fromCharCode(65 + index);
};

const cleanOptionText = (text: string) => {
  return text.replace(/^[A-Zក-ឃ0-9][\.\)]\s*/i, '').trim();
};

type Answer = 'A' | 'B' | 'C' | 'D';

function generateHumanBalancedKey(count: number): Answer[] {
  const letters: Answer[] = ['A', 'B', 'C', 'D'];

  function getDistribution(n: number) {
    const base = Math.floor(n / 4);
    const remainder = n % 4;

    const dist: Record<Answer, number> = {
      A: base,
      B: base,
      C: base,
      D: base,
    };

    for (let i = 0; i < remainder; i++) {
      const pick = letters[Math.floor(Math.random() * 4)];
      dist[pick]++;
    }

    letters.forEach(l => {
      if (dist[l] === 0 && n >= 4) {
        const maxKey = Object.keys(dist).reduce((a, b) =>
          dist[a as Answer] > dist[b as Answer] ? a : b
        ) as Answer;
        dist[maxKey]--;
        dist[l]++;
      }
    });

    return dist;
  }

  const distribution = getDistribution(count);
  let pool: Answer[] = [];
  (Object.keys(distribution) as Answer[]).forEach(letter => {
    pool.push(...Array(distribution[letter]).fill(letter));
  });

  function shuffleWithStreakControl(arr: Answer[]): Answer[] {
    let shuffled: Answer[] = [];
    let attempts = 0;

    while (attempts < 1000) {
      shuffled = [...arr].sort(() => Math.random() - 0.5);

      let valid = true;
      for (let i = 2; i < shuffled.length; i++) {
        if (
          shuffled[i] === shuffled[i - 1] &&
          shuffled[i] === shuffled[i - 2]
        ) {
          valid = false;
          break;
        }
      }

      if (valid) return shuffled;
      attempts++;
    }

    return shuffled;
  }

  return shuffleWithStreakControl(pool);
}

// --- Gemini Service ---

const generateTest = async (
  subject: string, 
  grade: string, 
  language: string,
  config: TestConfig,
  sourceContent: { text?: string; inlineData?: { data: string; mimeType: string }[] }
) => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("Gemini API key is missing. Please set it up in your environment.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const activeProtocols = config.protocols.filter(p => p.active).map(p => `- ${p.title}: ${p.description}`).join('\n');
  const activeRules = config.strictRules.filter(r => r.active).map(r => `- ${r.title}: ${r.description}`).join('\n');
  const moduleRequirements = config.exerciseConfigs.map(ex => `- ${ex.label} (${ex.id}): Generate EXACTLY ${ex.itemCount} items. Use "${ex.label}" as the 'module_label' in the JSON response.`).join('\n');

  // Calculate total MCQ count and generate balanced keys
  const mcqModules = ['kh_mcq', 'ma_mcq', 'kh_vocab', 'kh_grammar', 'kh_spelling'];
  const totalMcqCount = config.exerciseConfigs
    .filter(ex => mcqModules.includes(ex.id))
    .reduce((sum, ex) => sum + ex.itemCount, 0);
  
  const balancedKeys = generateHumanBalancedKey(totalMcqCount);
  const keysString = balancedKeys.join(', ');

  const prompt = `
    I HATE SUMMARIES. You are a STRICT MULTI-MODULE GENERATION ENGINE for the "Cambodian MoEYS National Curriculum".
    
    MoEYS STANDARDS & PEDAGOGY:
    - Grade 1-6 (Primary): Focus on foundational literacy, basic arithmetic, and moral education. Use simple, clear language.
    - Grade 7-9 (Lower Secondary): Focus on conceptual understanding, problem-solving, and critical analysis.
    - Grade 10-12 (Upper Secondary): Focus on advanced theory, complex calculations (Physics/Chem/Math), and academic writing.
    - KHMER STYLE: Use formal Khmer (ភាសាបច្ចេកទេស) for technical terms. Follow the MoEYS textbook structure for questions.
    
    MASTER PROTOCOLS:
    ${activeProtocols}
    
    STRICT RULES:
    ${activeRules}
    - NO THAI LANGUAGE (CRITICAL): Absolutely NO Thai characters (e.g., ก, ข, ค, ง, จ, ฉ, ช, ซ, ฌ, ญ, ฎ, ฏ, ฐ, ฑ, ฒ, ณ, ด, ต, ถ, ท, ธ, น, บ, ป, ผ, ฝ, พ, ฟ, ภ, ม, ย, ร, ล, ว, ศ, ษ, ส, ห, ฬ, อ, ฮ) or Thai words. Use ONLY Khmer script (ក, ខ, គ, ឃ, ង, ច, ឆ, ជ, ឈ, ញ, ដ, ឋ, ឌ, ឍ, ណ, ត, ថ, ទ, ធ, ន, ប, ផ, ព, ភ, ម, យ, រ, ល, វ, ស, ហ, ឡ, អ) for Khmer content.
    - NO MATH IN KHMER (CRITICAL): Khmer language exercises (Reading, Vocab, Grammar, CT) MUST NOT contain mathematical calculations, logic puzzles, or arithmetic. Keep Khmer exercises focused on literacy, literature, and language analysis.
    ${config.numberStyle === 'Khmer' ? '- MANDATORY: Use Khmer numerals (០, ១, ២, ៣, ៤, ៥, ៦, ៧, ៨, ៩) for all numbering and mathematical values.' : '- Use Roman/Arabic numerals.'}
    - MANDATORY: For MCQ options, provide ONLY the answer text in the 'options' array. DO NOT include prefixes like 'A.', 'B.', 'ក.', 'ខ.' etc.
    - EXTREME NEAR-MISS DISTRACTORS (CRITICAL): For ALL multiple-choice questions, all options MUST be plausible and potentially correct in some context, but only ONE is the absolute 'best' answer. Example: 'ដើម្បីឱ្យមានមិត្តភក្តិកាន់តែច្រើន យើងគួរតែ ____ ក. ខិតខំរៀនសូត្រ ខ. ជួយពួកគេ និងចែករំលែកអ្វីមួយ គ. និយាយរឿងល្អៗអំពីពួកគេ ឃ. ធ្វើឱ្យពួកគេមានអារម្មណ៍ល្អ' (To have more friends, we should: A. Study hard, B. Help them and share something, C. Speak good things about them, D. Make them feel good). While C and D are good, B is the most direct and 'best' answer in the MoEYS curriculum context. This is MANDATORY to make the test challenging and high-quality.
    - HUMAN-BALANCED ANSWER KEYS (STRICT): You MUST follow this exact sequence of correct answer keys for the MCQ questions in the order they appear: [${keysString}]. For example, if the first key is 'B', the correct answer for the first MCQ question MUST be at index 1 of the options array.
    - MCQ MODULES: The following modules MUST be generated as MCQ with EXACTLY 4 options: ${mcqModules.join(', ')}.
    - SOURCE TEXT EXTRACTION (MANDATORY): If a source (image or text) is provided, you MUST extract the FULL, literal text and provide it in the 'source_text' field. DO NOT summarize it.
    - TOPIC-BASED GENERATION (CRITICAL): When a source is provided, generate a mix of questions:
        1. Literal: Questions directly answered by the text.
        2. Contextual/Moral: Questions based on the TOPIC, THEME, or MORAL of the text (e.g., if the text is about a bird and a cow, ask about 'honesty', 'friendship', or 'gratitude' even if those words aren't in the text).
    - COMPACTNESS (CRITICAL): The generated test MUST be space-efficient. Avoid long, wordy questions or options if they can be expressed more concisely. PREFER 'single' or 'double' options_layout for MCQs.
    - VISUAL MATH (CRITICAL): For math questions like "X + Y = ?", the 'image_prompt' MUST specify the EXACT count of items for both X and Y. Example: "4 red apples, a plus sign, 4 red apples...". Use simple, countable objects like apples, mangoes, or pencils.
    - KHMER MATH STYLE (CRITICAL): For "ma_deep_exp" (Deep Math Explanation), you MUST follow the traditional Khmer MoEYS style for solving problems:
        1. Use "ដំណោះស្រាយ" (Solution) as the header.
        2. Use "គេមាន" (Given) to list known values.
        3. Use "រក" (Find) to state the goal.
        4. Use "តាមរូបមន្ត" (According to the formula) to state the formula used.
        5. Show step-by-step calculations with clear logical flow.
        6. Use "ដូចនេះ" (Therefore) for the final answer, boxed or clearly highlighted.
        7. Use LaTeX for ALL mathematical expressions and formulas (e.g., $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$).
    - DISCUSSION QUESTIONS (NEW): For any module with "disc" in its ID (Discussion), generate open-ended, thought-provoking questions that encourage critical thinking and classroom debate. Example: "តើយើងអាចបង្កើតមិត្តភក្តិឱ្យបានកាន់តែច្រើននៅក្នុងសាលារៀនដោយរបៀបណា?" (How can we make more friends at school?). These questions should NOT have MCQ options.
    - SELECTIVE IMAGE GENERATION (STRICT): Only provide an 'image_prompt' if the question CANNOT be answered without a visual aid (e.g., counting, identifying shapes, visual math). DO NOT generate images for abstract or moral questions.
    - IMAGE RELEVANCE (CRITICAL): The 'image_prompt' MUST be in ENGLISH and provide a literal, detailed description. For math like "4 + 4 = ?", the prompt MUST be: "Educational clipart for kids: 4 red apples, a plus symbol, 4 red apples, an equals sign, and a question mark. High quality, white background, simple style."
    - AVOID KHMER CHARACTERS in 'image_prompt'. Use common objects: apples, mangoes, pencils, watches, balls.
    - For MCQ questions, specify 'options_layout' as 'single' (all on one line, very compact), 'double' (2x2 grid), or 'vertical' (one per line) based on the length of the options. PREFER 'single' or 'double' to save vertical space on the test paper.
    - Use 'layout_columns' to specify the number of columns for the exercise part (1 to 6).
    - Use Khmer language for all instructions, questions, and content unless the target language is explicitly set to something else.
    
    QUANTITY REQUIREMENTS (MANDATORY):
    For each module below, you MUST generate the EXACT number of items specified. Do not skip any module.
    ${moduleRequirements}
    
    TASK: Create a Grade ${grade} test for ${subject} in ${language}.
    
    STRUCTURE:
    - Part A: Source Text Extraction. Extract and provide the full text from the source.
    - Part B: Generated Exercises. Create exercises for ALL parts found in the source.
    
    VISUAL EXERCISES:
    - For "ma_visual_large" or "ma_visual_compact", the "image_prompt" is MANDATORY.
    
    JSON Schema:
    {
      "title": "Technical Title",
      "source_text": "The exact text extracted",
      "questions": [
        {
          "id": "q_1",
          "type": "Module ID",
          "module_label": "Label",
          "question": "Question text",
          "options": ["A", "B", "C", "D"],
          "answer": "Correct Answer",
          "explanation": "Answer key",
          "layout_columns": number,
          "options_layout": "single" | "double" | "vertical",
          "image_prompt": "Prompt for image generation"
        }
      ]
    }
  `;

  const parts: any[] = [{ text: prompt }];
  if (sourceContent.inlineData) {
    sourceContent.inlineData.forEach(data => parts.push({ inlineData: data }));
  } else if (sourceContent.text) {
    parts.push({ text: `SOURCE TEXT: ${sourceContent.text}` });
  }

  const generateWithModel = async (modelName: string) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts }],
      config: {
        systemInstruction: "You are a specialized MoEYS Curriculum Test Builder. Generate high-quality exercises. If source is short, use internal knowledge of MoEYS curriculum. Never return empty questions.",
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
                required: ["id", "type", "question", "answer"]
              }
            }
          },
          required: ["title", "questions"]
        }
      },
    });
    return response;
  };

  try {
    let response;
    try {
      response = await generateWithModel("gemini-3.1-pro-preview");
    } catch (proError: any) {
      console.warn("Pro model failed, falling back to Flash model:", proError);
      response = await generateWithModel("gemini-3-flash-preview");
    }

    const text = response.text || '{}';
    const cleanJson = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Generation Error:", error);
    
    // Extract detailed error message
    let errorMessage = "Unknown error";
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = "Could not stringify error object";
      }
    }

    throw new Error(`Failed to generate test: ${errorMessage}. \n\nTroubleshooting:\n1. Ensure you have REDEPLOYED on Vercel after adding the GEMINI_API_KEY variable.\n2. Check if your API key is restricted by region or IP.\n3. Verify your quota in Google AI Studio.`);
  }
};

// --- Image Generation Service ---

const generateImage = async (prompt: string, retries = 2) => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) return null;

  for (let i = 0; i <= retries; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error) {
      console.error(`Image Generation Attempt ${i + 1} failed:`, error);
      if (i === retries) return null;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
    }
  }
  return null;
};

// --- App Component ---

const MathMarkdown = ({ content }: { content: string }) => {
  if (!content) return null;
  // Simple regex to find $...$ or $$...$$
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  
  return (
    <div className="markdown-body">
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <BlockMath key={i} math={part.slice(2, -2)} />;
        } else if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        } else {
          return <Markdown key={i}>{part}</Markdown>;
        }
      })}
    </div>
  );
};

export default function App() {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [grade, setGrade] = useState('1');
  const [language, setLanguage] = useState(LANGUAGES[1]); // Khmer
  const [exerciseConfigs, setExerciseConfigs] = useState<ExerciseConfig[]>(INITIAL_EXERCISE_TYPES);
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
  const [isExporting, setIsExporting] = useState(false);
  const [protocols, setProtocols] = useState<MasterProtocol[]>(INITIAL_PROTOCOLS);
  const [strictRules, setStrictRules] = useState<StrictRule[]>(INITIAL_STRICT_RULES);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'Backbone Logic' | 'General' | 'Engine' | 'Exercises' | 'Design'>('Backbone Logic');
  const [protocolCategory, setProtocolCategory] = useState<'General' | 'Grammar' | 'Vocabulary' | 'Reading'>('General');
  const [brandSettings, setBrandSettings] = useState<BrandSettings>(() => {
    try {
      const saved = localStorage.getItem('dp_brand_v46');
      return saved ? JSON.parse(saved) : DEFAULT_BRAND_SETTINGS;
    } catch (e) {
      return DEFAULT_BRAND_SETTINGS;
    }
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    localStorage.setItem('dp_brand_v46', JSON.stringify(brandSettings));
  }, [brandSettings]);

  useEffect(() => {
    // Close sidebar on mobile when view changes
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [view]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/tests');
      const data = await res.json();
      setHistory(data.map((item: any) => ({
        ...item,
        config: JSON.parse(item.config),
        questions: JSON.parse(item.content)
      })));
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    }
  });

  const handleToggleExercise = (id: string) => {
    setExerciseConfigs(prev => prev.map(ex => 
      ex.id === id ? { ...ex, selected: !ex.selected } : ex
    ));
  };

  const handleUpdateItemCount = (id: string, delta: number) => {
    setExerciseConfigs(prev => prev.map(ex => 
      ex.id === id ? { ...ex, itemCount: Math.max(1, ex.itemCount + delta) } : ex
    ));
  };

  const handleUpdateColumns = (id: string, delta: number) => {
    setExerciseConfigs(prev => prev.map(ex => 
      ex.id === id ? { ...ex, columns: Math.max(1, Math.min(6, ex.columns + delta)) } : ex
    ));
  };

  const handleGenerate = async () => {
    if (!sourceText && files.length === 0) {
      alert("Please provide source text or upload files.");
      return;
    }

    setIsGenerating(true);
    try {
      const selectedExercises = exerciseConfigs.filter(ex => ex.selected && ex.subject === subject);
      
      const config: TestConfig = {
        numberStyle,
        showAnswerKeys,
        font,
        fontSize,
        exerciseConfigs: selectedExercises,
        strictRules: strictRules,
        protocols: protocols,
      };

      let inlineData: { data: string; mimeType: string }[] | undefined;
      if (files.length > 0) {
        inlineData = await Promise.all(files.map(async file => {
          return new Promise<{ data: string; mimeType: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve({ data: base64, mimeType: file.type });
            };
            reader.readAsDataURL(file);
          });
        }));
      }

      const result = await generateTest(subject, grade, language, config, { 
        text: sourceText, 
        inlineData 
      });

      // Generate images for questions with image prompts (sequentially to avoid rate limits)
      const questionsWithImages: Question[] = [];
      for (const q of result.questions) {
        if (q.image_prompt) {
          const imageUrl = await generateImage(q.image_prompt);
          questionsWithImages.push({ ...q, image_url: imageUrl || undefined });
        } else {
          questionsWithImages.push(q);
        }
      }

      const newTestData: TestData = {
        title: result.title,
        subject,
        grade,
        language,
        config,
        questions: questionsWithImages,
        sourceText: result.source_text
      };

      setTestData(newTestData);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      
      await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTestData.title,
          subject,
          grade,
          language,
          config,
          content: newTestData.questions
        })
      });
      
      fetchHistory();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToPDF = async () => {
    if (!testData) return;
    setIsExporting(true);
    try {
      const element = document.getElementById('test-preview');
      if (!element) return;

      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${testData.title.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToHtml = () => {
    if (!testData) return;
    const element = document.getElementById('test-preview');
    if (!element) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="km">
      <head>
        <meta charset="UTF-8">
        <title>${testData.title}</title>
        <style>
          body { font-family: '${font}', sans-serif; font-size: ${fontSize}; padding: 40px; max-width: 800px; margin: 0 auto; color: #1e293b; line-height: 1.4; }
          h1 { text-align: center; font-size: 1.5em; font-weight: 900; margin-bottom: 5px; }
          .header-meta { text-align: center; font-size: 0.9em; font-weight: 700; margin-bottom: 20px; color: #64748b; }
          .module-title { font-size: 1.1em; font-weight: 900; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #f1f5f9; padding-bottom: 5px; }
          .question-item { margin-bottom: 15px; }
          .question-text { font-weight: 700; margin-bottom: 5px; display: flex; gap: 8px; }
          .options-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
          .option-item { display: flex; gap: 4px; font-size: 0.95em; font-weight: 600; }
          .option-label { color: #f97316; font-weight: 900; }
          .image-container { text-align: center; margin: 15px 0; }
          .image-container img { max-width: 250px; border-radius: 12px; border: 1px solid #e2e8f0; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>${testData.title}</h1>
        <div class="header-meta">Subject: ${testData.subject} | Grade: ${testData.grade} | Language: ${testData.language}</div>
        
        ${testData.source_text ? `
          <div style="margin: 30px 0; padding: 20px; background: #f8fafc; border-left: 4px solid #f97316; border-radius: 8px; font-style: italic; line-height: 1.6; color: #334155;">
            <div style="font-weight: 900; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #f97316; margin-bottom: 10px;">អត្ថបទប្រភព (Source Text)</div>
            ${testData.source_text}
          </div>
        ` : ''}

        ${Array.from(new Set(testData.questions.map(q => q.module_label))).map(label => `
          <div class="module-title">${label}</div>
          ${testData.questions.filter(q => q.module_label === label).map((q, i) => `
            <div class="question-item">
              <div class="question-text">
                <span>${i + 1}.</span>
                <div>${q.question}</div>
              </div>
              ${q.image_url ? `<div class="image-container"><img src="${q.image_url}" /></div>` : ''}
              ${q.options ? `
                <div class="options-container" style="${q.options_layout === 'double' ? 'display: grid; grid-template-columns: 1fr 1fr;' : q.options_layout === 'vertical' ? 'flex-direction: column;' : ''}">
                  ${q.options.map((opt, optIdx) => `
                    <div class="option-item">
                      <span class="option-label">${getOptionLabel(optIdx, testData.config.numberStyle)}.</span>
                      <span>${cleanOptionText(opt)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        `).join('')}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    saveAs(blob, `${testData.title.replace(/\s+/g, '_')}.html`);
  };

  const exportToDocx = async () => {
    if (!testData) return;
    setIsExporting(true);
    try {
      const children: any[] = [];

      // Add Branding Header
      if (brandSettings.logoData) {
        try {
          const response = await fetch(brandSettings.logoData);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          
          children.push(new Paragraph({
            children: [
              new ImageRun({
                data: arrayBuffer,
                transformation: { width: brandSettings.logoWidth, height: (brandSettings.logoWidth / 2) }, // Approximate aspect ratio
              } as any),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }));

          children.push(new Paragraph({
            children: [
              new TextRun({ 
                text: brandSettings.schoolName, 
                bold: true, 
                size: (brandSettings.fontSize + 4) * 2,
                allCaps: true 
              }),
            ],
            alignment: AlignmentType.CENTER,
          }));

          children.push(new Paragraph({
            children: [
              new TextRun({ 
                text: brandSettings.schoolAddress, 
                size: 20,
                color: "64748b"
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
          }));
        } catch (e) {
          console.error("Logo export error for DOCX:", e);
        }
      }

      children.push(
        new Paragraph({
          text: testData.title,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Subject: ${testData.subject}`, bold: true }),
            new TextRun({ text: ` | Grade: ${testData.grade}`, bold: true }),
            new TextRun({ text: ` | Language: ${testData.language}`, bold: true }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
        })
      );

      if (testData.source_text) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "អត្ថបទប្រភព (Source Text)", bold: true, color: "f97316", size: 20 }),
          ],
          spacing: { before: 240, after: 120 },
        }));
        children.push(new Paragraph({
          children: [
            new TextRun({ text: testData.source_text, italics: true, color: "334155" }),
          ],
          spacing: { after: 240 },
          indent: { left: 400, right: 400 },
        }));
      }

      // Group by module
      const modules = Array.from(new Set(testData.questions.map(q => q.module_label)));
      for (const label of modules) {
        children.push(new Paragraph({
          text: label,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        }));

        const moduleQuestions = testData.questions.filter(q => q.module_label === label);
        for (const [i, q] of moduleQuestions.entries()) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${i + 1}. `, bold: true }),
              new TextRun({ text: q.question }),
            ],
            spacing: { before: 120, after: 60 },
            indent: { left: 400, hanging: 400 },
          }));

          if (q.image_url) {
            try {
              const response = await fetch(q.image_url);
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              children.push(new Paragraph({
                children: [
                  new ImageRun({
                    data: arrayBuffer,
                    transformation: { width: 250, height: 160 },
                  } as any),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
              }));
            } catch (e) {
              console.error("Image fetch error for DOCX:", e);
            }
          }

          if (q.options) {
            if (q.options_layout === 'single') {
              const textParts: TextRun[] = [];
              q.options.forEach((opt, optIdx) => {
                if (optIdx > 0) {
                  textParts.push(new TextRun({ text: " ".repeat(15) }));
                }
                textParts.push(new TextRun({ text: `${getOptionLabel(optIdx, testData.config.numberStyle)}. `, bold: true, color: "f97316" }));
                textParts.push(new TextRun({ text: cleanOptionText(opt) }));
              });
              children.push(new Paragraph({
                children: textParts,
                indent: { left: 700 }, // ~7 spaces
                spacing: { after: 120 },
              }));
            } else if (q.options_layout === 'double') {
              // 2x2 grid using a table (Vertical-first: A-C, B-D)
              const half = Math.ceil(q.options.length / 2);
              const rows: TableRow[] = [];
              for (let i = 0; i < half; i++) {
                const cells = [
                  new TableCell({
                    children: [new Paragraph({
                      children: [
                        new TextRun({ text: `${getOptionLabel(i, testData.config.numberStyle)}. `, bold: true, color: "f97316" }),
                        new TextRun({ text: cleanOptionText(q.options[i]) }),
                      ],
                      spacing: { after: 0 },
                    })],
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                    width: { size: 45, type: WidthType.PERCENTAGE },
                  })
                ];
                if (q.options[i + half]) {
                  cells.push(new TableCell({
                    children: [new Paragraph({
                      children: [
                        new TextRun({ text: `${getOptionLabel(i + half, testData.config.numberStyle)}. `, bold: true, color: "f97316" }),
                        new TextRun({ text: cleanOptionText(q.options[i + half]) }),
                      ],
                      spacing: { after: 0 },
                    })],
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                    width: { size: 45, type: WidthType.PERCENTAGE },
                  }));
                } else {
                  cells.push(new TableCell({ children: [], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }));
                }
                rows.push(new TableRow({ children: cells }));
              }
              children.push(new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                indent: { size: 700, type: WidthType.DXA }, // ~7 spaces
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
              }));
            } else {
              // Vertical layout
              q.options.forEach((opt, optIdx) => {
                children.push(new Paragraph({
                  children: [
                    new TextRun({ text: `${getOptionLabel(optIdx, testData.config.numberStyle)}. `, bold: true, color: "f97316" }),
                    new TextRun({ text: cleanOptionText(opt) }),
                  ],
                  spacing: { after: 40 },
                  indent: { left: 700 }, // ~7 spaces
                }));
              });
            }
          }
        }
      }

      const halfPoints = parseInt(fontSize) * 2 || 22;
      const doc = new Document({
        styles: {
          default: {
            document: {
              run: {
                size: halfPoints,
                font: font,
              },
            },
          },
        },
        sections: [{
          properties: {
            page: {
              margin: {
                top: 720, // 0.5 inch
                bottom: 720,
                left: 720,
                right: 720,
              },
            },
          },
          children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${testData.title.replace(/\s+/g, '_')}.docx`);
    } catch (error) {
      console.error("DOCX Export Error:", error);
      alert("Failed to export DOCX.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this test?")) return;
    try {
      await fetch(`/api/tests/${id}`, { method: 'DELETE' });
      fetchHistory();
      if (testData?.id === id) setTestData(null);
    } catch (error) {
      alert("Failed to delete test.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
      {/* Mobile Header Toggle */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-600/20">
            <Zap className="text-white" size={16} />
          </div>
          <h1 className="font-black text-lg tracking-tight">TestBuilder</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto transition-transform duration-300 md:relative md:translate-x-0 md:z-30 md:max-h-screen md:sticky",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between mb-2">
          {brandSettings.logoData ? (
            <div className="flex flex-col items-center p-4 w-full">
              <img 
                src={brandSettings.logoData} 
                alt="School Logo" 
                className="mb-4 rounded-lg shadow-lg" 
                style={{ width: '100%', maxWidth: `${brandSettings.logoWidth}px` }} 
              />
              <h1 className="text-slate-900 font-black uppercase tracking-tight text-center" style={{ fontSize: `${brandSettings.fontSize}px`, fontWeight: brandSettings.fontWeight }}>
                {brandSettings.schoolName}
              </h1>
              <p className="text-[10px] text-slate-400 text-center">
                {brandSettings.schoolAddress}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
                <Zap className="text-white" size={24} />
              </div>
              <div>
                <h1 className="font-black text-xl tracking-tight leading-none">TestBuilder</h1>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">MoEYS Standard AI</p>
              </div>
            </div>
          )}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
          >
            <Settings size={20} />
          </button>
        </div>

        <nav className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          <button 
            onClick={() => setView('build')}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
              view === 'build' ? "bg-white shadow-sm text-brand" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Plus size={14} />
            Build
          </button>
          <button 
            onClick={() => setView('history')}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
              view === 'history' ? "bg-white shadow-sm text-brand" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <History size={14} />
            History
          </button>
        </nav>

        {view === 'build' ? (
          <div className="space-y-6">
            <section className="space-y-4">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Settings size={12} />
                Configuration
              </label>
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Subject</span>
                  <select 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-brand/10 outline-none transition-all"
                  >
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Grade</span>
                    <select 
                      value={grade} 
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-brand/10 outline-none transition-all"
                    >
                      {Array.from({length: 12}, (_, i) => i + 1).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Language</span>
                    <select 
                      value={language} 
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-brand/10 outline-none transition-all"
                    >
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <BookOpen size={12} />
                Exercise Modules
              </label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {exerciseConfigs.filter(ex => ex.subject === subject).map(ex => (
                  <motion.div 
                    layout
                    key={ex.id} 
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer group",
                      ex.selected ? "bg-brand/5 border-brand/20" : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    )}
                    onClick={() => handleToggleExercise(ex.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          ex.selected ? "bg-brand border-brand text-white" : "bg-white border-slate-300"
                        )}>
                          {ex.selected && <CheckCircle2 size={12} />}
                        </div>
                        <span className={cn("text-xs font-bold", ex.selected ? "text-brand" : "text-slate-600")}>{ex.label}</span>
                      </div>
                      <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-1.5 py-1 shadow-sm">
                          <button onClick={() => handleUpdateItemCount(ex.id, -1)} className="p-0.5 hover:text-brand text-slate-400 transition-colors"><Minus size={12}/></button>
                          <span className="text-[10px] font-black w-4 text-center">{ex.itemCount}</span>
                          <button onClick={() => handleUpdateItemCount(ex.id, 1)} className="p-0.5 hover:text-brand text-slate-400 transition-colors"><Plus size={12}/></button>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-1.5 py-1 shadow-sm">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Cols</span>
                          <button onClick={() => handleUpdateColumns(ex.id, -1)} className="p-0.5 hover:text-brand text-slate-400 transition-colors"><Minus size={10}/></button>
                          <span className="text-[10px] font-black w-3 text-center">{ex.columns}</span>
                          <button onClick={() => handleUpdateColumns(ex.id, 1)} className="p-0.5 hover:text-brand text-slate-400 transition-colors"><Plus size={10}/></button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Languages size={12} />
                Styling
              </label>
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Numbering</span>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                    <button 
                      onClick={() => setNumberStyle('Khmer')}
                      className={cn("flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all", numberStyle === 'Khmer' ? "bg-white shadow-sm text-brand" : "text-slate-500")}
                    >
                      KHMER
                    </button>
                    <button 
                      onClick={() => setNumberStyle('Roman')}
                      className={cn("flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all", numberStyle === 'Roman' ? "bg-white shadow-sm text-brand" : "text-slate-500")}
                    >
                      ROMAN
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-all" onClick={() => setShowAnswerKeys(!showAnswerKeys)}>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Show answer keys</span>
                  <div className={cn(
                    "w-10 h-5 rounded-full relative transition-all",
                    showAnswerKeys ? "bg-brand" : "bg-slate-300"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                      showAnswerKeys ? "left-6" : "left-1"
                    )} />
                  </div>
                </div>
              </div>
            </section>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-4 bg-brand text-white font-black text-sm rounded-2xl shadow-xl shadow-brand/20 hover:bg-brand/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <BrainCircuit size={20} />}
              {isGenerating ? "GENERATING..." : "BUILD TEST"}
            </button>

            <section className="pt-4 border-t border-slate-100 space-y-4">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <ExternalLink size={12} />
                Math Resources
              </label>
              <div className="grid grid-cols-1 gap-2">
                <a 
                  href="https://keoserey.wordpress.com/%E1%9E%9F%E1%9F%80%E1%9E%9C%E1%9E%97%E1%9F%85%E1%9E%8A%E1%9F%84%E1%9E%93%E1%9E%A1%E1%9E%BC%E1%9E%8F/%E1%9E%82%E1%9E%8E%E1%9E%B7%E1%9E%8F%E1%9E%9C%E1%9E%B7%E1%9E%91%E1%9F%92%E1%9E%99%E1%9E%B6/khmer-maths-books/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-brand/30 hover:bg-brand/5 transition-all group"
                >
                  <div className="p-2 bg-white rounded-lg border border-slate-200 group-hover:border-brand/20 transition-all">
                    <Book size={14} className="text-slate-400 group-hover:text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-700 truncate">Khmer Math Books</p>
                    <p className="text-[8px] text-slate-400 font-medium truncate">keoserey.wordpress.com</p>
                  </div>
                </a>
                <a 
                  href="https://drive.google.com/drive/folders/1RVqruXlaw-EcyA2Z_xiufcju4gg0QkwU" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-brand/30 hover:bg-brand/5 transition-all group"
                >
                  <div className="p-2 bg-white rounded-lg border border-slate-200 group-hover:border-brand/20 transition-all">
                    <FolderOpen size={14} className="text-slate-400 group-hover:text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-700 truncate">Math Source Drive</p>
                    <p className="text-[8px] text-slate-400 font-medium truncate">Google Drive Folder</p>
                  </div>
                </a>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
            {history.length === 0 ? (
              <div className="text-center py-20 text-slate-300">
                <History size={48} className="mx-auto mb-4 opacity-10" />
                <p className="text-xs font-bold uppercase tracking-widest">No history yet</p>
              </div>
            ) : (
              history.map(item => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={item.id} 
                  className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 transition-all group cursor-pointer relative overflow-hidden" 
                  onClick={() => { 
                    setTestData(item); 
                    setView('build'); 
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-brand bg-brand/10 px-2 py-1 rounded-lg">{item.subject}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id!); }}
                      className="text-slate-200 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold line-clamp-1 mb-1 group-hover:text-brand transition-colors">{item.title}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <span>Grade {item.grade}</span>
                    <span>•</span>
                    <span>{item.language}</span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {!testData && !isGenerating ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-10 py-10"
            >
              <div className="text-center space-y-4">
                <motion.div 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="inline-block p-4 bg-brand/10 rounded-3xl text-brand mb-2"
                >
                  <BrainCircuit size={48} />
                </motion.div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tight">Create a New Test</h2>
                <p className="text-slate-500 text-lg max-w-xl mx-auto">Upload your source material or paste text to begin AI-powered test generation.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Source Text</label>
                    <button onClick={() => setSourceText('')} className="text-[10px] font-bold text-slate-400 hover:text-brand transition-colors">CLEAR</button>
                  </div>
                  <div className="relative group">
                    <textarea 
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      placeholder="Paste your lesson content, curriculum notes, or raw text here..."
                      className="w-full h-80 p-6 bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 focus:ring-8 focus:ring-brand/5 outline-none resize-none text-sm leading-relaxed transition-all group-hover:border-slate-300"
                    />
                    <div className="absolute bottom-4 right-4 text-[10px] font-bold text-slate-300">
                      {sourceText.length} characters
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Source Files</label>
                  <div 
                    {...getRootProps()} 
                    className={cn(
                      "h-80 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-6 transition-all cursor-pointer relative overflow-hidden group",
                      isDragActive ? "border-brand bg-brand/5" : "border-slate-200 bg-white hover:border-brand/30 hover:bg-slate-50/50"
                    )}
                  >
                    <input {...getInputProps()} />
                    <div className="p-6 bg-slate-50 rounded-3xl text-slate-400 group-hover:scale-110 transition-transform group-hover:text-brand">
                      <Upload size={40} />
                    </div>
                    <div className="text-center px-6">
                      <p className="text-lg font-black text-slate-700">Drop files here</p>
                      <p className="text-sm text-slate-400 mt-2">Images (JPG/PNG), PDFs, or Text files</p>
                    </div>
                    {isDragActive && (
                      <div className="absolute inset-0 bg-brand/10 backdrop-blur-[2px] flex items-center justify-center">
                        <p className="text-brand font-black text-xl">Drop to upload</p>
                      </div>
                    )}
                  </div>
                  
                  <AnimatePresence>
                    {files.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex flex-wrap gap-2 pt-2"
                      >
                        {files.map((file, i) => (
                          <motion.div 
                            layout
                            key={i} 
                            className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-2xl text-xs font-bold text-slate-600 shadow-sm"
                          >
                            <FileText size={14} className="text-brand" />
                            <span className="max-w-[120px] truncate">{file.name}</span>
                            <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 transition-colors">
                              <X size={14}/>
                            </button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ) : isGenerating ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center gap-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-brand/20 blur-[100px] rounded-full animate-pulse" />
                <div className="relative z-10 w-32 h-32 flex items-center justify-center">
                  <Loader2 className="animate-spin text-brand" size={80} />
                  <BrainCircuit className="absolute text-brand/30" size={40} />
                </div>
              </div>
              <div className="text-center space-y-3 max-w-md">
                <h3 className="text-3xl font-black tracking-tight">Building your test...</h3>
                <p className="text-slate-500 leading-relaxed">Our AI is analyzing the MoEYS curriculum standards and your source material to generate high-quality exercises.</p>
                <div className="flex gap-2 justify-center pt-4">
                  <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-brand rounded-full animate-bounce" />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-5xl mx-auto space-y-8 pb-20"
            >
              {/* Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/50 sticky top-6 z-40">
                <div className="flex items-center gap-5">
                  <button 
                    onClick={() => setTestData(null)} 
                    className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all active:scale-90"
                  >
                    <ChevronRight className="rotate-180" size={20} />
                  </button>
                  <div>
                    <h2 className="font-black text-xl tracking-tight leading-none">{testData?.title}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand bg-brand/10 px-2 py-0.5 rounded-lg">GRADE {testData?.grade}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{testData?.subject}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={exportToDocx} 
                    disabled={isExporting}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 py-3 bg-slate-100 text-slate-700 font-black rounded-2xl hover:bg-slate-200 transition-all text-xs disabled:opacity-50"
                  >
                    <FileText size={18} />
                    DOCX
                  </button>
                  <button 
                    onClick={exportToHtml} 
                    className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 py-3 bg-slate-100 text-slate-700 font-black rounded-2xl hover:bg-slate-200 transition-all text-xs"
                  >
                    <Share2 size={18} />
                    HTML
                  </button>
                  <button 
                    onClick={exportToPDF} 
                    disabled={isExporting}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 shadow-xl shadow-slate-900/20 transition-all text-xs disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                    PDF
                  </button>
                </div>
              </div>

              {/* Preview Container */}
              <div className="relative group">
                <div className="absolute -inset-4 bg-brand/5 blur-3xl rounded-[4rem] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div 
                  id="test-preview" 
                  className="bg-white p-16 rounded-[2.5rem] border border-slate-200 shadow-2xl relative z-10 mx-auto overflow-hidden" 
                  style={{ 
                    fontFamily: font, 
                    fontSize: fontSize,
                    width: '210mm',
                    minHeight: '297mm'
                  }}
                >
                  {/* Header */}
                  <div className="text-center space-y-10 mb-16">
                    {brandSettings.logoData && (
                      <div className="flex flex-col items-center mb-6">
                        <img 
                          src={brandSettings.logoData} 
                          alt="School Logo" 
                          className="mb-4" 
                          style={{ width: '100%', maxWidth: `${brandSettings.logoWidth}px` }} 
                        />
                        <h2 className="text-slate-900 font-black uppercase tracking-tight text-center" style={{ fontSize: `${brandSettings.fontSize + 4}px`, fontWeight: brandSettings.fontWeight }}>
                          {brandSettings.schoolName}
                        </h2>
                        <p className="text-xs text-slate-400 text-center font-bold">
                          {brandSettings.schoolAddress}
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between items-start text-sm">
                      <div className="text-left space-y-2">
                        <p className="font-bold">សាលារៀន: {brandSettings.logoData ? brandSettings.schoolName : "........................................................."}</p>
                        <p className="font-bold">ឈ្មោះសិស្ស: .........................................................</p>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="font-bold">កាលបរិច្ឆេទ: ....../....../......</p>
                        <p className="font-bold">ថ្នាក់ទី: {testData?.grade}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h1 className="text-3xl font-black uppercase tracking-tight border-b-4 border-slate-900 pb-6 inline-block">{testData?.title}</h1>
                      <div className="flex justify-center gap-8 text-sm font-bold">
                        <p>វិញ្ញាសា: {testData?.subject}</p>
                        <p>រយៈពេល: ........... នាទី</p>
                      </div>
                    </div>
                  </div>

                  {/* Source Text Section */}
                  {testData?.source_text && (
                    <div className="mb-16 p-8 bg-slate-50 rounded-[2rem] border border-slate-100 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-brand" />
                      <div className="flex items-center gap-2 mb-4 text-[10px] font-black uppercase tracking-widest text-brand">
                        <BookOpen size={14} />
                        អត្ថបទប្រភព (Source Text)
                      </div>
                      <div className="text-lg leading-relaxed text-slate-700 whitespace-pre-wrap font-medium italic">
                        {testData.source_text}
                      </div>
                    </div>
                  )}

                  {/* Questions */}
                  <div className="space-y-16">
                    {Array.from(new Set(testData?.questions.map(q => q.module_label))).map((label, groupIdx) => (
                      <div key={groupIdx} className="space-y-8">
                        <div className="flex items-center gap-4">
                          <div className="h-px bg-slate-200 flex-1" />
                          <h3 className="text-xl font-black px-6 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">{label}</h3>
                          <div className="h-px bg-slate-200 flex-1" />
                        </div>
                        
                        <div 
                          className={cn(
                            "gap-x-12",
                            (() => {
                              const config = testData.config.exerciseConfigs.find(c => c.label === label);
                              const cols = config?.columns || 1;
                              if (cols === 1) return "columns-1";
                              if (cols === 2) return "columns-2";
                              if (cols === 3) return "columns-3";
                              if (cols === 4) return "columns-4";
                              if (cols === 5) return "columns-5";
                              if (cols === 6) return "columns-6";
                              return "columns-1";
                            })()
                          )}
                          style={{
                            columnRule: '1px solid #e2e8f0',
                            columnGap: '3rem'
                          }}
                        >
                          {testData?.questions.filter(q => q.module_label === label).map((q, qIdx) => (
                            <div key={q.id} className={cn(
                              "break-inside-avoid",
                              (() => {
                                const config = testData.config.exerciseConfigs.find(c => c.label === label);
                                const cols = config?.columns || 1;
                                // Add border and padding to items that are not in the first column
                                return qIdx % cols !== 0 ? "pl-12 border-l-2 border-slate-100" : "";
                              })()
                            )}>
                              <div className="flex gap-3">
                                <span className="font-black text-lg text-brand leading-tight">{qIdx + 1}.</span>
                                <div className="flex-1">
                                  <div className="text-base font-bold leading-snug">
                                    <MathMarkdown content={q.question} />
                                  </div>
                                  
                                  {q.image_url && (
                                    <div className="mt-3 mb-3 flex justify-center">
                                      <div className="max-w-[320px] w-full p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                                        <img 
                                          src={q.image_url} 
                                          alt={q.image_prompt || "Question illustration"} 
                                          className="w-full h-auto rounded-lg"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    </div>
                                  )}
                                  {q.options && (
                                    <div 
                                      className={cn(
                                        "mt-2",
                                        q.options_layout === 'single' ? "flex flex-wrap gap-x-[15ch] pl-[7ch]" : 
                                        q.options_layout === 'double' ? "grid grid-cols-2 grid-flow-col gap-x-[15ch] gap-y-1 pl-[7ch]" : 
                                        "flex flex-col gap-1 pl-[7ch]"
                                      )}
                                      style={q.options_layout === 'double' ? { 
                                        gridTemplateRows: `repeat(${Math.ceil(q.options.length / 2)}, minmax(0, 1fr))` 
                                      } : {}}
                                    >
                                      {q.options.map((opt, optIdx) => (
                                        <div 
                                          key={optIdx} 
                                          className="flex items-center gap-2"
                                        >
                                          <span className="font-black text-brand text-sm">
                                            {getOptionLabel(optIdx, testData.config.numberStyle)}.
                                          </span>
                                          <span className="text-sm font-bold text-slate-800">
                                            {cleanOptionText(opt)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {q.explanation && testData.config.showAnswerKeys && (
                                    <div className={cn(
                                      "mt-6 p-6 rounded-2xl border",
                                      q.type === 'ma_deep_exp' 
                                        ? "bg-brand/5 border-brand/20 shadow-sm" 
                                        : "bg-slate-50 border-slate-100"
                                    )}>
                                      <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-widest text-brand">
                                        <FileText size={14} />
                                        {q.type === 'ma_deep_exp' ? "ដំណោះស្រាយលម្អិត (Detailed Solution)" : "ការពន្យល់ (Explanation)"}
                                      </div>
                                      <div className={cn(
                                        "text-sm leading-relaxed text-slate-700",
                                        q.type === 'ma_deep_exp' ? "font-medium" : ""
                                      )}>
                                        <MathMarkdown content={q.explanation} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Footer */}
                  <div className="mt-32 pt-12 border-t-2 border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                    <span>MoEYS Curriculum Standard</span>
                    <span>Khmer Program Test Builder AI</span>
                    <span>Page 1 of 1</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Modal (Workspace Control Node) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <h2 className="font-black text-sm uppercase tracking-widest text-slate-900">Workspace Control Node</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="px-8 py-4 flex justify-center gap-4 border-b border-slate-100">
                {['ACCOUNT', 'COMMAND', 'ENGINE', 'BACKBONE LOGIC', 'DISPLAY', 'DESIGN'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      if (tab === 'BACKBONE LOGIC') setSettingsTab('Backbone Logic');
                      if (tab === 'ENGINE') setSettingsTab('Exercises');
                      if (tab === 'DESIGN') setSettingsTab('Design');
                    }}
                    className={cn(
                      "px-6 py-2 rounded-full text-[10px] font-black tracking-widest transition-all",
                      (settingsTab === 'Backbone Logic' && tab === 'BACKBONE LOGIC') ||
                      (settingsTab === 'Exercises' && tab === 'ENGINE') ||
                      (settingsTab === 'Design' && tab === 'DESIGN')
                        ? "bg-brand text-white shadow-lg shadow-brand/20"
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {settingsTab === 'Exercises' && (
                  <div className="space-y-10">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Exercise Modules</h3>
                        <button 
                          onClick={() => {
                            const newType: ExerciseConfig = {
                              id: `new_${Date.now()}`,
                              label: 'New Exercise Type',
                              rule: 'Enter AI generation rules here...',
                              description: 'Description of the new exercise type',
                              itemCount: 5,
                              selected: false,
                              active: true,
                              columns: 1,
                              subject: subject,
                              icon: 'HelpCircle'
                            };
                            setExerciseConfigs(prev => [...prev, newType]);
                          }}
                          className="flex items-center gap-2 text-[10px] font-black text-blue-600 hover:opacity-70"
                        >
                          <Plus size={14} />
                          NEW MODULE
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {exerciseConfigs.map(config => (
                          <div key={config.id} className="p-6 bg-white border border-slate-100 rounded-3xl space-y-4 hover:shadow-xl transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                  <Settings size={16} />
                                </div>
                                <input 
                                  value={config.label}
                                  onChange={(e) => setExerciseConfigs(prev => prev.map(c => c.id === config.id ? { ...c, label: e.target.value } : c))}
                                  className="text-xs font-black tracking-tight text-slate-900 bg-transparent border-none focus:ring-0 p-0 w-full"
                                />
                              </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setExerciseConfigs(prev => prev.filter(c => c.id !== config.id))}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                              <button 
                                onClick={() => setExerciseConfigs(prev => prev.map(c => c.id === config.id ? { ...c, active: !c.active } : c))}
                                className={cn(
                                  "w-10 h-5 rounded-full relative transition-all",
                                  config.active ? "bg-blue-600" : "bg-slate-300"
                                )}
                              >
                                <div className={cn(
                                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                  config.active ? "right-1" : "left-1"
                                )} />
                              </button>
                            </div>
                            </div>
                            <textarea 
                              value={config.description}
                              onChange={(e) => setExerciseConfigs(prev => prev.map(c => c.id === config.id ? { ...c, description: e.target.value } : c))}
                              className="w-full text-[10px] text-slate-400 font-bold leading-relaxed bg-slate-50 rounded-xl p-3 border-none focus:ring-0 resize-none h-20"
                            />
                            <div className="flex items-center justify-between pt-2">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default Items</span>
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => setExerciseConfigs(prev => prev.map(c => c.id === config.id ? { ...c, itemCount: Math.max(1, c.itemCount - 1) } : c))}
                                    className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-black text-slate-900 min-w-[2ch] text-center">{config.itemCount}</span>
                                  <button 
                                    onClick={() => setExerciseConfigs(prev => prev.map(c => c.id === config.id ? { ...c, itemCount: Math.min(50, c.itemCount + 1) } : c))}
                                    className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cols</span>
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => setExerciseConfigs(prev => prev.map(c => c.id === config.id ? { ...c, columns: Math.max(1, c.columns - 1) } : c))}
                                    className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-black text-slate-900 min-w-[2ch] text-center">{config.columns}</span>
                                  <button 
                                    onClick={() => setExerciseConfigs(prev => prev.map(c => c.id === config.id ? { ...c, columns: Math.min(6, c.columns + 1) } : c))}
                                    className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {settingsTab === 'Design' && (
                  <div className="space-y-10">
                    <div className="space-y-6">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Branding & Identity</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">School Name</label>
                            <input 
                              type="text"
                              value={brandSettings.schoolName}
                              onChange={(e) => setBrandSettings(prev => ({ ...prev, schoolName: e.target.value }))}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand/10 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">School Address</label>
                            <input 
                              type="text"
                              value={brandSettings.schoolAddress}
                              onChange={(e) => setBrandSettings(prev => ({ ...prev, schoolAddress: e.target.value }))}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand/10 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase">Logo Width (px)</label>
                              <input 
                                type="number"
                                value={brandSettings.logoWidth}
                                onChange={(e) => setBrandSettings(prev => ({ ...prev, logoWidth: parseInt(e.target.value) || 0 }))}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand/10 outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase">Font Size (pt)</label>
                              <input 
                                type="number"
                                value={brandSettings.fontSize}
                                onChange={(e) => setBrandSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) || 0 }))}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand/10 outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase">School Logo</label>
                          <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                            {brandSettings.logoData ? (
                              <div className="relative group">
                                <img 
                                  src={brandSettings.logoData} 
                                  alt="Logo Preview" 
                                  className="max-h-40 rounded-xl shadow-lg"
                                />
                                <button 
                                  onClick={() => setBrandSettings(prev => ({ ...prev, logoData: "" }))}
                                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="text-center space-y-2">
                                <Upload className="mx-auto text-slate-300" size={32} />
                                <p className="text-[10px] font-bold text-slate-400">Upload your school logo (PNG/JPG)</p>
                              </div>
                            )}
                            <input 
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    setBrandSettings(prev => ({ ...prev, logoData: reader.result as string }));
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                              id="logo-upload"
                            />
                            <label 
                              htmlFor="logo-upload"
                              className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black tracking-widest cursor-pointer hover:bg-slate-50 transition-all"
                            >
                              {brandSettings.logoData ? "CHANGE LOGO" : "SELECT LOGO"}
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {settingsTab === 'Backbone Logic' && (
                  <div className="space-y-10">
                    {/* Master Protocols Section */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Master Protocols</h3>
                        <button 
                          onClick={() => {
                            const newProtocol: MasterProtocol = {
                              id: `p_${Date.now()}`,
                              title: 'New Protocol',
                              description: 'Enter protocol instructions here...',
                              category: protocolCategory,
                              level: 'Medium',
                              active: true
                            };
                            setProtocols(prev => [...prev, newProtocol]);
                          }}
                          className="flex items-center gap-2 text-[10px] font-black text-emerald-600 hover:opacity-70"
                        >
                          <Plus size={14} />
                          NEW PROTOCOL
                        </button>
                      </div>

                      {/* Protocol Categories */}
                      <div className="flex gap-4 border-b border-slate-100 pb-4">
                        {['GENERAL', 'GRAMMAR', 'VOCABULARY', 'READING'].map(cat => (
                          <button
                            key={cat}
                            onClick={() => setProtocolCategory(cat.charAt(0) + cat.slice(1).toLowerCase() as any)}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all",
                              protocolCategory.toUpperCase() === cat
                                ? "bg-emerald-600 text-white"
                                : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Protocols List */}
                      <div className="space-y-4">
                        {protocols.filter(p => p.category === protocolCategory).map(protocol => (
                          <div key={protocol.id} className="group flex items-center gap-6 p-6 bg-white border border-slate-100 rounded-3xl hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                            <div className="p-3 bg-slate-50 rounded-2xl text-slate-300 group-hover:text-brand transition-colors">
                              <ChevronRight size={20} />
                            </div>
                            <div className="flex-1 space-y-1">
                              <h4 className="text-xs font-black tracking-tight text-slate-900">{protocol.title}</h4>
                              <p className="text-[10px] text-slate-400 font-bold leading-relaxed">{protocol.description}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => setProtocols(prev => prev.filter(p => p.id !== protocol.id))}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[8px] font-black tracking-widest",
                                protocol.level === 'High' ? "bg-red-50 text-red-500" : "bg-orange-50 text-orange-500"
                              )}>
                                {protocol.level.toUpperCase()}
                              </span>
                              <button 
                                onClick={() => setProtocols(prev => prev.map(p => p.id === protocol.id ? { ...p, active: !p.active } : p))}
                                className={cn(
                                  "px-4 py-1 rounded-full text-[8px] font-black tracking-widest transition-all",
                                  protocol.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                                )}
                              >
                                {protocol.active ? 'ACTIVE' : 'INACTIVE'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Strict Rules</h3>
                        <button 
                          onClick={() => {
                            const newRule: StrictRule = {
                              id: `r_${Date.now()}`,
                              title: 'New Strict Rule',
                              description: 'Enter rule description here...',
                              active: true
                            };
                            setStrictRules(prev => [...prev, newRule]);
                          }}
                          className="flex items-center gap-2 text-[10px] font-black text-red-600 hover:opacity-70"
                        >
                          <Plus size={14} />
                          NEW RULE
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {strictRules.map(rule => (
                          <div key={rule.id} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all">
                            <div className="space-y-1">
                              <h4 className="text-[10px] font-black tracking-tight text-slate-900">{rule.title}</h4>
                              <p className="text-[9px] text-slate-400 font-bold">{rule.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => setStrictRules(prev => prev.filter(r => r.id !== rule.id))}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                              <button 
                                onClick={() => setStrictRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))}
                                className={cn(
                                  "w-10 h-5 rounded-full relative transition-all",
                                  rule.active ? "bg-brand" : "bg-slate-300"
                                )}
                              >
                                <div className={cn(
                                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                  rule.active ? "right-1" : "left-1"
                                )} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-center gap-4">
                <button className="px-10 py-4 bg-white border border-slate-200 text-red-500 font-black text-[10px] tracking-widest rounded-full hover:bg-red-50 transition-all">
                  TERMINATE ARCHITECTURE
                </button>
                <button className="px-10 py-4 bg-rose-600 text-white font-black text-[10px] tracking-widest rounded-full hover:bg-rose-700 shadow-xl shadow-rose-600/20 transition-all">
                  HARD RESET
                </button>
                <button className="px-10 py-4 bg-slate-900 text-white font-black text-[10px] tracking-widest rounded-full hover:bg-slate-800 shadow-xl shadow-slate-900/20 transition-all">
                  SYNC SETTINGS
                </button>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-10 py-4 bg-orange-500 text-white font-black text-[10px] tracking-widest rounded-full hover:bg-orange-600 shadow-xl shadow-orange-500/20 transition-all"
                >
                  CLOSE PANEL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E0;
        }
      `}} />
    </div>
  );
}
