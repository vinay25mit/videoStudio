export const TRACKING_ITEMS = [
  { id: 'mcq', label: 'Detailed MCQs' },
  { id: 'lucent', label: 'Lucent objective' },
  { id: 'previousYear', label: 'Previous year questions' },
];

export const CLASS_TRACKING_ITEMS = [
  { id: 'notes', label: 'Notes read' },
  { id: 'book', label: 'Book read' },
  { id: 'dpp', label: 'DPP questions' },
];

export const DEFAULT_CLASSES_PER_CHAPTER = 4;
export const SYLLABUS_STRUCTURE_VERSION = 5;

export function createDefaultClasses(chapterId) {
  return Array.from({ length: DEFAULT_CLASSES_PER_CHAPTER }, (_, index) => ({
    id: `${chapterId}-class-${index + 1}`,
    title: `Class ${index + 1}`,
    notes: '',
    completed: {},
    taskFiles: {},
  }));
}

const prelimsSubjects = [
  ['HISTORY', [
    ['Ancient History', ['Sources and prehistoric India', 'Indus Valley Civilization', 'Vedic age and religious movements', 'Mahajanapadas and the Mauryan Empire', 'Post-Mauryan India and the Gupta age']],
    ['Medieval History', ['Early medieval India and regional kingdoms', 'Delhi Sultanate', 'Mughal Empire and regional powers']],
    ['Modern History', ['European arrival and expansion', 'Revolt of 1857', 'Socio-religious reform movements', 'Indian national movement (1885-1919)', 'Gandhian era and freedom struggle', 'Bihar in the freedom movement']],
  ]],
  ['GEOGRAPHY', [
    ['Physical Geography', ['Earth, latitude, longitude and time', 'Geomorphology and landforms', 'Climatology and monsoon', 'Oceanography and resources']],
    ['Indian Geography', ['Indian physiography', 'Rivers, drainage and water resources of India', 'Indian climate, soils and natural vegetation', 'Agriculture and irrigation in India', 'Minerals, energy and industries', 'Population, migration and urbanisation']],
    ['Bihar Geography', ['Bihar physiography and river systems', 'Bihar climate, soils and agriculture', 'Bihar minerals, industries and transport']],
    ['Mapping', ['World map: continents, oceans and major physical features', 'India map: states, rivers, mountains, resources and important places', 'Bihar map: districts, rivers and important locations']],
  ]],
  ['POLITY', [
    ['Constitution and Rights', ['Constitutional development and making of the Constitution', 'Preamble, citizenship and salient features', 'Fundamental Rights, Duties and Directive Principles', 'Emergency provisions and important amendments']],
    ['Union Government', ['Union executive: President, Vice-President and Prime Minister', 'Parliament and legislative procedure', 'Supreme Court and judicial review']],
    ['State and Local Government', ['State government: Governor, Chief Minister and legislature', 'High Courts and subordinate judiciary', 'Local self-government and Panchayati Raj']],
    ['Governance and Elections', ['Federalism and Centre-State relations', 'Constitutional and statutory bodies', 'Elections, political parties and electoral reforms']],
  ]],
  ['ECONOMICS', [
    ['Economic Foundations', ['Basic concepts, national income and economic growth', 'Planning and development in India', 'Poverty, unemployment and inclusive growth']],
    ['Public Finance and Banking', ['Inflation, monetary policy and the RBI', 'Fiscal policy, taxation and the Union budget', 'Banking and financial institutions']],
    ['Sectors and Development', ['Agriculture, land reforms and food security', 'Industry, infrastructure and MSMEs', 'Trade, balance of payments and globalisation', 'Human development, health and education']],
    ['Bihar Economy', ['Bihar economy: sectors and development indicators', 'Bihar budget, public finance and flagship schemes']],
  ]],
  ['PHYSICS', [
    ['Mechanics', ['Units, measurements and motion', 'Force, work, energy and power', 'Gravitation and satellites']],
    ['Heat, Waves and Light', ['Heat, temperature and thermodynamics', 'Waves and sound', 'Light, reflection and refraction']],
    ['Electricity and Modern Physics', ['Electricity and circuits', 'Magnetism and electromagnetic effects', 'Modern physics, atoms and radioactivity']],
    ['Applied Physics', ['Everyday applications of physics']],
  ]],
  ['CHEMISTRY', [
    ['Matter and Atomic Structure', ['Matter, atoms and molecules', 'Elements, compounds and the periodic table', 'Chemical bonding and reactions']],
    ['Inorganic Chemistry', ['Acids, bases, salts and pH', 'Metals, non-metals and alloys']],
    ['Organic and Applied Chemistry', ['Carbon compounds and polymers', 'Fuels, combustion and petroleum', 'Chemistry in everyday life', 'Environmental chemistry and pollution']],
  ]],
  ['MATH', [
    ['Arithmetic', ['Number system, fractions and decimals', 'Ratio, proportion and partnership', 'Percentage, profit, loss and discount', 'Simple and compound interest', 'Average, mixture and allegation']],
    ['Work and Motion', ['Time, work and pipes', 'Speed, time and distance']],
    ['Algebra and Geometry', ['Algebra and basic equations', 'Geometry and mensuration']],
    ['Data and Statistics', ['Data interpretation, statistics and probability']],
  ]],
  ['BIO', [
    ['Cell and Human Biology', ['Cell structure and organisation', 'Human digestive and respiratory systems', 'Circulatory, excretory and nervous systems', 'Endocrine system, health and diseases', 'Nutrition, vitamins and deficiency disorders']],
    ['Plant and Animal Biology', ['Plant anatomy, physiology and reproduction', 'Animal diversity and classification']],
    ['Genetics and Environment', ['Genetics, heredity and evolution', 'Ecology, ecosystems and biodiversity', 'Biotechnology and applied biology']],
  ]],
  ['BIHAR SPECIAL', [
    ['Bihar: Land and People', ['Bihar: location, districts and administrative divisions', 'Physical geography, rivers and climate of Bihar', 'Population, society and human development in Bihar']],
    ['Bihar History and Culture', ['History of Bihar from ancient to modern times', 'Bihar and the Indian national movement', 'Art, architecture and heritage sites of Bihar', 'Languages, literature, fairs and festivals of Bihar']],
    ['Bihar Economy and Governance', ['Agriculture, irrigation and major crops of Bihar', 'Minerals, industries and infrastructure in Bihar', 'Government schemes and important institutions of Bihar']],
  ]],
  ['CURRENT AFFAIRS', [
    ['Year-round Topics', ['National current affairs', 'International current affairs', 'Bihar state current affairs', 'Government schemes and public policy', 'Economy, budget and reports', 'Science, technology and innovation', 'Environment, climate and conservation', 'Awards, honours, books and authors', 'Sports, appointments and important days']],
    ['Monthly Current Affairs', ['January current affairs', 'February current affairs', 'March current affairs', 'April current affairs', 'May current affairs', 'June current affairs', 'July current affairs', 'August current affairs', 'September current affairs', 'October current affairs', 'November current affairs', 'December current affairs']],
  ]],
  ['ART AND CULTURE', [
    ['Architecture and Visual Arts', ['Indian architecture: ancient, medieval and modern', 'Sculpture, painting and visual arts', 'UNESCO heritage and cultural institutions']],
    ['Performing Arts', ['Classical and folk music traditions', 'Classical and folk dances of India', 'Theatre, puppetry and cultural forms']],
    ['Traditions and Literature', ['Religions, philosophy and cultural traditions', 'Literature, languages and classical texts']],
    ['Bihar Art and Culture', ['Bihar art, Madhubani painting and folk traditions', 'Bihar festivals, fairs and cultural heritage']],
  ]],
];

