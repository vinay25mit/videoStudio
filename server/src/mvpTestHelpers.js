import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';

export function registerUser(email, password) {
  const token = 'demo-token';
  return { id: 'user-1', email, token };
}

export function createQuestion(data) {
  return {
    id: 'q-1',
    question: data.question,
    optionA: data.optionA,
    optionB: data.optionB,
    optionC: data.optionC,
    optionD: data.optionD,
    correctAnswer: data.correctAnswer,
    explanation: data.explanation,
    hindiExplanation: data.hindiExplanation,
    hinglishExplanation: data.hinglishExplanation,
    createdAt: new Date().toISOString(),
  };
}

export function createSet(name, questionIds) {
  return { id: 'set-1', name, questionIds };
}

export function generatePpt({ title, questions }) {
  const outDir = path.resolve(process.cwd(), 'storage/test-output');
  fs.mkdirSync(outDir, { recursive: true });
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const slide = pptx.addSlide();
  slide.addText(title, { x: 0.8, y: 0.8, w: 8, h: 1.2, fontSize: 24, bold: true });
  slide.addText(questions[0].question, { x: 0.8, y: 2, w: 9, h: 1 });
  const filePath = path.join(outDir, 'test-presentation.pptx');
  pptx.writeFile({ fileName: filePath });
  return filePath;
}
