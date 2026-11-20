import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

function splitSpeechText(text, maxLength = 220) {
  const words = text.match(/\S+/g) || [];
  const chunks = [];
  let chunk = '';
  for (const word of words) {
    if (chunk && `${chunk} ${word}`.length > maxLength) {
      chunks.push(chunk);
      chunk = word;
    } else {
      chunk = chunk ? `${chunk} ${word}` : word;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

async function extractPowerPointSlides(buffer, JSZip) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((first, second) => Number(first.match(/slide(\d+)\.xml$/)[1]) - Number(second.match(/slide(\d+)\.xml$/)[1]));
  const slides = [];
  for (let index = 0; index < slideFiles.length; index += 1) {
    const xml = await zip.file(slideFiles[index]).async('string');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) {
      throw new Error('This PowerPoint file contains a slide that could not be read.');
    }
    const paragraphs = [...document.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p',
    )]
      .map((paragraph) => [...paragraph.getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/drawingml/2006/main',
        't',
      )].map((node) => node.textContent).join('').trim())
      .filter(Boolean);
    slides.push(paragraphs);
  }
  return slides;
}

export default function StudyMaterialViewer({ file, taskLabel, studyTimeLabel, onClose }) {
  const [documentState, setDocumentState] = useState({ status: 'loading', error: '', pdf: null, slides: [] });
  const [currentPage, setCurrentPage] = useState(1);
  const [slideCount, setSlideCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState('');
  const [speechState, setSpeechState] = useState('idle');
  const [speechProgress, setSpeechProgress] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [pageHasText, setPageHasText] = useState(null);
  const [pageWidth, setPageWidth] = useState(900);
  const viewerBodyRef = useRef(null);
  const pdfPageRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const pdfTextLayerRef = useRef(null);
  const pptCanvasRef = useRef(null);
  const pptViewerRef = useRef(null);
  const speechSequenceRef = useRef({ chunks: [], index: 0, voice: null });
  const isPptx = file.name.toLowerCase().endsWith('.pptx');
  const indianVoices = useMemo(
    () => voices.filter((voice) => /^(en|hi)-IN$/i.test(voice.lang)),
    [voices],
  );
  const selectedVoice = indianVoices.find((voice) => voice.voiceURI === selectedVoiceUri) || indianVoices[0];
  const totalPages = documentState.pdf?.numPages || 0;

  useEffect(() => {
    let active = true;
    let loadingTask;
    let pptViewer;
    async function loadDocument() {
      try {
        const response = await fetch(`/api/syllabus-tracker/files/${encodeURIComponent(file.id)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('mcq_token')}` },
        });
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.error?.message || 'Could not open this study file.');
        }
        const buffer = await response.arrayBuffer();
        if (!active) return;

        if (isPptx) {
          const [{ PPTXViewer }, { default: JSZip }] = await Promise.all([
            import('pptxviewjs'),
            import('jszip'),
          ]);
          const slides = await extractPowerPointSlides(buffer.slice(0), JSZip);
          pptViewer = new PPTXViewer({
            canvas: pptCanvasRef.current,
            enableThumbnails: false,
            slideSizeMode: 'fit',
            backgroundColor: '#ffffff',
          });
          pptViewerRef.current = pptViewer;
          await pptViewer.loadFile(buffer);
          await pptViewer.render(pptCanvasRef.current, { quality: 'high', scale: zoom });
          if (!active) return;
          setSlideCount(pptViewer.getSlideCount());
          setDocumentState({ status: 'ready', error: '', pdf: null, slides });
        } else {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
          const pdf = await loadingTask.promise;
          if (!active) return;
          setDocumentState({ status: 'ready', error: '', pdf, slides: [] });
        }
      } catch (error) {
        if (active) setDocumentState({ status: 'error', error: error.message || 'This file could not be previewed.', pdf: null, slides: [] });
      }
    }
    loadDocument();

    return () => {
      active = false;
      window.speechSynthesis?.cancel();
      pptViewer?.destroy();
      if (pptViewerRef.current === pptViewer) pptViewerRef.current = null;
      if (loadingTask) loadingTask.destroy();
    };
  }, [file.id, isPptx]);

  useEffect(() => {
    if (!documentState.pdf || !pdfCanvasRef.current) return undefined;
    let cancelled = false;
    let renderTask;
    let textLayer;
    async function renderPage() {
      const page = await documentState.pdf.getPage(currentPage);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, (pageWidth * zoom) / baseViewport.width);
      const viewport = page.getViewport({ scale });
      const pdfjsLib = await import('pdfjs-dist');
      const textContent = await page.getTextContent();
      if (cancelled) return;
      const pageElement = pdfPageRef.current;
      const textLayerElement = pdfTextLayerRef.current;
      const canvas = pdfCanvasRef.current;
      if (!pageElement || !textLayerElement || !canvas) return;
      pageElement.style.width = `${viewport.width}px`;
      pageElement.style.height = `${viewport.height}px`;
      textLayerElement.replaceChildren();
      textLayerElement.style.setProperty('--scale-factor', viewport.scale);
      textLayerElement.style.setProperty('--total-scale-factor', viewport.scale);
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      renderTask = page.render({ canvas, canvasContext: context, viewport });
      textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textLayerElement,
        viewport,
      });
      await Promise.all([renderTask.promise, textLayer.render()]);
      if (!cancelled) {
        setPageHasText(textLayer.textContentItemsStr.some((text) => text.trim()));
        setDocumentState((current) => current.error ? { ...current, error: '' } : current);
      }
    }
    renderPage().catch((error) => {
      if (!cancelled) setDocumentState((current) => ({ ...current, error: error.message || 'Could not render this PDF page.' }));
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [documentState.pdf, currentPage, zoom, pageWidth]);

  useEffect(() => {
    if (!isPptx || !pptViewerRef.current || !pptCanvasRef.current) return undefined;
    let active = true;
    pptViewerRef.current.goToSlide(currentPage - 1, pptCanvasRef.current)
      .then(() => pptViewerRef.current?.render(pptCanvasRef.current, { quality: 'high', scale: zoom }))
      .catch((error) => {
        if (active) setDocumentState((current) => ({ ...current, error: error.message || 'Could not render this PowerPoint slide.' }));
      });
    return () => { active = false; };
  }, [isPptx, currentPage, zoom]);

  useEffect(() => {
    const updateSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectedText('');
        return;
      }
      const range = selection.getRangeAt(0);
      const selectedContent = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
      if (selectedContent?.closest?.('.study-selectable-content')) {
        setSelectedText(selection.toString().replace(/\s+/g, ' ').trim());
      } else {
        setSelectedText('');
      }
    };
    document.addEventListener('selectionchange', updateSelection);
    return () => document.removeEventListener('selectionchange', updateSelection);
  }, []);

  useEffect(() => {
    setSelectedText('');
    setPageHasText(null);
    window.speechSynthesis?.cancel();
    setSpeechState('idle');
    setSpeechProgress('');
    setSpeechError('');
  }, [currentPage]);

  useEffect(() => {
    const container = viewerBodyRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver((entries) => {
      setPageWidth(Math.max(320, entries[0].contentRect.width - 36));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;
    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      setSelectedVoiceUri((current) => {
        if (current && available.some((voice) => voice.voiceURI === current && /^(en|hi)-IN$/i.test(voice.lang))) return current;
        return available.find((voice) => /^en-IN$/i.test(voice.lang))?.voiceURI
          || available.find((voice) => /^hi-IN$/i.test(voice.lang))?.voiceURI
          || '';
      });
    };
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
  }, []);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const renderSpeechChunk = useCallback((index) => {
    const sequence = speechSequenceRef.current;
    if (index >= sequence.chunks.length) {
      setSpeechState('idle');
      setSpeechProgress('');
      return;
    }
    sequence.index = index;
    setSpeechProgress(`${index + 1} of ${sequence.chunks.length}`);
    const utterance = new SpeechSynthesisUtterance(sequence.chunks[index]);
    utterance.voice = sequence.voice;
    utterance.lang = sequence.voice.lang;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => renderSpeechChunk(index + 1);
    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setSpeechState('idle');
        setSpeechError('Speech playback stopped. Try playing this material again.');
      }
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  function startReadAloud(text) {
    if (!('speechSynthesis' in window)) {
      setSpeechError('Read aloud is not supported by this browser.');
      return;
    }
    if (!selectedVoice) {
      setSpeechError('No Indian-accent voice is installed in this browser. Install an English (India) or Hindi (India) voice in your device settings to use read aloud.');
      return;
    }
    const chunks = splitSpeechText(text);
    if (chunks.length === 0) {
      setSpeechError('No selectable text was found in this file. Scanned pages may need OCR first.');
      return;
    }
    window.speechSynthesis.cancel();
    setSpeechError('');
    speechSequenceRef.current = { chunks, index: 0, voice: selectedVoice };
    setSpeechState('speaking');
    renderSpeechChunk(0);
  }

  function toggleSpeech() {
    if (speechState === 'speaking' && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setSpeechState('paused');
    } else if (speechState === 'paused') {
      window.speechSynthesis.resume();
      setSpeechState('speaking');
    }
  }

  function stopSpeech() {
    window.speechSynthesis?.cancel();
    setSpeechState('idle');
    setSpeechProgress('');
  }

  function changePage(nextPage) {
    setCurrentPage(Math.max(1, Math.min(isPptx ? slideCount : totalPages, nextPage)));
  }

  const hasSelectableText = isPptx
    ? (documentState.slides[currentPage - 1] || []).some((text) => text.trim())
    : pageHasText !== false;

  return (
    <div className="study-viewer-overlay" role="dialog" aria-modal="true" aria-label={`${file.name} viewer`} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="study-viewer">
        <header className="study-viewer-header">
          <div className="study-viewer-title">
            <span className="study-file-type">{isPptx ? 'PPTX' : 'PDF'}</span>
            <div><h2>{file.name}</h2><p>{taskLabel} · Focus mode · Select text to read aloud</p></div>
          </div>
          <div className="study-viewer-session-time" aria-live="off">
            <span>Chapter study time</span>
            <strong>{studyTimeLabel}</strong>
          </div>
          <button type="button" className="study-viewer-close" onClick={onClose} aria-label="Close document viewer">×</button>
        </header>

        {documentState.status === 'ready' && (
          <div className="study-viewer-toolbar">
            <div className="study-document-controls">
              <button type="button" className="outline-btn" onClick={() => changePage(currentPage - 1)} disabled={currentPage <= 1}>Previous</button>
              <span className="study-page-indicator">{isPptx ? 'Slide' : 'Page'} {currentPage} of {isPptx ? slideCount : totalPages}</span>
              <button type="button" className="outline-btn" onClick={() => changePage(currentPage + 1)} disabled={currentPage >= (isPptx ? slideCount : totalPages)}>Next</button>
            </div>
            <div className="study-zoom-controls">
              <button type="button" className="outline-btn" onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(1))))} aria-label="Zoom out" disabled={zoom <= 0.5}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" className="outline-btn" onClick={() => setZoom((value) => Math.min(2, Number((value + 0.1).toFixed(1))))} aria-label="Zoom in" disabled={zoom >= 2}>+</button>
            </div>
          </div>
        )}

        <main className="study-viewer-body" ref={viewerBodyRef}>
          {documentState.status === 'loading' && <div className="study-viewer-message">Opening your study material...</div>}
          {documentState.status === 'error' && <div className="error-message study-viewer-error" role="alert">{documentState.error}</div>}
          {documentState.status === 'ready' && documentState.error && <div className="error-message study-viewer-error" role="alert">{documentState.error}</div>}
          {documentState.status === 'ready' && !hasSelectableText && (
            <div className="study-viewer-message study-no-text" role="status">No selectable text was found on this {isPptx ? 'slide' : 'PDF'}. Scanned pages may need OCR first.</div>
          )}
          {(documentState.status === 'ready' || (documentState.status === 'loading' && isPptx)) && (
            <div className={`study-viewer-canvas-wrap ${isPptx ? 'presentation-layout' : ''}`}>
              {isPptx ? (
                <>
                  <div className="study-slide-frame">
                    <canvas ref={pptCanvasRef} className="study-pptx-canvas" />
                  </div>
                  <aside className="study-slide-text-panel">
                    <div className="study-slide-text-heading"><span>Slide {currentPage}</span><small>Select text to highlight and read</small></div>
                    <div className="study-pptx-transcript study-selectable-content">
                      {(documentState.slides[currentPage - 1] || []).map((paragraph, index) => <p key={`${currentPage}-${index}`}>{paragraph}</p>)}
                      {!(documentState.slides[currentPage - 1] || []).length && <p className="study-empty-transcript">This slide has no extractable text.</p>}
                    </div>
                  </aside>
                </>
              ) : (
                <div className="study-pdf-page" ref={pdfPageRef}>
                  <canvas ref={pdfCanvasRef} className="study-pdf-canvas" />
                  <div ref={pdfTextLayerRef} className="study-pdf-text-layer study-selectable-content" />
                </div>
              )}
            </div>
          )}
        </main>

        {documentState.status === 'ready' && (
          <footer className="study-viewer-footer">
            <div className="study-read-aloud">
              <div className="study-read-selection">
                <span className="study-selection-label">Selected text</span>
                <span className={`study-selection-preview ${selectedText ? 'has-selection' : ''}`} title={selectedText || 'Select text in the document'}>
                  {selectedText || 'Select or highlight text in the document'}
                </span>
              </div>
              {speechState === 'speaking' || speechState === 'paused' ? (
                <>
                  <button type="button" className="primary-btn" onClick={toggleSpeech}>{speechState === 'paused' ? 'Resume' : 'Pause'}</button>
                  <button type="button" className="outline-btn" onClick={stopSpeech}>Stop</button>
                  <span className="speech-progress">{speechState === 'paused' ? 'Paused' : 'Reading'} · {speechProgress}</span>
                </>
              ) : (
                <button type="button" className="primary-btn study-read-button" onClick={() => startReadAloud(selectedText)} disabled={!selectedText}>
                  Read highlighted text
                </button>
              )}
              <label className="study-voice-picker">
                <span>Voice</span>
                <select
                  value={selectedVoiceUri}
                  onChange={(event) => setSelectedVoiceUri(event.target.value)}
                  disabled={indianVoices.length === 0}
                >
                  {indianVoices.length === 0 && <option value="">No Indian voice installed</option>}
                  {indianVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
                </select>
              </label>
            </div>
            <div className="study-reader-footer-hint">
              <span>{selectedText ? `${selectedText.length.toLocaleString()} characters selected` : 'Drag across document text to highlight the passage you want to hear.'}</span>
              {indianVoices.length === 0 && <span>Install an English (India) or Hindi (India) voice in device settings for Indian-accent audio.</span>}
            </div>
            {speechError && <p className="study-speech-error" role="alert">{speechError}</p>}
          </footer>
        )}
      </section>
    </div>
  );
}
