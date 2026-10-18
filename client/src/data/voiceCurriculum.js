export const voiceCurriculum = [
  {
    id: 'science', name: { en: 'Science', hi: 'विज्ञान' }, subsubjects: [
      { id: 'physics', name: { en: 'Physics', hi: 'भौतिक विज्ञान' }, topics: [
        ['motion', 'Motion and reference frames', 'गति और संदर्भ तंत्र'], ['force', 'Force and acceleration', 'बल और त्वरण'],
        ['work-energy', 'Work and energy', 'कार्य और ऊर्जा'], ['heat', 'Heat and temperature', 'ऊष्मा और तापमान'],
        ['light', 'Light, reflection, and refraction', 'प्रकाश, परावर्तन और अपवर्तन'], ['sound', 'Sound and vibration', 'ध्वनि और कंपन'],
        ['electricity', 'Electric circuits', 'विद्युत परिपथ'], ['magnetism', 'Magnets and magnetic fields', 'चुंबक और चुंबकीय क्षेत्र'],
      ] },
      { id: 'chemistry', name: { en: 'Chemistry', hi: 'रसायन विज्ञान' }, topics: [
        ['atoms', 'Atoms and molecules', 'परमाणु और अणु'], ['elements', 'Elements and compounds', 'तत्व और यौगिक'],
        ['mixtures', 'Mixtures and solutions', 'मिश्रण और विलयन'], ['changes', 'Physical and chemical changes', 'भौतिक और रासायनिक परिवर्तन'],
        ['acids-bases', 'Acids, bases, and indicators', 'अम्ल, क्षार और सूचक'], ['metals', 'Metals and non-metals', 'धातु और अधातु'],
        ['periodic-table', 'The periodic table', 'आवर्त सारणी'], ['reactions', 'Chemical reactions and evidence', 'रासायनिक अभिक्रियाएँ और प्रमाण'],
      ] },
      { id: 'biology', name: { en: 'Biology', hi: 'जीव विज्ञान' }, topics: [
        ['cells', 'Cells and organelles', 'कोशिकाएँ और कोशिकांग'], ['tissues', 'Tissues and organs', 'ऊतक और अंग'],
        ['digestion', 'Digestion and nutrition', 'पाचन और पोषण'], ['respiration', 'Respiration and gas exchange', 'श्वसन और गैसों का आदान-प्रदान'],
        ['circulation', 'Blood and circulation', 'रक्त और परिसंचरण'], ['ecosystems', 'Ecosystems and food webs', 'पारितंत्र और खाद्य जाल'],
        ['inheritance', 'Inheritance and variation', 'वंशागति और विविधता'], ['microorganisms', 'Microorganisms and health', 'सूक्ष्मजीव और स्वास्थ्य'],
      ] },
      { id: 'earth-space', name: { en: 'Earth and space', hi: 'पृथ्वी और अंतरिक्ष' }, topics: [
        ['solar-system', 'The solar system', 'सौर मंडल'], ['earth-layers', 'Layers of the Earth', 'पृथ्वी की परतें'],
        ['rocks', 'Rocks and minerals', 'चट्टानें और खनिज'], ['water-cycle', 'The water cycle', 'जल चक्र'],
        ['atmosphere', 'The atmosphere and weather', 'वायुमंडल और मौसम'], ['climate', 'Climate and climate patterns', 'जलवायु और जलवायु प्रतिरूप'],
        ['seasons', 'Seasons and the tilted Earth', 'ऋतुएँ और झुकी हुई पृथ्वी'], ['moon', 'The Moon and its phases', 'चंद्रमा और उसकी कलाएँ'],
      ] },
      { id: 'scientific-method', name: { en: 'Scientific method', hi: 'वैज्ञानिक विधि' }, topics: [
        ['observation', 'Observation and questions', 'अवलोकन और प्रश्न'], ['hypothesis', 'Hypotheses and predictions', 'परिकल्पना और पूर्वानुमान'],
        ['variables', 'Variables in an experiment', 'प्रयोग में चर'], ['experiments', 'Fair tests and experiments', 'निष्पक्ष परीक्षण और प्रयोग'],
        ['measurement', 'Measurement and SI units', 'मापन और एसआई मात्रक'], ['data-tables', 'Recording data in tables', 'तालिकाओं में आँकड़े दर्ज करना'],
        ['graphs', 'Reading scientific graphs', 'वैज्ञानिक आलेख पढ़ना'], ['evidence', 'Evidence and uncertainty', 'प्रमाण और अनिश्चितता'],
      ] },
    ],
  },
  {
    id: 'history', name: { en: 'History', hi: 'इतिहास' }, subsubjects: [
      { id: 'ancient-india', name: { en: 'Ancient India', hi: 'प्राचीन भारत' }, topics: [
        ['indus', 'Indus Valley cities', 'सिंधु घाटी के नगर'], ['early-farming', 'Early farming communities', 'प्रारंभिक कृषक समुदाय'],
        ['vedic-society', 'Vedic society and texts', 'वैदिक समाज और ग्रंथ'], ['mahajanapadas', 'The Mahajanapadas', 'महाजनपद'],
        ['mauryas', 'The Mauryan Empire', 'मौर्य साम्राज्य'], ['ashoka', 'Ashoka and his inscriptions', 'अशोक और उसके अभिलेख'],
        ['guptas', 'The Gupta period', 'गुप्त काल'], ['ancient-trade', 'Trade in the ancient world', 'प्राचीन विश्व में व्यापार'],
      ] },
      { id: 'medieval-india', name: { en: 'Medieval India', hi: 'मध्यकालीन भारत' }, topics: [
        ['regional-kingdoms', 'Regional kingdoms', 'क्षेत्रीय राज्य'], ['delhi-sultanate', 'The Delhi Sultanate', 'दिल्ली सल्तनत'],
        ['mughal-admin', 'Mughal administration', 'मुगल प्रशासन'], ['bhakti', 'The Bhakti traditions', 'भक्ति परंपराएँ'],
        ['sufi', 'Sufi traditions and communities', 'सूफी परंपराएँ और समुदाय'], ['medieval-agriculture', 'Agriculture and land revenue', 'कृषि और भूमि राजस्व'],
        ['medieval-architecture', 'Medieval architecture', 'मध्यकालीन स्थापत्य'], ['maritime-trade', 'Maritime trade routes', 'समुद्री व्यापार मार्ग'],
      ] },
      { id: 'modern-india', name: { en: 'Modern India', hi: 'आधुनिक भारत' }, topics: [
        ['1857', 'The uprising of 1857', '1857 का विद्रोह'], ['social-reform', 'Social reform movements', 'सामाजिक सुधार आंदोलन'],
        ['early-congress', 'The early national movement', 'प्रारंभिक राष्ट्रीय आंदोलन'], ['swadeshi', 'The Swadeshi movement', 'स्वदेशी आंदोलन'],
        ['noncooperation', 'The Non-Cooperation movement', 'असहयोग आंदोलन'], ['civil-disobedience', 'Civil Disobedience', 'सविनय अवज्ञा'],
        ['independence', 'The road to independence', 'स्वतंत्रता का मार्ग'], ['partition', 'Partition and its effects', 'विभाजन और उसके प्रभाव'],
      ] },
      { id: 'world-history', name: { en: 'World history', hi: 'विश्व इतिहास' }, topics: [
        ['renaissance', 'The Renaissance', 'पुनर्जागरण'], ['reformation', 'The Reformation', 'धर्म सुधार आंदोलन'],
        ['industrial-revolution', 'The Industrial Revolution', 'औद्योगिक क्रांति'], ['french-revolution', 'The French Revolution', 'फ्रांसीसी क्रांति'],
        ['american-revolution', 'The American Revolution', 'अमेरिकी क्रांति'], ['world-wars', 'The World Wars', 'विश्व युद्ध'],
        ['decolonization', 'Decolonization movements', 'उपनिवेशवाद का अंत'], ['cold-war', 'The Cold War', 'शीत युद्ध'],
      ] },
      { id: 'history-methods', name: { en: 'Historical methods', hi: 'ऐतिहासिक विधियाँ' }, topics: [
        ['chronology', 'Chronology and timelines', 'कालक्रम और समयरेखा'], ['primary-sources', 'Primary and secondary sources', 'प्राथमिक और द्वितीयक स्रोत'],
        ['oral-history', 'Oral history and memory', 'मौखिक इतिहास और स्मृति'], ['archaeology', 'Archaeology and excavation', 'पुरातत्व और उत्खनन'],
        ['coins', 'Coins as historical evidence', 'ऐतिहासिक प्रमाण के रूप में सिक्के'], ['archives', 'Archives and written records', 'अभिलेखागार और लिखित दस्तावेज़'],
        ['cause-effect', 'Cause and consequence', 'कारण और परिणाम'], ['continuity', 'Continuity and change', 'निरंतरता और परिवर्तन'],
      ] },
    ],
  },
  {
    id: 'geography', name: { en: 'Geography', hi: 'भूगोल' }, subsubjects: [
      { id: 'physical-geography', name: { en: 'Physical geography', hi: 'भौतिक भूगोल' }, topics: [
        ['landforms', 'Mountains, plateaus, and plains', 'पर्वत, पठार और मैदान'], ['rivers', 'Rivers and drainage basins', 'नदियाँ और अपवाह बेसिन'],
        ['coasts', 'Coasts and coastal processes', 'तट और तटीय प्रक्रियाएँ'], ['glaciers', 'Glaciers and ice landscapes', 'हिमनद और हिमानी स्थलरूप'],
        ['deserts', 'Deserts and dry regions', 'मरुस्थल और शुष्क क्षेत्र'], ['volcanoes', 'Volcanoes and lava', 'ज्वालामुखी और लावा'],
        ['earthquakes', 'Earthquakes and plate boundaries', 'भूकंप और प्लेट सीमाएँ'], ['soil-formation', 'Soil formation and layers', 'मिट्टी का निर्माण और परतें'],
      ] },
      { id: 'maps-gis', name: { en: 'Maps and GIS', hi: 'मानचित्र और जीआईएस' }, topics: [
        ['map-scale', 'Map scale and distance', 'मानचित्र का पैमाना और दूरी'], ['latitude', 'Latitude and parallels', 'अक्षांश और समानांतर रेखाएँ'],
        ['longitude', 'Longitude and meridians', 'देशांतर और याम्योत्तर रेखाएँ'], ['map-symbols', 'Map symbols and legends', 'मानचित्र के संकेत और सूची'],
        ['directions', 'Directions and orientation', 'दिशाएँ और अभिविन्यास'], ['time-zones', 'Time zones', 'समय क्षेत्र'],
        ['contours', 'Contour lines and elevation', 'समोच्च रेखाएँ और ऊँचाई'], ['gis', 'Geographic information systems', 'भौगोलिक सूचना प्रणाली'],
      ] },
      { id: 'india-geography', name: { en: 'Geography of India', hi: 'भारत का भूगोल' }, topics: [
        ['himalayas', 'The Himalayas', 'हिमालय'], ['northern-plains', 'The Northern Plains', 'उत्तरी मैदान'],
        ['peninsular-plateau', 'The Peninsular Plateau', 'प्रायद्वीपीय पठार'], ['indian-coasts', 'India’s coastal regions', 'भारत के तटीय क्षेत्र'],
        ['indian-monsoon', 'The Indian monsoon', 'भारतीय मानसून'], ['indian-rivers', 'Major river systems of India', 'भारत की प्रमुख नदी प्रणालियाँ'],
        ['indian-soils', 'Soil regions of India', 'भारत के मृदा क्षेत्र'], ['indian-minerals', 'Mineral resources of India', 'भारत के खनिज संसाधन'],
      ] },
      { id: 'population-settlement', name: { en: 'Population and settlement', hi: 'जनसंख्या और बस्ती' }, topics: [
        ['population-density', 'Population density', 'जनसंख्या घनत्व'], ['migration', 'Migration and movement', 'प्रवास और आवागमन'],
        ['urbanization', 'Urbanization', 'नगरीकरण'], ['rural-settlement', 'Rural settlements', 'ग्रामीण बस्तियाँ'],
        ['city-planning', 'City planning and land use', 'नगर नियोजन और भूमि उपयोग'], ['transport-networks', 'Transport networks', 'परिवहन नेटवर्क'],
        ['population-age', 'Age structure and population', 'आयु संरचना और जनसंख्या'], ['resources-people', 'Resources and communities', 'संसाधन और समुदाय'],
      ] },
      { id: 'environment-geography', name: { en: 'Environment and hazards', hi: 'पर्यावरण और आपदाएँ' }, topics: [
        ['ecosystems', 'Ecosystems and habitats', 'पारितंत्र और आवास'], ['biodiversity', 'Biodiversity', 'जैव विविधता'],
        ['water-resources', 'Water resources', 'जल संसाधन'], ['flood-risk', 'Flood risk and preparedness', 'बाढ़ का जोखिम और तैयारी'],
        ['drought', 'Drought and water stress', 'सूखा और जल संकट'], ['climate-change', 'Climate change', 'जलवायु परिवर्तन'],
        ['conservation', 'Conservation and protected areas', 'संरक्षण और संरक्षित क्षेत्र'], ['sustainable-cities', 'Sustainable cities', 'सतत नगर'],
      ] },
    ],
  },
  {
    id: 'polity', name: { en: 'Polity', hi: 'राजव्यवस्था' }, subsubjects: [
      { id: 'constitution', name: { en: 'Constitution', hi: 'संविधान' }, topics: [
        ['constitutional-history', 'Making of the Constitution', 'संविधान का निर्माण'], ['preamble', 'The Preamble', 'संविधान की प्रस्तावना'],
        ['citizenship', 'Citizenship', 'नागरिकता'], ['constitutional-amendment', 'Constitutional amendments', 'संवैधानिक संशोधन'],
        ['rule-of-law', 'Rule of law', 'कानून का शासन'], ['constitutional-bodies', 'Constitutional bodies', 'संवैधानिक संस्थाएँ'],
        ['emergency', 'Emergency provisions', 'आपातकालीन प्रावधान'], ['constitutional-values', 'Constitutional values', 'संवैधानिक मूल्य'],
      ] },
      { id: 'rights-duties', name: { en: 'Rights and duties', hi: 'अधिकार और कर्तव्य' }, topics: [
        ['equality-right', 'Right to equality', 'समानता का अधिकार'], ['freedom-right', 'Right to freedom', 'स्वतंत्रता का अधिकार'],
        ['religion-right', 'Freedom of religion', 'धर्म की स्वतंत्रता'], ['cultural-rights', 'Cultural and educational rights', 'सांस्कृतिक और शैक्षिक अधिकार'],
        ['constitutional-remedies', 'Constitutional remedies', 'संवैधानिक उपचार'], ['directive-principles', 'Directive Principles', 'राज्य के नीति निदेशक तत्व'],
        ['fundamental-duties', 'Fundamental duties', 'मौलिक कर्तव्य'], ['rights-limits', 'Rights and reasonable limits', 'अधिकार और उचित प्रतिबंध'],
      ] },
      { id: 'union-government', name: { en: 'Union government', hi: 'केंद्र सरकार' }, topics: [
        ['president', 'The President of India', 'भारत के राष्ट्रपति'], ['prime-minister', 'The Prime Minister', 'प्रधानमंत्री'],
        ['council-ministers', 'Council of Ministers', 'मंत्रिपरिषद'], ['lok-sabha', 'The Lok Sabha', 'लोकसभा'],
        ['rajya-sabha', 'The Rajya Sabha', 'राज्यसभा'], ['law-making', 'How a bill becomes law', 'विधेयक से कानून बनने की प्रक्रिया'],
        ['budget-parliament', 'The Union Budget in Parliament', 'संसद में केंद्रीय बजट'], ['parliament-committees', 'Parliamentary committees', 'संसदीय समितियाँ'],
      ] },
      { id: 'state-local', name: { en: 'State and local government', hi: 'राज्य और स्थानीय शासन' }, topics: [
        ['governor', 'The Governor', 'राज्यपाल'], ['chief-minister', 'The Chief Minister', 'मुख्यमंत्री'],
        ['state-legislature', 'State legislatures', 'राज्य विधानमंडल'], ['panchayati-raj', 'Panchayati Raj', 'पंचायती राज'],
        ['municipalities', 'Municipal government', 'नगरपालिका शासन'], ['local-finance', 'Local government finance', 'स्थानीय शासन का वित्त'],
        ['decentralization', 'Decentralization', 'विकेंद्रीकरण'], ['public-services', 'Local public services', 'स्थानीय सार्वजनिक सेवाएँ'],
      ] },
      { id: 'institutions-governance', name: { en: 'Institutions and governance', hi: 'संस्थाएँ और शासन' }, topics: [
        ['supreme-court', 'The Supreme Court', 'सर्वोच्च न्यायालय'], ['high-courts', 'High Courts', 'उच्च न्यायालय'],
        ['judicial-review', 'Judicial review', 'न्यायिक समीक्षा'], ['election-commission', 'Election Commission', 'निर्वाचन आयोग'],
        ['comptroller-auditor', 'Comptroller and Auditor General', 'नियंत्रक एवं महालेखा परीक्षक'], ['public-service-commission', 'Public Service Commissions', 'लोक सेवा आयोग'],
        ['federalism', 'Federalism and Centre-State relations', 'संघवाद और केंद्र-राज्य संबंध'], ['accountability', 'Transparency and accountability', 'पारदर्शिता और जवाबदेही'],
      ] },
    ],
  },
  {
    id: 'economics', name: { en: 'Economics', hi: 'अर्थशास्त्र' }, subsubjects: [
      { id: 'basic-concepts', name: { en: 'Basic concepts', hi: 'मूल अवधारणाएँ' }, topics: [
        ['scarcity', 'Scarcity and choice', 'कमी और चयन'], ['opportunity-cost', 'Opportunity cost', 'अवसर लागत'],
        ['demand', 'Demand', 'माँग'], ['supply', 'Supply', 'आपूर्ति'],
        ['market-price', 'Markets and prices', 'बाज़ार और कीमतें'], ['competition', 'Competition and market structure', 'प्रतिस्पर्धा और बाज़ार संरचना'],
        ['production', 'Production and productivity', 'उत्पादन और उत्पादकता'], ['division-labour', 'Division of labour', 'श्रम विभाजन'],
      ] },
      { id: 'money-banking', name: { en: 'Money and banking', hi: 'मुद्रा और बैंकिंग' }, topics: [
        ['functions-money', 'Functions of money', 'मुद्रा के कार्य'], ['commercial-banks', 'Commercial banks', 'वाणिज्यिक बैंक'],
        ['central-bank', 'The central bank', 'केंद्रीय बैंक'], ['credit-loans', 'Credit and loans', 'ऋण और उधार'],
        ['interest-rates', 'Interest rates', 'ब्याज दरें'], ['digital-payments', 'Digital payments', 'डिजिटल भुगतान'],
        ['financial-inclusion', 'Financial inclusion', 'वित्तीय समावेशन'], ['monetary-policy', 'Monetary policy', 'मौद्रिक नीति'],
      ] },
      { id: 'public-finance', name: { en: 'Public finance', hi: 'सार्वजनिक वित्त' }, topics: [
        ['government-revenue', 'Government revenue', 'सरकारी राजस्व'], ['taxation', 'Direct and indirect taxes', 'प्रत्यक्ष और अप्रत्यक्ष कर'],
        ['public-spending', 'Public expenditure', 'सार्वजनिक व्यय'], ['union-budget', 'The Union Budget', 'केंद्रीय बजट'],
        ['fiscal-deficit', 'Fiscal deficit', 'राजकोषीय घाटा'], ['public-debt', 'Public debt', 'सार्वजनिक ऋण'],
        ['subsidies', 'Subsidies and transfers', 'सब्सिडी और हस्तांतरण'], ['fiscal-policy', 'Fiscal policy', 'राजकोषीय नीति'],
      ] },
      { id: 'national-economy', name: { en: 'National economy', hi: 'राष्ट्रीय अर्थव्यवस्था' }, topics: [
        ['national-income', 'National income', 'राष्ट्रीय आय'], ['gdp', 'Gross domestic product', 'सकल घरेलू उत्पाद'],
        ['sectors', 'Primary, secondary, and tertiary sectors', 'प्राथमिक, द्वितीयक और तृतीयक क्षेत्र'], ['employment', 'Employment and unemployment', 'रोज़गार और बेरोज़गारी'],
        ['inflation', 'Inflation and price indices', 'मुद्रास्फीति और मूल्य सूचकांक'], ['economic-growth', 'Economic growth', 'आर्थिक वृद्धि'],
        ['business-cycles', 'Business cycles', 'व्यापार चक्र'], ['income-distribution', 'Income distribution', 'आय वितरण'],
      ] },
      { id: 'development-trade', name: { en: 'Development and trade', hi: 'विकास और व्यापार' }, topics: [
        ['human-development', 'Human development', 'मानव विकास'], ['poverty', 'Poverty and measurement', 'गरीबी और मापन'],
        ['rural-development', 'Rural development', 'ग्रामीण विकास'], ['agriculture-economy', 'Agriculture in the economy', 'अर्थव्यवस्था में कृषि'],
        ['industry', 'Industry and manufacturing', 'उद्योग और विनिर्माण'], ['international-trade', 'International trade', 'अंतरराष्ट्रीय व्यापार'],
        ['exchange-rates', 'Exchange rates', 'विनिमय दरें'], ['sustainable-development', 'Sustainable development', 'सतत विकास'],
      ] },
    ],
  },
  {
    id: 'mathematics', name: { en: 'Mathematics', hi: 'गणित' }, subsubjects: [
      { id: 'number-sense', name: { en: 'Number sense', hi: 'संख्या बोध' }, topics: [
        ['integers', 'Integers and number lines', 'पूर्णांक और संख्या रेखा'], ['fractions', 'Fractions', 'भिन्न'],
        ['decimals', 'Decimals', 'दशमलव'], ['factors-multiples', 'Factors and multiples', 'गुणनखंड और गुणज'],
        ['prime-numbers', 'Prime numbers', 'अभाज्य संख्याएँ'], ['squares-roots', 'Squares and square roots', 'वर्ग और वर्गमूल'],
        ['ratios', 'Ratios and rates', 'अनुपात और दर'], ['percentages', 'Percentages', 'प्रतिशत'],
      ] },
      { id: 'arithmetic', name: { en: 'Arithmetic', hi: 'अंकगणित' }, topics: [
        ['addition-subtraction', 'Addition and subtraction', 'जोड़ और घटाव'], ['multiplication', 'Multiplication strategies', 'गुणा की विधियाँ'],
        ['division', 'Division and remainders', 'भाग और शेषफल'], ['averages', 'Mean and average', 'माध्य और औसत'],
        ['profit-loss', 'Profit and loss', 'लाभ और हानि'], ['simple-interest', 'Simple interest', 'साधारण ब्याज'],
        ['compound-interest', 'Compound interest', 'चक्रवृद्धि ब्याज'], ['time-work', 'Time and work', 'समय और कार्य'],
      ] },
      { id: 'algebra', name: { en: 'Algebra', hi: 'बीजगणित' }, topics: [
        ['variables', 'Variables and expressions', 'चर और व्यंजक'], ['linear-equations', 'Linear equations', 'रैखिक समीकरण'],
        ['inequalities', 'Inequalities', 'असमानताएँ'], ['polynomials', 'Polynomials', 'बहुपद'],
        ['identities', 'Algebraic identities', 'बीजीय सर्वसमिकाएँ'], ['sequences', 'Sequences and patterns', 'श्रेणियाँ और प्रतिरूप'],
        ['coordinates', 'Coordinate plane', 'निर्देशांक तल'], ['functions', 'Functions and graphs', 'फलन और आलेख'],
      ] },
      { id: 'geometry-measurement', name: { en: 'Geometry and measurement', hi: 'ज्यामिति और मापन' }, topics: [
        ['angles', 'Angles and lines', 'कोण और रेखाएँ'], ['triangles', 'Triangles', 'त्रिभुज'],
        ['quadrilaterals', 'Quadrilaterals', 'चतुर्भुज'], ['circles', 'Circles and arcs', 'वृत्त और चाप'],
        ['perimeter', 'Perimeter', 'परिमाप'], ['area', 'Area of plane shapes', 'समतलीय आकृतियों का क्षेत्रफल'],
        ['volume', 'Volume and capacity', 'आयतन और धारिता'], ['transformations', 'Geometric transformations', 'ज्यामितीय रूपांतरण'],
      ] },
      { id: 'data-probability', name: { en: 'Data and probability', hi: 'आँकड़े और प्रायिकता' }, topics: [
        ['data-collection', 'Collecting and organizing data', 'आँकड़े एकत्र और व्यवस्थित करना'], ['tables', 'Tables and frequency', 'तालिकाएँ और बारंबारता'],
        ['bar-graphs', 'Bar graphs', 'दंड आलेख'], ['line-graphs', 'Line graphs', 'रेखा आलेख'],
        ['median-mode', 'Median and mode', 'माध्यिका और बहुलक'], ['range', 'Range and spread', 'परास और फैलाव'],
        ['probability', 'Basic probability', 'प्रारंभिक प्रायिकता'], ['counting', 'Counting outcomes', 'परिणामों की गणना'],
      ] },
    ],
  },
  {
    id: 'current-affairs', name: { en: 'Current affairs', hi: 'समसामयिकी' }, subsubjects: [
      { id: 'governance', name: { en: 'Governance', hi: 'शासन' }, topics: [
        ['government-policy', 'Government policies', 'सरकारी नीतियाँ'], ['parliament-news', 'Parliament and legislation', 'संसद और कानून निर्माण'],
        ['public-programmes', 'Public programmes', 'सार्वजनिक कार्यक्रम'], ['elections', 'Elections and representation', 'चुनाव और प्रतिनिधित्व'],
        ['court-decisions', 'Important court decisions', 'महत्वपूर्ण न्यायिक फैसले'], ['local-governance-news', 'Local governance', 'स्थानीय शासन'],
        ['public-reports', 'Public reports and findings', 'सार्वजनिक रिपोर्ट और निष्कर्ष'], ['citizen-services', 'Citizen services', 'नागरिक सेवाएँ'],
      ] },
      { id: 'economy-news', name: { en: 'Economy', hi: 'अर्थव्यवस्था' }, topics: [
        ['economic-indicators', 'Economic indicators', 'आर्थिक संकेतक'], ['jobs-news', 'Jobs and employment', 'नौकरियाँ और रोज़गार'],
        ['prices-news', 'Prices and household costs', 'कीमतें और घरेलू खर्च'], ['banking-news', 'Banking and finance updates', 'बैंकिंग और वित्त की खबरें'],
        ['trade-news', 'Trade and industry', 'व्यापार और उद्योग'], ['budget-news', 'Budget announcements', 'बजट घोषणाएँ'],
        ['agriculture-news', 'Agriculture and rural economy', 'कृषि और ग्रामीण अर्थव्यवस्था'], ['development-news', 'Development projects', 'विकास परियोजनाएँ'],
      ] },
      { id: 'science-technology-news', name: { en: 'Science and technology', hi: 'विज्ञान और प्रौद्योगिकी' }, topics: [
        ['space-missions', 'Space missions', 'अंतरिक्ष अभियान'], ['health-research', 'Health research', 'स्वास्थ्य अनुसंधान'],
        ['digital-services', 'Digital public services', 'डिजिटल सार्वजनिक सेवाएँ'], ['artificial-intelligence', 'Artificial intelligence', 'कृत्रिम बुद्धिमत्ता'],
        ['communication-tech', 'Communication technology', 'संचार प्रौद्योगिकी'], ['energy-technology', 'Energy technology', 'ऊर्जा प्रौद्योगिकी'],
        ['scientific-discovery', 'Scientific discoveries', 'वैज्ञानिक खोजें'], ['cyber-safety', 'Cyber safety', 'साइबर सुरक्षा'],
      ] },
      { id: 'environment-news', name: { en: 'Environment', hi: 'पर्यावरण' }, topics: [
        ['climate-policy', 'Climate policy', 'जलवायु नीति'], ['weather-events', 'Major weather events', 'प्रमुख मौसमी घटनाएँ'],
        ['wildlife-news', 'Wildlife and conservation', 'वन्यजीव और संरक्षण'], ['pollution-news', 'Air and water quality', 'वायु और जल गुणवत्ता'],
        ['renewable-energy', 'Renewable energy', 'नवीकरणीय ऊर्जा'], ['environment-agreements', 'Environmental agreements', 'पर्यावरणीय समझौते'],
        ['disaster-response', 'Disaster response', 'आपदा प्रतिक्रिया'], ['sustainable-living', 'Sustainable living', 'सतत जीवनशैली'],
      ] },
      { id: 'world-society', name: { en: 'World, society, and culture', hi: 'विश्व, समाज और संस्कृति' }, topics: [
        ['international-relations', 'International relations', 'अंतरराष्ट्रीय संबंध'], ['global-organizations', 'International organizations', 'अंतरराष्ट्रीय संगठन'],
        ['diplomacy', 'Diplomacy and agreements', 'कूटनीति और समझौते'], ['education-news', 'Education developments', 'शिक्षा से जुड़े विकास'],
        ['public-health-news', 'Public health', 'जन स्वास्थ्य'], ['awards', 'Major awards and honours', 'प्रमुख पुरस्कार और सम्मान'],
        ['sports', 'Sports events', 'खेल आयोजन'], ['culture-heritage', 'Culture and heritage', 'संस्कृति और विरासत'],
      ] },
    ],
  },
];

