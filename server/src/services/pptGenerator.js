import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';
import { config } from '../config.js';

const palette = { navy: '0F172A', blue: '2563EB', teal: '2563EB', ink: '1E293B', muted: '64748B', paper: 'F8FAFC', white: 'FFFFFF', line: 'E2E8F0', paleBlue: 'EFF6FF', paleTeal: 'FEF3C7', green: '92400E', code: '132238', codeText: 'E7EEF7' };
const fontFace = 'Arial';

function addAccent(slide, label, page) {
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.12, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
  if (label) slide.addText(label.toUpperCase(), { x: 0.72, y: 0.25, w: 8.8, h: 0.25, fontSize: 9, bold: true, charSpacing: 1.4, color: palette.muted, margin: 0 });
  slide.addShape('line', { x: 0.72, y: 7.08, w: 11.9, h: 0, line: { color: palette.line, width: 0.8 } });
  if (page) slide.addText(String(page).padStart(2, '0'), { x: 12, y: 7.13, w: 0.55, h: 0.2, fontSize: 9, color: palette.muted, align: 'right', margin: 0 });
}

function addTitle(pptx, data, author) {
  const slide = pptx.addSlide(); slide.background = { color: palette.navy };
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, line: { color: palette.navy, transparency: 100 }, fill: { color: palette.navy } });
  slide.addShape('rect', { x: 0.82, y: 0.85, w: 0.12, h: 1.8, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
  slide.addText(String(data.title), { x: 1.2, y: 0.95, w: 10.9, h: 1.45, fontSize: 34, bold: true, color: palette.white, margin: 0, valign: 'mid', fit: 'shrink' });
  slide.addText([data.subject, data.exam, data.chapter, data.difficulty].filter(Boolean).join('  |  '), { x: 1.22, y: 2.52, w: 10.8, h: 0.42, fontSize: 15, color: 'D8E7EF', margin: 0, fit: 'shrink' });
  slide.addText('LEARNING PRESENTATION', { x: 0.88, y: 4.25, w: 5.8, h: 0.3, fontSize: 11, bold: true, charSpacing: 1.6, color: '79D1C8', margin: 0 });
  slide.addShape('line', { x: 0.88, y: 6.48, w: 11.4, h: 0, line: { color: '456078', width: 1 } });
  slide.addText(author, { x: 0.88, y: 6.7, w: 9, h: 0.3, fontSize: 11, color: 'D8E7EF', margin: 0 });
}

function addClosing(pptx, author) {
  const slide = pptx.addSlide(); slide.background = { color: palette.navy };
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.14, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
  slide.addShape('ellipse', { x: 5.93, y: 1.35, w: 1.45, h: 1.45, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal, transparency: 15 } });
  slide.addText('THANK YOU', { x: 2, y: 3.05, w: 9.33, h: 0.85, fontSize: 34, bold: true, color: palette.white, align: 'center', charSpacing: 1.5, margin: 0 });
  slide.addText('Review the key facts, then move to the next topic.', { x: 2, y: 4.12, w: 9.33, h: 0.45, fontSize: 17, color: 'D8E7EF', align: 'center', margin: 0 });
  slide.addText(author, { x: 2, y: 6.55, w: 9.33, h: 0.3, fontSize: 11, color: 'C4D3DE', align: 'center', margin: 0 });
}

