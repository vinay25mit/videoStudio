const iconPaths = {
  home: ['M3 10.5 12 3l9 7.5', 'M5.5 9.5V21h13V9.5', 'M9 21v-7h6v7'],
  questions: ['M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z', 'M4 17.5A2.5 2.5 0 0 1 6.5 15H20', 'M8 6h8', 'M8 10h8'],
  sets: ['M4 4h16v5H4z', 'M4 10h16v5H4z', 'M4 16h16v4H4z'],
  presentation: ['M3 4h18v13H3z', 'M12 17v4', 'M8 21h8', 'm9 10 2 2 4-4'],
  video: ['M3 5h13v14H3z', 'm16 10 5-3v10l-5-3z'],
  reels: ['M3 3h18v18H3z', 'M3 8h18', 'm8 3 4 5', 'm15 3 4 5', 'm10 13 5 3-5 3z'],
  microphone: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 11v1a7 7 0 0 1-14 0v-1', 'M12 19v3', 'M8 22h8'],
  narration: ['M4 10v4', 'M8 6v12', 'M12 3v18', 'M16 7v10', 'M20 10v4'],
  syllabus: ['M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z', 'M4 17.5A2.5 2.5 0 0 1 6.5 15H20', 'M8 7h8', 'M8 11h6'],
  logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6'],
  login: ['m14 7 5 5-5 5', 'M19 12H7', 'M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6'],
  plus: ['M12 5v14', 'M5 12h14'],
  upload: ['M12 16V4', 'm7 9 5-5 5 5', 'M4 20h16'],
  download: ['M12 4v12', 'm7 11 5 5 5-5', 'M4 20h16'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'm19 6-1 14H6L5 6', 'M10 11v5', 'M14 11v5'],
  edit: ['m15 5 4 4', 'M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16z', 'M13 7l4 4'],
  play: ['m8 5 12 7-12 7z'],
  sparkles: ['m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'm19 14 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z'],
  save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z', 'M17 21v-8H7v8', 'M7 3v5h8'],
  search: ['m20 20-4.5-4.5', 'M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  book: ['M3 4h18v16H3z', 'M8 4v16', 'M12 8h5', 'M12 12h5'],
  note: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  close: ['m18 6-12 12', 'm6 6 12 12'],
  timer: ['M10 2h4', 'M12 14l3-3', 'M12 14V9', 'M5.6 6.6 4 5', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z'],
  pause: ['M8 5v14', 'M16 5v14'],
  power: ['M12 2v10', 'M18.4 5.6a8 8 0 1 1-12.8 0'],
  news: ['M4 4h16v16H4z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  calendar: ['M4 5h16v16H4z', 'M8 3v4', 'M16 3v4', 'M4 10h16'],
};

export default function Icon({ name, size = 18, className = '' }) {
  const paths = iconPaths[name];
  if (!paths) return null;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}
