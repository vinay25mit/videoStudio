import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';
import { config } from '../config.js';

const palette = { navy: '17324D', blue: '245B7A', teal: '27A6A1', ink: '1D2935', muted: '627487', paper: 'F3F6F9', white: 'FFFFFF', line: 'DFE7ED', paleBlue: 'EAF2F7', paleTeal: 'E7F5F3', green: '16745C', code: '132238', codeText: 'E7EEF7' };

function addAccent(slide, label, page) {
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.12, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
  if (label) slide.addText(label.toUpperCase(), { x: 0.72, y: 0.25, w: 8.8, h: 0.25, fontSize: 9, bold: true, charSpacing: 1.4, color: palette.muted, margin: 0 });
  slide.addShape('line', { x: 0.72, y: 7.08, w: 11.9, h: 0, line: { color: palette.line, width: 0.8 } });
  if (page) slide.addText(String(page).padStart(2, '0'), { x: 12, y: 7.13, w: 0.55, h: 0.2, fontSize: 9, color: palette.muted, align: 'right', margin: 0 });
}

function addTitle(pptx, data, author) {
  const slide = pptx.addSlide(); slide.background = { color: palette.paper };
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 3.45, line: { color: palette.navy, transparency: 100 }, fill: { color: palette.navy } });
  slide.addShape('rect', { x: 0.82, y: 0.85, w: 0.12, h: 1.8, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
  slide.addText(String(data.title), { x: 1.2, y: 0.95, w: 10.9, h: 1.45, fontSize: 34, bold: true, color: palette.white, margin: 0, valign: 'mid', fit: 'shrink' });
  slide.addText([data.subject, data.exam, data.chapter, data.difficulty].filter(Boolean).join('  |  '), { x: 1.22, y: 2.52, w: 10.8, h: 0.42, fontSize: 15, color: 'D8E7EF', margin: 0, fit: 'shrink' });
  slide.addText('LEARNING PRESENTATION', { x: 0.88, y: 4.25, w: 5.8, h: 0.3, fontSize: 11, bold: true, charSpacing: 1.6, color: palette.teal, margin: 0 });
  slide.addShape('line', { x: 0.88, y: 6.48, w: 11.4, h: 0, line: { color: palette.line, width: 1 } });
  slide.addText(author, { x: 0.88, y: 6.7, w: 9, h: 0.3, fontSize: 11, color: palette.muted, margin: 0 });
}

function addClosing(pptx, author) {
  const slide = pptx.addSlide(); slide.background = { color: palette.navy };
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.14, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
  slide.addShape('ellipse', { x: 5.93, y: 1.35, w: 1.45, h: 1.45, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal, transparency: 15 } });
  slide.addText('THANK YOU', { x: 2, y: 3.05, w: 9.33, h: 0.85, fontSize: 34, bold: true, color: palette.white, align: 'center', charSpacing: 1.5, margin: 0 });
  slide.addText('Keep learning. Keep building.', { x: 2, y: 4.12, w: 9.33, h: 0.45, fontSize: 17, color: 'D8E7EF', align: 'center', margin: 0 });
  slide.addText(author, { x: 2, y: 6.55, w: 9.33, h: 0.3, fontSize: 11, color: 'C4D3DE', align: 'center', margin: 0 });
}

function addStyledContentSlide(pptx, title, description, bullets = [], examples = []) {
  const slide = pptx.addSlide(); slide.background = { color: palette.paper }; addAccent(slide, 'Concepts and explanations', pptx._slides.length);
  slide.addText(title, { x: 0.72, y: 0.68, w: 11.9, h: 0.62, fontSize: 25, bold: true, color: palette.navy, margin: 0, fit: 'shrink' });
  let y = 1.52;
  if (description) {
    const compact = bullets.length > 0 || examples.length > 0;
    const h = compact ? 1.38 : 4.95;
    slide.addShape('roundRect', { x: 0.72, y, w: 11.9, h, rectRadius: 0.08, line: { color: palette.line, width: 0.7 }, fill: { color: palette.white } });
    slide.addText(String(description), { x: 1.02, y: y + 0.2, w: 11.3, h: h - 0.4, fontSize: 19, color: palette.ink, margin: 0, valign: 'mid', fit: 'shrink' });
    if (compact) y += h + 0.22;
  }
  if (bullets.length) {
    const h = Math.min(2.1, 0.5 + bullets.length * 0.32);
    slide.addShape('roundRect', { x: 0.72, y, w: 11.9, h, rectRadius: 0.08, line: { color: 'D5E6EF', width: 0.7 }, fill: { color: palette.paleBlue } });
    slide.addText(bullets.map((item) => `•  ${item}`).join('\n'), { x: 1.02, y: y + 0.16, w: 11.25, h: h - 0.3, fontSize: 16, color: palette.ink, margin: 0.02, paraSpaceAfterPt: 8, valign: 'mid', fit: 'shrink' });
    y += h + 0.18;
  }
  if (examples.length) {
    const h = Math.min(0.9, 0.4 + examples.length * 0.2);
    slide.addShape('roundRect', { x: 0.72, y, w: 11.9, h, rectRadius: 0.08, line: { color: 'CBE8E3', width: 0.7 }, fill: { color: palette.paleTeal } });
    slide.addText(examples.map((item) => `Example  |  ${item}`).join('\n'), { x: 1.02, y: y + 0.14, w: 11.25, h: h - 0.25, fontSize: 15, color: palette.green, margin: 0, valign: 'mid', fit: 'shrink' });
  }
  return slide;
}

