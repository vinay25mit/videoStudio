import fs from 'node:fs';

const W = 1191, H = 842;
const C = {
  ink: [0.10, 0.16, 0.23], muted: [0.34, 0.40, 0.48], line: [0.48, 0.56, 0.64],
  blue: [0.89, 0.94, 0.99], blueEdge: [0.17, 0.39, 0.62],
  green: [0.89, 0.96, 0.91], greenEdge: [0.18, 0.48, 0.30],
  amber: [1.00, 0.96, 0.84], amberEdge: [0.62, 0.43, 0.08],
  purple: [0.95, 0.91, 0.98], purpleEdge: [0.43, 0.29, 0.57],
  white: [1, 1, 1], pale: [0.965, 0.975, 0.985],
};
const pages = [];
let ops;
const num = (n) => Number(n.toFixed(2)).toString();
const color = (c) => c.map(num).join(' ');
function rect(x, y, w, h, fill, edge = C.line, radius = 12) {
  ops.push(`${color(fill)} rg ${color(edge)} RG 1.5 w`);
  const k = radius * 0.55228475;
  ops.push(`${num(x + radius)} ${num(y)} m ${num(x + w - radius)} ${num(y)} l ${num(x + w - radius + k)} ${num(y)} ${num(x + w)} ${num(y + radius - k)} ${num(x + w)} ${num(y + radius)} c ${num(x + w)} ${num(y + h - radius)} l ${num(x + w)} ${num(y + h - radius + k)} ${num(x + w - radius + k)} ${num(y + h)} ${num(x + w - radius)} ${num(y + h)} c ${num(x + radius)} ${num(y + h)} l ${num(x + radius - k)} ${num(y + h)} ${num(x)} ${num(y + h - radius + k)} ${num(x)} ${num(y + h - radius)} c ${num(x)} ${num(y + radius)} l ${num(x)} ${num(y + radius - k)} ${num(x + radius - k)} ${num(y)} ${num(x + radius)} ${num(y)} c B`);
}
function ellipse(x, y, w, h, fill, edge = C.line) {
  const k = 0.55228475, rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry;
  ops.push(`${color(fill)} rg ${color(edge)} RG 1.5 w`);
  ops.push(`${num(cx-rx)} ${num(cy)} m ${num(cx-rx)} ${num(cy+k*ry)} ${num(cx-k*rx)} ${num(cy+ry)} ${num(cx)} ${num(cy+ry)} c ${num(cx+k*rx)} ${num(cy+ry)} ${num(cx+rx)} ${num(cy+k*ry)} ${num(cx+rx)} ${num(cy)} c ${num(cx+rx)} ${num(cy-k*ry)} ${num(cx+k*rx)} ${num(cy-ry)} ${num(cx)} ${num(cy-ry)} c ${num(cx-k*rx)} ${num(cy-ry)} ${num(cx-rx)} ${num(cy-k*ry)} ${num(cx-rx)} ${num(cy)} c B`);
}
function line(x1, y1, x2, y2, edge = C.line, width = 1.7, dash = false) {
  ops.push(`${color(edge)} RG ${num(width)} w ${dash ? '[5 4] 0 d' : '[] 0 d'} ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S [] 0 d`);
}
function arrow(x1, y1, x2, y2, edge = C.blueEdge, width = 1.8, dash = false) {
  line(x1, y1, x2, y2, edge, width, dash);
  const a = Math.atan2(y2 - y1, x2 - x1), len = 9;
  const p1 = [x2 - len * Math.cos(a - Math.PI / 6), y2 - len * Math.sin(a - Math.PI / 6)];
  const p2 = [x2 - len * Math.cos(a + Math.PI / 6), y2 - len * Math.sin(a + Math.PI / 6)];
  ops.push(`${color(edge)} rg ${num(x2)} ${num(y2)} m ${num(p1[0])} ${num(p1[1])} l ${num(p2[0])} ${num(p2[1])} l h f`);
}
function text(x, y, value, size = 12, fill = C.ink, bold = false) {
  const safe = String(value).replace(/[^\x20-\x7E]/g, '-').replace(/[\\()]/g, (m) => `\\${m}`);
  ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${color(fill)} rg 1 0 0 1 ${num(x)} ${num(y)} Tm (${safe}) Tj ET`);
}
function centerText(cx, y, value, size = 12, fill = C.ink, bold = false) {
  const estimated = String(value).length * size * (bold ? 0.29 : 0.265);
  text(cx - estimated, y, value, size, fill, bold);
}
function box(x, y, w, h, title, lines, fill = C.blue, edge = C.blueEdge) {
  rect(x, y, w, h, fill, edge);
  centerText(x + w/2, y + h - 25, title, 14, edge, true);
  const start = y + h - 46;
  lines.forEach((s, i) => centerText(x + w/2, start - i * 17, s, 11, C.ink));
}
function label(x, y, value, fill = C.muted, size = 10) { text(x, y, value, size, fill, false); }
function begin(title, subtitle, pageNo) {
  ops = [];
  ops.push(`${color(C.white)} rg 0 0 ${W} ${H} re f`);
  text(42, 800, title, 23, C.ink, true);
  text(42, 779, subtitle, 10, C.muted);
  line(42, 762, W - 42, 762, [0.82, 0.86, 0.90], 1);
  text(42, 22, 'MCQ Video Studio | Data Flow Diagram | Derived from current repository implementation', 9, C.muted);
  text(W - 64, 22, String(pageNo), 9, C.muted);
}
function finish() { pages.push(ops.join('\n')); }

begin('Data Flow Diagram - System Context', 'Level 0 DFD | Main trust boundaries, external services, persisted data and generated artifacts', 1);
ellipse(62, 455, 170, 100, C.amber, C.amberEdge);
centerText(147, 512, 'P1  MCQ Studio user', 14, C.amberEdge, true);
centerText(147, 491, 'Creator / signed-in account', 10);
box(328, 424, 208, 158, 'P2  Web client', ['React SPA', 'Questions / sets', 'PPT, video, voice UI'], C.blue, C.blueEdge);
box(637, 424, 235, 158, 'P3  Main API', ['Express + JWT auth', 'CRUD + job orchestration', 'PPT / narration / video'], C.green, C.greenEdge);
rect(974, 574, 171, 92, C.pale, C.purpleEdge, 8);
centerText(1059, 637, 'D1  Core JSON store', 12, C.purpleEdge, true);
centerText(1059, 616, 'users, questions, sets', 10);
centerText(1059, 599, 'presentations, videos', 10);
rect(974, 430, 171, 104, C.pale, C.purpleEdge, 8);
centerText(1059, 505, 'D2  Local file store', 12, C.purpleEdge, true);
centerText(1059, 484, 'PPTX, MP4, SRT, JSON', 10);
centerText(1059, 467, 'voice WAV + temp assets', 10);
ellipse(658, 169, 198, 102, C.amber, C.amberEdge);
centerText(757, 228, 'E1  Edge TTS service', 13, C.amberEdge, true);
centerText(757, 207, 'Online neural narration', 10);
box(904, 166, 214, 113, 'P4  Voice service', ['FastAPI on loopback', 'XTTS v2, lazy-loaded'], C.purple, C.purpleEdge);
ellipse(366, 169, 177, 102, C.amber, C.amberEdge);
centerText(454, 228, 'E2  FFmpeg', 13, C.amberEdge, true);
centerText(454, 207, 'Local render / audio mux', 10);

arrow(232, 509, 328, 509, C.blueEdge); label(245, 523, 'UI actions / MCQ data');
arrow(328, 472, 232, 472, C.greenEdge); label(244, 453, 'results / assets');
arrow(536, 509, 637, 509, C.blueEdge); label(547, 523, 'HTTP + Bearer JWT');
arrow(637, 472, 536, 472, C.greenEdge); label(548, 453, 'JSON / job status');
arrow(872, 542, 974, 620, C.purpleEdge); label(887, 583, 'read/write records');
arrow(872, 473, 974, 482, C.purpleEdge); label(885, 491, 'assets + temp files');
arrow(729, 424, 751, 271, C.amberEdge); label(667, 344, 'text -> speech (default)');
arrow(837, 424, 960, 279, C.purpleEdge); label(842, 362, 'custom voice HTTP / WAV');
arrow(637, 432, 543, 267, C.amberEdge); label(535, 349, 'render command / media');
label(63, 106, 'Boundary notes:', C.ink, 11);
label(63, 86, '- The API scopes records and jobs to the authenticated user ID; JSON and assets are local to the server host.', C.muted, 10);
label(63, 68, '- Custom voice profiles are stored locally; the Python service reads the shared profile catalog and WAV files.', C.muted, 10);
label(63, 50, '- Edge TTS requires internet. FFmpeg and the optional XTTS service run beside the API in the local MVP.', C.muted, 10);
finish();

begin('Data Flow Diagram - Internal Processes', 'Level 1 DFD | Account data, presentation generation, asynchronous video job and custom voice synthesis', 2);
// Left: user inputs and data management
ellipse(47, 604, 132, 72, C.amber, C.amberEdge);
centerText(113, 646, 'Creator', 13, C.amberEdge, true);
centerText(113, 628, 'authenticated user', 9);
box(221, 581, 169, 113, 'P1  Auth + API', ['JWT validation', 'account ownership'], C.green, C.greenEdge);
box(439, 581, 176, 113, 'P2  MCQ / set', ['create / import', 'select question IDs'], C.blue, C.blueEdge);
rect(687, 594, 201, 89, C.pale, C.purpleEdge, 8);
centerText(787, 651, 'D1  data.json', 13, C.purpleEdge, true);
centerText(787, 631, 'users | questions | sets', 9);
centerText(787, 614, 'presentations | videos', 9);
arrow(179, 640, 221, 640); label(181, 655, 'credentials / requests', C.muted, 8);
arrow(390, 640, 439, 640); label(390, 655, 'authorized input', C.muted, 8);
arrow(615, 642, 687, 642, C.purpleEdge); label(617, 657, 'read / write records', C.muted, 8);
arrow(687, 615, 615, 615, C.purpleEdge); label(619, 598, 'owned questions', C.muted, 8);

// Main video flow
box(47, 362, 154, 124, 'P3  Generate request', ['title + MCQs', 'duration / language', 'selected voice'], C.blue, C.blueEdge);
box(257, 362, 179, 124, 'P4  Create job', ['validate request', 'jobId + queued state', 'in-process Map'], C.green, C.greenEdge);
box(492, 362, 184, 124, 'P5  Script builder', ['normalize MCQs', 'question / solution', 'segments + timings'], C.blue, C.blueEdge);
box(739, 362, 182, 124, 'P6  Speech synthesis', ['Edge / system TTS', 'or custom XTTS'], C.amber, C.amberEdge);
box(973, 362, 174, 124, 'P7  Render + mux', ['FFmpeg frames', 'mix audio / MP4'], C.green, C.greenEdge);
arrow(201, 423, 257, 423); label(203, 440, 'POST + JWT', C.muted, 8);
arrow(436, 423, 492, 423); label(438, 440, 'accepted payload', C.muted, 8);
arrow(676, 423, 739, 423); label(677, 440, 'speech segments', C.muted, 8);
arrow(921, 423, 973, 423); label(921, 440, 'WAV segments', C.muted, 8);

ellipse(47, 187, 169, 78, C.amber, C.amberEdge);
centerText(131, 231, 'E1  Edge TTS', 12, C.amberEdge, true);
centerText(131, 212, 'external network', 9);
box(280, 178, 190, 96, 'P8  FastAPI voice API', ['owner-scoped lookup', 'XTTS v2 inference'], C.purple, C.purpleEdge);
rect(529, 178, 196, 96, C.pale, C.purpleEdge, 8);
centerText(627, 237, 'D2  Voice catalog', 12, C.purpleEdge, true);
centerText(627, 217, 'voices.json + WAV samples', 9);
ellipse(810, 187, 153, 78, C.amber, C.amberEdge);
centerText(886, 231, 'E2  FFmpeg', 12, C.amberEdge, true);
centerText(886, 212, 'local binary', 9);
rect(1000, 169, 147, 112, C.pale, C.purpleEdge, 8);
centerText(1074, 248, 'D3  Video assets', 11, C.purpleEdge, true);
centerText(1074, 228, 'MP4 + SRT', 9);
centerText(1074, 211, 'metadata JSON', 9);
centerText(1074, 194, 'temporary files', 9);
arrow(798, 362, 196, 265, C.amberEdge); label(477, 309, 'Edge TTS request', C.muted, 9);
arrow(798, 362, 375, 274, C.purpleEdge); label(628, 294, 'custom voice request', C.muted, 9);
arrow(470, 222, 529, 222, C.purpleEdge); label(473, 238, 'profile lookup', C.muted, 8);
arrow(529, 197, 470, 197, C.purpleEdge); label(473, 181, 'reference WAVs', C.muted, 8);
arrow(973, 400, 963, 226, C.amberEdge); label(923, 314, 'render + audio mux', C.muted, 8);
arrow(1059, 362, 1072, 281, C.purpleEdge); label(1068, 318, 'final files', C.muted, 8);
// Job and outputs feedback at bottom
arrow(343, 362, 343, 328, C.greenEdge); label(352, 339, 'job status', C.muted, 8);
arrow(343, 328, 132, 328, C.greenEdge); label(178, 336, 'poll GET /api/jobs/:id', C.muted, 8);
arrow(1000, 197, 922, 197, C.purpleEdge); label(919, 180, 'persist artifact paths', C.muted, 8);
arrow(1000, 238, 888, 581, C.purpleEdge, 1.4, true); label(876, 531, 'save video record after success', C.muted, 8);
arrow(1074, 169, 113, 604, C.blueEdge, 1.2, true); label(56, 550, 'download MP4 / SRT / metadata', C.muted, 8);
label(47, 105, 'Legend:', C.ink, 10);
ellipse(112, 97, 24, 14, C.amber, C.amberEdge); label(142, 99, 'External actor/service', C.muted, 8);
rect(270, 96, 28, 15, C.blue, C.blueEdge, 3); label(306, 99, 'Process', C.muted, 8);
rect(378, 96, 28, 15, C.pale, C.purpleEdge, 3); label(414, 99, 'Data store', C.muted, 8);
arrow(518, 103, 552, 103, C.blueEdge, 1.2); label(559, 99, 'Data flow direction', C.muted, 8);
label(47, 77, 'Operational detail: POST /api/videos/generate returns HTTP 202; job progress is process-local and not durable across API restarts.', C.muted, 9);
finish();

const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const objects = [];
function obj(body) { objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, 'binary')); return objects.length; }
const catalogId = obj('');
const pagesId = obj('');
const font1 = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
const font2 = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
const pageIds = [];
for (const content of pages) {
  const stream = Buffer.from(content, 'binary');
  const streamId = obj(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'binary'), stream, Buffer.from('\nendstream', 'binary')]));
  const pageId = obj(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${streamId} 0 R >>`);
  pageIds.push(pageId);
}
objects[catalogId - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`, 'binary');
objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`, 'binary');

const chunks = [Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'binary')];
const offsets = [0];
let cursor = chunks[0].length;
objects.forEach((body, i) => {
  offsets.push(cursor);
  const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'binary'), body, Buffer.from('\nendobj\n', 'binary')]);
  chunks.push(chunk);
  cursor += chunk.length;
});
const xrefOffset = cursor;
let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`, 'binary'));
const output = new URL('../DATA_FLOW_DIAGRAM.pdf', import.meta.url);
fs.writeFileSync(output, Buffer.concat(chunks));
console.log(`Created ${output.pathname}`);
