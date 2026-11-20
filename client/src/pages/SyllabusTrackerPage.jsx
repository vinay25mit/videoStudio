import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CLASS_TRACKING_ITEMS,
  createDefaultClasses,
  createInitialTracker,
  migrateTrackerStructure,
  TRACKING_ITEMS,
} from '../data/bpscSyllabus';
import { getImportedChapterNames } from '../lib/chapterImport';
import { normalizeQuestionImport } from '../lib/questionImport';
import { transliterateHindiWord } from '../lib/hindiTransliteration';
import SyllabusMcqTest, { SyllabusMcqReview } from '../components/SyllabusMcqTest';
import Icon from '../components/Icon';

const StudyMaterialViewer = lazy(() => import('../components/StudyMaterialViewer'));
const TASK_FILE_ITEMS = new Set(['notes', 'dpp', 'mcq', 'lucent', 'previousYear']);
const MAX_MCQS_PER_CHAPTER = 1000;
const MAX_NOTES_CHARACTERS = 70000;

function getToken() {
  return localStorage.getItem('mcq_token');
}

function getNotesHtml(notes = '') {
  const marker = '<!--class-notes-html-->';
  if (notes.startsWith(marker)) return notes.slice(marker.length);
  return notes.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

async function requestTracker(method, tracker) {
  const response = await fetch('/api/syllabus-tracker', {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(tracker ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(tracker ? { body: JSON.stringify(tracker) } : {}),
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || 'Could not save your syllabus tracker.');
  }
  return payload.data;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remainingSeconds).padStart(2, '0')}s`
    : `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
}

function getLiveSeconds(chapter, now) {
  return (Number(chapter.seconds) || 0) + (
    chapter.timerStartedAt ? Math.max(0, (now - new Date(chapter.timerStartedAt).getTime()) / 1000) : 0
  );
}

function getLiveGlobalSeconds(tracker, now) {
  return (Number(tracker.globalStudySeconds) || 0) + (
    tracker.globalTimerStartedAt
      ? Math.max(0, (now - new Date(tracker.globalTimerStartedAt).getTime()) / 1000)
      : 0
  );
}

function localDayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTodayStudySeconds(tracker, now) {
  const dayKey = localDayKey(now);
  const dayStart = new Date(`${dayKey}T00:00:00`).getTime();
  const dayEnd = dayStart + 86400000;
  const hasTodayBaseline = tracker.todayStudyDate === dayKey && Number.isFinite(tracker.todayStudySeconds);
  const baseline = hasTodayBaseline ? Math.max(0, tracker.todayStudySeconds) : 0;
  const baselineAt = hasTodayBaseline && Number.isFinite(Date.parse(tracker.todayStudyBaselineAt))
    ? Date.parse(tracker.todayStudyBaselineAt)
    : dayStart;
  const intervals = (tracker.studySessions || [])
    // Older chapter timer records were not tied to a chapter and could preserve
    // an accidental all-day run. Only count general sessions or chapter-linked
    // sessions created by the current timer flow.
    .filter((session) => !session.subjectId || session.chapterId)
    .filter((session) => !hasTodayBaseline || new Date(session.endedAt).getTime() > baselineAt)
    .map((session) => [
    Math.max(dayStart, hasTodayBaseline ? baselineAt : dayStart, new Date(session.startedAt).getTime()),
    Math.min(dayEnd, new Date(session.endedAt).getTime()),
  ]);
  for (const exam of tracker.exams || []) {
    for (const subject of exam.subjects || []) {
      for (const chapter of subject.chapters || []) {
        if (chapter.timerStartedAt) intervals.push([
          Math.max(dayStart, hasTodayBaseline ? baselineAt : dayStart, new Date(chapter.timerStartedAt).getTime()), Math.min(dayEnd, now),
        ]);
      }
    }
  }
  if (tracker.globalTimerStartedAt) intervals.push([
    Math.max(dayStart, hasTodayBaseline ? baselineAt : dayStart, new Date(tracker.globalTimerStartedAt).getTime()), Math.min(dayEnd, now),
  ]);
  const valid = intervals.filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current = null;
  for (const interval of valid) {
    if (!current || interval[0] > current[1]) {
      if (current) total += current[1] - current[0];
      current = [...interval];
    } else current[1] = Math.max(current[1], interval[1]);
  }
  if (current) total += current[1] - current[0];
  return baseline + total / 1000;
}

function getChapterItems(chapter) {
  return [...TRACKING_ITEMS, ...(chapter.customItems || [])];
}

function getClassItems(noteClass) {
  return [...CLASS_TRACKING_ITEMS, ...(noteClass.customItems || [])];
}

function getFileDisplayKey(file) {
  return `${String(file.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()}:${Number(file.size) || 0}`;
}

function createNextClass(classes) {
  const nextClassNumber = classes.reduce((highest, noteClass, index) => {
    const match = noteClass.title?.match(/^class\s+(\d+)$/i);
    return Math.max(highest, match ? Number(match[1]) : index + 1);
  }, 0) + 1;
  return {
    id: `class-${crypto.randomUUID()}`,
    title: `Class ${nextClassNumber}`,
    notes: '',
    completed: {},
    taskFiles: {},
  };
}

function getChapterTaskCount(chapter) {
  return getChapterItems(chapter).length
    + (chapter.classes || []).reduce((sum, noteClass) => sum + getClassItems(noteClass).length, 0);
}

function getChapterCompletedCount(chapter) {
  return getChapterItems(chapter).filter((item) => chapter.completed?.[item.id]).length
    + (chapter.classes || []).reduce((sum, noteClass) => (
      sum + getClassItems(noteClass).filter((item) => noteClass.completed?.[item.id]).length
    ), 0);
}

function getProgress(exams) {
  const chapters = exams.flatMap((exam) => exam.subjects.flatMap((subject) => subject.chapters));
  const total = chapters.reduce((sum, chapter) => sum + getChapterTaskCount(chapter), 0);
  const completed = chapters.reduce((sum, chapter) => sum + getChapterCompletedCount(chapter), 0);
  return total ? Math.round((completed / total) * 100) : 0;
}

function getLatestTests(chapters) {
  const latestTests = new Map();
  chapters.forEach((chapter) => {
    (chapter.tests || []).forEach((test) => {
      const identity = test.questionSetId
        ? `question-set:${test.sectionId || ''}:${test.questionSetId}`
        : `named-test:${String(test.title || '').trim().toLowerCase()}`;
      const key = `${chapter.id}:${identity}`;
      const current = latestTests.get(key);
      const nextTime = test.takenAt ? Date.parse(test.takenAt) : NaN;
      const currentTime = current?.takenAt ? Date.parse(current.takenAt) : NaN;
      if (!current || (Number.isFinite(nextTime) && (!Number.isFinite(currentTime) || nextTime >= currentTime))
        || (!Number.isFinite(nextTime) && !Number.isFinite(currentTime))) {
        latestTests.set(key, test);
      }
    });
  });
  return [...latestTests.values()];
}

function getMarks(chapters) {
  const totals = getLatestTests(chapters).reduce((result, test) => ({
    obtained: result.obtained + (Number(test.obtained) || 0),
    total: result.total + (Number(test.total) || 0),
  }), { obtained: 0, total: 0 });
  return { ...totals, percentage: totals.total ? (totals.obtained / totals.total) * 100 : null };
}

function getExamChapters(exams) {
  return exams.flatMap((exam) => exam.subjects.flatMap((subject) => subject.chapters));
}

function getChapterGroups(subject) {
  const groups = new Map();
  for (const name of subject.subsections || []) {
    if (typeof name === 'string' && name.trim() && !groups.has(name)) groups.set(name, []);
  }
  for (const chapter of subject.chapters) {
    const name = chapter.subsection || 'Other';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(chapter);
  }
  return [...groups].map(([name, groupedChapters]) => ({ name, chapters: groupedChapters }));
}

const PASTED_NOTE_TAGS = new Set([
  'A', 'ABBR', 'B', 'BLOCKQUOTE', 'BR', 'CAPTION', 'CODE', 'COL', 'COLGROUP', 'DD', 'DEL', 'DIV', 'DL', 'DT',
  'EM', 'FONT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'INS', 'LI', 'OL', 'P', 'PRE', 'S', 'SMALL',
  'IMG', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL',
]);
const PASTED_NOTE_STYLES = new Set([
  'background-color', 'border', 'border-bottom', 'border-collapse', 'border-color', 'border-left', 'border-right',
  'border-spacing', 'border-style', 'border-top', 'border-width', 'color', 'font-family', 'font-size', 'font-style',
  'font-weight', 'height', 'line-height', 'list-style-type', 'margin', 'margin-bottom', 'margin-left', 'margin-right',
  'margin-top', 'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'text-align', 'text-indent',
  'text-decoration', 'vertical-align', 'white-space', 'width',
]);