function addStyledContentSlide(pptx, title, description, bullets = [], examples = []) {
  const slide = pptx.addSlide(); slide.background = { color: palette.paper }; addAccent(slide, 'Concepts and explanations', pptx._slides.length);
  slide.addText(title, { x: 0.72, y: 0.68, w: 11.9, h: 0.62, fontFace, fontSize: 28, bold: true, color: palette.navy, margin: 0, fit: 'shrink' });
  let y = 1.52;
  if (description) {
    const compact = bullets.length > 0 || examples.length > 0;
    const h = compact ? 1.38 : 4.95;
    slide.addShape('roundRect', { x: 0.72, y, w: 11.9, h, rectRadius: 0.08, line: { color: palette.line, width: 0.7 }, fill: { color: palette.white } });
    slide.addText(String(description), { x: 1.02, y: y + 0.2, w: 11.3, h: h - 0.4, fontSize: 19, color: palette.ink, margin: 0, valign: 'mid', fit: 'shrink' });
    if (compact) y += h + 0.22;
  }
  if (bullets.length) {
    const h = Math.min(4.25, Math.max(1.2, Math.ceil(bullets.length / 3) * 1.45));
    slide.addShape('roundRect', { x: 0.72, y, w: 11.9, h, rectRadius: 0.08, line: { color: 'D5E6EF', width: 0.7 }, fill: { color: palette.paleBlue } });
    slide.addText(bullets.map((item) => `•  ${item}`).join('\n'), { x: 1.02, y: y + 0.16, w: 11.25, h: h - 0.3, fontSize: 16, color: palette.ink, margin: 0.02, paraSpaceAfterPt: 8, valign: 'mid', fit: 'shrink' });
    y += h + 0.18;
  }
  if (examples.length) {
    const estimatedLines = examples.reduce((total, item) => total + Math.max(1, Math.ceil(String(item).length / 100)), 0);
    const h = Math.min(2.2, Math.max(1.1, 0.4 + estimatedLines * 0.33));
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

function toContentFragments(value, type = 'point') {
  const normalized = String(value || '').replace(/^[\s•●▪\-–—]+/, '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const colon = normalized.indexOf(':');
  if (colon > 0 && colon < 48) {
    return [{ keyword: normalized.slice(0, colon).trim(), takeaway: normalized.slice(colon + 1).trim(), type, hasMetric: /\d/.test(normalized) }];
  }
  const words = normalized.split(' ').filter(Boolean);
  const keywordSize = words.length >= 5 ? 2 : 1;
  const keyword = words.slice(0, keywordSize).join(' ').replace(/[,:;]+$/, '');
  const takeaway = words.slice(keywordSize).join(' ');
  return [{ keyword, takeaway, type, hasMetric: /\d/.test(normalized) }];
}

function collectContentFragments(section) {
  const content = [
    { type: 'context', items: [section.description] },
    { type: 'point', items: section.bulletPoints || [] },
    { type: 'example', items: section.examples || [] },
    { type: 'point', items: [section.explanation] },
  ];
  return content.flatMap(({ type, items }) => items
    .filter((item) => typeof item === 'string' && item.trim())
    .flatMap((item) => toContentFragments(item, type)));
}

function addFragmentCard(slide, fragment, x, y, w, h, index, accent = palette.teal) {
  const cardAccent = fragment.hasMetric ? 'D49A13' : fragment.type === 'example' ? palette.green : accent;
  const cardFill = fragment.type === 'example' ? palette.paleTeal : palette.white;
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, line: { color: fragment.type === 'example' ? 'FCD34D' : palette.line, width: 0.8 }, fill: { color: cardFill } });
  slide.addShape('ellipse', { x: x + 0.22, y: y + 0.22, w: 0.48, h: 0.48, line: { color: cardAccent, transparency: 100 }, fill: { color: cardAccent } });
  slide.addText(String(index).padStart(2, '0'), { x: x + 0.22, y: y + 0.38, w: 0.48, h: 0.16, fontSize: 10, bold: true, color: palette.white, align: 'center', margin: 0 });
  slide.addText(fragment.type === 'example' ? `EXAMPLE / EXAM NOTE  |  ${fragment.keyword}` : `${fragment.keyword}:`, { x: x + 0.82, y: y + 0.25, w: w - 1.05, h: 0.42, fontFace, fontSize: 15, bold: true, color: cardAccent, margin: 0, fit: 'shrink' });
  slide.addText(fragment.takeaway, { x: x + 0.22, y: y + 0.92, w: w - 0.44, h: h - 1.15, fontFace, fontSize: 18, bold: true, color: palette.ink, margin: 0.02, valign: 'mid', fit: 'shrink' });
}

const educationalLayouts = [
  { name: 'BACKGROUND / CORE IDEA', capacity: 2, kind: 'split' },
  { name: 'PRIMARY ENTITY / PHASE 1', capacity: 3, kind: 'three' },
  { name: 'SECONDARY ENTITY / PHASE 2', capacity: 3, kind: 'metric' },
  { name: 'PROGRESSION', capacity: 4, kind: 'steps' },
  { name: 'SIDE-BY-SIDE KEY FACTS', capacity: 4, kind: 'compare' },
  { name: 'CRITICAL EVENTS / KEY FACTS', capacity: 4, kind: 'table' },
  { name: 'SPECIAL FOCUS', capacity: 4, kind: 'matrix' },
  { name: 'KEY ITEMS / SOURCES', capacity: 2, kind: 'split' },
  { name: 'HIGH-YIELD FOCUS', capacity: 3, kind: 'impact' },
  { name: 'REVISION MATRIX', capacity: 3, kind: 'three' },
  { name: 'FOCUS FACT', capacity: 1, kind: 'dense' },
];

function selectEducationalLayout(pptx, section, fragments, sectionIndex, firstPage) {
  const title = String(section.title || '').toLowerCase();
  const content = fragments.map(({ keyword, takeaway }) => `${keyword} ${takeaway}`).join(' ').toLowerCase();
  const yearCount = (content.match(/\b(?:1[0-9]{3}|20\d{2})\b/g) || []).length;
  const metricCount = fragments.filter((fragment) => fragment.hasMetric).length;
  let selectedIndex;

  if (pptx._educationalSlideCount === undefined && sectionIndex === 0 && firstPage) selectedIndex = 0;
  else if (firstPage && fragments[0]?.type === 'context') selectedIndex = 0;
  else if ((/chronolog|timeline|progression|sequence|arrival|expedition|reign|war|battle|treaty|founded/.test(title) || yearCount >= 3) && fragments.length >= 3) selectedIndex = 3;
  else if (/compare|versus|\bvs\b|difference|contrast|rival|competing/.test(`${title} ${content}`) && fragments.length >= 2) selectedIndex = 4;
  else if (/regional|region|province|local|geography/.test(title) && fragments.length >= 3) selectedIndex = 6;
  else if (fragments.length && fragments.every((fragment) => fragment.type === 'example')) selectedIndex = 7;
  else if (metricCount > 0) selectedIndex = 2;
  else if (/source|document|record|inscription|book|textbook/.test(title) && fragments.length >= 2) selectedIndex = 7;
  else if (/conflict|crisis|event|movement|revolt|agreement|act|outcome/.test(title) && fragments.length >= 3) selectedIndex = 5;
  else selectedIndex = (pptx._educationalLayoutIndex || 0) % educationalLayouts.length;

  const selectedKind = educationalLayouts[selectedIndex].kind;
  const lengthLimit = selectedKind === 'steps' || selectedKind === 'table' ? 70 : 105;
  const needsReadingRoom = fragments.some((fragment) => `${fragment.keyword}: ${fragment.takeaway}`.length > lengthLimit);
  if (needsReadingRoom) selectedIndex = educationalLayouts.findIndex((layout) => layout.kind === 'dense');

  const previousKind = pptx._lastEducationalLayoutKind;
  if (!needsReadingRoom && educationalLayouts[selectedIndex].kind === previousKind) {
    for (let step = 1; step <= educationalLayouts.length; step += 1) {
      const candidate = (selectedIndex + step) % educationalLayouts.length;
      if (educationalLayouts[candidate].kind !== previousKind) {
        selectedIndex = candidate;
        break;
      }
    }
  }
  return selectedIndex;
}

function addEducationalLayoutSlide(pptx, title, fragments, layoutIndex) {
  const slide = pptx.addSlide();
  slide.background = { color: palette.paper };
  const layout = educationalLayouts[layoutIndex % educationalLayouts.length];
  addAccent(slide, layout.name, pptx._slides.length);
  slide.addText(String(title), { x: 0.72, y: 0.64, w: 11.9, h: 0.58, fontFace, fontSize: 28, bold: true, color: palette.navy, margin: 0, fit: 'shrink' });

  if (layout.kind === 'dense') {
    addFragmentCard(slide, fragments[0], 0.72, 1.55, 11.9, 4.95, 1);
  } else if (layout.kind === 'split' || layout.kind === 'compare') {
    const split = Math.ceil(fragments.length / 2);
    fragments.forEach((fragment, index) => {
      const col = index < split ? 0 : 1;
      const single = fragments.length === 1;
      const x = single ? 0.72 : col === 0 ? 0.72 : 6.82;
      const y = single ? 1.55 : 1.55 + (index % split) * 2.45;
      addFragmentCard(slide, fragment, x, y, single ? 11.9 : 5.78, single ? 4.95 : 2.1, index + 1, col ? palette.blue : palette.teal);
    });
  } else if (layout.kind === 'three') {
    const gap = 0.24;
    const w = (11.9 - gap * 2) / 3;
    fragments.forEach((fragment, index) => addFragmentCard(slide, fragment, 0.72 + index * (w + gap), 2.0, w, 3.8, index + 1));
  } else if (layout.kind === 'metric') {
    const metricIndex = fragments.findIndex((fragment) => /\b(?:1[0-9]{3}|20\d{2})\b|\b\d+(?:\.\d+)?%?\b/.test(`${fragment.keyword} ${fragment.takeaway}`));
    const heroIndex = metricIndex >= 0 ? metricIndex : 0;
    const hero = fragments[heroIndex];
    const supporting = fragments.filter((_, index) => index !== heroIndex);
    slide.addShape('roundRect', { x: 0.72, y: 1.55, w: 4.0, h: 4.95, rectRadius: 0.08, line: { color: palette.line, width: 0.8 }, fill: { color: palette.white } });
    const heroText = `${hero.keyword} ${hero.takeaway}`;
    const metric = heroText.match(/\b(?:1[0-9]{3}|20\d{2}|\d+(?:\.\d+)?%?)\b/)?.[0];
    slide.addText(metric || hero.keyword, { x: 1.02, y: 2.0, w: 3.4, h: 1.05, fontSize: 34, bold: true, color: palette.teal, align: 'center', margin: 0, fit: 'shrink' });
    slide.addText(`${hero.keyword}: ${hero.takeaway}`, { x: 1.05, y: 3.25, w: 3.35, h: 2.65, fontSize: 20, bold: true, color: palette.ink, align: 'center', valign: 'mid', margin: 0.03, fit: 'shrink' });
    supporting.forEach((fragment, index) => addFragmentCard(slide, fragment, 5.05, 1.55 + index * 2.48, 7.57, 2.2, index + 2, palette.blue));
  } else if (layout.kind === 'steps') {
    slide.addShape('line', { x: 1.35, y: 3.4, w: 10.65, h: 0, line: { color: 'B8CDD8', width: 2 } });
    const gap = 0.18;
    const w = (11.9 - gap * (fragments.length - 1)) / fragments.length;
    fragments.forEach((fragment, index) => {
      const x = 0.72 + index * (w + gap);
      slide.addShape('ellipse', { x: x + (w - 0.54) / 2, y: 3.13, w: 0.54, h: 0.54, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
      slide.addText(String(index + 1), { x: x + (w - 0.54) / 2, y: 3.3, w: 0.54, h: 0.16, fontSize: 11, bold: true, color: palette.white, align: 'center', margin: 0 });
      slide.addShape('roundRect', { x, y: index % 2 ? 4.05 : 1.65, w, h: 1.7, rectRadius: 0.08, line: { color: palette.line, width: 0.8 }, fill: { color: palette.white } });
      slide.addText(`${fragment.keyword}:`, { x: x + 0.14, y: (index % 2 ? 4.05 : 1.65) + 0.16, w: w - 0.28, h: 0.33, fontSize: 14, bold: true, color: palette.blue, align: 'center', margin: 0, fit: 'shrink' });
      slide.addText(fragment.takeaway, { x: x + 0.14, y: (index % 2 ? 4.05 : 1.65) + 0.58, w: w - 0.28, h: 0.95, fontSize: 18, bold: true, color: palette.ink, align: 'center', valign: 'mid', margin: 0, fit: 'shrink' });
    });
  } else if (layout.kind === 'table') {
    const headers = [{ text: 'KEYWORD', x: 0.9, w: 3.0 }, { text: 'TAKEAWAY', x: 4.0, w: 8.1 }];
    headers.forEach((header) => slide.addText(header.text, { x: header.x, y: 1.48, w: header.w, h: 0.35, fontSize: 12, bold: true, charSpacing: 1.2, color: palette.muted, margin: 0 }));
    fragments.forEach((fragment, index) => {
      const y = 1.95 + index * 1.08;
      slide.addShape('line', { x: 0.86, y: y + 0.88, w: 11.55, h: 0, line: { color: palette.line, width: 0.8 } });
      slide.addText(`${fragment.keyword}:`, { x: 0.9, y, w: 3.0, h: 0.7, fontSize: 18, bold: true, color: palette.blue, margin: 0, valign: 'mid', fit: 'shrink' });
      slide.addText(fragment.takeaway, { x: 4.0, y, w: 8.1, h: 0.7, fontSize: 18, color: palette.ink, margin: 0, valign: 'mid', fit: 'shrink' });
    });
  } else if (layout.kind === 'matrix') {
    const gap = 0.25;
    const w = (11.9 - gap) / 2;
    fragments.forEach((fragment, index) => {
      const x = 0.72 + (index % 2) * (w + gap);
      const y = 1.55 + Math.floor(index / 2) * 2.48;
      addFragmentCard(slide, fragment, x, y, w, 2.2, index + 1, index % 2 ? palette.blue : palette.teal);
    });
  } else if (layout.kind === 'impact') {
    const [hero, ...supporting] = fragments;
    slide.addShape('roundRect', { x: 0.72, y: 1.55, w: 6.15, h: 4.95, rectRadius: 0.08, line: { color: palette.line, width: 0.8 }, fill: { color: palette.white } });
    slide.addText(`${hero.keyword}:`, { x: 1.1, y: 1.95, w: 5.4, h: 0.55, fontSize: 17, bold: true, color: palette.teal, margin: 0 });
    slide.addText(hero.takeaway, { x: 1.1, y: 2.7, w: 5.4, h: 3.1, fontSize: 25, bold: true, color: palette.navy, margin: 0.02, valign: 'mid', fit: 'shrink' });
    supporting.forEach((fragment, index) => addFragmentCard(slide, fragment, 7.15, 1.55 + index * 2.48, 5.47, 2.2, index + 2, palette.blue));
  }
}

function addEducationalContentSlides(pptx, section, sectionIndex) {
  const fragments = collectContentFragments(section);
  let offset = 0;
  while (offset < fragments.length) {
    const remainingFragments = fragments.slice(offset);
    const layoutIndex = selectEducationalLayout(pptx, section, remainingFragments, sectionIndex, offset === 0);
    const layout = educationalLayouts[layoutIndex % educationalLayouts.length];
    const pageFragments = remainingFragments.slice(0, layout.capacity);
    addEducationalLayoutSlide(pptx, section.title, pageFragments, layoutIndex);
    pptx._lastEducationalLayoutKind = layout.kind;
    pptx._educationalSlideCount = (pptx._educationalSlideCount || 0) + 1;
    pptx._educationalLayoutIndex = (pptx._educationalLayoutIndex || 0) + 1;
    offset += pageFragments.length;
  }
}

function addEducationalSummarySlide(pptx, sections) {
  const summaryItems = sections.flatMap((section) => {
    const facts = (section.bulletPoints || []).filter((item) => typeof item === 'string' && item.trim());
    return facts.map((fact) => ({ section: section.title, fragment: toContentFragments(fact, 'point')[0] }));
  }).filter(({ fragment }) => fragment?.takeaway).sort((a, b) => Number(b.fragment.hasMetric) - Number(a.fragment.hasMetric)).slice(0, 5);
  if (!summaryItems.length) return;

  const slide = pptx.addSlide();
  slide.background = { color: palette.paper };
  addAccent(slide, 'MASTER REVISION / SUMMARY MATRIX', pptx._slides.length);
  slide.addText('Quick revision matrix', { x: 0.72, y: 0.65, w: 11.9, h: 0.6, fontSize: 25, bold: true, color: palette.navy, margin: 0 });
  slide.addText('SECTION', { x: 0.9, y: 1.45, w: 3.1, h: 0.3, fontSize: 12, bold: true, charSpacing: 1.2, color: palette.muted, margin: 0 });
  slide.addText('KEYWORD', { x: 4.1, y: 1.45, w: 2.6, h: 0.3, fontSize: 12, bold: true, charSpacing: 1.2, color: palette.muted, margin: 0 });
  slide.addText('TAKEAWAY', { x: 6.85, y: 1.45, w: 5.5, h: 0.3, fontSize: 12, bold: true, charSpacing: 1.2, color: palette.muted, margin: 0 });
  summaryItems.forEach(({ section, fragment }, index) => {
    const y = 1.9 + index * 0.91;
    slide.addShape('line', { x: 0.86, y: y + 0.72, w: 11.55, h: 0, line: { color: palette.line, width: 0.8 } });
    slide.addText(String(section), { x: 0.9, y, w: 3.1, h: 0.62, fontSize: 18, bold: true, color: palette.navy, margin: 0, valign: 'mid', fit: 'shrink' });
    slide.addText(`${fragment.keyword}:`, { x: 4.1, y, w: 2.6, h: 0.62, fontSize: 18, bold: true, color: fragment.hasMetric ? 'A06F00' : palette.blue, margin: 0, valign: 'mid', fit: 'shrink' });
    slide.addText(fragment.takeaway, { x: 6.85, y, w: 5.5, h: 0.62, fontSize: 18, color: palette.ink, margin: 0, valign: 'mid', fit: 'shrink' });
  });
}

function addDetailsSlides(pptx, rawDetails, heading = 'Quick revision points') {
  const details = (Array.isArray(rawDetails) ? rawDetails : rawDetails == null ? [] : [rawDetails])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .flatMap((item) => splitText(item, 220));
  const entriesPerSlide = 4;
  const pageCount = Math.ceil(details.length / entriesPerSlide);

  for (let start = 0; start < details.length; start += entriesPerSlide) {
    const page = Math.floor(start / entriesPerSlide) + 1;
    const slide = pptx.addSlide(); slide.background = { color: palette.paper };
    addAccent(slide, `Key details ${page}/${pageCount}`, pptx._slides.length);
    slide.addText('KEY DETAILS', { x: 0.82, y: 0.78, w: 11.7, h: 0.42, fontSize: 13, bold: true, charSpacing: 1.4, color: palette.teal, margin: 0 });
    slide.addText(String(heading), { x: 0.82, y: 1.28, w: 11.7, h: 0.58, fontSize: 26, bold: true, color: palette.navy, margin: 0, fit: 'shrink' });
    slide.addShape('roundRect', { x: 0.82, y: 2.08, w: 11.7, h: 4.45, rectRadius: 0.08, line: { color: palette.line, width: 0.8 }, fill: { color: palette.white } });
    const pageEntries = details.slice(start, start + entriesPerSlide);
    slide.addText(pageEntries.map((item, itemIndex) => `${start + itemIndex + 1}.  ${item}`).join('\n\n'), { x: 1.18, y: 2.35, w: 10.95, h: 3.95, fontSize: 18, color: palette.ink, margin: 0.02, paraSpaceAfterPt: 10, valign: 'mid', fit: 'shrink' });
  }
}

function addMcq(pptx, q, index, language) {
  const rawDetails = q.keyDetails ?? q.keyPoints ?? q.shortDetails ?? q.importantPoints ?? q.details;
  const details = (Array.isArray(rawDetails) ? rawDetails : rawDetails == null ? [] : [rawDetails])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  if (details.length) {
    const detailEntries = details.flatMap((item) => splitText(item, 220));
    const entriesPerSlide = 4;
    const detailPages = Math.ceil(detailEntries.length / entriesPerSlide);
    for (let start = 0; start < detailEntries.length; start += entriesPerSlide) {
      const page = Math.floor(start / entriesPerSlide) + 1;
      const detailSlide = pptx.addSlide(); detailSlide.background = { color: palette.paper };
      addAccent(detailSlide, `Before question ${String(index + 1).padStart(2, '0')}`, pptx._slides.length);
      detailSlide.addText(`KEY DETAILS${detailPages > 1 ? `  |  ${page}/${detailPages}` : ''}`, { x: 0.82, y: 0.78, w: 11.7, h: 0.42, fontSize: 13, bold: true, charSpacing: 1.4, color: palette.teal, margin: 0 });
      detailSlide.addText(String(q.topic || q.subject || 'Quick revision points'), { x: 0.82, y: 1.28, w: 11.7, h: 0.58, fontSize: 26, bold: true, color: palette.navy, margin: 0, fit: 'shrink' });
      detailSlide.addShape('roundRect', { x: 0.82, y: 2.08, w: 11.7, h: 4.45, rectRadius: 0.08, line: { color: palette.line, width: 0.8 }, fill: { color: palette.white } });
      const pageEntries = detailEntries.slice(start, start + entriesPerSlide);
      detailSlide.addText(pageEntries.map((item, itemIndex) => `${start + itemIndex + 1}.  ${item}`).join('\n\n'), { x: 1.18, y: 2.35, w: 10.95, h: 3.95, fontSize: 18, color: palette.ink, margin: 0.02, paraSpaceAfterPt: 10, valign: 'mid', fit: 'shrink' });
    }
  }
  const question = pptx.addSlide(); question.background = { color: palette.paper }; addAccent(question, `Question ${String(index + 1).padStart(2, '0')}`, pptx._slides.length);
  question.addShape('roundRect', { x: 0.82, y: 0.72, w: 11.7, h: 1.62, rectRadius: 0.08, line: { color: palette.line, width: 0.8 }, fill: { color: palette.white } });
  question.addShape('rect', { x: 0.82, y: 0.72, w: 0.1, h: 1.62, line: { color: palette.teal, transparency: 100 }, fill: { color: palette.teal } });
  question.addText(`QUESTION ${String(index + 1).padStart(2, '0')}`, { x: 1.12, y: 0.91, w: 3, h: 0.24, fontSize: 10, bold: true, charSpacing: 1.3, color: palette.teal, margin: 0 });
  question.addText(String(q.question || ''), { x: 1.12, y: 1.22, w: 11.05, h: 0.88, fontSize: 23, bold: true, color: palette.ink, margin: 0.02, valign: 'mid', fit: 'shrink' });
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
  const explanation = language === 'hindi' && q.hindiExplanation ? q.hindiExplanation : language === 'hinglish' && q.hinglishExplanation ? q.hinglishExplanation : q.explanation || '';
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
  pptx.theme = { colorScheme: { accent1: palette.navy, accent2: palette.teal, accent3: palette.blue, accent4: 'D49A13', accent5: palette.green, accent6: palette.muted, hlink: palette.blue, folHlink: palette.navy }, fontFace: { body: fontFace, title: fontFace } };
  addTitle(pptx, content, author);
  if (mode === 'mcq') {
    if (content.details?.length) addDetailsSlides(pptx, content.details, content.chapter || content.title || 'Quick revision points');
    content.questions.forEach((q, i) => addMcq(pptx, q, i, explanationLanguage));
  }
  else content.sections.forEach((section, sectionIndex) => {
    if (mode === 'educational') {
      addEducationalContentSlides(pptx, section, sectionIndex);
    } else if (mode === 'coding' && section.code) {
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
  if (mode === 'educational') addEducationalSummarySlide(pptx, content.sections);
  addClosing(pptx, author);
  const outputDir = path.resolve(process.cwd(), config.storagePath, 'presentations');
  const filePath = path.join(outputDir, `${Date.now()}-${String(content.title || title).replace(/\s+/g, '-').toLowerCase()}.pptx`);
  fs.mkdirSync(outputDir, { recursive: true }); await pptx.writeFile({ fileName: filePath });
  return { filePath, fileName: path.basename(filePath), title: content.title || title, questionCount: mode === 'mcq' ? content.questions.length : 0, sectionCount: mode === 'mcq' ? 0 : content.sections.length };
}