function splitText(value, max = 850) {
  const text = String(value || '');
  if (text.length <= max) return [text];
  const chunks = []; let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf('\n', max);
    if (cut < max * 0.55) cut = remaining.lastIndexOf(' ', max);
    if (cut < max * 0.55) cut = max;
    chunks.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).replace(/^\s+/, '');
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function addMcq(pptx, q, index, language) {
  const question = pptx.addSlide(); question.background = { color: palette.paper }; addAccent(question, `Question ${String(index + 1).padStart(2, '0')}`, pptx._slides.length);
  question.addText(q.question, { x: 0.82, y: 0.8, w: 11.65, h: 1.45, fontSize: 24, bold: true, color: palette.ink, margin: 0.04, valign: 'mid', fit: 'shrink' });
  ['A', 'B', 'C', 'D'].forEach((key, i) => {
    const x = i % 2 ? 6.78 : 0.82; const y = 2.65 + Math.floor(i / 2) * 1.45;
    question.addShape('roundRect', { x, y, w: 5.72, h: 1.08, rectRadius: 0.08, line: { color: palette.line, width: 0.8 }, fill: { color: palette.white } });
    question.addShape('ellipse', { x: x + 0.2, y: y + 0.23, w: 0.6, h: 0.6, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
    question.addText(key, { x: x + 0.2, y: y + 0.34, w: 0.6, h: 0.28, fontSize: 13, bold: true, color: palette.white, align: 'center', margin: 0 });
    question.addText(q.options ? q.options[key] : q[`option${key}`], { x: x + 1, y: y + 0.16, w: 4.45, h: 0.76, fontSize: 17, color: palette.ink, margin: 0.02, valign: 'mid', fit: 'shrink' });
  });

  const answer = pptx.addSlide(); answer.background = { color: palette.paper }; addAccent(answer, `Answer and explanation ${String(index + 1).padStart(2, '0')}`, pptx._slides.length);
  answer.addText('Correct answer', { x: 0.82, y: 0.82, w: 11.7, h: 0.45, fontSize: 13, bold: true, charSpacing: 1.2, color: palette.green, margin: 0 });
  const correct = String(q.correctAnswer).toUpperCase();
  answer.addShape('roundRect', { x: 0.82, y: 1.42, w: 11.7, h: 1.02, rectRadius: 0.08, line: { color: 'CBE8E3', width: 0.8 }, fill: { color: palette.paleTeal } });
  answer.addText(`${correct}. ${q.options ? q.options[correct] : q[`option${correct}`]}`, { x: 1.12, y: 1.65, w: 11.1, h: 0.55, fontSize: 21, bold: true, color: palette.green, margin: 0, valign: 'mid', fit: 'shrink' });
  const explanation = language === 'hindi' && q.hindiExplanation ? q.hindiExplanation : language === 'hinglish' && q.hinglishExplanation ? q.hinglishExplanation : q.explanation;
  answer.addText('Explanation', { x: 0.82, y: 2.85, w: 5, h: 0.35, fontSize: 13, bold: true, charSpacing: 1.2, color: palette.muted, margin: 0 });
  answer.addShape('roundRect', { x: 0.82, y: 3.32, w: 11.7, h: 3.25, rectRadius: 0.08, line: { color: palette.line, width: 0.8 }, fill: { color: palette.white } });
  answer.addText(String(explanation), { x: 1.12, y: 3.62, w: 11.1, h: 2.65, fontSize: 17, color: palette.ink, margin: 0, valign: 'top', fit: 'shrink' });
}

function addCode(pptx, section) {
  const lines = String(section.code).split('\n'); const perSlide = 24;
  const language = String(section.language || '').toLowerCase();
  const keywordMap = {
    python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda nonlocal not or pass raise return True try while with yield print',
    javascript: 'async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof let new null return static super switch this throw true try typeof var void while with yield',
    java: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while',
    c: 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while',
    'c++': 'alignas auto bool break case catch char class const constexpr continue default delete do double else enum explicit extern false float for friend goto if inline int long namespace new nullptr operator private protected public return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while',
    sql: 'all alter as between by case create delete distinct drop else end from group having in insert into is join left limit not null on or order outer right select set table then union update values when where',
    html: 'html head body div span p a img section article header footer main script style',
    css: 'important media supports keyframes from to',
  };
  const keywords = new RegExp(`\\b(${(keywordMap[language] || keywordMap.javascript).split(' ').join('|')})\\b`, 'g');
  const codeRuns = (source) => source.split('\n').flatMap((line, lineIndex) => {
    const pieces = line.split(/("[^"]*"|'[^']*'|#.*|--.*|\/\/.*|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*)/g);
    const runs = pieces.filter((piece) => piece !== '').map((piece) => {
      let color = 'E2E8F0';
      if (/^("|'|`)/.test(piece)) color = 'A7F3D0';
      else if (/^(#|\/\/)/.test(piece)) color = '94A3B8';
      else if (/^\d/.test(piece)) color = 'FCD34D';
      else if (keywords.test(piece)) color = '93C5FD';
      keywords.lastIndex = 0;
      return { text: piece, options: { color, fontFace: 'Consolas', breakLine: false } };
    });
    if (lineIndex < source.split('\n').length - 1) runs.push({ text: ' ', options: { breakLine: true } });
    return runs;
  });
  for (let start = 0; start < lines.length; start += perSlide) {
    const slide = pptx.addSlide(); slide.background = { color: palette.paper }; addAccent(slide, `${section.language || 'Code'} example`, pptx._slides.length);
    slide.addText(`${section.title}${lines.length > perSlide ? ` (Code ${Math.floor(start / perSlide) + 1})` : ''}`, { x: 0.72, y: 0.65, w: 11.9, h: 0.55, fontSize: 23, bold: true, color: palette.navy, margin: 0, fit: 'shrink' });
    slide.addShape('roundRect', { x: 0.72, y: 1.38, w: 11.9, h: section.output && start + perSlide >= lines.length ? 3.85 : 5.2, rectRadius: 0.08, line: { color: '263B53', width: 0.8 }, fill: { color: palette.code } });
    slide.addText(codeRuns(lines.slice(start, start + perSlide).join('\n')), { x: 0.98, y: 1.62, w: 11.38, h: section.output && start + perSlide >= lines.length ? 3.36 : 4.72, fontFace: 'Consolas', fontSize: 14, color: palette.codeText, margin: 0.04, breakLine: false, valign: 'top', fit: 'shrink' });
    if (section.output && start + perSlide >= lines.length) {
      slide.addShape('roundRect', { x: 0.72, y: 5.42, w: 11.9, h: 1.16, rectRadius: 0.08, line: { color: 'CBE8E3', width: 0.8 }, fill: { color: palette.paleTeal } });
      slide.addText(`OUTPUT\n${section.output}`, { x: 0.98, y: 5.57, w: 11.38, h: 0.85, fontFace: 'Consolas', fontSize: 13, color: palette.green, margin: 0, valign: 'mid', fit: 'shrink' });
    }
  }
  if (section.explanation) addStyledContentSlide(pptx, `${section.title} - Explanation`, section.explanation);
}

export async function generatePptx({ title, questions = [], data, mode = 'mcq', author = 'MCQ Video Studio', explanationLanguage = 'english' }) {
  const content = data || { title, questions };
  const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = author; pptx.company = 'MCQ Video Studio'; pptx.subject = content.subject || 'Educational Presentation'; pptx.title = content.title || title;
  pptx.theme = { colorScheme: { accent1: palette.navy, accent2: palette.teal, accent3: palette.blue, accent4: 'D49A13', accent5: palette.green, accent6: palette.muted, hlink: palette.blue, folHlink: palette.navy }, fontFace: { body: 'Aptos', title: 'Aptos Display' } };
  addTitle(pptx, content, author);
  if (mode === 'mcq') content.questions.forEach((q, i) => addMcq(pptx, q, i, explanationLanguage));
  else content.sections.forEach((section) => {
    if (mode === 'coding' && section.code) {
      if (section.description || section.bulletPoints?.length) {
        splitText(section.description || '').forEach((chunk, index) => addStyledContentSlide(pptx, `${section.title}${index ? ` (continued ${index + 1})` : ''}`, chunk, index === 0 ? section.bulletPoints || [] : []));
      }
      addCode(pptx, section);
    } else {
      const chunks = splitText(section.description || '');
      chunks.forEach((chunk, index) => addStyledContentSlide(pptx, `${section.title}${index ? ` (continued ${index + 1})` : ''}`, chunk, index === 0 ? section.bulletPoints || [] : [], index === chunks.length - 1 ? section.examples || [] : []));
      if (mode === 'coding' && section.explanation) addStyledContentSlide(pptx, `${section.title} - Explanation`, section.explanation);
      if (mode === 'coding' && section.output) addStyledContentSlide(pptx, `${section.title} - Output`, section.output);
    }
  });
  addClosing(pptx, author);
  const outputDir = path.resolve(process.cwd(), config.storagePath, 'presentations');
  const filePath = path.join(outputDir, `${Date.now()}-${String(content.title || title).replace(/\s+/g, '-').toLowerCase()}.pptx`);
  fs.mkdirSync(outputDir, { recursive: true }); await pptx.writeFile({ fileName: filePath });
  return { filePath, fileName: path.basename(filePath), title: content.title || title, questionCount: mode === 'mcq' ? content.questions.length : 0, sectionCount: mode === 'mcq' ? 0 : content.sections.length };
}