function sanitizePastedNoteHtml(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('script,style,iframe,object,embed,form,input,button,textarea,select,svg,math,link,meta,head').forEach((node) => node.remove());
  const elements = [...parsed.body.querySelectorAll('*')].reverse();
  elements.forEach((element) => {
    if (!PASTED_NOTE_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name === 'style') {
        const safeStyles = [...element.style]
          .filter((property) => PASTED_NOTE_STYLES.has(property))
          .map((property) => `${property}: ${element.style.getPropertyValue(property)}`)
          .filter((rule) => !/url\s*\(|expression\s*\(|javascript:/i.test(rule));
        if (safeStyles.length) element.setAttribute('style', safeStyles.join('; '));
        else element.removeAttribute('style');
        return;
      }
      const allowed = ['alt', 'colspan', 'rowspan', 'span', 'start', 'reversed', 'type', 'align', 'valign', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'scope', 'title', 'href', 'src'].includes(name);
      if (!allowed || name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (name === 'href' || name === 'src') {
        try {
          const url = new URL(attribute.value, window.location.href);
          const allowedProtocols = name === 'src' ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:'];
          if (!allowedProtocols.includes(url.protocol)) element.removeAttribute(attribute.name);
          else element.setAttribute(name, url.href);
        } catch {
          element.removeAttribute(attribute.name);
        }
      }
    });
  });
  return parsed.body.innerHTML;
}

function ClassNotesEditor({ value, onChange, onPasteImage, onRemoveImage, imageFiles, editorRef, selectionRef, hindiTyping, readOnly }) {
  const imageUrls = useRef([]);
  const existingImageIds = useRef(new Set());
  const cropDrag = useRef(null);
  const resizeDrag = useRef(null);
  const resizeTableDrag = useRef(null);
  const cursorImage = useRef(null);
  const selectedImage = useRef(null);
  const movingImage = useRef(null);
  useEffect(() => () => imageUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    editorRef.current?.querySelectorAll('img[data-file-id]').forEach((image) => { image.draggable = !readOnly; });
  }, [readOnly, editorRef]);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const marker = '<!--class-notes-html-->';
    const isHtml = value.startsWith(marker);
    editor.innerHTML = isHtml
      ? value.slice(marker.length)
      : value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    for (const file of imageFiles) {
      if (editor.querySelector(`img[data-file-id="${CSS.escape(file.id)}"]`)) continue;
      const image = document.createElement('img');
      image.dataset.fileId = file.id;
      image.alt = file.name;
      image.style.width = '480px';
      editor.append(document.createElement('br'), image, document.createElement('br'));
    }
    for (const image of editor.querySelectorAll('img[data-file-id]')) image.draggable = !readOnly;
    existingImageIds.current = new Set([...editor.querySelectorAll('img[data-file-id]')].map((image) => image.dataset.fileId));
    let cancelled = false;
    const objectUrls = [];
    const hydrateImages = async () => {
      for (const image of editor.querySelectorAll('img[data-file-id]:not([src])')) {
        const response = await fetch(`/api/syllabus-tracker/files/${encodeURIComponent(image.dataset.fileId)}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!response.ok) continue;
        const blob = await response.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        image.src = url;
      }
    };
    hydrateImages().catch(() => {});
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [editorRef]);

  function serialize() {
    const editor = editorRef.current;
    const images = new Set([...editor.querySelectorAll('img[data-file-id]')].map((image) => image.dataset.fileId));
    for (const id of existingImageIds.current) if (!images.has(id)) onRemoveImage(id);
    existingImageIds.current = images;
    const html = (editor.innerHTML || '').replace(/\s+src="blob:[^"]*"/g, '');
    onChange(`<!--class-notes-html-->${html}`);
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function transliterateBeforeSpace(event) {
    if (!hindiTyping || event.key !== ' ') return;
    const selection = window.getSelection();
    if (!selection?.isCollapsed || selection.anchorNode?.nodeType !== Node.TEXT_NODE) return;
    const node = selection.anchorNode;
    const offset = selection.anchorOffset;
    const before = node.textContent.slice(0, offset);
    const match = before.match(/[a-z]+$/i);
    if (!match) return;
    const range = document.createRange();
    range.setStart(node, offset - match[0].length);
    range.setEnd(node, offset);
    selection.removeAllRanges();
    selection.addRange(range);
    event.preventDefault();
    document.execCommand('insertText', false, transliterateHindiWord(match[0]));
    document.execCommand('insertText', false, ' ');
    serialize();
    rememberSelection();
  }

  function paste(event) {
    const clipboard = event.clipboardData;
    const html = clipboard?.getData('text/html') || '';
    const imageItems = [...(clipboard?.items || [])].filter((entry) => entry.type.startsWith('image/'));
    const itemFiles = imageItems.map((entry) => entry.getAsFile()).filter(Boolean);
    const imageFiles = itemFiles.length
      ? itemFiles
      : [...(clipboard?.files || [])].filter((file) => file.type.startsWith('image/'));
    if (!html && !imageFiles.length) return;

    event.preventDefault();
    const template = document.createElement('template');
    template.innerHTML = html ? sanitizePastedNoteHtml(html) : '';
    let pastedImages = [...template.content.querySelectorAll('img')];
    while (pastedImages.length < imageFiles.length) {
      if (template.content.lastChild) template.content.append(document.createElement('br'));
      const image = document.createElement('img');
      image.alt = imageFiles[pastedImages.length].name || 'Pasted image';
      image.style.width = '480px';
      template.content.append(image, document.createElement('br'));
      pastedImages.push(image);
    }
    if (!imageFiles.length) {
      pastedImages.filter((image) => !image.getAttribute('src')).forEach((image) => image.remove());
      pastedImages = [...template.content.querySelectorAll('img')];
    }

    const selection = window.getSelection();
    const editor = editorRef.current;
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const insertRange = range && editor?.contains(range.commonAncestorContainer) ? range : document.createRange();
    if (!range || !editor?.contains(range.commonAncestorContainer)) {
      insertRange.selectNodeContents(editor);
      insertRange.collapse(false);
    }
    insertRange.deleteContents();
    const fragment = template.content;
    const lastNode = fragment.lastChild;
    insertRange.insertNode(fragment);
    if (lastNode) {
      insertRange.setStartAfter(lastNode);
      insertRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(insertRange);
    }

    Promise.all(imageFiles.map(async (file, index) => {
      const image = pastedImages[index];
      try {
        const savedFile = await onPasteImage(file);
        if (!savedFile || !image?.isConnected) return;
        const response = await fetch(`/api/syllabus-tracker/files/${encodeURIComponent(savedFile.id)}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!response.ok) throw new Error('The image uploaded, but could not be loaded into the notes.');
        image.dataset.fileId = savedFile.id;
        image.alt = savedFile.name;
        if (!image.style.width && !image.getAttribute('width')) image.style.width = '480px';
        image.draggable = true;
        image.src = URL.createObjectURL(await response.blob());
        imageUrls.current.push(image.src);
      } catch {
        if (image && !image.dataset.fileId) image.remove();
      }
    })).then(() => {
      pastedImages.filter((image) => !image.getAttribute('src') && !image.dataset.fileId).forEach((image) => image.remove());
      serialize();
      rememberSelection();
    });

    if (!imageFiles.length) {
      serialize();
      rememberSelection();
    }
  }

  function removeSelectedImage(event) {
    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      if (event.key.startsWith('Arrow')) selectedImage.current = null;
      return;
    }
    const editor = editorRef.current;
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const offset = selection?.anchorOffset || 0;
    let image = selectedImage.current;
    if (!image || !editor?.contains(image)) {
      image = node?.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG' ? node : null;
      if (!image && node?.nodeType === Node.TEXT_NODE) {
        const sibling = event.key === 'Backspace' && offset === 0
          ? node.previousSibling
          : event.key === 'Delete' && offset === node.textContent.length ? node.nextSibling : null;
        if (sibling?.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'IMG') image = sibling;
      }
    }
    if (!image || !editor?.contains(image)) return;
    event.preventDefault();
    const parent = image.parentNode;
    let caretIndex = [...parent.childNodes].indexOf(image);
    const previous = image.previousSibling;
    const next = image.nextSibling;
    image.remove();
    if (event.key === 'Backspace' && previous?.nodeType === Node.TEXT_NODE && previous.textContent === ' ') {
      previous.remove();
      caretIndex -= 1;
    }
    if (event.key === 'Delete' && next?.nodeType === Node.TEXT_NODE && next.textContent === ' ') next.remove();
    const range = document.createRange();
    range.setStart(parent, Math.max(0, Math.min(caretIndex, parent.childNodes.length)));
    range.collapse(true);
    const currentSelection = window.getSelection();
    currentSelection.removeAllRanges();
    currentSelection.addRange(range);
    selectedImage.current = null;
    serialize();
  }

  function startImageMove(event) {
    if (readOnly) {
      event.preventDefault();
      return;
    }
    const image = event.target?.tagName === 'IMG' ? event.target : null;
    if (!image) return;
    if (resizeDrag.current) {
      event.preventDefault();
      return;
    }
    movingImage.current = image;
    selectedImage.current = image;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', image.dataset.fileId || 'class-note-image');
  }

  function allowImageDrop(event) {
    if (readOnly) return;
    if (movingImage.current) event.preventDefault();
  }

  function dropImage(event) {
    if (readOnly) return;
    const image = movingImage.current;
    const editor = editorRef.current;
    if (!image || !editor) return;
    event.preventDefault();
    let range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (!range && document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(event.clientX, event.clientY);
      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }
    if (!range || !editor.contains(range.startContainer) || image.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    image.remove();
    range.deleteContents();
    range.insertNode(image);
    const spacer = document.createTextNode(' ');
    image.after(spacer);
    movingImage.current = null;
    selectedImage.current = image;
    serialize();
  }

  function cropPointerDown(event) {
    if (readOnly) return;
    const image = event.target?.tagName === 'IMG' ? event.target : null;
    if (!image) {
      const table = event.target?.closest?.('table');
      if (!table || !editorRef.current?.contains(table)) return;
      const bounds = table.getBoundingClientRect();
      const edge = 9;
      const cell = event.target.closest('td, th');
      const cellBounds = cell?.getBoundingClientRect();
      const nearRight = cellBounds && cellBounds.right - event.clientX <= edge;
      const nearBottom = cellBounds && cellBounds.bottom - event.clientY <= edge;
      const nearTableRight = bounds.right - event.clientX <= edge;
      const nearTableBottom = bounds.bottom - event.clientY <= edge;
      let mode;
      if ((nearTableRight || nearTableBottom) && (!cell || (nearTableRight && nearTableBottom))) mode = nearTableRight && nearTableBottom ? 'table-both' : nearTableRight ? 'table-width' : 'table-height';
      else if (nearRight && cell) mode = 'column';
      else if (nearBottom && cell) mode = 'row';
      if (!mode) return;
      event.preventDefault();
      resizeTableDrag.current = {
        mode, table, cell, row: cell?.closest('tr'), startX: event.clientX, startY: event.clientY,
        startWidth: bounds.width, startHeight: bounds.height,
        startCellWidth: cellBounds?.width || 0, startRowHeight: cell?.closest('tr')?.getBoundingClientRect().height || 0,
      };
      editorRef.current?.setPointerCapture?.(event.pointerId);
      return;
    }
    const bounds = image.getBoundingClientRect();
    if (event.altKey) {
      event.preventDefault();
      cropDrag.current = { image, bounds, startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY };
      editorRef.current?.setPointerCapture?.(event.pointerId);
      return;
    }
    const handle = getImageResizeHandle(event.clientX, event.clientY, bounds);
    if (!handle) return;
    event.preventDefault();
    resizeDrag.current = {
      image,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: bounds.width,
      aspect: bounds.width / Math.max(1, bounds.height),
    };
    editorRef.current?.setPointerCapture?.(event.pointerId);
  }

  function cropPointerMove(event) {
    if (readOnly) return;
    const tableResize = resizeTableDrag.current;
    if (tableResize) {
      const dx = event.clientX - tableResize.startX;
      const dy = event.clientY - tableResize.startY;
      if (tableResize.mode.startsWith('table-')) {
        if (tableResize.mode === 'table-width' || tableResize.mode === 'table-both') tableResize.table.style.width = `${Math.max(120, tableResize.startWidth + dx)}px`;
        if (tableResize.mode === 'table-height' || tableResize.mode === 'table-both') tableResize.table.style.height = `${Math.max(60, tableResize.startHeight + dy)}px`;
      } else if (tableResize.mode === 'column') {
        tableResize.cell.style.width = `${Math.max(48, tableResize.startCellWidth + dx)}px`;
      } else if (tableResize.mode === 'row') {
        tableResize.row.style.height = `${Math.max(28, tableResize.startRowHeight + dy)}px`;
      }
      return;
    }
    const resize = resizeDrag.current;
    if (resize) {
      const dx = event.clientX - resize.startX;
      const dy = event.clientY - resize.startY;
      const horizontalDelta = resize.handle.includes('left') ? -dx : resize.handle.includes('right') ? dx : 0;
      const verticalDelta = resize.handle.includes('top') ? -dy : resize.handle.includes('bottom') ? dy : 0;
      const delta = horizontalDelta || verticalDelta * resize.aspect;
      resize.image.style.width = `${Math.max(80, Math.min(1600, resize.startWidth + delta))}px`;
      return;
    }
    const drag = cropDrag.current;
    if (drag) {
      drag.currentX = Math.max(drag.bounds.left, Math.min(drag.bounds.right, event.clientX));
      drag.currentY = Math.max(drag.bounds.top, Math.min(drag.bounds.bottom, event.clientY));
      return;
    }
    const image = event.target?.tagName === 'IMG' ? event.target : null;
    if (!image) {
      const target = event.target?.closest?.('td, th, table');
      if (cursorImage.current && cursorImage.current !== target) cursorImage.current.style.cursor = '';
      cursorImage.current = target;
      if (target) {
        const table = target.closest('table') || target;
        const bounds = table.getBoundingClientRect();
        const cell = target.matches('td, th') ? target : null;
        const cellBounds = cell?.getBoundingClientRect();
        const right = cellBounds ? cellBounds.right - event.clientX <= 9 : bounds.right - event.clientX <= 9;
        const bottom = cellBounds ? cellBounds.bottom - event.clientY <= 9 : bounds.bottom - event.clientY <= 9;
        target.style.cursor = right && bottom ? 'nwse-resize' : right ? 'ew-resize' : bottom ? 'ns-resize' : '';
      }
      return;
    }
    const bounds = image?.getBoundingClientRect();
    if (cursorImage.current && cursorImage.current !== image) cursorImage.current.style.cursor = '';
    cursorImage.current = image;
    if (image && bounds) image.style.cursor = getImageResizeHandle(event.clientX, event.clientY, bounds)?.cursor || 'pointer';
  }

  function cropPointerUp() {
    if (readOnly) return;
    if (resizeTableDrag.current) {
      resizeTableDrag.current = null;
      serialize();
      return;
    }
    if (resizeDrag.current) {
      resizeDrag.current = null;
      if (cursorImage.current) cursorImage.current.style.cursor = '';
      serialize();
      return;
    }
    const drag = cropDrag.current;
    if (!drag) return;
    cropDrag.current = null;
    const left = Math.min(drag.startX, drag.currentX) - drag.bounds.left;
    const right = Math.max(drag.startX, drag.currentX) - drag.bounds.left;
    const top = Math.min(drag.startY, drag.currentY) - drag.bounds.top;
    const bottom = Math.max(drag.startY, drag.currentY) - drag.bounds.top;
    if (right - left < 12 || bottom - top < 12) return;
    const insetTop = (top / drag.bounds.height) * 100;
    const insetRight = ((drag.bounds.width - right) / drag.bounds.width) * 100;
    const insetBottom = ((drag.bounds.height - bottom) / drag.bounds.height) * 100;
    const insetLeft = (left / drag.bounds.width) * 100;
    drag.image.style.clipPath = `inset(${insetTop}% ${insetRight}% ${insetBottom}% ${insetLeft}%)`;
    serialize();
  }

  function getImageResizeHandle(x, y, bounds) {
    const edge = 12;
    const left = x - bounds.left <= edge;
    const right = bounds.right - x <= edge;
    const top = y - bounds.top <= edge;
    const bottom = bounds.bottom - y <= edge;
    if (!(left || right || top || bottom)) return null;
    if ((left || right) && (top || bottom)) {
      const corner = `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}`;
      return { includes: (side) => corner.includes(side), cursor: top === left ? 'nwse-resize' : 'nesw-resize' };
    }
    if (left || right) return { includes: (side) => side === (left ? 'left' : 'right'), cursor: 'ew-resize' };
    return { includes: (side) => side === (top ? 'top' : 'bottom'), cursor: 'ns-resize' };
  }

  return (
    <div
      ref={editorRef}
      className="notes-editor-input notes-rich-editor"
      contentEditable={!readOnly}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      onInput={serialize}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      onBlur={rememberSelection}
      onPaste={paste}
      onClick={(event) => { selectedImage.current = event.target?.tagName === 'IMG' ? event.target : null; }}
      onKeyDown={removeSelectedImage}
      onKeyDownCapture={transliterateBeforeSpace}
      onDragStart={startImageMove}
      onDragOver={allowImageDrop}
      onDrop={dropImage}
      onPointerDown={cropPointerDown}
      onPointerMove={cropPointerMove}
      onPointerUp={cropPointerUp}
      data-placeholder="Write class notes or paste an image here..."
    />
  );
}

