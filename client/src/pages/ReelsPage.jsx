import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { normalizeQuestionImport } from '../lib/questionImport.js';
import Icon from '../components/Icon';

const palettes = [
  { name: 'Midnight', background: ['#101827', '#243b55'], accent: '#a3e635', text: '#f8fafc' },
  { name: 'Sunrise', background: ['#7c2d12', '#ea580c'], accent: '#fde047', text: '#fff7ed' },
  { name: 'Emerald', background: ['#052e2b', '#047857'], accent: '#6ee7b7', text: '#ecfdf5' },
  { name: 'Cobalt', background: ['#172554', '#1d4ed8'], accent: '#67e8f9', text: '#eff6ff' },
  { name: 'Rose', background: ['#4c0519', '#be123c'], accent: '#fda4af', text: '#fff1f2' },
  { name: 'Violet', background: ['#2e1065', '#7e22ce'], accent: '#d8b4fe', text: '#faf5ff' },
  { name: 'Sand', background: ['#422006', '#a16207'], accent: '#fef08a', text: '#fffbeb' },
  { name: 'Mono', background: ['#111827', '#374151'], accent: '#f9fafb', text: '#f9fafb' },
];

const layouts = ['Spotlight', 'News ticker', 'Split screen', 'Minimal', 'Bold type', 'Framed', 'Stacked'];
const breakingNewsTemplate = {
  id: 'breaking-news-tv',
  name: 'Breaking News TV',
  palette: { name: 'Broadcast', background: ['#071426', '#152942'], accent: '#f22f46', text: '#ffffff' },
  layout: 'Breaking News TV',
  layoutIndex: 7,
  isBreakingNews: true,
};
const subjectTemplates = [
  {
    id: 'subject-physics',
    name: 'Physics',
    logo: 'PHY',
    icon: '⚛',
    palette: { name: 'Physics', background: ['#082f49', '#0369a1'], accent: '#67e8f9', text: '#f0f9ff' },
  },
  {
    id: 'subject-chemistry',
    name: 'Chemistry',
    logo: 'CHE',
    icon: '⚗',
    palette: { name: 'Chemistry', background: ['#052e16', '#15803d'], accent: '#bef264', text: '#f0fdf4' },
  },
  {
    id: 'subject-maths',
    name: 'Mathematics',
    logo: 'MAT',
    icon: 'π',
    palette: { name: 'Mathematics', background: ['#312e81', '#6d28d9'], accent: '#c4b5fd', text: '#f5f3ff' },
  },
  {
    id: 'subject-biology',
    name: 'Biology',
    logo: 'BIO',
    icon: '🧬',
    palette: { name: 'Biology', background: ['#064e3b', '#0f766e'], accent: '#6ee7b7', text: '#ecfdf5' },
  },
  {
    id: 'subject-history',
    name: 'History',
    logo: 'HIS',
    icon: '⌛',
    palette: { name: 'History', background: ['#451a03', '#92400e'], accent: '#fcd34d', text: '#fffbeb' },
  },
  {
    id: 'subject-geography',
    name: 'Geography',
    logo: 'GEO',
    icon: '🌍',
    palette: { name: 'Geography', background: ['#164e63', '#0e7490'], accent: '#a5f3fc', text: '#ecfeff' },
  },
  {
    id: 'subject-economics',
    name: 'Economics',
    logo: 'ECO',
    icon: '📈',
    palette: { name: 'Economics', background: ['#14532d', '#166534'], accent: '#fde047', text: '#f7fee7' },
  },
  {
    id: 'subject-polity',
    name: 'Polity',
    logo: 'POL',
    icon: '⚖',
    palette: { name: 'Polity', background: ['#1e1b4b', '#3730a3'], accent: '#f9a8d4', text: '#eef2ff' },
  },
  {
    id: 'subject-bihar',
    name: 'Bihar Special',
    logo: 'BIH',
    icon: '🏛',
    palette: { name: 'Bihar Special', background: ['#7c2d12', '#b45309'], accent: '#fde68a', text: '#fff7ed' },
  },
].map((subject) => ({
  ...subject,
  palette: { ...subject.palette },
  layout: 'Subject spotlight',
  layoutIndex: 0,
}));
const templates = [
  breakingNewsTemplate,
  ...palettes.flatMap((palette, paletteIndex) => layouts.map((layout, layoutIndex) => ({
    id: `${paletteIndex}-${layoutIndex}`,
    name: `${palette.name} ${layout}`,
    palette,
    layout,
    layoutIndex,
  }))),
  ...palettes.map((palette, paletteIndex) => ({
    id: `${paletteIndex}-breaking-news-tv`,
    name: `${palette.name} Breaking News TV`,
    palette,
    layout: 'Breaking News TV',
    layoutIndex: 7,
    isBreakingNews: true,
  })),
  ...palettes.map((palette, paletteIndex) => ({
    id: `${paletteIndex}-orbit`,
    name: `${palette.name} Orbit`,
    palette,
    layout: 'Animated Orbit',
    layoutIndex: 8,
  })),
  ...subjectTemplates,
];

const reelDuration = 15;
const breakingStoryDuration = 3.5;
const breakingNewsStingId = 'generated:breaking-news-sting';

function easeOut(value) {
  const amount = Math.max(0, Math.min(1, value));
  return 1 - ((1 - amount) ** 3);
}

function getBreakingNewsItems(value) {
  const seen = new Set();
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const normalized = item.toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 30);
}

function extractNewsItems(value) {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? value.news || value.articles || value.headlines || value.stories || value.items || value.results || value.data || []
      : [];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((item) => {
    if (typeof item === 'string') return item.trim();
    if (!item || typeof item !== 'object') return '';
    return String(item.headline || item.title || item.heading || item.content || item.description || '').trim();
  }).filter(Boolean).slice(0, 30);
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawSubjectBrand(context, template, motion) {
  if (!template.subject) return;
  const { subject, palette } = template;
  const pulse = 0.9 + (Math.sin(motion * 2.2) + 1) * 0.05;
  context.save();
  context.globalAlpha = 0.94;
  context.fillStyle = 'rgba(255,255,255,0.12)';
  roundedRect(context, 70, 68, 330, 86, 22);
  context.fill();
  context.fillStyle = palette.accent;
  context.beginPath();
  context.arc(112, 111, 28 * pulse, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = palette.background[0];
  context.font = '900 17px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(subject.logo, 112, 111);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = palette.text;
  context.font = '800 26px system-ui, sans-serif';
  context.fillText(subject.name.toUpperCase(), 154, 120);

  context.globalAlpha = 0.2;
  context.font = '88px "Segoe UI Emoji", system-ui, sans-serif';
  context.textAlign = 'center';
  context.save();
  context.translate(930, 570 + Math.sin(motion * 0.9) * 24);
  context.rotate(Math.sin(motion * 0.45) * 0.12);
  context.fillText(subject.icon, 0, 0);
  context.restore();
  context.save();
  context.translate(150, 1430 + Math.cos(motion * 0.7) * 30);
  context.rotate(Math.cos(motion * 0.4) * 0.1);
  context.fillText(subject.icon, 0, 0);
  context.restore();
  context.restore();
}

function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  const words = String(text || '').split(/\s+/);
  let line = '';
  let lineNumber = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + lineNumber * lineHeight);
      lineNumber += 1;
      line = word;
      if (lineNumber === maxLines - 1) break;
    } else {
      line = candidate;
    }
  }
  if (line && lineNumber < maxLines) {
    const remaining = lineNumber === maxLines - 1 && words.length > 1
      ? `${line.replace(/\s+\S+$/, '')}…`
      : line;
    context.fillText(remaining, x, y + lineNumber * lineHeight);
  }
}

function drawImageCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image,
    (image.width - sourceWidth) / 2,
    (image.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function createBreakingNewsSting() {
  const sampleRate = 22050;
  const duration = 6;
  const sampleCount = sampleRate * duration;
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const time = sample / sampleRate;
    const fadeIn = Math.min(1, time / 0.06);
    const fadeOut = Math.min(1, (duration - time) / 0.7);
    const hitEnvelope = [0.12, 0.62, 1.12].reduce((level, start) => {
      const age = time - start;
      return age >= 0 ? Math.max(level, Math.exp(-age * 5.2) * 0.42) : level;
    }, 0);
    const noteAge = time - 1.45;
    const noteEnvelope = noteAge >= 0 ? Math.min(1, noteAge / 0.16) * Math.exp(-noteAge * 0.42) : 0;
    const sweepFrequency = 220 + (Math.min(time, 1.45) / 1.45) * 220;
    const sweep = Math.sin(2 * Math.PI * sweepFrequency * time) * Math.exp(-Math.max(0, time - 1.45) * 1.7) * 0.16;
    const noteFrequency = noteAge >= 0 ? [392, 523.25, 659.25][Math.min(2, Math.floor(noteAge / 0.48))] : 0;
    const note = noteFrequency
      ? (Math.sin(2 * Math.PI * noteFrequency * noteAge) + 0.35 * Math.sin(2 * Math.PI * noteFrequency * 2 * noteAge)) * noteEnvelope * 0.22
      : 0;
    const impact = hitEnvelope * (Math.sin(2 * Math.PI * (72 - Math.min(time, 0.4) * 42) * time) * 0.28);
    const value = Math.max(-1, Math.min(1, (sweep + note + impact) * fadeIn * fadeOut));
    view.setInt16(44 + sample * 2, Math.round(value * 32767), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function drawReel(context, {
  template,
  category,
  question,
  title,
  image,
  elapsed,
  motionStyle,
  breakingHeadline,
  breakingTicker,
  breakingNewsItems,
  reelDuration,
}) {
  const { palette, layoutIndex } = template;
  const isBreakingNews = template.isBreakingNews === true;
  const width = 1080;
  const height = 1920;
  const progress = Math.min(elapsed / reelDuration, 1);
  const revealAnswer = elapsed >= 9;
  const motionRate = motionStyle === 'energetic' ? 1.45 : motionStyle === 'editorial' ? 0.7 : 1;
  const motion = elapsed * motionRate;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.background[0]);
  gradient.addColorStop(1, palette.background[1]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const lightPosition = ((motion * 100) % (width + 900)) - 450;
  const lightBeam = context.createLinearGradient(lightPosition - 420, 0, lightPosition + 420, height);
  lightBeam.addColorStop(0, 'rgba(255,255,255,0)');
  lightBeam.addColorStop(0.5, `rgba(255,255,255,${motionStyle === 'editorial' ? 0.025 : 0.065})`);
  lightBeam.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = lightBeam;
  context.fillRect(0, 0, width, height);
  const vignette = context.createRadialGradient(width / 2, height / 2, 260, width / 2, height / 2, 1120);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = isBreakingNews ? 0.035 : 0.1;
  context.fillStyle = palette.accent;
  context.beginPath();
  context.arc(
    (layoutIndex % 2 ? 920 : 160) + Math.sin(motion * 0.7) * 90,
    280 + Math.cos(motion * 0.8) * 55,
    230 + Math.sin(motion * 1.4) * 26,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.beginPath();
  context.arc(
    (layoutIndex % 2 ? 130 : 960) + Math.cos(motion * 0.55) * 70,
    1630 + Math.sin(motion * 0.65) * 65,
    310 + Math.cos(motion * 1.1) * 34,
    0,
    Math.PI * 2,
  );
  context.fill();
  for (let index = 0; index < (isBreakingNews ? 5 : 12); index += 1) {
    const phase = motion * (0.25 + (index % 4) * 0.08) + index * 2.4;
    const x = 70 + ((index * 197 + Math.sin(phase) * 48 + width) % (width - 140));
    const y = ((index * 311 + motion * (28 + (index % 3) * 9)) % height);
    context.globalAlpha = 0.16 + ((Math.sin(phase) + 1) * 0.09);
    context.beginPath();
    context.arc(x, y, 4 + ((index + 1) % 4), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  drawSubjectBrand(context, template, motion);

  if (isBreakingNews) {
    const accent = palette.accent;
    const livePulse = 0.72 + (Math.sin(motion * 5) + 1) * 0.14;
    context.fillStyle = '#09111d';
    context.fillRect(0, 0, width, 310);
    context.fillStyle = '#1c2b3d';
    context.fillRect(0, 302, width, 3);
    context.fillStyle = accent;
    context.fillRect(0, 0, width, 14);
    context.font = '800 31px system-ui, sans-serif';
    context.fillStyle = '#ffffff';
    context.fillText('NEWSROOM', 76, 102);
    context.font = '600 23px system-ui, sans-serif';
    context.fillStyle = '#a9bbd0';
    context.fillText('CURRENT AFFAIRS  /  SPECIAL COVERAGE', 78, 146);
    context.fillStyle = accent;
    roundedRect(context, 76, 182, 720, 90, 12);
    context.fill();
    context.save();
    context.beginPath();
    roundedRect(context, 76, 182, 720, 90, 12);
    context.clip();
    context.fillStyle = '#ffffff';
    context.font = '900 47px system-ui, sans-serif';
    context.fillText(String(breakingHeadline || 'BREAKING NEWS').toUpperCase(), 104, 242, 664);
    context.restore();
    context.globalAlpha = livePulse;
    context.fillStyle = '#ffffff';
    roundedRect(context, 822, 184, 182, 82, 12);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = accent;
    context.beginPath();
    context.arc(858, 225, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#102033';
    context.font = '900 31px system-ui, sans-serif';
    context.fillText('LIVE', 884, 236);

    const tickerY = 1710;
    context.fillStyle = '#101b2a';
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(0, tickerY - 8, width, 8);
    context.fillStyle = accent;
    context.fillRect(0, tickerY - 8, width * progress, 8);
    context.fillStyle = '#101b2a';
    context.fillRect(0, tickerY, width, 144);
    context.fillStyle = accent;
    context.fillRect(0, tickerY, 250, 58);
    context.fillStyle = '#ffffff';
    context.font = '900 28px system-ui, sans-serif';
    context.fillText('TOP HEADLINES', 30, tickerY + 39);
    context.save();
    context.beginPath();
    context.rect(270, tickerY + 58, width - 270, 86);
    context.clip();
    context.fillStyle = '#ffffff';
    context.font = '700 31px system-ui, sans-serif';
    const allHeadlines = breakingNewsItems.length
      ? breakingNewsItems.join('  •  ')
      : breakingTicker || 'LATEST UPDATE  •  DAILY CURRENT AFFAIRS';
    const tickerText = `${String(allHeadlines).toUpperCase()}  •  `;
    const tickerWidth = context.measureText(tickerText).width;
    const tickerOffset = (motion * 180) % tickerWidth;
    context.fillText(tickerText.repeat(4), 270 - tickerOffset, tickerY + 113);
    context.restore();
    context.fillStyle = accent;
    context.fillRect(0, 1854, width, 4);
    context.fillStyle = '#a9bbd0';
    context.font = '600 21px system-ui, sans-serif';
    context.fillText('NEWS DESK  •  STAY INFORMED', 76, 1900);
    if (breakingNewsItems.length) {
      const storyDuration = reelDuration / breakingNewsItems.length;
      const storyIndex = Math.min(breakingNewsItems.length - 1, Math.floor(elapsed / storyDuration));
      const storyProgress = Math.min(1, (elapsed - storyIndex * storyDuration) / storyDuration);
      const storyEntrance = easeOut(storyProgress / 0.24);
      const storyExit = easeOut((1 - storyProgress) / 0.2);
      const cardAlpha = Math.min(storyEntrance, storyExit);
      const cardY = 390 + (1 - storyEntrance) * 96 - (1 - storyExit) * 54;
      context.save();
      context.globalAlpha = cardAlpha;
      context.translate((1 - storyEntrance) * 75, 0);
      context.shadowColor = 'rgba(0,0,0,0.42)';
      context.shadowBlur = 44;
      context.shadowOffsetY = 22;
      context.fillStyle = 'rgba(9,17,29,0.94)';
      roundedRect(context, 64, cardY, width - 128, 1150, 34);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = 'rgba(255,255,255,0.16)';
      context.lineWidth = 2;
      roundedRect(context, 64, cardY, width - 128, 1150, 34);
      context.stroke();
      context.save();
      roundedRect(context, 64, cardY, width - 128, 12, 6);
      context.clip();
      context.fillStyle = accent;
      context.fillRect(64, cardY, (width - 128) * Math.min(storyProgress / 0.42, 1), 12);
      context.restore();

      context.fillStyle = accent;
      context.font = '900 25px system-ui, sans-serif';
      context.fillText('LATEST UPDATE', 112, cardY + 92);
      context.fillStyle = 'rgba(255,255,255,0.22)';
      context.fillRect(112, cardY + 122, width - 224, 2);
      context.fillStyle = '#ffffff';
      context.font = '800 59px system-ui, sans-serif';
      wrapText(context, breakingNewsItems[storyIndex], 112, cardY + 250, width - 224, 84, 8);

      context.fillStyle = '#a9bbd0';
      context.font = '700 23px system-ui, sans-serif';
      context.fillText('CURRENT AFFAIRS  •  INDIA', 112, cardY + 1060);
      context.fillStyle = 'rgba(255,255,255,0.16)';
      roundedRect(context, 112, cardY + 1092, width - 224, 8, 4);
      context.fill();
      context.fillStyle = accent;
      roundedRect(context, 112, cardY + 1092, (width - 224) * storyProgress, 8, 4);
      context.fill();
      context.restore();

      context.fillStyle = '#ffffff';
      context.font = '700 24px system-ui, sans-serif';
      context.fillText(`STORY ${String(storyIndex + 1).padStart(2, '0')} / ${String(breakingNewsItems.length).padStart(2, '0')}`, 76, 1638);
    } else {
      context.fillStyle = 'rgba(9,17,29,0.92)';
      roundedRect(context, 64, 430, width - 128, 1060, 34);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = '700 48px system-ui, sans-serif';
      wrapText(context, category === 'image' ? (title || 'Your image story') : (question?.question || 'Add news headlines below'), 112, 610, width - 224, 68, 8);
    }
  } else if (layoutIndex === 1) {
    context.fillStyle = palette.accent;
    context.fillRect(0, 0, width, 16);
    context.fillRect(0, height - 220, width, 220);
    context.save();
    context.beginPath();
    context.rect(0, height - 220, width, 220);
    context.clip();
    context.fillStyle = palette.background[0];
    context.font = '800 34px system-ui, sans-serif';
    const tickerText = 'DAILY CURRENT AFFAIRS  •  TEST YOUR KNOWLEDGE  •  ANSWER REVEAL  •  ';
    const tickerWidth = context.measureText(tickerText).width;
    const tickerOffset = (motion * 125) % tickerWidth;
    context.fillText(tickerText.repeat(3), -tickerOffset, height - 102);
    context.restore();
  } else if (layoutIndex === 2) {
    context.fillStyle = palette.accent;
    context.globalAlpha = 0.9;
    context.fillRect(0, 0, 34, height);
    context.globalAlpha = 1;
  } else if (layoutIndex === 3) {
    context.strokeStyle = palette.accent;
    context.lineWidth = 3;
    context.strokeRect(54, 54, width - 108, height - 108);
  } else if (layoutIndex === 5) {
    context.strokeStyle = palette.accent;
    context.lineWidth = 12;
    context.strokeRect(38, 38, width - 76, height - 76);
  } else if (layoutIndex === 6) {
    context.fillStyle = palette.accent;
    context.globalAlpha = 0.17 + (Math.sin(motion * 2) + 1) * 0.035;
    const headerPulse = 180 + Math.sin(motion * 1.2) * 12;
    roundedRect(context, 70, 180, width - 140, headerPulse, 90);
    context.fill();
    context.globalAlpha = 1;
  } else if (layoutIndex === 8) {
    const centerX = width / 2;
    const centerY = 590;
    context.save();
    context.translate(centerX, centerY);
    context.rotate(motion * 0.22);
    context.strokeStyle = `${palette.accent}88`;
    context.lineWidth = 3;
    context.setLineDash([12, 18]);
    context.beginPath();
    context.ellipse(0, 0, 370, 175, -0.28, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    for (let index = 0; index < 3; index += 1) {
      const angle = motion * (0.65 + index * 0.14) + index * (Math.PI * 2 / 3);
      const x = Math.cos(angle) * (250 + index * 42);
      const y = Math.sin(angle) * (115 + index * 28);
      context.globalAlpha = 0.62 + (Math.sin(motion * 2 + index) + 1) * 0.16;
      context.fillStyle = palette.accent;
      context.shadowColor = palette.accent;
      context.shadowBlur = 24;
      context.beginPath();
      context.arc(x, y, 11 + (Math.sin(motion * 2 + index) + 1) * 4, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    context.globalAlpha = 0.45;
    context.strokeStyle = palette.accent;
    context.lineWidth = 2;
    const framePulse = 14 + Math.sin(motion * 1.5) * 4;
    roundedRect(context, 50 + framePulse, 290 + framePulse, width - 100 - framePulse * 2, 1140 - framePulse * 2, 40);
    context.stroke();
    context.globalAlpha = 1;
  }

  if (!isBreakingNews && category === 'image' && image) {
    const imageEntrance = easeOut((motion - 0.15) / 1.2);
    const imageTop = isBreakingNews ? 340 : 240;
    const imageHeight = isBreakingNews ? 1000 : 1150;
    const imageScale = 1.12 - (imageEntrance * 0.12) + Math.sin(motion * 0.35) * 0.012;
    const imageWidth = width - 112;
    const imageX = 56 - ((imageWidth * imageScale) - imageWidth) / 2;
    const imageY = imageTop - ((imageHeight * imageScale) - imageHeight) / 2 + Math.sin(motion * 0.42) * 16;
    context.save();
    context.globalAlpha = 0.28;
    context.filter = 'blur(38px) saturate(1.3)';
    drawImageCover(context, image, -90, 150, width + 180, height - 300);
    context.restore();
    context.save();
    context.shadowColor = 'rgba(0,0,0,0.42)';
    context.shadowBlur = 44;
    context.shadowOffsetY = 24;
    roundedRect(context, 56, imageTop, imageWidth, imageHeight, 28);
    context.clip();
    context.translate(imageX, imageY);
    context.scale(imageScale, imageScale);
    drawImageCover(context, image, 56, imageTop, imageWidth, imageHeight);
    context.restore();
    context.fillStyle = 'rgba(0, 0, 0, 0.53)';
    const captionTop = imageTop + imageHeight - 310;
    const captionGradient = context.createLinearGradient(56, captionTop, 56, captionTop + 310);
    captionGradient.addColorStop(0, 'rgba(0,0,0,0)');
    captionGradient.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    captionGradient.addColorStop(1, 'rgba(0,0,0,0.84)');
    context.fillStyle = captionGradient;
    context.fillRect(56, captionTop, width - 112, 310);
    context.fillStyle = palette.accent;
    context.font = '700 25px system-ui, sans-serif';
    context.fillText('A MOMENT TO REMEMBER', 100, captionTop + 80);
    context.fillStyle = palette.text;
    context.font = '700 58px system-ui, sans-serif';
    context.save();
    const captionEntrance = easeOut((motion - 0.7) / 0.8);
    context.globalAlpha = captionEntrance;
    context.translate(0, (1 - captionEntrance) * 55);
    wrapText(context, title || 'A moment worth sharing', 100, captionTop + 155, width - 200, 74, 3);
    context.restore();
  } else if (!isBreakingNews && question) {
    const headingEntrance = easeOut(motion / 0.7);
    context.fillStyle = palette.text;
    context.font = '700 34px system-ui, sans-serif';
    context.save();
    context.globalAlpha = headingEntrance;
    context.translate(0, (1 - headingEntrance) * 35);
    context.fillStyle = 'rgba(255,255,255,0.1)';
    roundedRect(context, 82, 176, 420, 78, 39);
    context.fill();
    context.fillStyle = palette.text;
    context.fillText(template.subject ? template.subject.name.toUpperCase() : 'DAILY CURRENT AFFAIRS', 112, 226);
    context.fillStyle = palette.accent;
    roundedRect(context, 82, 278, 156, 10, 5);
    context.fill();
    context.restore();

    const questionCardEntrance = easeOut((motion - 0.25) / 0.75);
    context.save();
    context.globalAlpha = questionCardEntrance;
    context.translate(0, (1 - questionCardEntrance) * 90);
    context.shadowColor = `${palette.accent}55`;
    context.shadowBlur = motionStyle === 'editorial' ? 12 : 32;
    context.fillStyle = 'rgba(8,15,28,0.38)';
    roundedRect(context, 58, 340, width - 116, 540, 34);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(255,255,255,0.15)';
    context.lineWidth = 2;
    roundedRect(context, 58, 340, width - 116, 540, 34);
    context.stroke();
    context.fillStyle = palette.text;
    context.font = '800 62px system-ui, sans-serif';
    wrapText(context, question.question, 104, 468, width - 208, 82, 5);
    context.restore();

    const options = ['A', 'B', 'C', 'D'].map((key) => ({
      key,
      text: question[`option${key}`] || question.options?.[key],
    }));
    options.forEach((option, index) => {
      const optionEntrance = easeOut((motion - 1.6 - index * 0.55) / 0.68);
      const top = 965 + index * 148 + (1 - optionEntrance) * 84;
      const correct = revealAnswer && option.key === String(question.correctAnswer || '').toUpperCase();
      const answerPulse = correct ? (1 + Math.max(0, Math.sin((motion - 9) * Math.PI * 2)) * 0.022) : 1;
      context.save();
      context.globalAlpha = optionEntrance;
      context.translate((1 - optionEntrance) * 50, 0);
      context.translate(82 + ((width - 164) * (1 - answerPulse)) / 2, top + (118 * (1 - answerPulse)) / 2);
      context.scale(answerPulse, answerPulse);
      context.shadowColor = correct ? `${palette.accent}88` : 'rgba(0,0,0,0.22)';
      context.shadowBlur = correct ? 30 : 16;
      context.fillStyle = correct ? palette.accent : 'rgba(255,255,255,0.13)';
      roundedRect(context, 0, 0, width - 164, 118, 24);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = correct ? palette.background[0] : palette.text;
      context.font = '700 36px system-ui, sans-serif';
      context.beginPath();
      context.arc(58, 59, 34, 0, Math.PI * 2);
      context.fillStyle = correct ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
      context.fill();
      context.fillStyle = correct ? palette.background[0] : palette.accent;
      context.textAlign = 'center';
      context.fillText(option.key, 58, 72);
      context.textAlign = 'left';
      context.font = '500 32px system-ui, sans-serif';
      wrapText(context, option.text, 116, 54, width - 330, 40, 2);
      context.restore();
    });

    context.fillStyle = palette.text;
    context.globalAlpha = 0.88;
    context.font = '700 30px system-ui, sans-serif';
    if (revealAnswer) {
      context.fillStyle = palette.accent;
      context.fillText('CORRECT ANSWER', 82, 1665);
      context.fillStyle = palette.text;
      context.globalAlpha = 0.9;
    } else if (elapsed >= 6) {
      const countdown = Math.max(1, 3 - Math.floor(elapsed - 6));
      context.fillStyle = palette.accent;
      context.font = '800 46px system-ui, sans-serif';
      context.fillText(String(countdown), 82, 1670);
      context.fillStyle = palette.text;
      context.font = '700 28px system-ui, sans-serif';
      context.fillText('REVEALING IN…', 132, 1666);
    } else if (!isBreakingNews) {
      context.fillText('PICK YOUR ANSWER', 82, 1665);
    }
    if (revealAnswer && elapsed >= 11.5) {
      context.globalAlpha = easeOut((elapsed - 11.5) / 0.7);
      context.font = '700 25px system-ui, sans-serif';
      context.fillText('FOLLOW FOR YOUR DAILY QUIZ', 82, 1720);
    }
    context.globalAlpha = 1;
  } else if (!isBreakingNews) {
    context.fillStyle = palette.text;
    context.font = '700 58px system-ui, sans-serif';
    wrapText(context, 'Load a question or choose an image story', 90, 900, width - 180, 76, 4);
  }

  if (!isBreakingNews) {
    context.fillStyle = palette.text;
    context.globalAlpha = 0.8;
    context.font = '600 28px system-ui, sans-serif';
    context.fillText(
      template.subject
        ? `${template.subject.name.toUpperCase()}  •  ${category === 'image' ? 'IMAGE STORY' : 'SUBJECT QUIZ'}`
        : category === 'image' ? 'IMAGE STORY' : 'MCQ STUDIO  •  REEL',
      82,
      1770,
    );
    context.globalAlpha = 1;
    context.fillStyle = 'rgba(255,255,255,0.25)';
    roundedRect(context, 82, 1830, width - 164, 8, 4);
    context.fill();
    context.fillStyle = palette.accent;
    roundedRect(context, 82, 1830, (width - 164) * progress, 8, 4);
    context.fill();
  }
}

function getRecorderMimeType() {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export default function ReelsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const appliedCurrentAffairsDraftRef = useRef(false);
  const pendingCurrentAffairsTrackRef = useRef(false);
  const [category, setCategory] = useState('questions');
  const [questions, setQuestions] = useState([]);
  const [questionFileName, setQuestionFileName] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [image, setImage] = useState(null);
  const [title, setTitle] = useState('');
  const [breakingHeadline, setBreakingHeadline] = useState('BREAKING NEWS');
  const [breakingTicker, setBreakingTicker] = useState('LATEST UPDATE  •  DAILY CURRENT AFFAIRS');
  const [breakingNewsText, setBreakingNewsText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const [motionStyle, setMotionStyle] = useState('cinematic');
  const [audioTracks, setAudioTracks] = useState([]);
  const audioTracksRef = useRef(audioTracks);
  const [musicTracks, setMusicTracks] = useState([]);
  const [musicGenre, setMusicGenre] = useState('hindi');
  const [musicSearchInput, setMusicSearchInput] = useState('');
  const [musicSearch, setMusicSearch] = useState('');
  const [musicReloadCount, setMusicReloadCount] = useState(0);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [playbackHint, setPlaybackHint] = useState('');
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [preparedAudioUrl, setPreparedAudioUrl] = useState('');
  const [audioClipDuration, setAudioClipDuration] = useState(10);
  const [useFullReelAudio, setUseFullReelAudio] = useState(false);
  const [audioClipStart, setAudioClipStart] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPreviewPlaying, setAudioPreviewPlaying] = useState(false);
  const audioPreviewStartedAtRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(elapsed);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const currentAffairsDraft = location.state?.currentAffairsDraft;
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || templates[0],
    [selectedTemplateId],
  );
  const isBreakingNewsTemplate = selectedTemplate.isBreakingNews === true;
  const activeQuestion = questions[selectedQuestion];
  const breakingNewsItems = useMemo(() => getBreakingNewsItems(breakingNewsText), [breakingNewsText]);
  const currentReelDuration = isBreakingNewsTemplate && breakingNewsItems.length
    ? Math.max(reelDuration, breakingNewsItems.length * breakingStoryDuration)
    : reelDuration;
  const selectedAudio = audioTracks.find((track) => track.id === selectedAudioId)
    || musicTracks.find((track) => track.id === selectedAudioId);
  const isNewsBackgroundAudio = selectedAudio?.source === 'jamendo'
    && selectedAudio.genre === 'cinematic'
    && isBreakingNewsTemplate;
  const effectiveAudioClipDuration = isNewsBackgroundAudio && useFullReelAudio
    ? currentReelDuration
    : audioClipDuration;
  const maxAudioClipStart = Math.max(0, Math.floor(audioDuration - effectiveAudioClipDuration));
  audioTracksRef.current = audioTracks;
  elapsedRef.current = elapsed;

  useEffect(() => {
    if (!currentAffairsDraft || appliedCurrentAffairsDraftRef.current) return;
    appliedCurrentAffairsDraftRef.current = true;
    const isHindi = currentAffairsDraft.language === 'hi';
    setSelectedTemplateId(isHindi ? '2-breaking-news-tv' : 'breaking-news-tv');
    setCategory('questions');
    setTitle(`Current Affairs ${currentAffairsDraft.date}`);
    setBreakingHeadline(isHindi ? 'आज की मुख्य खबरें' : 'BREAKING NEWS');
    setBreakingTicker(`${isHindi ? 'आज की मुख्य खबरें' : 'LATEST UPDATE'}  •  DAILY CURRENT AFFAIRS`);
    setBreakingNewsText(currentAffairsDraft.headlines.join('\n'));
    setMusicGenre('cinematic');
    setMusicSearchInput('Dark Eye');
    setMusicSearch('Dark Eye');
    setSelectedAudioId('');
    setUseFullReelAudio(true);
    setError('');
    setMusicError('');
    pendingCurrentAffairsTrackRef.current = true;
    navigate(location.pathname, { replace: true, state: null });
  }, [currentAffairsDraft, location.pathname, navigate]);

  useEffect(() => {
    setAudioClipStart((current) => Math.min(current, maxAudioClipStart));
  }, [maxAudioClipStart]);

  useEffect(() => {
    const token = localStorage.getItem('mcq_token');
    if (!token) return undefined;
    const controller = new AbortController();
    fetch('/api/questions', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error?.message || 'Could not load saved questions.');
        }
        if (Array.isArray(payload.data) && payload.data.length) {
          setQuestions(payload.data);
          setQuestionFileName('Question bank');
        }
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Could not load saved questions.');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('mcq_token');
    if (!token) return undefined;
    const controller = new AbortController();
    setMusicLoading(true);
    setMusicError('');
    fetch(`/api/reels/music?genre=${encodeURIComponent(musicGenre)}&search=${encodeURIComponent(musicSearch)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error?.message || 'Could not load music tracks.');
        }
        if (Array.isArray(payload.data)) {
          const tracks = payload.data.map((track) => ({
            ...track,
            id: `jamendo:${track.id}`,
            source: 'jamendo',
            genre: musicGenre,
            url: track.previewUrl,
            isCurrentAffairsSoundtrack: track.name.trim().toLocaleLowerCase() === 'dark eye'
              && track.artist.trim().toLocaleLowerCase() === 'marc teichert',
          }));
          setMusicTracks(tracks);
          if (pendingCurrentAffairsTrackRef.current) {
            const currentAffairsTrack = tracks.find((track) => track.isCurrentAffairsSoundtrack);
            if (currentAffairsTrack) {
              setSelectedAudioId(currentAffairsTrack.id);
              setUseFullReelAudio(true);
            } else {
              setMusicError('Dark Eye by Marc Teichert is not available as a downloadable Jamendo track. Choose another track to continue.');
            }
            pendingCurrentAffairsTrackRef.current = false;
          }
          if (selectedAudioId.startsWith('jamendo:') && !tracks.some((track) => track.id === selectedAudioId)) {
            setSelectedAudioId('');
          }
        }
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setMusicError(loadError.message || 'Could not load music tracks.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setMusicLoading(false);
      });
    return () => controller.abort();
  }, [musicGenre, musicReloadCount, musicSearch]);

  useEffect(() => {
    if (!selectedAudioId || !preparedAudioUrl || !audioRef.current) return;
    setPlaybackHint('');
    audioRef.current.loop = isNewsBackgroundAudio && useFullReelAudio;
    audioRef.current.volume = 1;
    audioRef.current.currentTime = audioClipStart;
    audioPreviewStartedAtRef.current = Date.now();
    audioRef.current.play().catch(() => {
      audioPreviewStartedAtRef.current = 0;
      setPlaybackHint('Press play to preview this track.');
    }).then(() => {
      if (!audioRef.current?.paused) setAudioPreviewPlaying(true);
    });
  }, [isNewsBackgroundAudio, preparedAudioUrl, selectedAudioId, useFullReelAudio]);

  useEffect(() => {
    if (!selectedAudio) {
      setPreparedAudioUrl('');
      setPreviewLoading(false);
      setAudioDuration(0);
      setAudioPreviewPlaying(false);
      return undefined;
    }

    setAudioDuration(0);
    setAudioClipStart(0);
    setAudioPreviewPlaying(false);
    if (selectedAudio.source !== 'jamendo') {
      setPreparedAudioUrl(selectedAudio.url);
      setPreviewLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let objectUrl;
    setPreparedAudioUrl('');
    setPreviewLoading(true);
    setPlaybackHint('');
    const token = localStorage.getItem('mcq_token');
    const trackId = encodeURIComponent(selectedAudio.id.replace(/^jamendo:/, ''));
    const audioPath = selectedAudio.isCurrentAffairsSoundtrack
      ? `/api/reels/music/${trackId}/download`
      : `/api/reels/music/${trackId}/preview?${new URLSearchParams({ url: selectedAudio.url })}`;
    fetch(audioPath, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error?.message || 'Could not load this audio preview.');
        }
        objectUrl = URL.createObjectURL(await response.blob());
        setPreparedAudioUrl(objectUrl);
      })
      .catch((previewError) => {
        if (previewError.name !== 'AbortError') {
          setPlaybackHint(previewError.message || 'Could not load this audio preview.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedAudio]);

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return undefined;
    }
    const loadedImage = new Image();
    loadedImage.onload = () => setImage(loadedImage);
    loadedImage.onerror = () => setError('Could not read the selected image.');
    loadedImage.src = imageUrl;
    return () => {
      loadedImage.onload = null;
      loadedImage.onerror = null;
    };
  }, [imageUrl]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useEffect(() => () => {
    audioTracksRef.current.forEach((track) => URL.revokeObjectURL(track.url));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) return undefined;
    let frameId;
    const draw = (timestamp) => {
      drawReel(context, {
        template: selectedTemplate,
        category,
        question: activeQuestion,
        title,
        image,
        motionStyle,
        breakingHeadline,
        breakingTicker,
        breakingNewsItems,
        reelDuration: currentReelDuration,
        elapsed: isRecording ? elapsedRef.current : (timestamp / 1000) % currentReelDuration,
      });
      frameId = window.requestAnimationFrame(draw);
    };
    frameId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeQuestion,
    breakingHeadline,
    breakingNewsItems,
    breakingTicker,
    category,
    currentReelDuration,
    image,
    isRecording,
    motionStyle,
    selectedTemplate,
    title,
  ]);

  const handleQuestionFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const imported = normalizeQuestionImport(JSON.parse(await file.text()));
      setQuestions(imported);
      setSelectedQuestion(0);
      setQuestionFileName(file.name);
      setCategory('questions');
    } catch (importError) {
      setError(importError.message || 'Could not read the question JSON file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleBreakingNewsFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const contents = await file.text();
      let headlines;
      if (/\.(json)$/i.test(file.name)) {
        headlines = extractNewsItems(JSON.parse(contents));
      } else {
        headlines = getBreakingNewsItems(contents);
      }
      if (!headlines.length) {
        throw new Error('No news headlines were found. Use a JSON array or an object with a news, articles, headlines, stories, items, or results array, or one headline per line in a text file.');
      }
      setBreakingNewsText(headlines.join('\n'));
    } catch (importError) {
      setError(importError.message || 'Could not read the news file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImageFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file to create an image story.');
      return;
    }
    setError('');
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setCategory('image');
    event.target.value = '';
  };

  const handleAudioFiles = (event) => {
    const files = Array.from(event.target.files || []);
    const invalidFile = files.find((file) => !file.type.startsWith('audio/'));
    if (invalidFile) {
      setError('Choose audio files such as MP3, WAV, or M4A.');
      event.target.value = '';
      return;
    }
    const tracks = files.map((file) => ({
      id: `upload:${file.name}-${file.lastModified}-${Math.random()}`,
      name: file.name,
      file,
      url: URL.createObjectURL(file),
      source: 'upload',
    }));
    setAudioTracks((current) => [...current, ...tracks]);
    if (!selectedAudioId && tracks.length) setSelectedAudioId(tracks[0].id);
    setError('');
    event.target.value = '';
  };

  const addBreakingNewsSting = () => {
    const existing = audioTracks.find((track) => track.id === breakingNewsStingId);
    if (existing) {
      setSelectedAudioId(existing.id);
      setUseFullReelAudio(false);
      return;
    }
    const track = {
      id: breakingNewsStingId,
      name: 'Original Breaking News Sting · 6 sec',
      url: URL.createObjectURL(createBreakingNewsSting()),
      source: 'generated',
    };
    setAudioTracks((current) => [...current, track]);
    setSelectedAudioId(track.id);
    setUseFullReelAudio(false);
    setError('');
  };

  const browseNewsBackgroundMusic = () => {
    setMusicSearch('');
    setMusicSearchInput('');
    setMusicGenre('cinematic');
    setMusicReloadCount((count) => count + 1);
  };

  const removeAudioTrack = (track) => {
    setAudioTracks((current) => current.filter((entry) => entry.id !== track.id));
    if (selectedAudioId === track.id) {
      const next = audioTracks.find((entry) => entry.id !== track.id);
      setSelectedAudioId(next?.id || '');
      setUseFullReelAudio(false);
    }
    URL.revokeObjectURL(track.url);
  };

  const handleMusicSearch = (event) => {
    event.preventDefault();
    setMusicSearch(musicSearchInput.trim());
  };

  const chooseHindiMusic = (genre) => {
    setMusicSearchInput('');
    setMusicSearch('');
    setMusicGenre(genre);
  };

  const toggleAudioPreview = async () => {
    const audioElement = audioRef.current;
    if (!audioElement || !preparedAudioUrl) return;
    if (!audioElement.paused) {
      audioElement.pause();
      audioElement.loop = false;
      audioElement.currentTime = audioClipStart;
      audioPreviewStartedAtRef.current = 0;
      setAudioPreviewPlaying(false);
      return;
    }
    try {
      audioElement.loop = isNewsBackgroundAudio && useFullReelAudio;
      audioElement.volume = 1;
      audioElement.currentTime = audioClipStart;
      audioPreviewStartedAtRef.current = Date.now();
      await audioElement.play();
      setAudioPreviewPlaying(true);
      setPlaybackHint('');
    } catch {
      audioPreviewStartedAtRef.current = 0;
      setPlaybackHint('Could not play this audio clip. Try previewing it again.');
    }
  };

  const handleAudioTimeUpdate = () => {
    const audioElement = audioRef.current;
    const previewElapsed = (Date.now() - audioPreviewStartedAtRef.current) / 1000;
    const fullReelPreviewEnded = isNewsBackgroundAudio
      && useFullReelAudio
      && previewElapsed >= effectiveAudioClipDuration;
    const regularPreviewEnded = audioElement
      && audioElement.currentTime >= audioClipStart + effectiveAudioClipDuration;
    if (audioElement && (fullReelPreviewEnded || regularPreviewEnded)) {
      audioElement.pause();
      audioElement.loop = false;
      audioElement.currentTime = audioClipStart;
      audioPreviewStartedAtRef.current = 0;
      setAudioPreviewPlaying(false);
    }
  };

  const handleAudioLoadedMetadata = () => {
    const duration = audioRef.current?.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    setAudioDuration(duration);
    const allowedClipLengths = [3, 6, 10, 15, currentReelDuration];
    const availableClipLengths = allowedClipLengths.filter((clipLength) => clipLength <= duration);
    if (availableClipLengths.length) {
      setAudioClipDuration((current) => (
        current <= duration ? current : availableClipLengths[availableClipLengths.length - 1]
      ));
    }
    setAudioClipStart((current) => Math.min(current, Math.max(0, Math.floor(duration - effectiveAudioClipDuration))));
  };

  const generateReel = async () => {
    const isBreakingNewsReel = isBreakingNewsTemplate;
    if (category === 'questions' && !activeQuestion && !(isBreakingNewsReel && breakingNewsItems.length)) {
      setError('Import a question JSON file or add questions to your question bank first.');
      return;
    }
    if (!isBreakingNewsReel && category === 'image' && !image) {
      setError('Upload an image before generating an image story.');
      return;
    }
    if (!canvasRef.current?.captureStream || typeof MediaRecorder === 'undefined') {
      setError('Video export is not supported by this browser. Try the latest Chrome or Edge.');
      return;
    }
    if (selectedAudio && !preparedAudioUrl) {
      setError('Wait for the selected audio preview to load, then generate the reel.');
      return;
    }
    setError('');
    setIsRecording(true);
    setElapsed(0);
    let outputStream;
    let recordingClipLength = effectiveAudioClipDuration;
    try {
      const canvasStream = canvasRef.current.captureStream(30);
      const selectedTrack = audioTracks.find((track) => track.id === selectedAudioId)
        || musicTracks.find((track) => track.id === selectedAudioId);
      outputStream = canvasStream;
      const audioElement = audioRef.current;
      if (selectedTrack && audioElement) {
        const captureAudio = audioElement.captureStream || audioElement.mozCaptureStream;
        if (!captureAudio) throw new Error('Audio capture is not supported by this browser. Try the latest Chrome or Edge.');
        if (audioElement.src !== preparedAudioUrl || audioElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          throw new Error('Wait for the selected audio preview to finish loading, then generate the reel.');
        }
        recordingClipLength = isNewsBackgroundAudio && useFullReelAudio
          ? effectiveAudioClipDuration
          : Math.min(effectiveAudioClipDuration, audioElement.duration - audioClipStart);
        if (!Number.isFinite(recordingClipLength) || recordingClipLength <= 0) {
          throw new Error('The selected audio is shorter than the chosen clip. Choose a shorter clip or another track.');
        }
        audioElement.loop = isNewsBackgroundAudio && useFullReelAudio;
        audioElement.volume = 1;
        audioElement.currentTime = audioClipStart;
        audioPreviewStartedAtRef.current = Date.now();
        await audioElement.play();
        outputStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...captureAudio.call(audioElement).getAudioTracks(),
        ]);
      }

      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(outputStream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      const blob = await new Promise((resolve, reject) => {
        let timer;
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => {
          window.clearInterval(timer);
          reject(new Error('The reel recording failed. Please try again.'));
        };
        recorder.onstop = () => {
          window.clearInterval(timer);
          resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
        };
        recorder.start(250);
        const startedAt = Date.now();
        timer = window.setInterval(() => {
          const nextElapsed = Math.min((Date.now() - startedAt) / 1000, currentReelDuration);
          setElapsed(nextElapsed);
          if (selectedTrack && audioElement) {
            const fadeDuration = Math.min(0.8, recordingClipLength / 3);
            const remaining = recordingClipLength - nextElapsed;
            audioElement.volume = Math.max(0, Math.min(1, remaining / fadeDuration));
            if (remaining <= 0) {
              audioElement.pause();
              audioElement.volume = 0;
            }
          }
          if (nextElapsed >= currentReelDuration) {
            window.clearInterval(timer);
            if (recorder.state !== 'inactive') recorder.stop();
          }
        }, 100);
      });

      if (!blob.size) throw new Error('The generated reel is empty. Please try again.');
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${(title || activeQuestion?.question || imageFile?.name || 'current-affairs-reel')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80) || 'current-affairs-reel'}.webm`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (recordingError) {
      setError(recordingError.message || 'Could not generate the reel.');
    } finally {
      outputStream?.getTracks().forEach((track) => track.stop());
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.loop = false;
        audioRef.current.volume = 1;
        setAudioPreviewPlaying(false);
      }
      audioPreviewStartedAtRef.current = 0;
      setElapsed(0);
      setIsRecording(false);
    }
  };

  return (
    <div className="page reels-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Create vertical videos</p>
          <h1 className="page-title"><Icon name="reels" size={23} />Reels Maker</h1>
          <p className="reels-intro">Turn daily current-affairs MCQs or your own images into a 9:16 social reel.</p>
        </div>
      </header>

      <div className="reels-workspace">
        <section className="card reels-editor">
          <div className="reel-category-tabs" role="tablist" aria-label="Reel category">
            <button type="button" className={category === 'questions' ? 'active' : ''} onClick={() => setCategory('questions')}>
              <Icon name="questions" size={16} />
              Daily current affairs
            </button>
            <button type="button" className={category === 'image' ? 'active' : ''} onClick={() => setCategory('image')}>
              <Icon name="presentation" size={16} />
              Image story
            </button>
          </div>

          {category === 'questions' ? (
            <>
              <label className="field">
                <span>Import current-affairs questions (JSON)</span>
                <input type="file" accept=".json,application/json" onChange={handleQuestionFile} />
              </label>
              <div className="summary-box">
                {questions.length} questions loaded{questionFileName ? ` · ${questionFileName}` : ''}
              </div>
              {questions.length > 0 && (
                <label className="field">
                  <span>Question for this reel</span>
                  <select value={selectedQuestion} onChange={(event) => setSelectedQuestion(Number(event.target.value))}>
                    {questions.map((question, index) => (
                      <option key={`${index}-${question.question}`} value={index}>
                        {index + 1}. {question.question}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : (
            <>
              <label className="field">
                <span>Upload a photo</span>
                <input type="file" accept="image/*" onChange={handleImageFile} />
              </label>
              {imageFile && <p className="reel-file-note">Selected image: {imageFile.name}</p>}
              <label className="field">
                <span>Image story caption</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a short caption" maxLength={100} />
              </label>
            </>
          )}

          {isBreakingNewsTemplate && (
            <section className="reel-breaking-settings" aria-labelledby="breaking-news-settings-heading">
              <div>
                <p className="eyebrow">On-air graphics</p>
                <h3 id="breaking-news-settings-heading">Breaking news TV</h3>
                <p>Add multiple stories. They play one after another while the ticker repeats the full list.</p>
              </div>
              <label className="field">
                <span>Breaking banner</span>
                <input
                  value={breakingHeadline}
                  onChange={(event) => setBreakingHeadline(event.target.value)}
                  maxLength={24}
                  placeholder="BREAKING NEWS"
                />
              </label>
              <label className="field">
                <span>News stories · one headline per line ({breakingNewsItems.length}/30)</span>
                <textarea
                  value={breakingNewsText}
                  onChange={(event) => setBreakingNewsText(event.target.value)}
                  rows={7}
                  maxLength={6000}
                  placeholder={'India announces a new national initiative\nParliament passes a major bill\nISRO confirms its next mission timeline'}
                />
              </label>
              <label className="field reel-news-file-field">
                <span>Or import news headlines (.txt or .json)</span>
                <input type="file" accept=".txt,.json,text/plain,application/json" onChange={handleBreakingNewsFile} />
              </label>
              <p className="reel-breaking-story-count" role="status">
                {breakingNewsItems.length
                  ? `${breakingNewsItems.length} stories · ${currentReelDuration}s reel · ${breakingStoryDuration}s per story`
                  : 'Add headlines above to create a multi-story news reel.'}
              </p>
              <div className="reel-news-sound-controls">
                <label className="field">
                  <span>News background music · Jamendo cinematic instrumentals</span>
                  <select
                    value={isNewsBackgroundAudio ? selectedAudioId : ''}
                    disabled={musicGenre !== 'cinematic' || musicLoading || musicTracks.length === 0}
                    onChange={(event) => {
                      const trackId = event.target.value;
                      setSelectedAudioId(trackId);
                      setUseFullReelAudio(Boolean(trackId));
                    }}
                  >
                    <option value="">
                      {musicGenre === 'cinematic' && musicLoading
                        ? 'Loading Jamendo tracks…'
                        : musicGenre === 'cinematic' && musicTracks.length
                          ? 'Choose a cinematic instrumental'
                          : 'Load Jamendo cinematic tracks first'}
                    </option>
                    {musicGenre === 'cinematic' && musicTracks.map((track) => (
                      <option key={track.id} value={track.id}>{track.name} — {track.artist}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={browseNewsBackgroundMusic}
                  disabled={musicLoading}
                >
                  {musicLoading && musicGenre === 'cinematic' ? 'Loading Jamendo tracks…' : 'Browse Jamendo cinematic tracks'}
                </button>
                <p className="reel-file-note">Preview real instrumental tracks from Jamendo. Preview/download availability does not guarantee every reuse right; check each track’s license before publishing. Select a track below to preview it and include it across the full {currentReelDuration}s reel.</p>
                {musicError && <div className="error-box" role="alert">{musicError}</div>}
              </div>
              <button type="button" className="secondary-btn" onClick={addBreakingNewsSting}>
                {selectedAudioId === breakingNewsStingId ? 'Breaking news sting selected' : 'Add original breaking-news sting'}
              </button>
              <p className="reel-file-note">An original six-second synthesized news cue. It is added to the reel audio and can be previewed and trimmed below.</p>
            </section>
          )}

          <div className="reel-audio-library">
            <div className="section-heading">
              <h3>Audio library &amp; short clips</h3>
              <button
                type="button"
                className="outline-btn reel-refresh-music"
                onClick={() => setMusicReloadCount((count) => count + 1)}
                disabled={musicLoading}
              >
                {musicLoading ? 'Loading…' : 'Refresh tracks'}
              </button>
            </div>
            <section className="reel-motivational-upload" aria-labelledby="motivational-audio-heading">
              <h4 id="motivational-audio-heading">Your motivational Hindi songs</h4>
              <p>Upload Hindi songs you own or have permission to use. They will appear in the track picker for preview and clipping.</p>
              <label className="field">
                <span>Add your song files</span>
                <input type="file" accept="audio/*" multiple onChange={handleAudioFiles} />
              </label>
            </section>
            <div className="reel-hindi-catalog-heading">
              <h4>Browse independent Hindi tracks</h4>
              <p>Jamendo’s Hindi catalog is not curated by motivational mood. Check each track’s license before publishing.</p>
            </div>
            <div className="reel-hindi-audio-tabs" aria-label="Hindi motivational audio type">
              <button
                type="button"
                className={`reel-hindi-audio-tab${musicGenre === 'hindi' ? ' active' : ''}`}
                onClick={() => chooseHindiMusic('hindi')}
                aria-pressed={musicGenre === 'hindi'}
              >
                Hindi songs
              </button>
              <button
                type="button"
                className={`reel-hindi-audio-tab${musicGenre === 'hindi-instrumental' ? ' active' : ''}`}
                onClick={() => chooseHindiMusic('hindi-instrumental')}
                aria-pressed={musicGenre === 'hindi-instrumental'}
              >
                Hindi instrumental
              </button>
            </div>
            <label className="field">
              <span>Browse other music styles</span>
              <select value={musicGenre} onChange={(event) => setMusicGenre(event.target.value)}>
                <option value="popular">Popular this week</option>
                <option value="cinematic">Cinematic</option>
                <option value="hiphop">Hip-hop</option>
                <option value="electronic">Electronic</option>
                <option value="pop">Pop</option>
                <option value="relaxation">Relaxation</option>
                <option value="hindi">Hindi songs &amp; music</option>
                <option value="hindi-instrumental">Hindi instrumentals</option>
              </select>
            </label>
            <form className="reel-music-search" onSubmit={handleMusicSearch}>
              <label className="field">
                <span>Search Jamendo titles and artists</span>
                <input value={musicSearchInput} onChange={(event) => setMusicSearchInput(event.target.value)} placeholder="Search a Hindi song or artist" maxLength={80} />
              </label>
              <button type="submit" className="secondary-btn" disabled={musicLoading}><Icon name="search" size={16} />Search</button>
            </form>
            <label className="field">
              <span>Choose a track</span>
              <select
                value={selectedAudioId}
                onChange={(event) => {
                  const trackId = event.target.value;
                  const track = audioTracks.find((entry) => entry.id === trackId)
                    || musicTracks.find((entry) => entry.id === trackId);
                  setSelectedAudioId(trackId);
                  setUseFullReelAudio(
                    track?.genre === 'cinematic' && isBreakingNewsTemplate,
                  );
                }}
              >
                <option value="">No music</option>
                {musicTracks.length > 0 && (
                  <optgroup label="Jamendo · preview and download allowed">
                    {musicTracks.map((track) => (
                      <option key={track.id} value={track.id}>{track.name} — {track.artist}</option>
                    ))}
                  </optgroup>
                )}
                {audioTracks.length > 0 && (
                  <optgroup label="Your audio files">
                    {audioTracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
            {musicLoading && <p className="reel-file-note" role="status">Loading tracks…</p>}
            {musicError && <div className="error-box" role="alert">{musicError}</div>}
            {!musicLoading && !musicError && musicTracks.length === 0 && (
              <p className="reel-music-empty" role="status">
                {musicGenre === 'cinematic'
                  ? 'No Jamendo cinematic tracks are available right now. Refresh the list or try again later.'
                  : musicSearch
                    ? `No Jamendo Hindi tracks matched “${musicSearch}”. Upload your licensed motivational song above or clear the search to browse Hindi tracks.`
                    : 'No Hindi tracks are available right now. Refresh the list or upload a motivational song you are licensed to use.'}
              </p>
            )}
            <div className="reel-audio-clip-controls">
              <div className="reel-audio-clip-heading">
                <strong>Trim your background clip</strong>
                <span>{effectiveAudioClipDuration}s · fades out smoothly</span>
              </div>
              <label className="field">
                <span>Clip length</span>
                <select
                  value={effectiveAudioClipDuration}
                  onChange={(event) => {
                    const duration = Number(event.target.value);
                    setAudioClipDuration(duration);
                    setUseFullReelAudio(isNewsBackgroundAudio && duration === currentReelDuration);
                    setAudioClipStart((current) => Math.min(current, Math.max(0, Math.floor(audioDuration - duration))));
                    if (audioRef.current) {
                      audioRef.current.pause();
                      setAudioPreviewPlaying(false);
                    }
                  }}
                >
                  {[3, 6, 10, 15]
                    .filter((duration) => !isNewsBackgroundAudio || duration !== currentReelDuration)
                    .map((duration) => (
                    <option key={duration} value={duration} disabled={audioDuration > 0 && duration > audioDuration}>
                      {duration} seconds
                    </option>
                    ))}
                  {isNewsBackgroundAudio && (
                    <option value={currentReelDuration}>Full reel · {currentReelDuration} seconds</option>
                  )}
                </select>
              </label>
              <label className="field">
                <span>Start point · {audioClipStart}s</span>
                <input
                  type="range"
                  min="0"
                  max={maxAudioClipStart}
                  step="1"
                  value={Math.min(audioClipStart, maxAudioClipStart)}
                  disabled={!audioDuration || maxAudioClipStart === 0}
                  onChange={(event) => {
                    setAudioClipStart(Number(event.target.value));
                    if (audioRef.current) {
                      audioRef.current.pause();
                      setAudioPreviewPlaying(false);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="secondary-btn reel-clip-preview-button"
                onClick={toggleAudioPreview}
                disabled={previewLoading || !preparedAudioUrl}
              >
                {previewLoading ? 'Loading clip…' : audioPreviewPlaying ? 'Stop clip preview' : `Preview ${effectiveAudioClipDuration}s clip`}
              </button>
              {!selectedAudio && <span className="reel-clip-helper">Choose a Hindi track above to enable the clip preview.</span>}
            </div>
            {selectedAudio && (
              <div className="reel-audio-preview">
                <audio
                  ref={audioRef}
                  key={selectedAudio.id}
                  preload="auto"
                  src={preparedAudioUrl || undefined}
                  onLoadedMetadata={handleAudioLoadedMetadata}
                  onTimeUpdate={handleAudioTimeUpdate}
                  onEnded={() => setAudioPreviewPlaying(false)}
                  aria-hidden="true"
                >
                  Audio preview is not supported by this browser.
                </audio>
                {selectedAudio.source === 'jamendo' ? (
                  <div className="reel-track-links">
                    {selectedAudio.downloadUrl && (
                      <a className="download-btn" href={selectedAudio.downloadUrl} target="_blank" rel="noreferrer">
                        Download track
                      </a>
                    )}
                    {selectedAudio.licenseUrl && (
                      <a className="reel-license-link" href={selectedAudio.licenseUrl} target="_blank" rel="noreferrer">
                        Check track license
                      </a>
                    )}
                    {selectedAudio.pageUrl && (
                      <a className="reel-license-link" href={selectedAudio.pageUrl} target="_blank" rel="noreferrer">
                        Track details
                      </a>
                    )}
                  </div>
                ) : (
                  <button type="button" className="outline-btn" onClick={() => removeAudioTrack(selectedAudio)}><Icon name="trash" size={16} />Remove audio track</button>
                )}
              </div>
            )}
            {previewLoading && (
              <p className="reel-file-note" role="status">
                {selectedAudio?.isCurrentAffairsSoundtrack
                  ? 'Downloading the full Jamendo track and preparing it…'
                  : 'Loading audio preview…'}
              </p>
            )}
            {selectedAudio?.isCurrentAffairsSoundtrack && (
              <p className="reel-file-note">
                This downloadable soundtrack is cached on the server after its first use and reused for future reels. Check the linked track license before publishing.
              </p>
            )}
            {playbackHint && <p className="reel-file-note" role="status">{playbackHint}</p>}
            <p className="reel-file-note">Choose Hindi-tagged music for a motivational edit, then preview a 3–15 second excerpt and its start point. Jamendo does not classify tracks by mood; licenses vary by track, and commercial Bollywood songs aren’t included.</p>
          </div>

          {error && <div className="error-box" role="alert">{error}</div>}
          <button type="button" className="primary-btn reel-generate-btn" onClick={generateReel} disabled={isRecording}>
            <Icon name="sparkles" size={17} />
            {isRecording ? `Recording reel · ${Math.ceil(elapsed)}s / ${currentReelDuration}s` : 'Generate & download reel'}
          </button>
          <p className="reel-export-note">
            Exports a {currentReelDuration}-second, 1080 × 1920 WebM video in your browser
            {isBreakingNewsTemplate && breakingNewsItems.length ? ` · ${breakingNewsItems.length} stories` : ''}.
          </p>
        </section>

        <section className="card reel-preview-panel">
          <div className="section-heading">
            <h2 className="icon-heading"><Icon name="eye" />Live preview</h2>
            <span className="voice-count">9:16 portrait</span>
          </div>
          <label className="field reel-motion-field">
            <span>Motion style</span>
            <select value={motionStyle} onChange={(event) => setMotionStyle(event.target.value)}>
              <option value="cinematic">Cinematic · smooth camera and light</option>
              <option value="energetic">High energy · faster movement</option>
              <option value="editorial">Editorial · restrained motion</option>
            </select>
          </label>
          <div className="reel-canvas-frame">
            <canvas ref={canvasRef} width="1080" height="1920" aria-label="Reel preview" />
          </div>
          <p className="reel-preview-caption">{selectedTemplate.name} · {motionStyle} motion{isBreakingNewsTemplate ? ' with an on-air banner and scrolling news ticker' : ' with timed question, countdown and answer reveal'}.</p>
        </section>
      </div>

      <section className="card reel-template-section">
        <div className="section-heading">
          <div>
            <h2>Choose a template</h2>
            <p className="reels-intro">56 layouts, eight animated Orbit templates, nine color-style Breaking News TV templates, one broadcast original, and nine animated subject templates with matching logos.</p>
          </div>
          <span className="voice-count">{templates.length} templates</span>
        </div>
        <div className="reel-template-grid">
          {templates.map((template, index) => (
            <button
              type="button"
              key={template.id}
              className={`reel-template-card${selectedTemplateId === template.id ? ' active' : ''}`}
              onClick={() => setSelectedTemplateId(template.id)}
              aria-pressed={selectedTemplateId === template.id}
            >
              <span
                className={`reel-template-art layout-${template.layoutIndex}`}
                style={{
                  '--template-start': template.palette.background[0],
                  '--template-end': template.palette.background[1],
                  '--template-accent': template.palette.accent,
                }}
              >
                <span className="reel-template-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="reel-template-lines" />
                {template.subject && (
                  <>
                    <span className="reel-template-subject-logo" aria-hidden="true">{template.subject.logo}</span>
                    <span className="reel-template-symbol" aria-hidden="true">{template.subject.icon}</span>
                  </>
                )}
              </span>
              <span className="reel-template-name">{template.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