const subjectVocabulary = {
  science: {
    en: 'observe, measure, compare, test, evidence, energy, matter, result',
    hi: 'अवलोकन, मापन, तुलना, परीक्षण, प्रमाण, ऊर्जा, पदार्थ और परिणाम',
  },
  history: {
    en: 'source, event, date, evidence, change, community, cause, consequence',
    hi: 'स्रोत, घटना, तारीख, प्रमाण, बदलाव, समुदाय, कारण और परिणाम',
  },
  geography: {
    en: 'place, map, region, river, climate, distance, resource, environment',
    hi: 'स्थान, नक्शा, क्षेत्र, नदी, जलवायु, दूरी, संसाधन और पर्यावरण',
  },
  polity: {
    en: 'citizen, right, law, government, institution, vote, duty, public',
    hi: 'नागरिक, अधिकार, कानून, सरकार, संस्था, मतदान, कर्तव्य और जनता',
  },
  economics: {
    en: 'money, price, market, income, cost, budget, saving, choice',
    hi: 'पैसा, कीमत, बाज़ार, आय, लागत, बजट, बचत और चुनाव',
  },
  mathematics: {
    en: 'number, value, pattern, measure, result, estimate, calculate, check',
    hi: 'संख्या, मान, प्रतिरूप, मापन, परिणाम, अनुमान, गणना और जाँच',
  },
  'current-affairs': {
    en: 'report, source, date, fact, public, policy, community, impact',
    hi: 'रिपोर्ट, स्रोत, तारीख, तथ्य, जनता, नीति, समुदाय और प्रभाव',
  },
};

