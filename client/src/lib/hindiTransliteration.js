const commonWords = {
  ram: 'राम', kal: 'कल', patna: 'पटना', gya: 'गया', gaya: 'गया', gayi: 'गई',
  namaste: 'नमस्ते', hindi: 'हिंदी', bharat: 'भारत', mera: 'मेरा', meri: 'मेरी',
  tum: 'तुम', aap: 'आप', main: 'मैं', mein: 'में', hai: 'है', hain: 'हैं', hoon: 'हूँ',
  kya: 'क्या', kyun: 'क्यों', kaise: 'कैसे', kaisa: 'कैसा', achha: 'अच्छा', accha: 'अच्छा',
  bahut: 'बहुत', nahi: 'नहीं', nahin: 'नहीं', aur: 'और', lekin: 'लेकिन', kyunki: 'क्योंकि',
  aaj: 'आज', kal: 'कल', subah: 'सुबह', shaam: 'शाम', raat: 'रात', ghar: 'घर',
  school: 'स्कूल', kitab: 'किताब', paani: 'पानी', pani: 'पानी', khana: 'खाना',
  jaana: 'जाना', jana: 'जाना', jao: 'जाओ', aana: 'आना', aaya: 'आया', aayi: 'आई',
  karo: 'करो', karna: 'करना', kiya: 'किया', kar: 'कर', raha: 'रहा', rahi: 'रही',
  rahe: 'रहे', tha: 'था', thi: 'थी', the: 'थे', hoga: 'होगा', hogi: 'होगी',
  dost: 'दोस्त', pyar: 'प्यार', prem: 'प्रेम', duniya: 'दुनिया', desh: 'देश',
  acchi: 'अच्छी', sundar: 'सुंदर', samay: 'समय', waqt: 'वक्त', baat: 'बात',
  likho: 'लिखो', dekho: 'देखो', suno: 'सुनो', bolo: 'बोलो', mujhe: 'मुझे',
  tumhe: 'तुम्हें', unhe: 'उन्हें', yeh: 'यह', ye: 'ये', woh: 'वह', wo: 'वो',
  kahan: 'कहाँ', yahan: 'यहाँ', wahan: 'वहाँ', abhi: 'अभी', phir: 'फिर',
  please: 'कृपया', dhanyavad: 'धन्यवाद', shukriya: 'शुक्रिया',
};

const consonants = [
  ['ksh', 'क्ष'], ['chh', 'छ'], ['tth', 'ट्ठ'], ['shh', 'ष'], ['kh', 'ख'], ['gh', 'घ'],
  ['ch', 'च'], ['jh', 'झ'], ['th', 'थ'], ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'],
  ['sh', 'श'], ['gy', 'ज्ञ'], ['ny', 'ञ'], ['ng', 'ङ'], ['jh', 'झ'],
  ['k', 'क'], ['g', 'ग'], ['c', 'क'], ['j', 'ज'], ['t', 'त'], ['d', 'द'], ['n', 'न'],
  ['p', 'प'], ['b', 'ब'], ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'],
  ['w', 'व'], ['s', 'स'], ['h', 'ह'], ['f', 'फ़'], ['q', 'क़'], ['z', 'ज़'],
];
const vowels = [
  ['aa', 'ा'], ['ii', 'ी'], ['ee', 'ी'], ['uu', 'ू'], ['oo', 'ू'], ['ai', 'ै'], ['au', 'ौ'],
  ['a', ''], ['i', 'ि'], ['e', 'े'], ['u', 'ु'], ['o', 'ो'],
];

export function transliterateHindiWord(input) {
  const word = input.toLocaleLowerCase();
  if (commonWords[word]) return commonWords[word];

  let output = '';
  let index = 0;
  while (index < word.length) {
    const vowel = vowels.find(([letters]) => word.startsWith(letters, index));
    if (vowel) {
      const independentVowels = { aa: String.fromCharCode(0x0906), ii: String.fromCharCode(0x0908), ee: String.fromCharCode(0x0908), uu: String.fromCharCode(0x090A), oo: String.fromCharCode(0x090A), ai: String.fromCharCode(0x0910), au: String.fromCharCode(0x0914), a: String.fromCharCode(0x0905), i: String.fromCharCode(0x0907), e: String.fromCharCode(0x090F), u: String.fromCharCode(0x0909), o: String.fromCharCode(0x0913) };
      output += output ? vowel[1] : independentVowels[vowel[0]];
      index += vowel[0].length;
      continue;
    }
    const consonant = consonants.find(([letters]) => word.startsWith(letters, index));
    if (!consonant) {
      output += word[index];
      index += 1;
      continue;
    }
    output += consonant[1];
    index += consonant[0].length;
    const nextVowel = vowels.find(([letters]) => word.startsWith(letters, index));
    if (nextVowel) {
      output += nextVowel[1];
      index += nextVowel[0].length;
    } else if (index < word.length && consonants.some(([letters]) => word.startsWith(letters, index))) {
      output += '्';
    }
  }
  return output || input;
}