function formatMarkValue(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatMarks(marks) {
  return marks.percentage === null
    ? 'No test scores yet'
    : `${formatMarkValue(marks.obtained)} / ${formatMarkValue(marks.total)} marks · ${marks.percentage.toFixed(2)}%`;
}

export default function SyllabusTrackerPage() {
  const [tracker, setTracker] = useState(null);
  const [activeExamId, setActiveExamId] = useState('prelims');
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [expandedChapterId, setExpandedChapterId] = useState('');
  const [expandedClassKey, setExpandedClassKey] = useState('');
  const [chapterTaskTabs, setChapterTaskTabs] = useState({});
  const [chapterSubsectionSelections, setChapterSubsectionSelections] = useState({});
  const [editingSubsection, setEditingSubsection] = useState(null);
  const [subsectionDraft, setSubsectionDraft] = useState('');
  const [addingSubsection, setAddingSubsection] = useState('');
  const [newSubsectionName, setNewSubsectionName] = useState('');
  const [notesChapterId, setNotesChapterId] = useState('');
  const [notesClassId, setNotesClassId] = useState('');
  const [studyViewer, setStudyViewer] = useState(null);
  const [studyFileStatus, setStudyFileStatus] = useState('');
  const [editingTimeChapterId, setEditingTimeChapterId] = useState('');
  const [timeDraft, setTimeDraft] = useState({ hours: '0', minutes: '0', seconds: '0' });
  const [activeMcqTest, setActiveMcqTest] = useState(null);
  const [mcqReview, setMcqReview] = useState(null);
  const [mcqImportStatuses, setMcqImportStatuses] = useState({});
  const [now, setNow] = useState(Date.now());
  const [subjectName, setSubjectName] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [chapterImportStatus, setChapterImportStatus] = useState('');
  const [chapterImportFailed, setChapterImportFailed] = useState(false);
  const [customItemNames, setCustomItemNames] = useState({});
  const [testDrafts, setTestDrafts] = useState({});
  const [uploadingChapterIds, setUploadingChapterIds] = useState([]);
  const [activeFileOperations, setActiveFileOperations] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hindiTyping, setHindiTyping] = useState(() => localStorage.getItem('syllabus_hindi_typing') === 'true');
  const [notesWritingMode, setNotesWritingMode] = useState(false);
  const [showTimeAnalysis, setShowTimeAnalysis] = useState(false);
  const [showTestAnalysis, setShowTestAnalysis] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const pendingFileOperations = useRef(0);
  const pendingUploadKeys = useRef(new Set());
  const notesEditorRef = useRef(null);
  const notesSelectionRef = useRef(null);

  useEffect(() => {
    let active = true;
    requestTracker('GET')
      .then(async (stored) => {
        const initial = stored ? migrateTrackerStructure(stored) : createInitialTracker();
        if (active) setTracker(initial);
        if (!stored || stored.syllabusStructureVersion !== initial.syllabusStructureVersion) {
          await requestTracker('PUT', initial);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function stopTimers(stoppedAt) {
      setTracker((current) => {
        if (!current) return current;
        const stoppedAtIso = new Date(stoppedAt).toISOString();
        const sessions = [...(current.studySessions || [])];
        let globalStudySeconds = Number(current.globalStudySeconds) || 0;
        if (current.globalTimerStartedAt) {
          const elapsed = Math.max(0, (stoppedAt - new Date(current.globalTimerStartedAt).getTime()) / 1000);
          globalStudySeconds += elapsed;
          sessions.push({ id: crypto.randomUUID(), startedAt: current.globalTimerStartedAt, endedAt: stoppedAtIso, subjectId: null, subjectName: 'General study', examId: null });
        }
        const exams = current.exams.map((exam) => ({
          ...exam,
          subjects: exam.subjects.map((subject) => ({
            ...subject,
            chapters: subject.chapters.map((chapter) => {
              if (!chapter.timerStartedAt) return chapter;
              const elapsed = Math.max(0, (stoppedAt - new Date(chapter.timerStartedAt).getTime()) / 1000);
              sessions.push({ id: crypto.randomUUID(), startedAt: chapter.timerStartedAt, endedAt: stoppedAtIso, subjectId: subject.id, subjectName: subject.name, examId: exam.id, chapterId: chapter.id });
              return { ...chapter, seconds: (Number(chapter.seconds) || 0) + elapsed, timerStartedAt: null };
            }),
          })),
        }));
        return { ...current, exams, studySessions: sessions, globalStudySeconds, globalTimerStartedAt: null };
      });
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        window.sessionStorage.setItem('syllabus_hidden_clock', JSON.stringify({
          wall: Date.now(),
          monotonic: performance.now(),
        }));
      } else {
        const saved = window.sessionStorage.getItem('syllabus_hidden_clock');
        window.sessionStorage.removeItem('syllabus_hidden_clock');
        if (!saved) return;
        try {
          const { wall, monotonic } = JSON.parse(saved);
          const wallElapsed = Date.now() - wall;
          const monotonicElapsed = performance.now() - monotonic;
          // A large gap between wall and monotonic time indicates the system
          // was suspended while the laptop was asleep or powered off.
          if (wallElapsed - monotonicElapsed > 60_000) stopTimers(wall);
        } catch {
          // Ignore invalid snapshots and keep the running timer untouched.
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!tracker || loading || activeFileOperations > 0) return undefined;
    const timeout = window.setTimeout(async () => {
      if (pendingFileOperations.current > 0) return;
      setSaving(true);
      try {
        saveQueue.current = saveQueue.current.catch(() => {}).then(() => requestTracker('PUT', tracker));
        await saveQueue.current;
        setError('');
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [tracker, loading, activeFileOperations]);

  useEffect(() => {
    if (!tracker || loading) return;
    const dayKey = localDayKey(Date.now());
    if (tracker.todayStudyDate === dayKey && tracker.todayStudyBaselineAt) return;
    setTracker((current) => {
      if (!current) return current;
      if (current.todayStudyDate === dayKey) {
        return current.todayStudyBaselineAt
          ? current
          : { ...current, todayStudyBaselineAt: new Date().toISOString() };
      }
      if (current.todayStudyDate) return current;
      return { ...current, todayStudyDate: dayKey, todayStudySeconds: 7200, todayStudyBaselineAt: new Date().toISOString() };
    });
  }, [tracker, loading]);

  const activeExam = tracker?.exams.find((exam) => exam.id === activeExamId) || tracker?.exams[0];
  const prelimsExam = tracker?.exams.find((exam) => exam.id === 'prelims') || tracker?.exams[0];
  const activeSubject = activeExam?.subjects.find((subject) => subject.id === activeSubjectId)
    || activeExam?.subjects[0];

  useEffect(() => {
    if (activeSubject && activeSubject.id !== activeSubjectId) setActiveSubjectId(activeSubject.id);
  }, [activeSubject, activeSubjectId]);

  const overallProgress = useMemo(() => getProgress(tracker?.exams || []), [tracker]);
  const prelimsProgress = prelimsExam ? getProgress([prelimsExam]) : 0;
  const chapterCount = activeExam?.subjects.reduce((sum, subject) => sum + subject.chapters.length, 0) || 0;
  const remainingTasks = activeExam?.subjects.reduce((sum, subject) => sum + subject.chapters.reduce((chapterSum, chapter) => (
    chapterSum + getChapterTaskCount(chapter) - getChapterCompletedCount(chapter)
  ), 0), 0) || 0;
  const completedTasks = activeExam?.subjects.reduce((sum, subject) => sum + subject.chapters.reduce((chapterSum, chapter) => (
    chapterSum + getChapterCompletedCount(chapter)
  ), 0), 0) || 0;
  const globalStudySeconds = tracker ? getLiveGlobalSeconds(tracker, now) : 0;
  const overallSeconds = globalStudySeconds + (tracker?.exams || []).reduce((examTotal, exam) => (
    examTotal + exam.subjects.reduce((subjectTotal, subject) => (
      subjectTotal + subject.chapters.reduce((chapterTotal, chapter) => chapterTotal + getLiveSeconds(chapter, now), 0)
    ), 0)
  ), 0);
  const totalSeconds = (activeExam?.subjects || []).reduce((sum, subject) => (
    sum + subject.chapters.reduce((subjectTotal, chapter) => subjectTotal + getLiveSeconds(chapter, now), 0)
  ), 0);
  const studyStarts = [
    ...(tracker?.studySessions || []).map((session) => Date.parse(session.startedAt)),
    ...(tracker?.exams || []).flatMap((exam) => exam.subjects.flatMap((subject) => subject.chapters
      .filter((chapter) => chapter.timerStartedAt).map((chapter) => Date.parse(chapter.timerStartedAt)))),
    ...(tracker?.globalTimerStartedAt ? [Date.parse(tracker.globalTimerStartedAt)] : []),
  ].filter(Number.isFinite);
  const studyDays = studyStarts.length
    ? Math.max(1, Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(Math.min(...studyStarts)).setHours(0, 0, 0, 0)) / 86400000) + 1)
    : 1;
  const averageDailyExamSeconds = overallSeconds / studyDays;
  const todaySeconds = tracker ? getTodayStudySeconds(tracker, now) : 0;
  const subjectTimeAnalysis = (tracker?.exams || []).flatMap((exam) => exam.subjects.map((subject) => ({
    id: `${exam.id}:${subject.id}`,
    label: `${subject.name} · ${exam.name}`,
    seconds: subject.chapters.reduce((sum, chapter) => sum + getLiveSeconds(chapter, now), 0),
    chapters: subject.chapters.map((chapter) => ({ id: chapter.id, name: chapter.name, seconds: getLiveSeconds(chapter, now) })),
  }))).sort((a, b) => b.seconds - a.seconds);
  const subjectTestAnalysis = (tracker?.exams || []).flatMap((exam) => exam.subjects.map((subject) => {
    const tests = getLatestTests(subject.chapters).map((test) => ({
      ...test,
      chapterName: subject.chapters.find((chapter) => chapter.tests?.some((entry) => entry.id === test.id))?.name || '',
    }));
    const marks = getMarks(subject.chapters);
    const questionCount = tests.filter((test) => test.source === 'mcq-json')
      .reduce((sum, test) => sum + (Number(test.total) || 0), 0);
    return {
      id: `${exam.id}:${subject.id}`,
      label: `${subject.name} · ${exam.name}`,
      marks,
      tests,
      questionCount,
    };
  })).filter((subject) => subject.tests.length).sort((a, b) => (b.marks.percentage || 0) - (a.marks.percentage || 0));
  const overallQuestionCount = subjectTestAnalysis.reduce((sum, subject) => sum + subject.questionCount, 0);
  const activeSubjectMarks = getMarks(activeSubject?.chapters || []);
  const prelimsMarks = getMarks(getExamChapters(prelimsExam ? [prelimsExam] : []));
  const overallMarks = getMarks(getExamChapters(tracker?.exams || []));

  const updateChapter = useCallback((chapterId, update) => {
    setTracker((current) => {
      const stoppedAt = new Date();
      const stoppedAtIso = stoppedAt.toISOString();
      const stoppedSessions = [];
      const targetChapter = current.exams.flatMap((exam) => exam.subjects).flatMap((subject) => subject.chapters).find((chapter) => chapter.id === chapterId);
      const targetFields = targetChapter ? (typeof update === 'function' ? update(targetChapter) : update) : {};
      const startingTimer = Boolean(targetFields.timerStartedAt && !targetChapter?.timerStartedAt);
      const exams = current.exams.map((exam) => ({
        ...exam,
        subjects: exam.subjects.map((subject) => ({
          ...subject,
          chapters: subject.chapters.map((chapter) => {
            if (chapter.id === chapterId) {
              if (chapter.timerStartedAt && targetFields.timerStartedAt === null) {
                stoppedSessions.push({ id: crypto.randomUUID(), startedAt: chapter.timerStartedAt, endedAt: stoppedAtIso, subjectId: subject.id, subjectName: subject.name, examId: exam.id, chapterId: chapter.id });
              }
              return { ...chapter, ...targetFields };
            }
            if (startingTimer && chapter.timerStartedAt) {
              const elapsed = Math.max(0, (stoppedAt.getTime() - new Date(chapter.timerStartedAt).getTime()) / 1000);
              stoppedSessions.push({ id: crypto.randomUUID(), startedAt: chapter.timerStartedAt, endedAt: stoppedAtIso, subjectId: subject.id, subjectName: subject.name, examId: exam.id, chapterId: chapter.id });
              return { ...chapter, seconds: (Number(chapter.seconds) || 0) + elapsed, timerStartedAt: null };
            }
            return chapter;
          }),
        })),
      }));
      return {
      ...current,
      ...(stoppedSessions.length ? { studySessions: [...(current.studySessions || []), ...stoppedSessions] } : {}),
      exams,
      };
    });
  }, []);

  function openStudyMaterial(chapter, file, taskLabel) {
    if (/\.(pdf|pptx?)$/i.test(file.name)) {
      openStudyFileInDesktopApp(chapter, file);
      return;
    }
    const autoTimerStartedAt = chapter.timerStartedAt ? '' : new Date().toISOString();
    if (autoTimerStartedAt) updateChapter(chapter.id, { timerStartedAt: autoTimerStartedAt });
    setStudyViewer({ chapterId: chapter.id, file, taskLabel, autoTimerStartedAt });
  }

  async function openStudyFileInDesktopApp(chapter, file) {
    const timerStartedAt = chapter.timerStartedAt ? '' : new Date().toISOString();
    if (timerStartedAt) updateChapter(chapter.id, { timerStartedAt });
    setStudyFileStatus('');
    setError('');
    try {
      const response = await fetch(`/api/syllabus-tracker/open-file/${encodeURIComponent(file.id)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Could not open this file in its desktop app.');
      }
      const appName = /\.pdf$/i.test(file.name) ? 'Adobe Acrobat' : 'PowerPoint';
      setStudyFileStatus(`Opened "${file.name}" in ${appName}. The chapter timer is running.`);
    } catch (fileError) {
      if (timerStartedAt) {
        updateChapter(chapter.id, (current) => (
          current.timerStartedAt === timerStartedAt ? { timerStartedAt: null } : {}
        ));
      }
      setError(fileError.message);
    }
  }

  const closeStudyMaterial = useCallback(() => {
    if (studyViewer?.autoTimerStartedAt) {
      updateChapter(studyViewer.chapterId, (chapter) => {
        if (chapter.timerStartedAt !== studyViewer.autoTimerStartedAt) return {};
        const elapsed = Math.max(0, (Date.now() - new Date(chapter.timerStartedAt).getTime()) / 1000);
        return { seconds: (Number(chapter.seconds) || 0) + elapsed, timerStartedAt: null };
      });
    }
    setStudyViewer(null);
  }, [studyViewer, updateChapter]);

  function beginChapterTimeEdit(chapter) {
    const total = Math.floor(getLiveSeconds(chapter, Date.now()));
    setTimeDraft({
      hours: String(Math.floor(total / 3600)),
      minutes: String(Math.floor((total % 3600) / 60)),
      seconds: String(total % 60),
    });
    setEditingTimeChapterId(chapter.id);
  }

  function saveChapterTime(event, chapter) {
    event.preventDefault();
    const hours = Number(timeDraft.hours);
    const minutes = Number(timeDraft.minutes);
    const seconds = Number(timeDraft.seconds);
    if (
      !Number.isInteger(hours) || hours < 0 || hours > 9999
      || !Number.isInteger(minutes) || minutes < 0 || minutes > 59
      || !Number.isInteger(seconds) || seconds < 0 || seconds > 59
    ) {
      setError('Enter a valid logged time: hours, and minutes and seconds from 0 to 59.');
      return;
    }
    const editedSeconds = hours * 3600 + minutes * 60 + seconds;
    updateChapter(chapter.id, {
      seconds: editedSeconds,
      timerStartedAt: null,
    });
    setEditingTimeChapterId('');
    setError('');
  }

  function getLocalChapterFiles(chapter, taskId = '', classId = '') {
    return (chapter.localFiles || []).filter((file) => (
      (file.taskId || '') === taskId && (file.classId || '') === classId
    ));
  }

  async function openLocalChapterFile(chapter, file) {
    const timerStartedAt = chapter.timerStartedAt ? '' : new Date().toISOString();
    if (timerStartedAt) updateChapter(chapter.id, { timerStartedAt });
    setStudyFileStatus('');
    setError('');
    try {
      const response = await fetch('/api/syllabus-tracker/open-local-file', {
        method: 'POST',
        headers: {
          Authorization: `******'mcq_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: file.path }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Could not open this file on your computer.');
      }
      setStudyFileStatus(`Opened "${file.name}" in its Windows desktop app. The chapter timer is running.`);
    } catch (fileError) {
      if (timerStartedAt) {
        updateChapter(chapter.id, (current) => (
          current.timerStartedAt === timerStartedAt ? { timerStartedAt: null } : {}
        ));
      }
      setError(fileError.message);
    }
  }

  function deleteLocalChapterFile(chapter, file) {
    updateChapter(chapter.id, (current) => ({
      localFiles: (current.localFiles || []).filter((entry) => entry.id !== file.id),
    }));
  }

  function renderLocalFileAccess(chapter, taskId = '', classId = '') {
    const uploadedFiles = classId
      ? chapter.classes?.find((noteClass) => noteClass.id === classId)?.taskFiles?.[taskId] || []
      : taskId ? chapter.taskFiles?.[taskId] || [] : [];
    const uploadedNames = new Set(uploadedFiles.map((file) => (
      String(file.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    )));
    const files = getLocalChapterFiles(chapter, taskId, classId).filter((file) => (
      !uploadedNames.has(String(file.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase())
    ));
    if (!files.length) return null;
    return (
      <div className="local-file-access">
        <small className="local-file-help">Previously linked files</small>
        <div className="local-file-list">
          {files.map((file) => (
            <div className="local-file-row" key={file.id}>
              <span title={file.path}>{file.name}</span>
              <button type="button" className="outline-btn" onClick={() => openLocalChapterFile(chapter, file)}>Open on this PC</button>
              <button type="button" className="icon-action-button danger" onClick={() => deleteLocalChapterFile(chapter, file)} aria-label={`Delete ${file.name} path`} title="Delete linked file path"><Icon name="trash" size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function toggleCompletion(chapter, itemId) {
    updateChapter(chapter.id, {
      completed: { ...chapter.completed, [itemId]: !chapter.completed?.[itemId] },
    });
  }

  function selectChapterTaskTab(chapterId, itemId) {
    setChapterTaskTabs((current) => ({ ...current, [chapterId]: itemId }));
  }

  function toggleClassCompletion(chapter, noteClass, itemId) {
    updateChapter(chapter.id, (current) => ({
      classes: (current.classes || []).map((entry) => (
        entry.id === noteClass.id
          ? { ...entry, completed: { ...entry.completed, [itemId]: !entry.completed?.[itemId] } }
          : entry
      )),
    }));
  }

  async function uploadChapterFile(chapter, file, taskItemId = '', classId = '') {
    const isImage = /^image\/(png|jpeg|webp|gif)$/.test(file.type);
    if (taskItemId && !/\.(pdf|pptx)$/i.test(file.name) && !(taskItemId === 'notes' && classId && isImage)) {
      setError('Notes and DPP attachments must be PDF or PowerPoint files. Class notes also support pasted PNG, JPEG, WebP, and GIF images.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError(`${file.name} is larger than the 25 MB file limit.`);
      return;
    }

    const normalizedName = String(file.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const storedFiles = classId
      ? chapter.classes?.find((noteClass) => noteClass.id === classId)?.taskFiles?.[taskItemId] || []
      : taskItemId ? chapter.taskFiles?.[taskItemId] || [] : chapter.files || [];
    const alreadyUploaded = storedFiles.find((entry) => (
      String(entry.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedName
      && Number(entry.size) === Number(file.size)
    ));
    if (alreadyUploaded) return alreadyUploaded;
    const pendingKey = `${chapter.id}:${classId}:${taskItemId}:${normalizedName}:${file.size}:${file.lastModified || 0}`;
    if (pendingUploadKeys.current.has(pendingKey)) return null;
    pendingUploadKeys.current.add(pendingKey);

    pendingFileOperations.current += 1;
    setActiveFileOperations(pendingFileOperations.current);
    setUploadingChapterIds((current) => [...current, chapter.id]);
    setError('');
    try {
      const upload = () => {
        const formData = new FormData();
        formData.append('file', file);
        if (taskItemId) formData.append('taskId', taskItemId);
        if (classId) formData.append('classId', classId);
        return fetch(`/api/syllabus-tracker/chapters/${encodeURIComponent(chapter.id)}/files`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData,
        }).then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.success) {
            throw new Error(payload.error?.message || 'Could not upload this chapter file.');
          }
          return payload.data;
        });
      };
      saveQueue.current = saveQueue.current.catch(() => {}).then(upload);
      const savedFile = await saveQueue.current;
      updateChapter(chapter.id, (current) => {
        if (!taskItemId) return { files: [...(current.files || []), savedFile] };
        if (!classId) {
          const files = current.taskFiles?.[taskItemId] || [];
          if (files.some((entry) => entry.id === savedFile.id)) return {};
          return { taskFiles: { ...current.taskFiles, [taskItemId]: [...files, savedFile] } };
        }
        const classes = current.classes || [];
        const updatedClasses = classes.map((noteClass) => (
            noteClass.id === classId
              ? noteClass.taskFiles?.[taskItemId]?.some((entry) => entry.id === savedFile.id)
                ? noteClass
                : { ...noteClass, taskFiles: { ...noteClass.taskFiles, [taskItemId]: [...(noteClass.taskFiles?.[taskItemId] || []), savedFile] } }
              : noteClass
        ));
        if (classes[classes.length - 1]?.id === classId && classes.length < 100) {
          updatedClasses.push(createNextClass(classes));
        }
        return { classes: updatedClasses };
      });
      if (classId && chapter.classes?.length >= 100 && chapter.classes[chapter.classes.length - 1]?.id === classId) {
        setError('This chapter has reached the 100-class limit. Delete a class to add another.');
      }
      return savedFile;
    } catch (uploadError) {
      setError(uploadError.message);
      return null;
    } finally {
      pendingFileOperations.current -= 1;
      pendingUploadKeys.current.delete(pendingKey);
      setActiveFileOperations(pendingFileOperations.current);
      setUploadingChapterIds((current) => current.filter((id) => id !== chapter.id));
    }
  }

  async function openChapterFile(chapter, file) {
    const timerStartedAt = chapter.timerStartedAt ? '' : new Date().toISOString();
    if (timerStartedAt) updateChapter(chapter.id, { timerStartedAt });
    setStudyFileStatus('');
    setError('');
    try {
      const response = await fetch(`/api/syllabus-tracker/files/${encodeURIComponent(file.id)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error?.message || 'Could not download this chapter file.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      const openHint = file.name.toLowerCase().endsWith('.pptx')
        ? 'Open it from your browser downloads in PowerPoint.'
        : file.name.toLowerCase().endsWith('.pdf')
          ? 'Open it from your browser downloads in your PDF app.'
          : 'Open it from your browser downloads in your default app.';
      setStudyFileStatus(`Downloaded "${file.name}". ${openHint} The chapter timer is running.`);
    } catch (fileError) {
      if (timerStartedAt) {
        updateChapter(chapter.id, (current) => (
          current.timerStartedAt === timerStartedAt ? { timerStartedAt: null } : {}
        ));
      }
      setError(fileError.message);
    }
  }

  async function deleteChapterFile(chapter, file) {
    pendingFileOperations.current += 1;
    setActiveFileOperations(pendingFileOperations.current);
    try {
      const removeFile = async () => {
        const response = await fetch(
          `/api/syllabus-tracker/chapters/${encodeURIComponent(chapter.id)}/files/${encodeURIComponent(file.id)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } },
        );
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || 'Could not delete this chapter file.');
        }
      };
      saveQueue.current = saveQueue.current.catch(() => {}).then(removeFile);
      await saveQueue.current;
      updateChapter(chapter.id, (current) => ({
        files: (current.files || []).filter((entry) => entry.id !== file.id),
        taskFiles: Object.fromEntries(
          Object.entries(current.taskFiles || {}).map(([taskId, files]) => [taskId, files.filter((entry) => entry.id !== file.id)]),
        ),
        classes: (current.classes || []).map((noteClass) => ({
          ...noteClass,
          taskFiles: Object.fromEntries(
            Object.entries(noteClass.taskFiles || {}).map(([taskId, files]) => [taskId, files.filter((entry) => entry.id !== file.id)]),
          ),
        })),
      }));
      setError('');
    } catch (fileError) {
      setError(fileError.message);
    } finally {
      pendingFileOperations.current -= 1;
      setActiveFileOperations(pendingFileOperations.current);
    }
  }

  function addNotesClass(chapter) {
    const classes = chapter.classes || [];
    if (classes.length >= 100) {
      setError('A chapter can have at most 100 class note pages.');
      return;
    }
    const noteClass = createNextClass(classes);
    updateChapter(chapter.id, { classes: [...classes, noteClass] });
    setExpandedClassKey(`${chapter.id}:${noteClass.id}`);
  }

  function updateNotesClass(chapter, classId, update) {
    updateChapter(chapter.id, (current) => ({
      classes: (current.classes || []).map((noteClass) => (
        noteClass.id === classId ? { ...noteClass, ...update } : noteClass
      )),
    }));
  }

  function deleteNotesClass(chapter, noteClass) {
    if (!window.confirm(`Delete "${noteClass.title}" and its notes?`)) return;
    updateChapter(chapter.id, {
      classes: (chapter.classes || []).filter((entry) => entry.id !== noteClass.id),
    });
    const deletedClassKey = `${chapter.id}:${noteClass.id}`;
    setExpandedClassKey((current) => (current === deletedClassKey ? '' : current));
    if (notesClassId === noteClass.id) setNotesClassId('');
  }

  const notesChapter = tracker?.exams
    .flatMap((exam) => exam.subjects)
    .flatMap((subject) => subject.chapters)
    .find((chapter) => chapter.id === notesChapterId);
  const activeNotesClass = notesChapter?.classes?.find((noteClass) => noteClass.id === notesClassId);

  function insertNoteFormatting(command, value) {
    const editor = notesEditorRef.current;
    if (!editor) return;
    editor.focus();
    const savedRange = notesSelectionRef.current;
    if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    const legacyCommands = { '**': 'bold', '## ': 'formatBlock', '- ': 'insertUnorderedList' };
    const actualCommand = legacyCommands[command] || command;
    const actualValue = command === '## ' ? 'H2' : value;
    document.execCommand(actualCommand, false, actualValue);
    notesSelectionRef.current = null;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function downloadClassNotesPdf() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Allow pop-ups to export class notes as a PDF.');
      return;
    }
    setError('');
    try {
      const parsed = new DOMParser().parseFromString(getNotesHtml(activeNotesClass.notes || ''), 'text/html');
      parsed.querySelectorAll('script,iframe,object,embed,form,button,input,textarea').forEach((element) => element.remove());
      parsed.body.querySelectorAll('*').forEach((element) => {
        [...element.attributes].forEach((attribute) => {
          if (/^on/i.test(attribute.name) || (/^(href|src)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value))) {
            element.removeAttribute(attribute.name);
          }
        });
      });
      const noteImages = getClassTaskFiles(activeNotesClass, 'notes').filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file.name));
      for (const image of parsed.querySelectorAll('img[data-file-id]')) {
        const file = noteImages.find((entry) => entry.id === image.dataset.fileId);
        if (!file) {
          image.remove();
          continue;
        }
        const response = await fetch(`/api/syllabus-tracker/files/${encodeURIComponent(file.id)}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!response.ok) throw new Error(`Could not load ${file.name} for PDF export.`);
        const blob = await response.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Could not prepare an image for PDF export.'));
          reader.readAsDataURL(blob);
        });
        image.src = dataUrl;
        image.removeAttribute('data-file-id');
      }
      const title = `${activeNotesClass.title || 'Class notes'} - ${notesChapter.name}`;
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>]/g, '')}</title><style>
        @page { margin: 18mm; } body { color: #172033; font: 12pt/1.7 Arial, sans-serif; }
        h1 { font-size: 20pt; margin: 0 0 4mm; } .chapter { color: #64748b; margin-bottom: 10mm; }
        img { max-width: 100%; height: auto; page-break-inside: avoid; } blockquote { margin: 4mm 0; padding: 2mm 5mm; border-left: 3px solid #94a3b8; color: #475569; }
        table { max-width: 100%; border-collapse: collapse; } pre { white-space: pre-wrap; }
      </style></head><body><h1>${title.replace(/[<>]/g, '')}</h1><div class="chapter">${notesChapter.name.replace(/[<>]/g, '')}</div>${parsed.body.innerHTML}</body></html>`);
      printWindow.document.close();
    } catch (exportError) {
      printWindow.close();
      setError(exportError.message || 'Could not export these notes as a PDF.');
    }
  }

  function pasteClassNoteImage(file) {
    if (!notesChapter || !activeNotesClass) return null;
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const namedImage = new File([file], `class-note-image-${Date.now()}.${extension}`, { type: file.type });
    return uploadChapterFile(notesChapter, namedImage, 'notes', activeNotesClass.id);
  }

  function noteFormatButton(label, command, value = null, content = label) {
    return (
      <button
        key={`${command}-${value || label}`}
        type="button"
        title={label}
        aria-label={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => insertNoteFormatting(command, value)}
      >
        {content}
        <small className="notes-tool-label">{label}</small>
      </button>
    );
  }

  function addTestScore(event, chapter) {
    event.preventDefault();
    const draft = testDrafts[chapter.id] || {};
    const title = (draft.title || '').trim();
    const obtained = Number(draft.obtained);
    const total = Number(draft.total);
    const link = (draft.link || '').trim();
    if (!title || !Number.isFinite(obtained) || obtained < 0 || !Number.isFinite(total) || total <= 0 || obtained > total) {
      setError('Enter a test name, a score from 0 to the total marks, and a total greater than zero.');
      return;
    }
    if (link) {
      try {
        const parsedLink = new URL(link);
        if (!['http:', 'https:'].includes(parsedLink.protocol)) throw new Error('Unsupported link protocol.');
      } catch {
        setError('Test link must be a valid HTTP or HTTPS URL.');
        return;
      }
    }
    const test = { id: `test-${crypto.randomUUID()}`, title, obtained, total, link, takenAt: new Date().toISOString() };
    updateChapter(chapter.id, { tests: [...(chapter.tests || []), test] });
    setTestDrafts((current) => ({ ...current, [chapter.id]: {} }));
    setError('');
  }

  function getSectionQuestionSets(chapter, sectionId) {
    const storedSets = chapter.questionSetsBySection?.[sectionId] || [];
    if (sectionId === 'mcq' && chapter.mcqQuestionSet?.questions?.length) {
      return [
        {
          ...chapter.mcqQuestionSet,
          id: 'legacy-mcq-question-set',
        },
        ...storedSets.filter((questionSet) => questionSet.id !== 'legacy-mcq-question-set'),
      ];
    }
    return storedSets;
  }

  async function importMcqQuestions(event, chapter, section) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const statusKey = `${chapter.id}:${section.id}`;
    if (file.size > 5 * 1024 * 1024) {
      setMcqImportStatuses((current) => ({ ...current, [statusKey]: 'MCQ JSON files must be 5 MB or smaller.' }));
      return;
    }

    try {
      const payload = JSON.parse(await file.text());
      const questions = normalizeQuestionImport(payload);
      if (questions.length > MAX_MCQS_PER_CHAPTER) {
        throw new Error(`A chapter can have at most ${MAX_MCQS_PER_CHAPTER} MCQ questions.`);
      }
      const title = typeof payload?.title === 'string' && payload.title.trim()
        ? payload.title.trim().slice(0, 160)
        : file.name.replace(/\.json$/i, '').slice(0, 160);
      const questionSet = {
        id: `question-set-${crypto.randomUUID()}`,
        title,
        sourceName: file.name.slice(0, 180),
        questions,
      };
      const existingSets = getSectionQuestionSets(chapter, section.id);
      if (existingSets.length >= 30) {
        throw new Error('A section can have at most 30 saved tests.');
      }
      updateChapter(chapter.id, (current) => ({
        questionSetsBySection: {
          ...current.questionSetsBySection,
          [section.id]: [...(current.questionSetsBySection?.[section.id] || []), questionSet],
        },
      }));
      setMcqImportStatuses((current) => ({
        ...current,
        [statusKey]: `Created test "${title}" with ${questions.length} questions.`,
      }));
      setError('');
    } catch (importError) {
      setMcqImportStatuses((current) => ({
        ...current,
        [statusKey]: importError instanceof SyntaxError
          ? 'This file is not valid JSON. Check the file syntax and try again.'
          : importError.message || 'Could not create a test from this JSON.',
      }));
    }
  }

  function startMcqTest(chapter, questionSet, section) {
    if (!questionSet?.questions?.length) {
      setError('Create a test from a valid MCQ JSON question set before starting.');
      return;
    }
    if ((chapter.tests || []).length >= 100) {
      setError('This chapter already has 100 saved test results. Delete a result before starting another test.');
      return;
    }
    setActiveMcqTest({
      chapterId: chapter.id,
      chapterName: chapter.name,
      title: questionSet.title || `${chapter.name} ${section.label} test`,
      sectionId: section.id,
      sectionLabel: section.label,
      questionSetId: questionSet.id,
      questions: questionSet.questions,
      startedAt: new Date().toISOString(),
    });
  }

  function deleteQuestionSet(chapter, sectionId, questionSetId) {
    const questionSet = getSectionQuestionSets(chapter, sectionId).find((entry) => entry.id === questionSetId);
    if (!questionSet || !window.confirm(`Delete the test "${questionSet.title}"? Saved test results will remain.`)) return;
    updateChapter(chapter.id, (current) => {
      const questionSetsBySection = { ...(current.questionSetsBySection || {}) };
      questionSetsBySection[sectionId] = (questionSetsBySection[sectionId] || [])
        .filter((entry) => entry.id !== questionSetId);
      if (questionSetsBySection[sectionId].length === 0) delete questionSetsBySection[sectionId];

      const updatedChapter = {
        ...current,
        questionSetsBySection,
        ...(questionSetId === 'legacy-mcq-question-set' ? { mcqQuestionSet: undefined } : {}),
      };
      return updatedChapter;
    });
    setMcqImportStatuses((current) => ({
      ...current,
      [`${chapter.id}:${sectionId}`]: `Deleted test "${questionSet.title}".`,
    }));
    setError('');
  }

  function finishMcqTest(result, answers) {
    const test = {
      id: `test-${crypto.randomUUID()}`,
      title: activeMcqTest.title.slice(0, 100),
      obtained: Math.max(0, result.score),
      total: activeMcqTest.questions.length,
      correct: result.correct,
      wrong: result.wrong,
      unanswered: result.unanswered,
      timeSeconds: result.elapsedSeconds,
      source: 'mcq-json',
      sectionId: activeMcqTest.sectionId,
      sectionLabel: activeMcqTest.sectionLabel,
      questionSetId: activeMcqTest.questionSetId,
      takenAt: new Date().toISOString(),
      analysis: { questions: activeMcqTest.questions, answers, result },
    };
    setMcqReview({ questions: activeMcqTest.questions, answers, result, title: activeMcqTest.title });
    updateChapter(activeMcqTest.chapterId, (chapter) => ({ tests: [...(chapter.tests || []), test] }));
    setExpandedChapterId(activeMcqTest.chapterId);
    setActiveMcqTest(null);
    setError('');
  }

  function deleteTestScore(chapter, testId) {
    updateChapter(chapter.id, (current) => ({
      tests: (current.tests || []).filter((test) => test.id !== testId),
    }));
    setError('');
  }

  function getSavedTestQuestionSet(chapter, test) {
    if (test.questionSetId && test.sectionId) {
      const matchingSet = getSectionQuestionSets(chapter, test.sectionId)
        .find((questionSet) => questionSet.id === test.questionSetId);
      if (matchingSet?.questions?.length) return matchingSet;
    }
    const availableSets = Object.keys(chapter.questionSetsBySection || {})
      .flatMap((sectionId) => getSectionQuestionSets(chapter, sectionId));
    return availableSets.find((questionSet) => (
      questionSet.questions?.length && questionSet.title?.trim().toLowerCase() === test.title?.trim().toLowerCase()
    )) || null;
  }

  function openMcqAnalysis(chapter, test) {
    if (test.analysis?.questions?.length) {
      setMcqReview({ ...test.analysis, title: test.title });
      return;
    }
    const questionSet = getSavedTestQuestionSet(chapter, test);
    if (!questionSet) return;
    setMcqReview({
      title: test.title,
      questions: questionSet.questions,
      answers: null,
      result: {
        score: Number(test.obtained) || 0,
        correct: Number(test.correct) || 0,
        wrong: Number(test.wrong) || 0,
        unanswered: Number(test.unanswered) || 0,
        notAttempted: 0,
        elapsedSeconds: Number(test.timeSeconds) || 0,
      },
    });
  }

  function toggleTimer(chapter) {
    if (chapter.timerStartedAt) {
      const stoppedAt = new Date();
      const elapsed = Math.max(0, (stoppedAt.getTime() - new Date(chapter.timerStartedAt).getTime()) / 1000);
      updateChapter(chapter.id, { seconds: (Number(chapter.seconds) || 0) + elapsed, timerStartedAt: null });
    } else {
      updateChapter(chapter.id, { timerStartedAt: new Date().toISOString() });
    }
  }

  function startChapterTimer(chapter) {
    if (!chapter.timerStartedAt) {
      updateChapter(chapter.id, { timerStartedAt: new Date().toISOString() });
    }
  }

  function toggleGlobalTimer() {
    setTracker((current) => {
      if (current.globalTimerStartedAt) {
        const stoppedAt = Date.now();
        const elapsed = Math.max(0, (stoppedAt - new Date(current.globalTimerStartedAt).getTime()) / 1000);
        return {
          ...current,
          studySessions: [...(current.studySessions || []), { id: crypto.randomUUID(), startedAt: current.globalTimerStartedAt, endedAt: new Date(stoppedAt).toISOString(), subjectId: null, subjectName: 'General study', examId: null }],
          globalStudySeconds: (Number(current.globalStudySeconds) || 0) + elapsed,
          globalTimerStartedAt: null,
          exams: current.exams.map((exam) => ({
            ...exam,
            subjects: exam.subjects.map((subject) => ({
              ...subject,
              chapters: subject.chapters.map((chapter) => {
                if (!chapter.timerStartedAt) return chapter;
                const chapterElapsed = Math.max(0, (stoppedAt - new Date(chapter.timerStartedAt).getTime()) / 1000);
                return {
                  ...chapter,
                  seconds: (Number(chapter.seconds) || 0) + chapterElapsed,
                  timerStartedAt: null,
                };
              }),
            })),
          })),
        };
      }
      return { ...current, globalTimerStartedAt: new Date().toISOString() };
    });
  }

  function addSubject() {
    const name = subjectName.trim();
    if (!name || !activeExam) return;
    const newSubject = { id: `custom-${crypto.randomUUID()}`, name, chapters: [] };
    setTracker((current) => ({
      ...current,
      exams: current.exams.map((exam) => (
        exam.id === activeExam.id ? { ...exam, subjects: [...exam.subjects, newSubject] } : exam
      )),
    }));
    setActiveSubjectId(newSubject.id);
    setSubjectName('');
  }

  function deleteSubject(subject) {
    if (!activeExam || !window.confirm(`Delete "${subject.name}" and all its chapter progress?`)) return;
    const subjects = activeExam.subjects.filter((entry) => entry.id !== subject.id);
    setTracker((current) => ({
      ...current,
      exams: current.exams.map((exam) => (exam.id === activeExam.id ? { ...exam, subjects } : exam)),
    }));
    setActiveSubjectId(subjects[0]?.id || '');
  }

  function addChapter() {
    const name = chapterName.trim();
    if (!name || !activeExam || !activeSubject) return;
    const id = `custom-${crypto.randomUUID()}`;
    const subsection = chapterSubsectionSelections[activeSubject.id]
      || getChapterGroups(activeSubject)[0]?.name
      || 'Other';
    const chapter = {
      id,
      name,
      subsection,
      completed: {},
      seconds: 0,
      timerStartedAt: null,
      classes: createDefaultClasses(id),
    };
    setTracker((current) => ({
      ...current,
      exams: current.exams.map((exam) => ({
        ...exam,
        subjects: exam.subjects.map((subject) => (
          subject.id === activeSubject.id ? { ...subject, chapters: [...subject.chapters, chapter] } : subject
        )),
      })),
    }));
    setChapterName('');
  }

  function addSubsection() {
    if (!activeSubject) return;
    const name = newSubsectionName.trim();
    if (!name) return;
    if (name.length > 100) {
      setError('Subsection names must be 100 characters or fewer.');
      return;
    }
    const existing = getChapterGroups(activeSubject).map((group) => group.name);
    if (existing.some((entry) => entry.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError(`The subsection "${name}" already exists.`);
      return;
    }
    setTracker((current) => ({
      ...current,
      exams: current.exams.map((exam) => ({
        ...exam,
        subjects: exam.subjects.map((subject) => (
          subject.id === activeSubject.id
            ? { ...subject, subsections: [...existing, name] }
            : subject
        )),
      })),
    }));
    setChapterSubsectionSelections((current) => ({ ...current, [activeSubject.id]: name }));
    setNewSubsectionName('');
    setAddingSubsection('');
    setError('');
  }

  function startEditingSubsection(name) {
    setEditingSubsection({ subjectId: activeSubject.id, name });
    setSubsectionDraft(name);
  }

  function renameSubsection(previousName) {
    if (!activeSubject) return;
    const name = subsectionDraft.trim();
    if (!name || name === previousName) {
      setEditingSubsection(null);
      return;
    }
    if (name.length > 100) {
      setError('Subsection names must be 100 characters or fewer.');
      return;
    }
    const duplicate = getChapterGroups(activeSubject).some((group) => (
      group.name !== previousName && group.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    ));
    if (duplicate) {
      setError(`The subsection "${name}" already exists.`);
      return;
    }
    setTracker((current) => ({
      ...current,
      exams: current.exams.map((exam) => ({
        ...exam,
        subjects: exam.subjects.map((subject) => {
          if (subject.id !== activeSubject.id) return subject;
          const names = getChapterGroups(subject).map((group) => (
            group.name === previousName ? name : group.name
          ));
          return {
            ...subject,
            subsections: [...new Set(names)],
            chapters: subject.chapters.map((chapter) => (
              chapter.subsection === previousName ? { ...chapter, subsection: name } : chapter
            )),
          };
        }),
      })),
    }));
    setChapterSubsectionSelections((current) => (
      current[activeSubject.id] === previousName
        ? { ...current, [activeSubject.id]: name }
        : current
    ));
    setEditingSubsection(null);
    setError('');
  }

  function deleteSubsection(name) {
    if (!activeSubject) return;
    const chapters = activeSubject.chapters.filter((chapter) => chapter.subsection === name);
    const chapterWarning = chapters.length
      ? ` This will also delete ${chapters.length} chapter${chapters.length === 1 ? '' : 's'} and all their progress and study data.`
      : '';
    if (!window.confirm(`Delete the "${name}" subsection?${chapterWarning}`)) return;
    setTracker((current) => ({
      ...current,
      exams: current.exams.map((exam) => ({
        ...exam,
        subjects: exam.subjects.map((subject) => subject.id !== activeSubject.id ? subject : ({
          ...subject,
          subsections: (subject.subsections || []).filter((subsection) => subsection !== name),
          chapters: subject.chapters.filter((chapter) => chapter.subsection !== name),
        })),
      })),
    }));
    setChapterSubsectionSelections((current) => {
      if (current[activeSubject.id] !== name) return current;
      const next = { ...current };
      delete next[activeSubject.id];
      return next;
    });
    if (editingSubsection?.subjectId === activeSubject.id && editingSubsection.name === name) setEditingSubsection(null);
    if (addingSubsection === name) setAddingSubsection('');
  }

  async function importChapters(file) {
    const targetSubject = activeSubject;
    if (!targetSubject) return;
    if (file.size > 2 * 1024 * 1024) {
      setChapterImportStatus('Chapter JSON files must be 2 MB or smaller.');
      setChapterImportFailed(true);
      return;
    }

    try {
      const data = JSON.parse(await file.text());
      const names = getImportedChapterNames(data, targetSubject.name);
      const existing = new Set(targetSubject.chapters.map((chapter) => chapter.name.trim().toLocaleLowerCase()));
      const newNames = names.filter((name) => !existing.has(name.toLocaleLowerCase()));
      if (newNames.length === 0) {
        setChapterImportStatus('All chapter names in this file already exist in this subject.');
        setChapterImportFailed(false);
        setError('');
        return;
      }
      if (newNames.length + targetSubject.chapters.length > 500) {
        setChapterImportStatus('A subject can have at most 500 chapters. Remove some chapters before importing this list.');
        setChapterImportFailed(true);
        return;
      }

      const chapters = newNames.map((name) => {
        const id = `custom-${crypto.randomUUID()}`;
        return {
          id,
          name,
          subsection: 'Other',
          completed: {},
          seconds: 0,
          timerStartedAt: null,
          classes: createDefaultClasses(id),
        };
      });
      setTracker((current) => ({
        ...current,
        exams: current.exams.map((exam) => ({
          ...exam,
          subjects: exam.subjects.map((subject) => (
            subject.id === targetSubject.id
              ? { ...subject, chapters: [...subject.chapters, ...chapters] }
              : subject
          )),
        })),
      }));
      setChapterImportStatus(`Added ${chapters.length} chapter${chapters.length === 1 ? '' : 's'} to ${targetSubject.name}.`);
      setChapterImportFailed(false);
      setError('');
    } catch (importError) {
      setChapterImportStatus(importError instanceof SyntaxError
        ? 'This file is not valid JSON. Check the file syntax and try again.'
        : importError.message || 'Could not import chapters from this file.');
      setChapterImportFailed(true);
    }
  }

  function deleteChapter(chapter) {
    if (!activeSubject || !window.confirm(`Delete "${chapter.name}" and its completion progress and study time?`)) return;
    setTracker((current) => ({
      ...current,
      exams: current.exams.map((exam) => ({
        ...exam,
        subjects: exam.subjects.map((subject) => (
          subject.id === activeSubject.id
            ? { ...subject, chapters: subject.chapters.filter((entry) => entry.id !== chapter.id) }
            : subject
        )),
      })),
    }));
  }

  function addCustomItem(event, chapter) {
    event.preventDefault();
    const name = (customItemNames[chapter.id] || '').trim();
    if (!name) return;
    const item = { id: `custom-${crypto.randomUUID()}`, label: name };
    updateChapter(chapter.id, { customItems: [...(chapter.customItems || []), item] });
    setCustomItemNames((current) => ({ ...current, [chapter.id]: '' }));
  }

  function deleteCustomItem(chapter, itemId) {
    const completed = { ...chapter.completed };
    delete completed[itemId];
    updateChapter(chapter.id, {
      customItems: (chapter.customItems || []).filter((item) => item.id !== itemId),
      completed,
    });
  }

  function getTaskFiles(chapter, taskId) {
    return chapter.taskFiles?.[taskId] || [];
  }

  function getClassTaskFiles(noteClass, taskId) {
    const seen = new Set();
    return (noteClass.taskFiles?.[taskId] || []).filter((file) => {
      const key = getFileDisplayKey(file);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (loading) return <div className="page"><div className="card">Loading your syllabus tracker...</div></div>;
  if (!tracker) return <div className="page"><div className="error-message">{error || 'Could not load your syllabus tracker.'}</div></div>;
  if (activeMcqTest) {
    return (
      <SyllabusMcqTest
        chapterName={activeMcqTest.chapterName}
        title={activeMcqTest.title}
        questions={activeMcqTest.questions}
        startedAt={activeMcqTest.startedAt}
        now={now}
        onCancel={() => {
          if (window.confirm('Exit this test? Your answers will not be saved.')) setActiveMcqTest(null);
        }}
        onFinish={finishMcqTest}
      />
    );
  }
  if (mcqReview) {
    return <SyllabusMcqReview {...mcqReview} onClose={() => setMcqReview(null)} />;
  }
  if (notesChapter) {
    const noteClasses = notesChapter.classes || [];
    if (!activeNotesClass) {
      return (
        <div className="notes-editor-page notes-class-page">
          <header className="notes-editor-header">
            <button type="button" className="notes-back-button" onClick={() => setNotesChapterId('')}>← <span>Back to syllabus</span></button>
            <div className="notes-editor-heading">
              <p className="eyebrow">Chapter notes</p>
              <h1>{notesChapter.name}</h1>
              <span>{noteClasses.length} class{noteClasses.length === 1 ? '' : 'es'} · one note page per class</span>
            </div>
            <span className={`save-status ${error ? 'failed' : ''}`}>{error ? 'Save failed' : saving ? 'Saving...' : 'All changes saved'}</span>
          </header>
          {error && <div className="error-message" role="alert">{error}</div>}
          <div className="notes-class-library">
            <div className="notes-class-library-header">
              <div>
                <p className="eyebrow">Your class notes</p>
                <h2>Classes for this chapter</h2>
                <p>Add a separate note page for every lesson or class you attend.</p>
              </div>
              <button type="button" className="primary-btn" onClick={() => addNotesClass(notesChapter)} disabled={noteClasses.length >= 100}>
                + Add class
              </button>
            </div>
            {noteClasses.length === 0 ? (
              <div className="notes-class-empty">
                <span aria-hidden="true">✎</span>
                <strong>No class notes yet</strong>
                <p>Create Class 1 to start organizing notes for {notesChapter.name}.</p>
                <button type="button" className="primary-btn" onClick={() => addNotesClass(notesChapter)}>Create Class 1</button>
              </div>
            ) : (
              <div className="notes-class-grid">
                {noteClasses.map((noteClass, index) => {
                  const classWords = noteClass.notes?.trim() ? noteClass.notes.trim().split(/\s+/).length : 0;
                  return (
                    <article className="notes-class-card" key={noteClass.id}>
                      <div className="notes-class-card-icon" aria-hidden="true">▤</div>
                      <div className="notes-class-card-copy">
                        <h3>{noteClass.title || `Class ${index + 1}`}</h3>
                        <p>{classWords ? `${classWords} words` : 'No notes yet'} · Class {index + 1}</p>
                      </div>
                      <button type="button" className="secondary-btn" onClick={() => { startChapterTimer(notesChapter); setNotesClassId(noteClass.id); }}>Open notes</button>
                      <button
                        type="button"
                        className="notes-class-delete"
                        aria-label={`Delete ${noteClass.title || `Class ${index + 1}`}`}
                        title="Delete class"
                        onClick={() => deleteNotesClass(notesChapter, noteClass)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    const notes = activeNotesClass.notes || '';
    const wordCount = notes.replace(/^<!--class-notes-html-->/, '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return (
      <div className="notes-editor-page">
        <header className="notes-editor-header">
          <button type="button" className="notes-back-button" onClick={() => { if (notesChapter.timerStartedAt) toggleTimer(notesChapter); setNotesClassId(''); }}>← <span>All classes</span></button>
          <div className="notes-editor-heading">
            <p className="eyebrow">{notesChapter.name}</p>
            <input
              className="notes-class-title-input"
              value={activeNotesClass.title || ''}
              onChange={(event) => updateNotesClass(notesChapter, activeNotesClass.id, { title: event.target.value })}
              aria-label="Class name"
              placeholder="Class name"
              maxLength={100}
              readOnly={!notesWritingMode}
            />
          </div>
          <div className="notes-editor-header-actions">
            <button type="button" className="notes-header-icon-button" onClick={downloadClassNotesPdf} title="Download notes as PDF" aria-label="Download notes as PDF">
              <Icon name="download" size={17} />
            </button>
            <div className="notes-mode-switch" role="group" aria-label="Notes mode">
              <button type="button" className={!notesWritingMode ? 'active' : ''} aria-pressed={!notesWritingMode} onClick={() => setNotesWritingMode(false)} title="Read mode">
                <Icon name="eye" size={16} /><span>Read</span>
              </button>
              <button type="button" className={notesWritingMode ? 'active' : ''} aria-pressed={notesWritingMode} onClick={() => setNotesWritingMode(true)} title="Write mode">
                <Icon name="edit" size={16} /><span>Write</span>
              </button>
            </div>
            <span className={`save-status ${error ? 'failed' : ''}`}>{error ? 'Save failed' : saving ? 'Saving...' : 'All changes saved'}</span>
          </div>
        </header>
        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="notes-editor-workspace">
          <div className="notes-editor-context">
            <span>{activeExam?.name}</span><span aria-hidden="true">/</span><span>{activeSubject?.name}</span>
          </div>
          {notesWritingMode && (
          <div className="notes-editor-toolbar" role="toolbar" aria-label="Note formatting">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertNoteFormatting('**', '**')} aria-label="Bold selected text"><strong>B</strong><small className="notes-tool-label">Bold</small></button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertNoteFormatting('## ')} aria-label="Insert heading"><span>Heading</span><small className="notes-tool-label">Heading 2</small></button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertNoteFormatting('- ')} aria-label="Insert bullet">• List<small className="notes-tool-label">Bullets</small></button>
            {noteFormatButton('Italic', 'italic', null, <em>I</em>)}
            {noteFormatButton('Underline', 'underline', null, <u>U</u>)}
            {noteFormatButton('Strikethrough', 'strikeThrough', null, <s>S</s>)}
            {noteFormatButton('Superscript', 'superscript', null, 'x²')}
            {noteFormatButton('Subscript', 'subscript', null, 'x₂')}
            {noteFormatButton('Heading 1', 'formatBlock', 'H1', 'H1')}
            {noteFormatButton('Heading 2', 'formatBlock', 'H2', 'H2')}
            {noteFormatButton('Paragraph', 'formatBlock', 'P', '¶')}
            {noteFormatButton('Block quote', 'formatBlock', 'BLOCKQUOTE', '❞')}
            {noteFormatButton('Numbered list', 'insertOrderedList', null, '1. List')}
            {noteFormatButton('Increase indent', 'indent', null, '→')}
            {noteFormatButton('Decrease indent', 'outdent', null, '←')}
            {noteFormatButton('Align left', 'justifyLeft', null, '⇤')}
            {noteFormatButton('Center align', 'justifyCenter', null, '↔')}
            {noteFormatButton('Align right', 'justifyRight', null, '⇥')}
            {noteFormatButton('Justify', 'justifyFull', null, '☷')}
            {noteFormatButton('Undo', 'undo', null, '↶')}
            {noteFormatButton('Redo', 'redo', null, '↷')}
            {noteFormatButton('Clear formatting', 'removeFormat', null, 'Tx')}
            <label className="notes-color-picker" title="Text color">
              <span aria-hidden="true">A</span>
              <small className="notes-tool-label">Text color</small>
              <input type="color" aria-label="Text color" onChange={(event) => insertNoteFormatting('foreColor', event.target.value)} />
            </label>
            <label className="notes-color-picker highlight" title="Highlight color">
              <span aria-hidden="true">▰</span>
              <small className="notes-tool-label">Highlight</small>
              <input type="color" aria-label="Highlight color" onChange={(event) => insertNoteFormatting('hiliteColor', event.target.value)} />
            </label>
            <label className="notes-font-size" title="Text size">
              <small className="notes-tool-label">Text size</small>
              <select defaultValue="3" aria-label="Text size" onChange={(event) => insertNoteFormatting('fontSize', event.target.value)}>
                <option value="2">Small</option>
                <option value="3">Normal</option>
                <option value="4">Large</option>
                <option value="5">Extra large</option>
              </select>
            </label>
            <button
              type="button"
              className={`notes-hindi-toggle ${hindiTyping ? 'active' : ''}`}
              title="Toggle Hindi phonetic typing"
              aria-label={`Hindi phonetic typing ${hindiTyping ? 'on' : 'off'}`}
              aria-pressed={hindiTyping}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setHindiTyping((enabled) => {
                localStorage.setItem('syllabus_hindi_typing', String(!enabled));
                return !enabled;
              })}
            >
              {hindiTyping ? 'हिंदी: On' : 'हिंदी: Off'}
            </button>
            <span className="notes-word-count">{wordCount} words</span>
          </div>
          )}
          <ClassNotesEditor
            key={activeNotesClass.id}
            editorRef={notesEditorRef}
            selectionRef={notesSelectionRef}
            value={notes}
            onChange={(updatedNotes) => updateNotesClass(notesChapter, activeNotesClass.id, {
              notes: updatedNotes.slice(0, MAX_NOTES_CHARACTERS),
            })}
            onPasteImage={pasteClassNoteImage}
            onRemoveImage={(fileId) => {
              const imageFile = getClassTaskFiles(activeNotesClass, 'notes').find((file) => file.id === fileId);
              if (imageFile) deleteChapterFile(notesChapter, imageFile);
            }}
            imageFiles={getClassTaskFiles(activeNotesClass, 'notes').filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file.name))}
            hindiTyping={hindiTyping}
            readOnly={!notesWritingMode}
          />
          <footer className="notes-editor-footer">
            <span>{notesWritingMode
              ? 'Notes save automatically. Hindi mode converts Roman words when you press Space. Drag image edges to resize and Alt-drag to crop. Drag table edges, cell borders, or row borders to resize. Backspace/Delete removes selected images.'
              : 'Read mode. Switch to Write to edit notes and use the formatting tools.'}</span>
            <span>{notes.length.toLocaleString()} / 70,000 characters</span>
          </footer>
        </div>
      </div>
    );
  }

  const activeSectionProgress = activeSubject
    ? getProgress([{ subjects: [activeSubject] }])
    : 0;

  return (
    <div className="page syllabus-page">
      <header className="page-header syllabus-header">
        <div>
          <p className="eyebrow">Study plan</p>
          <h1 className="page-title"><Icon name="syllabus" size={23} />Syllabus Completion Tracker</h1>
          <p className="syllabus-intro">Track every chapter, revision task and study session for BPSC Prelims and Mains.</p>
        </div>
        <div className="syllabus-header-actions">
          <button
            type="button"
            className={`global-timer-button${tracker?.globalTimerStartedAt ? ' running' : ''}`}
            onClick={toggleGlobalTimer}
            aria-pressed={Boolean(tracker?.globalTimerStartedAt)}
            aria-label={tracker?.globalTimerStartedAt ? 'Stop study timer' : 'Start study timer'}
            title={tracker?.globalTimerStartedAt ? 'Stop study timer' : 'Start study timer'}
          >
            <Icon name="power" size={21} />
          </button>
          <span className={`save-status ${error ? 'failed' : ''}`}>{error ? 'Save failed' : saving ? 'Saving...' : 'Progress saved'}</span>
        </div>
      </header>

      {error && <div className="error-message" role="alert">{error}</div>}
      {studyFileStatus && <div className="study-download-status" role="status">{studyFileStatus}</div>}

      <section className="syllabus-overview">
        <div className="card overall-card">
          <div className="overall-copy">
            <div className="overview-label"><span className="overview-icon overall-icon"><Icon name="syllabus" size={19} /></span><p className="eyebrow">Overall syllabus completion</p></div>
            <strong>{overallProgress}%</strong>
            <span>Across prelims and mains</span>
          </div>
          <div className="progress-track overall-track" role="progressbar" aria-label="Overall syllabus completion" aria-valuenow={overallProgress} aria-valuemin="0" aria-valuemax="100">
            <span style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
        <div className="card syllabus-stat prelims-summary-card">
          <div className="stat-label"><span className="overview-icon exam-icon"><Icon name="book" size={17} /></span><span>BPSC Prelims</span></div>
          <div className="prelims-summary-metrics">
            <div>
              <span>Completion</span><strong>{prelimsProgress}%</strong>
              <div className="progress-track" role="progressbar" aria-label="BPSC Prelims completion" aria-valuenow={prelimsProgress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${prelimsProgress}%` }} /></div>
            </div>
            <div>
              <span>Test marks</span><strong>{prelimsMarks.percentage === null ? '—' : `${prelimsMarks.percentage.toFixed(2)}%`}</strong>
              <div className="progress-track" role="progressbar" aria-label="BPSC Prelims test marks" aria-valuenow={prelimsMarks.percentage || 0} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${prelimsMarks.percentage || 0}%` }} /></div>
            </div>
          </div>
        </div>
        <div className="card syllabus-stat remaining-stat">
          <div className="stat-label"><span className="overview-icon remaining-icon"><Icon name="sparkles" size={17} /></span><span>Task progress</span></div>
          <span className="stat-value task-progress-value">{completedTasks}/{completedTasks + remainingTasks}</span>
          <small>{remainingTasks} remaining in {activeExam?.name || 'this exam'}</small>
        </div>
        <div className="card syllabus-stat">
          <div className="stat-label"><span className="overview-icon chapters-icon"><Icon name="book" size={17} /></span><span>Chapters in this exam</span></div>
          <strong className="stat-value">{chapterCount}</strong>
          <small>{activeExam?.subjects.length || 0} subjects</small>
        </div>
        <div className="card syllabus-stat">
          <div className="stat-label"><span className="overview-icon today-icon"><Icon name="calendar" size={17} /></span><span>Studied today</span></div>
          <strong className="stat-value time-value">{formatTime(todaySeconds)}</strong>
          <small>Today</small>
        </div>
        <div className="card syllabus-stat">
          <div className="stat-label"><span className="overview-icon exam-icon"><Icon name="timer" size={17} /></span><span>Study time in this exam</span></div>
          <div className="prelims-summary-metrics exam-study-metrics">
            <div><span>Total study time</span><strong>{formatTime(totalSeconds)}</strong></div>
            <div><span>Average daily</span><strong>{formatTime(averageDailyExamSeconds)}</strong></div>
          </div>
          <small>All tracked time · {studyDays} {studyDays === 1 ? 'day' : 'days'}</small>
        </div>
        <div className="card syllabus-stat">
          <div className="stat-label"><span className="overview-icon total-time-icon"><Icon name="timer" size={17} /></span><span>Total study time</span></div>
          <strong className="stat-value time-value">{formatTime(overallSeconds)}</strong>
          <small>All tracked time</small>
        </div>
        <div className="card syllabus-stat">
          <div className="stat-label"><span className="overview-icon marks-icon"><Icon name="sparkles" size={17} /></span><span>Overall test marks</span></div>
          <strong className="stat-value">{overallMarks.percentage === null ? '—' : `${overallMarks.percentage.toFixed(2)}%`}</strong>
          <small>{overallMarks.total ? `${formatMarkValue(overallMarks.obtained)} / ${formatMarkValue(overallMarks.total)} marks · ${overallQuestionCount} questions` : 'No test scores yet'}</small>
        </div>
      </section>

      <section className="card study-time-analysis">
        <div className="section-heading">
          <div className="analysis-title"><div><p className="eyebrow">Overall analysis</p><h2>Time and test analysis</h2></div></div>
          <div className="analysis-actions">
            <button type="button" className="analysis-icon-toggle" aria-expanded={showTimeAnalysis} aria-label={showTimeAnalysis ? 'Hide time analysis' : 'Show time analysis'} title={showTimeAnalysis ? 'Hide time analysis' : 'Time analysis'} onClick={() => { const next = !showTimeAnalysis; setShowTimeAnalysis(next); if (next) setShowTestAnalysis(false); }}>
              <Icon name="timer" size={18} />
            </button>
            <button type="button" className="analysis-icon-toggle" aria-expanded={showTestAnalysis} aria-label={showTestAnalysis ? 'Hide overall test analysis' : 'Show overall test analysis'} title={showTestAnalysis ? 'Hide overall test analysis' : 'Overall test analysis'} onClick={() => { const next = !showTestAnalysis; setShowTestAnalysis(next); if (next) setShowTimeAnalysis(false); }}>
              <Icon name="questions" size={18} />
            </button>
          </div>
        </div>
        {showTimeAnalysis && <div className="study-time-subject-list">
          {subjectTimeAnalysis.map((subject) => (
            <div className="study-time-subject-row" key={subject.id} tabIndex="0" aria-label={`${subject.label}: ${formatTime(subject.seconds)}. Focus or hover to view chapter times.`}>
              <span>{subject.label}</span><strong>{formatTime(subject.seconds)}</strong>
              <div className="progress-track"><span style={{ width: `${overallSeconds ? (subject.seconds / overallSeconds) * 100 : 0}%` }} /></div>
              <div className="study-time-chapter-tooltip" role="tooltip">
                <strong>Chapter time</strong>
                {subject.chapters.length ? subject.chapters.map((chapter) => (
                  <span key={chapter.id}><span>{chapter.name}</span><b>{formatTime(chapter.seconds)}</b></span>
                )) : <span>No chapters added</span>}
              </div>
            </div>
          ))}
        </div>}
      </section>

      {showTestAnalysis && <section className="card study-time-analysis test-score-analysis">
        <div className="section-heading">
          <div className="analysis-title"><span className="overview-icon marks-icon"><Icon name="questions" size={17} /></span><div><p className="eyebrow">Latest attempts</p><h2>Overall test score analysis</h2></div></div>
          <strong className="test-analysis-total">{overallMarks.percentage === null ? 'No scores yet' : `${overallMarks.percentage.toFixed(2)}% overall · ${overallQuestionCount} questions`}</strong>
        </div>
        {subjectTestAnalysis.length ? <div className="study-time-subject-list test-analysis-subject-list">
          {subjectTestAnalysis.map((subject) => (
            <div className="test-analysis-subject-row" key={subject.id} tabIndex="0">
              <span>{subject.label}</span>
              <strong>{subject.marks.percentage === null ? '—' : `${subject.marks.percentage.toFixed(2)}%`}</strong>
              <div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, subject.marks.percentage || 0))}%` }} /></div>
              <small>{formatMarkValue(subject.marks.obtained)} / {formatMarkValue(subject.marks.total)} marks · {subject.questionCount} questions · {subject.tests.length} tests</small>
              <div className="study-time-chapter-tooltip test-analysis-tooltip" role="tooltip">
                <strong>Latest test scores</strong>
                {subject.tests.map((test) => (
                  <span key={test.id}><span>{test.chapterName ? `${test.chapterName}: ` : ''}{test.title}</span><b>{formatMarkValue(test.obtained)}/{formatMarkValue(test.total)}{test.source === 'mcq-json' ? ` · ${test.total} questions` : ''}</b></span>
                ))}
              </div>
            </div>
          ))}
        </div> : <p className="test-analysis-empty">Complete a topic test to see question counts and the latest score for each subject.</p>}
      </section>}

      <div className="exam-tabs" role="tablist" aria-label="BPSC exam">
        {tracker.exams.map((exam) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeExam?.id === exam.id}
            className={activeExam?.id === exam.id ? 'active' : ''}
            key={exam.id}
            onClick={() => { setActiveExamId(exam.id); setActiveSubjectId(exam.subjects[0]?.id || ''); }}
          >
            {exam.name}<span>{getProgress([exam])}% complete · {getMarks(getExamChapters([exam])).percentage === null ? 'no marks' : `${getMarks(getExamChapters([exam])).percentage.toFixed(2)}% marks`}</span>
          </button>
        ))}
      </div>

      <div className="syllabus-layout">
        <aside className="card subject-sidebar">
          <div className="section-heading">
            <div><p className="eyebrow">Your sections</p><h2>Subjects</h2></div>
            <span className="voice-count">{activeExam?.subjects.length || 0}</span>
          </div>
          <div className="subject-list">
            {(activeExam?.subjects || []).map((subject) => {
              const progress = getProgress([{ subjects: [subject] }]);
              const marks = getMarks(subject.chapters);
              return (
                <button
                  type="button"
                  className={`subject-link ${activeSubject?.id === subject.id ? 'active' : ''}`}
                  key={subject.id}
                  onClick={() => setActiveSubjectId(subject.id)}
                >
                  <span className="subject-link-heading">
                    <span>{subject.name}</span>
                    <span>{progress}%</span>
                  </span>
                  <span className="progress-track subject-progress-track" role="progressbar" aria-label={`${subject.name} completion`} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                    <span style={{ width: `${progress}%` }} />
                  </span>
                  <span className="subject-link-marks">{marks.percentage === null ? 'No test score' : `${marks.percentage.toFixed(2)}% marks`}</span>
                </button>
              );
            })}
          </div>
          <form className="add-subject-form" onSubmit={(event) => { event.preventDefault(); addSubject(); }}>
            <label className="field">
              <span>Add a section</span>
              <input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="e.g. Optional subject" maxLength={80} />
            </label>
            <button type="submit" className="secondary-btn" disabled={!subjectName.trim()}>Add section</button>
          </form>
        </aside>

        <section className="card chapter-panel">
          {activeSubject ? (
            <>
              <div className="section-heading chapter-heading">
                <div>
                  <p className="eyebrow">{activeExam.name}</p>
                  <h2>{activeSubject.name}</h2>
                  <div className="section-progress-block">
                    <div className="progress-track section-progress-track" role="progressbar" aria-label={`${activeSubject.name} completion`} aria-valuenow={activeSectionProgress} aria-valuemin="0" aria-valuemax="100">
                      <span style={{ width: `${activeSectionProgress}%` }} />
                    </div>
                    <small>{activeSectionProgress}% complete</small>
                  </div>
                  <p className="chapter-summary">
                    {activeSubject.chapters.length} chapters · {getProgress([{ subjects: [activeSubject] }])}% complete ·{' '}
                    {formatTime(activeSubject.chapters.reduce((sum, chapter) => sum + getLiveSeconds(chapter, now), 0))} studied ·{' '}
                    {formatMarks(activeSubjectMarks)}
                  </p>
                </div>
                <div className="chapter-heading-actions">
                  <button
                    type="button"
                    className="subsection-icon-button add"
                    aria-label="Add subsection"
                    title="Add subsection"
                    onClick={() => {
                      setAddingSubsection('__root__');
                      setNewSubsectionName('');
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="icon-action-button danger"
                    aria-label={`Delete section ${activeSubject.name}`}
                    title="Delete section"
                    onClick={() => deleteSubject(activeSubject)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              </div>

              {activeSubject.chapters.length === 0 && <div className="empty-state">No chapters yet. Add the first chapter below.</div>}

              {addingSubsection === '__root__' && (
                <form
                  className="subsection-name-form subsection-add-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addSubsection();
                  }}
                >
                  <input
                    autoFocus
                    value={newSubsectionName}
                    onChange={(event) => setNewSubsectionName(event.target.value)}
                    aria-label="New subsection name"
                    placeholder="New subsection name"
                    maxLength={100}
                  />
                  <button type="submit" className="subsection-icon-button add" aria-label="Save new subsection" title="Add subsection" disabled={!newSubsectionName.trim()}>+</button>
                  <button type="button" className="subsection-icon-button" aria-label="Cancel adding subsection" title="Cancel" onClick={() => setAddingSubsection('')}>×</button>
                </form>
              )}

              <div className="chapter-list">
                {getChapterGroups(activeSubject).map((group) => {
                  const subsectionProgress = getProgress([{ subjects: [{ chapters: group.chapters }] }]);
                  const subsectionSeconds = group.chapters.reduce((sum, chapter) => sum + getLiveSeconds(chapter, now), 0);
                  const subsectionMarks = getMarks(group.chapters);
                  return (
                  <section className="subsection-group" key={group.name}>
                    <header className="subsection-heading">
                      <div>
                        {editingSubsection?.subjectId === activeSubject.id && editingSubsection.name === group.name ? (
                          <form
                            className="subsection-name-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              renameSubsection(group.name);
                            }}
                          >
                            <input
                              value={subsectionDraft}
                              onChange={(event) => setSubsectionDraft(event.target.value)}
                              aria-label="Subsection name"
                              maxLength={100}
                              autoFocus
                            />
                            <button type="submit" className="subsection-icon-button" aria-label="Save subsection name" title="Save">✓</button>
                            <button type="button" className="subsection-icon-button" aria-label="Cancel editing subsection" title="Cancel" onClick={() => setEditingSubsection(null)}>×</button>
                          </form>
                        ) : (
                          <h3>{group.name}</h3>
                        )}
                        <p>{group.chapters.length} chapters · {subsectionProgress}% complete · {formatTime(subsectionSeconds)} studied · {formatMarks(subsectionMarks)}</p>
                      </div>
                      <div className="subsection-heading-actions">
                        <button
                          type="button"
                          className="subsection-icon-button"
                          aria-label={`Edit ${group.name} subsection`}
                          title={`Edit ${group.name}`}
                          onClick={() => startEditingSubsection(group.name)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="subsection-icon-button add"
                          aria-label={`Add subsection after ${group.name}`}
                          title="Add subsection"
                          onClick={() => {
                            setAddingSubsection(group.name);
                            setNewSubsectionName('');
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="subsection-icon-button danger"
                          aria-label={`Delete ${group.name} subsection`}
                          title={`Delete ${group.name} subsection`}
                          onClick={() => deleteSubsection(group.name)}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </header>
                    {addingSubsection === group.name && (
                      <form
                        className="subsection-name-form subsection-add-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          addSubsection();
                        }}
                      >
                        <input
                          autoFocus
                          value={newSubsectionName}
                          onChange={(event) => setNewSubsectionName(event.target.value)}
                          aria-label="New subsection name"
                          placeholder="New subsection name"
                          maxLength={100}
                        />
                        <button type="submit" className="subsection-icon-button add" aria-label="Save new subsection" title="Add subsection" disabled={!newSubsectionName.trim()}>+</button>
                        <button type="button" className="subsection-icon-button" aria-label="Cancel adding subsection" title="Cancel" onClick={() => setAddingSubsection('')}>×</button>
                      </form>
                    )}
                    <div className="subsection-chapters">
                {group.chapters.map((chapter) => {
                  const chapterItems = getChapterItems(chapter);
                  const customChapterItems = chapterItems.filter((item) => !TRACKING_ITEMS.some((tracked) => tracked.id === item.id));
                  const activeChapterTab = chapterTaskTabs[chapter.id];
                  const done = getChapterCompletedCount(chapter);
                  const taskCount = getChapterTaskCount(chapter);
                  const progress = taskCount ? Math.round((done / taskCount) * 100) : 0;
                  const time = getLiveSeconds(chapter, now);
                  const chapterMarks = getMarks([chapter]);
                  const testDraft = testDrafts[chapter.id] || {};
                  const expanded = expandedChapterId === chapter.id;
                  return (
                    <article className={`chapter-card ${expanded ? 'expanded' : ''}`} key={chapter.id}>
                      <div className="chapter-card-header">
                        <button
                          type="button"
                          className="chapter-expand-button"
                          aria-expanded={expanded}
                          aria-controls={`chapter-details-${chapter.id}`}
                          onClick={() => setExpandedChapterId(expanded ? '' : chapter.id)}
                        >
                          <span className="chapter-progress-ring">{progress}%</span>
                          <div>
                            <h3>{chapter.name}</h3>
                            <span>{done}/{taskCount} tasks complete · {formatTime(time)}</span>
                            <small className="chapter-marks">{formatMarks(chapterMarks)}</small>
                          </div>
                          <span className={`chapter-chevron ${expanded ? 'open' : ''}`} aria-hidden="true">⌄</span>
                        </button>
                        <div className="chapter-actions">
                          <button
                            type="button"
                            className={`icon-action-button timer-button${chapter.timerStartedAt ? ' running' : ''}`}
                            onClick={() => toggleTimer(chapter)}
                            aria-label={chapter.timerStartedAt ? `Stop timer for ${chapter.name}` : `Start timer for ${chapter.name}`}
                            title={chapter.timerStartedAt ? 'Stop timer' : 'Start timer'}
                          >
                            <Icon name={chapter.timerStartedAt ? 'pause' : 'timer'} size={17} />
                          </button>
                          <button
                            type="button"
                            className="icon-action-button chapter-time-edit-button"
                            onClick={() => beginChapterTimeEdit(chapter)}
                            aria-label={`Edit study time for ${chapter.name}`}
                            title="Edit time"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-action-button danger"
                            aria-label={`Delete chapter ${chapter.name}`}
                            title="Delete chapter"
                            onClick={() => deleteChapter(chapter)}
                          >
                            <Icon name="trash" size={17} />
                          </button>
                        </div>
                      </div>
                      {editingTimeChapterId === chapter.id && (
                        <form className="chapter-time-editor" onSubmit={(event) => saveChapterTime(event, chapter)}>
                          <strong>Edit logged study time</strong>
                          <label>
                            <span>Hours</span>
                            <input
                              type="number"
                              min="0"
                              max="9999"
                              step="1"
                              value={timeDraft.hours}
                              onChange={(event) => setTimeDraft((current) => ({ ...current, hours: event.target.value }))}
                              required
                            />
                          </label>
                          <label>
                            <span>Minutes</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              step="1"
                              value={timeDraft.minutes}
                              onChange={(event) => setTimeDraft((current) => ({ ...current, minutes: event.target.value }))}
                              required
                            />
                          </label>
                          <label>
                            <span>Seconds</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              step="1"
                              value={timeDraft.seconds}
                              onChange={(event) => setTimeDraft((current) => ({ ...current, seconds: event.target.value }))}
                              required
                            />
                          </label>
                          <button type="submit" className="primary-btn">Save time</button>
                          <button type="button" className="outline-btn" onClick={() => setEditingTimeChapterId('')}>Cancel</button>
                        </form>
                      )}
                      {expanded && <div className="chapter-details" id={`chapter-details-${chapter.id}`}>
                      <section className="chapter-study-tabs" aria-label={`${chapter.name} study tasks`}>
                        <div className="chapter-study-tab-list" role="tablist" aria-label="Chapter study tasks">
                          {TRACKING_ITEMS.map((item) => {
                            const done = Boolean(chapter.completed?.[item.id]);
                            return (
                              <button
                                type="button"
                                role="tab"
                                key={item.id}
                                id={`chapter-tab-${chapter.id}-${item.id}`}
                                aria-selected={activeChapterTab === item.id}
                                aria-controls={`chapter-tab-panel-${chapter.id}`}
                                className={`chapter-study-tab ${activeChapterTab === item.id ? 'active' : ''} ${done ? 'complete' : ''}`}
                                onClick={() => selectChapterTaskTab(chapter.id, item.id)}
                              >
                                <span className="chapter-study-tab-icon" aria-hidden="true">
                                  {item.id === 'mcq' ? '✦' : item.id === 'lucent' ? '▤' : '◷'}
                                </span>
                                <span className="chapter-study-tab-copy">
                                  <strong>{item.label}</strong>
                                  <small>{done ? 'Completed' : 'Track progress'}</small>
                                </span>
                                <span className="chapter-study-tab-check" aria-hidden="true">{done ? '✓' : ''}</span>
                              </button>
                            );
                          })}
                        </div>
                        {activeChapterTab ? (() => {
                          const item = TRACKING_ITEMS.find((entry) => entry.id === activeChapterTab);
                          if (!item) return null;
                          const taskFiles = getTaskFiles(chapter, item.id);
                          const questionSets = getSectionQuestionSets(chapter, item.id);
                          const importStatusKey = `${chapter.id}:${item.id}`;
                          return (
                            <div
                              className="chapter-study-tab-panel"
                              role="tabpanel"
                              id={`chapter-tab-panel-${chapter.id}`}
                              aria-labelledby={`chapter-tab-${chapter.id}-${item.id}`}
                            >
                              <div className="chapter-study-panel-heading">
                                <div>
                                  <p className="eyebrow">Chapter study section</p>
                                  <h4>{item.label}</h4>
                                </div>
                                <label className={`chapter-task-complete ${chapter.completed?.[item.id] ? 'checked' : ''}`}>
                                  <input
                                    type="checkbox"
                                    aria-label={`Mark ${item.label} complete`}
                                    checked={Boolean(chapter.completed?.[item.id])}
                                    onChange={() => toggleCompletion(chapter, item.id)}
                                  />
                                  <span>{chapter.completed?.[item.id] ? 'Completed' : 'Mark complete'}</span>
                                </label>
                              </div>
                              <div className="chapter-study-panel-content">
                                {TASK_FILE_ITEMS.has(item.id) && (
                                  <div className="task-attachments chapter-task-attachments">
                                    <small className="upload-save-help">Uploaded files are saved to your account automatically.</small>
                                    <label className="task-file-upload">
                                      <Icon name="upload" size={14} />
                                      <span>{uploadingChapterIds.includes(chapter.id) ? 'Uploading...' : 'Add PDF / PPTX'}</span>
                                      <input
                                        type="file"
                                        accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                        disabled={uploadingChapterIds.includes(chapter.id)}
                                        onChange={(event) => {
                                          const file = event.target.files?.[0];
                                          if (file) uploadChapterFile(chapter, file, item.id);
                                          event.target.value = '';
                                        }}
                                      />
                                    </label>
                                    {taskFiles.map((file) => (
                                      <div className="task-attachment" key={file.id}>
                                        <span title={file.name}>{file.name}</span>
                                        <button type="button" onClick={() => openChapterFile(chapter, file)}>Download to open</button>
                                        <button
                                          type="button"
                                          className="study-file-view-button"
                                          title="Open file"
                                          aria-label={`Open ${file.name}`}
                                          onClick={() => openStudyMaterial(chapter, file, item.label)}
                                        >
                                          <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                                            <circle cx="12" cy="12" r="3" />
                                          </svg>
                                        </button>
                                      <button type="button" className="icon-action-button danger" onClick={() => deleteChapterFile(chapter, file)} aria-label={`Delete ${file.name}`} title={`Delete ${file.name}`}><Icon name="trash" size={15} /></button>
                                      </div>
                                    ))}
                                    {renderLocalFileAccess(chapter, item.id)}
                                  </div>
                                )}
                                <div className="mcq-json-tools">
                                  <div className="mcq-json-description">
                                    <strong>Create a test for {item.label}</strong>
                                    <span>Upload a JSON file with a title and multiple-choice questions.</span>
                                  </div>
                                  <label className="secondary-btn mcq-json-upload">
                                    <Icon name="plus" size={15} />
                                    Create test
                                    <input
                                      type="file"
                                      accept=".json,application/json"
                                      onChange={(event) => importMcqQuestions(event, chapter, item)}
                                    />
                                  </label>
                                  {mcqImportStatuses[importStatusKey] && (
                                    <small className="mcq-import-status" role="status">{mcqImportStatuses[importStatusKey]}</small>
                                  )}
                                  {questionSets.length > 0 && (
                                    <div className="section-test-list">
                                      {questionSets.map((questionSet, index) => (
                                        <article className="section-test-card" key={questionSet.id}>
                                          <span className="section-test-number">{String(index + 1).padStart(2, '0')}</span>
                                          <div className="section-test-copy">
                                            <strong>{questionSet.title}</strong>
                                            <small>{questionSet.questions.length} questions · {questionSet.sourceName}</small>
                                          </div>
                                          <button
                                            type="button"
                                            className="primary-btn"
                                            onClick={() => startMcqTest(chapter, questionSet, item)}
                                          >
                                            Start test
                                          </button>
                                          <button
                                            type="button"
                                            className="icon-action-button danger"
                                            onClick={() => deleteQuestionSet(chapter, item.id, questionSet.id)}
                                            aria-label={`Delete ${questionSet.title}`}
                                            title={`Delete ${questionSet.title}`}
                                          >
                                            <Icon name="trash" size={16} />
                                          </button>
                                        </article>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })() : (
                          <div className="chapter-study-tab-empty" role="tabpanel" id={`chapter-tab-panel-${chapter.id}`}>
                            <span aria-hidden="true">↗</span>
                            <strong>Choose a study section</strong>
                            <p>Select Detailed MCQs, Lucent objective, or Previous year questions to view its checklist and materials.</p>
                          </div>
                        )}
                      </section>
                      {customChapterItems.length > 0 && <div className="chapter-checklist chapter-custom-checklist">
                        {customChapterItems.map((item) => (
                          <div className="tracking-item-wrapper" key={item.id}>
                            <div className={`tracking-check ${chapter.completed?.[item.id] ? 'checked' : ''}`}>
                                <input
                                  type="checkbox"
                                  aria-label={item.label}
                                  checked={Boolean(chapter.completed?.[item.id])}
                                  onChange={() => toggleCompletion(chapter, item.id)}
                                />
                                <span>{item.label}</span>
                                {item.id.startsWith('custom-') && (
                                  <button
                                    type="button"
                                    className="remove-tracking-item"
                                    aria-label={`Delete ${item.label}`}
                                    title={`Delete ${item.label}`}
                                    onClick={() => deleteCustomItem(chapter, item.id)}
                                  >
                                    <Icon name="trash" size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                        ))}
                      </div>}
                      <form className="add-tracking-item-form" onSubmit={(event) => addCustomItem(event, chapter)}>
                        <label className="field">
                          <span>Add a book or study task</span>
                          <input
                            value={customItemNames[chapter.id] || ''}
                            onChange={(event) => setCustomItemNames((current) => ({ ...current, [chapter.id]: event.target.value }))}
                            placeholder="e.g. Read another reference book"
                            maxLength={100}
                          />
                        </label>
                        <button type="submit" className="secondary-btn" disabled={!(customItemNames[chapter.id] || '').trim()}>
                          Add task
                        </button>
                      </form>

                      <section className="chapter-resources">
                        <div className="chapter-subsection-heading">
                          <div><h4>Study files</h4><p>Files are saved to your account automatically when uploaded. Maximum 25 MB per file.</p></div>
                          <label className="secondary-btn upload-file-button">
                            <Icon name="upload" size={16} />
                            {uploadingChapterIds.includes(chapter.id) ? 'Uploading...' : 'Choose file'}
                            <input
                              type="file"
                              disabled={uploadingChapterIds.includes(chapter.id)}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) uploadChapterFile(chapter, file);
                                event.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                        {(chapter.files || []).length === 0 ? (
                          <p className="resource-empty">No files saved for this chapter.</p>
                        ) : (
                          <ul className="chapter-file-list">
                            {chapter.files.map((file) => (
                              <li key={file.id}>
                                <span>{file.name} <small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small></span>
                                <div>
                                  <button type="button" className="outline-btn" onClick={() => openChapterFile(chapter, file)}>
                                    Download to open
                                  </button>
                                  {/\.(pdf|pptx?)$/i.test(file.name) && (
                                    <button
                                      type="button"
                                      className="outline-btn study-file-view-button"
                                      title="Open file"
                                      aria-label={`Open ${file.name}`}
                                      onClick={() => openStudyMaterial(chapter, file, 'Study file')}
                                    >
                                      <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                                        <circle cx="12" cy="12" r="3" />
                                      </svg>
                                    </button>
                                  )}
                                  <button type="button" className="icon-action-button danger" onClick={() => deleteChapterFile(chapter, file)} aria-label={`Delete ${file.name}`} title={`Delete ${file.name}`}><Icon name="trash" size={15} /></button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        {renderLocalFileAccess(chapter)}
                      </section>

                      <section className="chapter-resources chapter-class-notes">
                        <div className="chapter-subsection-heading">
                          <div>
                            <h4>Classes for {chapter.name}</h4>
                            <p>{chapter.classes?.length || 0} classes · each tracks Notes, Book, and DPP progress</p>
                          </div>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => addNotesClass(chapter)}
                            disabled={(chapter.classes?.length || 0) >= 100}
                          >
                            + Add class
                          </button>
                        </div>
                        {(chapter.classes || []).length === 0 ? (
                          <p className="resource-empty">No classes yet. Add Class 1 to start this chapter's class notes.</p>
                        ) : (
                          <div className="chapter-class-list">
                            {chapter.classes.map((noteClass, index) => {
                              const notesText = (noteClass.notes || '').replace(/^<!--class-notes-html-->/, '');
                              const hasNotes = /<img\b/i.test(notesText)
                                || notesText.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').trim().length > 0;
                              const classWords = hasNotes ? notesText.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').trim().split(/\s+/).filter(Boolean).length : 0;
                              const classItems = getClassItems(noteClass);
                              const classDone = classItems.filter((item) => noteClass.completed?.[item.id]).length;
                              const classKey = `${chapter.id}:${noteClass.id}`;
                              const classExpanded = expandedClassKey === classKey;
                              const classProgress = classItems.length ? Math.round((classDone / classItems.length) * 100) : 0;
                              return (
                                <article className={`chapter-class-card ${classExpanded ? 'expanded' : ''}`} key={noteClass.id}>
                                  <div className="chapter-class-heading">
                                    <button
                                      type="button"
                                      className="chapter-class-toggle"
                                      aria-expanded={classExpanded}
                                      aria-controls={`class-details-${chapter.id}-${noteClass.id}`}
                                      onClick={() => {
                                        setExpandedClassKey((current) => (current === classKey ? '' : classKey));
                                      }}
                                    >
                                      <span className="notes-class-card-icon" aria-hidden="true">▤</span>
                                      <span className="chapter-class-copy">
                                        <strong>{noteClass.title || `Class ${index + 1}`}</strong>
                                        <small>{classDone}/{classItems.length} tasks complete · {hasNotes ? (classWords ? `${classWords} notes words` : 'Notes added') : 'Notes not started'}</small>
                                      </span>
                                      <span className="chapter-class-progress" aria-label={`${classProgress}% complete`}>{classProgress}%</span>
                                      <span className={`chapter-class-chevron ${classExpanded ? 'open' : ''}`} aria-hidden="true">⌄</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="notes-class-delete"
                                      aria-label={`Delete ${noteClass.title || `Class ${index + 1}`}`}
                                      title="Delete class"
                                      onClick={() => deleteNotesClass(chapter, noteClass)}
                                    >
                                      <Icon name="trash" size={16} />
                                    </button>
                                  </div>
                                  {classExpanded && (
                                  <div className="chapter-class-details" id={`class-details-${chapter.id}-${noteClass.id}`}>
                                    <div className="chapter-class-details-heading">
                                      <span>Class checklist</span>
                                      <span>{classDone} completed · {classItems.length - classDone} remaining</span>
                                    </div>
                                    <div className="class-task-list">
                                    {classItems.map((item) => {
                                      const classTaskFiles = getClassTaskFiles(noteClass, item.id).filter((file) => (
                                        item.id !== 'notes' || !/\.(png|jpe?g|webp|gif)$/i.test(file.name)
                                      ));
                                      return (
                                        <div className="class-task-wrapper" key={item.id}>
                                          <label className={`tracking-check ${noteClass.completed?.[item.id] ? 'checked' : ''}`}>
                                            <input
                                              type="checkbox"
                                              aria-label={`${noteClass.title || `Class ${index + 1}`}: ${item.label}`}
                                              checked={Boolean(noteClass.completed?.[item.id])}
                                              onChange={() => toggleClassCompletion(chapter, noteClass, item.id)}
                                            />
                                            <span>{item.label}</span>
                                          </label>
                                          {TASK_FILE_ITEMS.has(item.id) && (
                                            <div className="task-attachments">
                                              <small className="upload-save-help">Uploaded files are saved to your account automatically.</small>
                                              <label className="task-file-upload">
                                                <Icon name="upload" size={14} />
                                                <span>{uploadingChapterIds.includes(chapter.id) ? 'Uploading...' : 'Add PDF / PPTX'}</span>
                                                <input
                                                  type="file"
                                                  accept={item.id === 'notes' ? '.pdf,.pptx,image/png,image/jpeg,image/webp,image/gif' : '.pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation'}
                                                  disabled={uploadingChapterIds.includes(chapter.id)}
                                                  onChange={(event) => {
                                                    const file = event.target.files?.[0];
                                                    if (file) uploadChapterFile(chapter, file, item.id, noteClass.id);
                                                    event.target.value = '';
                                                  }}
                                                />
                                              </label>
                                              {classTaskFiles.map((file) => (
                                                <div className="task-attachment" key={file.id}>
                                                  <span title={file.name}>{file.name}</span>
                                                  <button
                                                    type="button"
                                                    className="study-file-view-button"
                                                    title="Open file"
                                                    aria-label={`Open ${file.name}`}
                                                    onClick={() => openStudyMaterial(chapter, file, `${noteClass.title}: ${item.label}`)}
                                                  >
                                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                                                      <circle cx="12" cy="12" r="3" />
                                                    </svg>
                                                  </button>
                                                  <button type="button" className="icon-action-button danger" onClick={() => deleteChapterFile(chapter, file)} aria-label={`Delete ${file.name}`} title={`Delete ${file.name}`}><Icon name="trash" size={15} /></button>
                                                </div>
                                              ))}
                                              {renderLocalFileAccess(chapter, item.id, noteClass.id)}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    </div>
                                    <div className="chapter-class-actions">
                                      <button
                                        type="button"
                                        className={`outline-btn class-notes-action ${hasNotes ? 'has-notes' : 'no-notes'}`}
                                        onClick={() => {
                                          setNotesChapterId(chapter.id);
                                          setNotesClassId(noteClass.id);
                                          startChapterTimer(chapter);
                                        }}
                                      >
                                        <Icon name="note" size={16} />
                                        {hasNotes ? 'Open notes' : 'Add note'}
                                      </button>
                                    </div>
                                  </div>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </section>

                      <section className="chapter-resources test-score-section">
                        <div className="chapter-subsection-heading">
                          <div>
                            <h4>Test scores</h4>
                            <p>{formatMarks(chapterMarks)}</p>
                          </div>
                        </div>
                        {(chapter.tests || []).length > 0 && (
                          <ul className="test-score-list">
                            {chapter.tests.map((test) => (
                              <li key={test.id}>
                                <div>
                                  {test.link ? <a href={test.link} target="_blank" rel="noreferrer">{test.title}</a> : <strong>{test.title}</strong>}
                                  <span>{formatMarkValue(test.obtained)} / {formatMarkValue(test.total)} marks · {((test.obtained / test.total) * 100).toFixed(2)}%</span>
                                  {test.source === 'mcq-json' && (
                                    <small>
                                      {test.sectionLabel ? `${test.sectionLabel} · ` : ''}
                                      {test.correct} correct · {test.wrong} wrong · {test.unanswered} unanswered · {formatTime(test.timeSeconds)}
                                    </small>
                                  )}
                                </div>
                                <div className="test-row-actions">
                                  {(test.analysis || getSavedTestQuestionSet(chapter, test)) && (
                                    <button type="button" className="test-row-icon-button test-analysis-button" onClick={() => openMcqAnalysis(chapter, test)} aria-label={`View detailed analysis for ${test.title}`} title="View detailed analysis">
                                      <Icon name="eye" size={18} />
                                    </button>
                                  )}
                                  <button type="button" className="test-row-icon-button test-delete-button" onClick={() => deleteTestScore(chapter, test.id)} aria-label={`Delete ${test.title} score`} title="Delete test score">
                                    <Icon name="trash" size={17} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <form className="test-score-form" onSubmit={(event) => addTestScore(event, chapter)}>
                          <label className="field">
                            <span>Test name</span>
                            <input value={testDraft.title || ''} onChange={(event) => setTestDrafts((current) => ({ ...current, [chapter.id]: { ...current[chapter.id], title: event.target.value } }))} placeholder="e.g. Chapter mock test" maxLength={100} required />
                          </label>
                          <label className="field">
                            <span>Marks obtained</span>
                            <input type="number" min="0" step="any" value={testDraft.obtained ?? ''} onChange={(event) => setTestDrafts((current) => ({ ...current, [chapter.id]: { ...current[chapter.id], obtained: event.target.value } }))} required />
                          </label>
                          <label className="field">
                            <span>Total marks</span>
                            <input type="number" min="0.01" step="any" value={testDraft.total ?? ''} onChange={(event) => setTestDrafts((current) => ({ ...current, [chapter.id]: { ...current[chapter.id], total: event.target.value } }))} required />
                          </label>
                          <label className="field">
                            <span>Test link (optional)</span>
                            <input type="url" value={testDraft.link || ''} onChange={(event) => setTestDrafts((current) => ({ ...current, [chapter.id]: { ...current[chapter.id], link: event.target.value } }))} placeholder="https://..." />
                          </label>
                          <button type="submit" className="secondary-btn">Save score</button>
                        </form>
                      </section>
                      </div>}
                    </article>
                  );
                })}
                    </div>
                  </section>
                  );
                })}
              </div>
              <form className="add-chapter-form" onSubmit={(event) => { event.preventDefault(); addChapter(); }}>
                {getChapterGroups(activeSubject).length > 1 && (
                  <label className="field">
                    <span>Subsection</span>
                    <select
                      value={chapterSubsectionSelections[activeSubject.id] || getChapterGroups(activeSubject)[0]?.name || 'Other'}
                      onChange={(event) => setChapterSubsectionSelections((current) => ({
                        ...current,
                        [activeSubject.id]: event.target.value,
                      }))}
                    >
                      {getChapterGroups(activeSubject).map((group) => (
                        <option key={group.name} value={group.name}>{group.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>Add a chapter</span>
                  <input value={chapterName} onChange={(event) => setChapterName(event.target.value)} placeholder="Enter chapter name" maxLength={120} />
                </label>
                <button type="submit" className="primary-btn" disabled={!chapterName.trim()}>Add chapter</button>
              </form>
              <div className="chapter-import-row">
                <div>
                  <strong>Import chapters for {activeSubject.name}</strong>
                  <span>Upload a JSON chapter list. Existing chapter names are skipped.</span>
                  <code>["Chapter one", "Chapter two"]</code>
                </div>
                <label className="secondary-btn chapter-import-button">
                  Upload JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) importChapters(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
              {chapterImportStatus && <p className={`chapter-import-status ${chapterImportFailed ? 'failed' : ''}`} role={chapterImportFailed ? 'alert' : 'status'}>{chapterImportStatus}</p>}
            </>
          ) : (
            <div className="empty-state">Add a section to begin tracking a custom syllabus.</div>
          )}
        </section>
      </div>
      {studyViewer && (
        <Suspense fallback={<div className="study-viewer-overlay"><div className="study-viewer-message">Loading document viewer...</div></div>}>
          <StudyMaterialViewer
            file={studyViewer.file}
            taskLabel={studyViewer.taskLabel}
            studyTimeLabel={formatTime(getLiveSeconds(
              getExamChapters(tracker?.exams || []).find((chapter) => chapter.id === studyViewer.chapterId) || { seconds: 0 },
              now,
            ))}
            onClose={closeStudyMaterial}
          />
        </Suspense>
      )}
    </div>
  );
}