export function buildCurriculumScript({ subjectId, subject, subsubject, topic, language }) {
  const vocabulary = subjectVocabulary[subjectId] || subjectVocabulary.science;
  if (language === 'hi-IN') {
    return [
      `आज का विषय ${topic.hi} है। यह ${subsubject.hi} का हिस्सा है और ${subject.hi} से जुड़ा है।`,
      `इस विषय के मुख्य शब्द हैं: ${topic.hi}। मैं इन शब्दों को साफ़ बोलूँगा और वाक्य में उनका संबंध बताऊँगा।`,
      `रोज़मर्रा की बातचीत में मैं पूछ सकता हूँ, “क्या आप ${topic.hi} को सरल शब्दों में समझा सकते हैं?”`,
      `इस विषय को समझने के लिए ${vocabulary.hi} जैसे शब्द उपयोगी होते हैं।`,
      'उदाहरण देखते समय मैं एक बात का वर्णन करूँगा, उसकी तुलना दूसरी बात से करूँगा और उसका कारण बताऊँगा।',
      'पहले मैं ध्यान से सुनूँगा, फिर प्रश्न पूछूँगा और अंत में अपने शब्दों में उत्तर समझाऊँगा।',
      'मैं हर पंक्ति स्वाभाविक गति से पढ़ूँगा, ज़रूरी शब्दों पर हल्का ज़ोर दूँगा और वाक्यों के बीच रुकूँगा।',
      `अंत में मैं ${topic.hi} का सार दोहराऊँगा और बताऊँगा कि यह ${subject.hi} में क्यों महत्वपूर्ण है।`,
    ].join('\n');
  }
  return [
    `Today I am reading about ${topic.en}. It belongs to ${subsubject.en}, within the subject of ${subject.en}.`,
    `The key words are ${topic.en}. I will pronounce the complete topic clearly and connect the words in a sentence.`,
    `In daily conversation, I might ask, “Could you explain ${topic.en} in a simple way?”`,
    `Words such as ${vocabulary.en} are useful when we talk about ${subject.en}.`,
    'For an example, I can describe one detail, compare it with another, and explain why it matters.',
    'First I listen carefully, next I ask a question, and then I explain the answer in my own words.',
    'I will read at a natural pace, stress important words lightly, and pause between complete thoughts.',
    `Finally, I will summarize ${topic.en} and explain why it matters within ${subject.en}.`,
  ].join('\n');
}