const mainsSubjects = [
  ['GENERAL HINDI', [
    ['Language and Grammar', ['Hindi grammar and sentence structure', 'Vocabulary, synonyms and antonyms', 'Idioms, proverbs and usage']],
    ['Writing and Comprehension', ['Precis writing', 'Essay and paragraph writing', 'Letter and report writing', 'Comprehension and translation']],
  ]],
  ['GENERAL STUDIES PAPER I', [
    ['History and National Movement', ['Modern history of India and the national movement', 'Bihar history and the freedom movement']],
    ['Culture and Heritage', ['Indian culture, art and heritage', 'Bihar culture, literature and heritage']],
    ['Current Affairs and Analysis', ['Current events of national and international importance', 'Statistical analysis, graphs and diagrams']],
  ]],
  ['GENERAL STUDIES PAPER II', [
    ['Polity and Governance', ['Indian polity and the Constitution', 'Governance, transparency and accountability']],
    ['Economy and Geography', ['Indian and Bihar economy', 'Geography of India and Bihar']],
    ['Science, Environment and Reasoning', ['Science and technology in everyday life', 'Environment, ecology and disaster management', 'Logical reasoning and analytical ability']],
  ]],
  ['ESSAY', [
    ['Society and History', ['History and culture', 'Society and social justice']],
    ['Governance and Economy', ['Polity, governance and democracy', 'Economy, development and employment']],
    ['Science and Environment', ['Science, technology and innovation', 'Environment and sustainable development']],
    ['Bihar', ['Bihar-specific development themes']],
  ]],
];

