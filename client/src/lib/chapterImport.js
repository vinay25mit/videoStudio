export function getImportedChapterNames(data, subjectName) {
  let chapters;
  if (Array.isArray(data)) {
    chapters = data;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.chapters)) {
      chapters = data.chapters;
    } else {
      const subjectEntries = data.subjects && typeof data.subjects === 'object' && !Array.isArray(data.subjects)
        ? data.subjects
        : data;
      const subjectKey = Object.keys(subjectEntries).find(
        (key) => key.trim().toLocaleLowerCase() === subjectName.trim().toLocaleLowerCase(),
      );
      chapters = subjectKey ? subjectEntries[subjectKey] : null;
    }
  }

  if (!Array.isArray(chapters) || chapters.length === 0 || chapters.length > 500) {
    throw new Error(`Use a JSON array of chapter names or an object with a "chapters" array for ${subjectName}. Include 1–500 chapters.`);
  }

  const names = chapters.map((chapter) => {
    const name = typeof chapter === 'string'
      ? chapter
      : chapter && typeof chapter === 'object'
        ? chapter.name ?? chapter.chapter ?? chapter.title
        : null;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) {
      throw new Error('Each chapter must be a non-empty name of 200 characters or fewer. No chapters were imported.');
    }
    return name.trim();
  });
  const uniqueNames = new Map();
  for (const name of names) {
    const key = name.toLocaleLowerCase();
    if (!uniqueNames.has(key)) uniqueNames.set(key, name);
  }
  return [...uniqueNames.values()];
}