function toSubjects(entries, examId) {
  return entries.map(([name, subsections]) => {
    const subjectId = `${examId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    let chapterIndex = 0;
    return {
      id: subjectId,
      name,
      chapters: subsections.flatMap(([subsection, chapters]) => chapters.map((chapter) => {
        chapterIndex += 1;
        const id = `${subjectId}-${chapterIndex}`;
        return {
          id,
          name: chapter,
          subsection,
          completed: {},
          seconds: 0,
          timerStartedAt: null,
          classes: createDefaultClasses(id),
        };
      })),
    };
  });
}

export function createInitialTracker() {
  return {
    syllabusStructureVersion: SYLLABUS_STRUCTURE_VERSION,
    globalStudySeconds: 0,
    globalTimerStartedAt: null,
    studySessions: [],
    exams: [
      { id: 'prelims', name: 'BPSC Prelims', subjects: toSubjects(prelimsSubjects, 'prelims') },
      { id: 'mains', name: 'BPSC Mains', subjects: toSubjects(mainsSubjects, 'mains') },
    ],
  };
}

export function migrateTrackerStructure(tracker) {
  if (tracker.syllabusStructureVersion >= SYLLABUS_STRUCTURE_VERSION) return tracker;
  const initial = createInitialTracker();
  const defaultSubjects = new Map(initial.exams.flatMap((exam) => exam.subjects.map((subject) => [subject.id, subject])));
  const exams = tracker.exams.map((exam) => ({
    ...exam,
    subjects: exam.subjects.map((subject) => {
      const defaultSubject = defaultSubjects.get(subject.id);
      const defaultsByName = new Map((defaultSubject?.chapters || []).map((chapter) => [chapter.name.toLocaleLowerCase(), chapter]));
      let chapters = subject.chapters.map((chapter) => {
        const { notes, ...chapterData } = chapter;
        let classes = Array.isArray(chapter.classes) && chapter.classes.length > 0
          ? chapter.classes
          : notes?.trim()
            ? [{ id: 'legacy-notes', title: 'Class 1', notes }]
            : [];
        if (classes.length === 0) {
          classes = [{ id: `${chapter.id}-class-1`, title: 'Class 1', notes: '' }];
        }
        const classOne = classes[0];
        const completed = { ...(chapter.completed || {}) };
        const classOneCompleted = { ...(classOne.completed || {}) };
        for (const taskId of ['notes', 'book', 'dpp']) {
          if (completed[taskId]) classOneCompleted[taskId] = true;
          delete completed[taskId];
        }
        const chapterTaskFiles = { ...(chapter.taskFiles || {}) };
        const classOneTaskFiles = { ...(classOne.taskFiles || {}) };
        for (const taskId of ['notes', 'dpp']) {
          if (chapterTaskFiles[taskId]?.length) {
            classOneTaskFiles[taskId] = [...(classOneTaskFiles[taskId] || []), ...chapterTaskFiles[taskId]];
          }
          delete chapterTaskFiles[taskId];
        }
        const migratedClasses = classes.map((noteClass, index) => ({
          ...noteClass,
          title: noteClass.title || `Class ${index + 1}`,
          completed: index === 0 ? classOneCompleted : { ...(noteClass.completed || {}) },
          taskFiles: index === 0 ? classOneTaskFiles : { ...(noteClass.taskFiles || {}) },
        }));
        for (let index = migratedClasses.length; index < DEFAULT_CLASSES_PER_CHAPTER; index += 1) {
          const number = index + 1;
          migratedClasses.push({
            id: `${chapter.id}-class-${number}`,
            title: `Class ${number}`,
            notes: '',
            completed: {},
            taskFiles: {},
          });
        }
        return {
          ...chapterData,
          completed,
          ...(Object.keys(chapterTaskFiles).length ? { taskFiles: chapterTaskFiles } : { taskFiles: undefined }),
          subsection: chapter.subsection || defaultsByName.get(chapter.name.toLocaleLowerCase())?.subsection || 'Other',
          classes: migratedClasses,
        };
      });
      if (subject.id === 'prelims-current-affairs' && defaultSubject) {
        const existingNames = new Set(chapters.map((chapter) => chapter.name.toLocaleLowerCase()));
        chapters = [
          ...chapters,
          ...defaultSubject.chapters
            .filter((chapter) => chapter.subsection === 'Monthly Current Affairs' && !existingNames.has(chapter.name.toLocaleLowerCase())),
        ];
      }
      return { ...subject, chapters };
    }),
  }));
  return {
    ...tracker,
    syllabusStructureVersion: SYLLABUS_STRUCTURE_VERSION,
    globalStudySeconds: Number.isFinite(tracker.globalStudySeconds) ? tracker.globalStudySeconds : 0,
    globalTimerStartedAt: tracker.globalTimerStartedAt || null,
    exams,
  };
}
