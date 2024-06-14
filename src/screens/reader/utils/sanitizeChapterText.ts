import sanitizeHtml from 'sanitize-html';
import { textVide } from 'text-vide';

import { load as loadCheerio } from 'cheerio';
import { sourceManager } from './../../../sources/sourceManager';
import { LoadingImageSrc } from './LoadImage';
import { decodeHtmlEntity } from '../../../sources/helpers/htmlToText';

interface Options {
  removeExtraParagraphSpacing?: boolean;
  sourceId?: number;
  bionicReading?: boolean;
}

export const sanitizeChapterText = (
  html: string,
  options?: Options,
): string => {
  const isEPubSource = options?.sourceId === 0;
  let text = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'input',
      'i',
      'em',
      'b',
      'a',
      'center',
      ...(isEPubSource ? ['head', 'title', 'style'] : []),
    ]),
    allowedAttributes: {
      'img': ['src', 'class'],
      'a': ['href'],
      'input': ['type', 'offline'],
      ...(isEPubSource ? { '*': ['class'] } : {}),
    },
    allowedSchemes: ['data', 'http', 'https', 'file'],
    allowVulnerableTags: isEPubSource,
  });
  if (text) {
    if (options?.removeExtraParagraphSpacing) {
      text = text
        .replace(/Cum/, 'he’s invited us')
//↓ — 0 || performance anchors (symbol=♦)
.replace(/(^[^<]*(?:<input[^\>]+\>)?)\s*/, '$1♪')//♦start-chapter
//↓↓— 1
.replace(/\n+/g, '')
.replace(/<p id=\"spacer\">\s*<\/p>/g, '')
.replace(/(?<=$)/, '<p></p>')
//↑↑
///↓↓↓↓↓— 2
.replace(/[\u200B-\u200D\uFEFF]/g, '')//deletes zero-width spaces
.replace(/\&nbsp\;/g, ' ')//no-break-space; To make the characters in "&nbsp;" not interferee with other replacements.
.replace(/<p class=[^><]+>/g, '<p></p>')
.replace(/(?<=<\/?(?:p|h[1-9]|div|span(?!>\s+<(?:em|i)>))>)\s+/g, '')
.replace(/\s+(?=<\/?(?:p|h[1-9]|div|(?<=<\/)span)>)/g, '')
//↓
.replace(/<(em|span|[abi]|br|div)><\/\1>/g, '')
.replace(/(?<=<p>)<span>/g, '')
.replace(/<\/span>(?=<\/p>)/g, '')//<p><span>Haha</span></p>
//↑
.replace(/<br>(?=<\/?p>)/g, '')
///↑↑↑↑↑
//↓↓↓ —
.replace(/^\s*/, '<p></p>')
.replace(/<\/?div>/g, '<p></p>')
.replace(/<input type=\"(?:text|checkbox)\">/g, '')
.replace(/(?<!^)<p><\/p>(?!$)/g, '')//excessive <p>
.replace(/<a href=\"[^\"\>]+\">/g, '')
.replace(/(?<=<h[1-4]>)<span>([^]+?)?<\/span>/, '$1')
//↑↑↑

.replace(/(?:<br><\/?br>)+/g, '')
//↓↓↓↓↓ — masked letters
.replace(/[асᴄԁеһіјӏոоοօᴏрԛѕꜱսνᴠԝᴡхⅹуᴢАВСЕНІЈKМОРԚЅТԜХ]/g, (aa) => {
	const fakers = {
		а: 'a', с: 'c', ᴄ: 'c', ԁ: 'd', е: 'e', һ: 'h', і: 'i', ј: 'j', ӏ: 'l',
		ո: 'n', о: 'o', ο: 'o', օ: 'o', ᴏ: 'o', р: 'p', ԛ: 'q', ѕ: 's', ꜱ: 's',
		ս: 'u', ν: 'v', ᴠ: 'v', ᴡ: 'w', ԝ: 'w', х: 'x', ⅹ: 'x', у: 'y', ᴢ: 'ᴢ',
		А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', І: 'I', Ј: 'J', K: 'K', М: 'M',
		О: 'O', Р: 'P', Ԛ: 'Q', Ѕ: 'S', Т: 'T', Ԝ: 'W', Х: 'X'};
	return fakers[aa]})
//↑↑↑↑↑
//↓ — 2
.replace(/\.(?<=[a-zA-Z]\.)[a-z](?:\.[a-z])+/g, (_) => `${_.replace(/\./g, '')}`)//input: ``s.p.a.c.e.s.h.i.p`` —> output: ``spaceship``
//↑
//↓↓↓↓↓— 3
.replace(/(\d) ?(k?m)([2-9])\b/g, '$1 $2‡$3★')
.replace(/\bmeters?²/g, 'm²')
//↑↑↑↑↑
//↓↓↓—
.replace(/<sup>(\d)<\/sup>/g, '‡$1★')
.replace(/‡(\d)★/g, (_, a) => {
	const hdigg = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
	return hdigg[+a]})
//↑↑↑
//↓↓↓↓↓ — 
.replace(/\.(?<=\s\.)(\d\d+)/g, ' ✓+©.$1')//★↓
.replace(/\s([\.\,\;\:]+)(?<=(?:[¹²³⁴⁵⁶⁷⁸⁹]|\w+)\s\1)/g, '$1')//↑↓
.replace(/✓\+\©/g, '')//★↑
.replace(/([\.\,\:\!\?])(?<=[a-z\…]\1)(?=[A-Z]|\d(?<=,\d))/g, '$1 ')
.replace(/(?<=“\w+)\.”\.?/g, '”.')
.replace(/([\"“”])(?<!\=\")(?!>|\s[\"“”])([^\"“”]+)([\"”])(?<!=\")/g, '→→$1$2$3←←')
.replace(/\,([\"”](?=←←)|[\'’](?=\W))/g, '$1,')//comma
.replace(/(?:←←|→→)/g, '')
.replace(/, ?,/g, ', ')
.replace(/\,(?<=\D\,)(?=[^\s\d\”\’\,])/g, ', ')
.replace(/ ?[\,\.]\,/g, ', ')
.replace(/(<|\\?u003c)\1/g, '&lt;&lt;').replace(/(>|\\?u003e)\1/g, '&gt;&gt;')
.replace(/\'(?<=[A-Za-z]\')(?=[A-Za-z])/g, '’')
//↑↑↑↑↑
//↓↓
.replace(/”(?=(?:t|ll|s|d|m)\s)/g, '’')
.replace(/’ll\b(?<=‘(?:it?|you|s?he|we|they)’ll)/gi, ' will')
.replace(/’ve\b(?<=‘(?:i|you|we|they)’ve)/gi, ' have')
.replace(/’m\b(?<=‘(If )?\bI’m)/g, ' am')
//↑↑

//↓↓↓↓quotation marks => DOUBLE PRIME 
.replace(/“(?<=\bthe “)([\s\-\w’]+)([\!])?”/g, '″$1″$2')
.replace(/[”“\"](?<=\b\w+? [“\"])(\w+|[\?\!])[”\"]/g, '″$1″')
.replace(/“(?<=\b\w+ “)(\w+\s\w+)”(?= [a-z])/g, '″$1″')
.replace(/“(?<=\b[a-z]+ “)([a-z]+\s[a-z]+)”(?= [A-Za-z])/g, '″$1″')
.replace(/(?<=“\S[^\"”“<]+\s)“([\s\w’]+)”(?=\W[^\"”“<]*?”)/g, '″$1″')
.replace(/[“\"](?<=\b[a-z]+ [“\"])([a-z\s’]+(?<!’))[”\"]/g, '″$1″')
.replace(/\"(?<=\b(?:or|as|the|to) \")([A-Za-z’\s]+)\"/g, '″$1″')
//<p>The “ab bb” is fake.</p>
//“I saw the “Ack Bac aa”, it's great
//Go in "place" and...
//DOESNT WORK //<p>"It is so", Aina said, "he did say: "I didnt do it." to me."</p>
//Anastasia sneered; "Weren’t you busy "Crafting"?"
///↑↑↑↑
////↓↓↓↓↓ — 
.replace(/(?:‘|’(?<=\W’)(?!s?\s))([^\"”“\'’‘\<]+)(?:(?<!\s)‘|’(?![a-z]))/g, '‘$1’')//test-strings: ``Can’t u do the ’job’?``|||``‘He said ‘something’!’``|||``‘We don’t!’ They said on the Merfolk Pirates’ deck.``|||
.replace(/”(?<=[^\s\>\,]”)(?=\w)/g, '” ')
.replace(/”(?<=(?:<p>|, |”|\: ?|\. |–|—)”)/g, '“')
.replace(/“(?=<\/p>)/g, '”')
.replace(/’(?<=(?:<p>|, )’)/g, '‘')
.replace(/‘(?:<\/p>)/g, '’')
.replace(/’(?<![\s\w]’)(?=\w\w\w+)/g, '’ ')
.replace(/(?<=<p>|\: )[\"“][\"”“]/g, '“')
.replace(/(?: ([\”’])|([\“‘]) )/g, '$1$2')
.replace(/(?<=\w+[\?\!\.\…]+)((?!\"\")[\"”“][\"”“])(?=\w)/g, '∆∆$1')
.replace(/∆∆([\"”“])([\"”“])/g, '$1 $2')
.replace(/(?!\"\")[\"”“][\"”“]/g, '\"')
.replace(/“(?<=[^\s\>]“)/g, ' “')
.replace(/(“[^\"”“<>\—\–]+[\—\–]) \“(?=\S)/, '$1” ')
//↓simulation to check the pairs
.replace(/([\"“”](?<!\=\")(?! offline\=\")(?:[^\"“”<]+?)(?:<br>[^\"“”<]+)?([\"”]|“(?=\S)))/g, '∅¢$1∅¢')
.replace(/∅¢[\"“”](\,)?\s/g, '$1 \“')
.replace(/(?<=\"∅¢)(?=[A-Za-z])/g, ' ')
.replace(/\s(?<=[^\,]\s)[\"“”]∅¢/g, '\”©© ')
.replace(/∅¢/g, '')
//↑
.replace(/”(?<=[^\>\,]”)(?=\w)/g, '” ')
//test-strings:
//AAAAAAAAAAAA↓↓
//||“With this I’m immune to it,“ Leylin nodded.||
//||<p>“Neela’s smiled, “I’ll serve my king!”</p>||
//||Bob sat down. ”Good!”||
//||<p>“To Victory! “To Victory!” “Long Live Stewart!” “Long Live Stewart!”.</p>||

////↑↑↑↑↑
//↓↓↓↓↓↓↓ excessive space — **don't put `.replace`(ments) that add 2+ spaces consecutively above this line**
.replace(/\s\s+/g, ' ')//faster than /\s{2,}/
//↑↑↑↑↑↑↑
//↓↓↓ — 
.replace(/ ?(\?+)(?: ?(\!))?/g, '$1$2')
.replace(/ \!(?<=\w+ \!)/g, '!')
.replace(/(?<=[\?\!])\./g, '')
//↑↑↑
//↓↓↓↓↓↓ — italics
.replace(/<(\/)?em>/g, '<$1♠♠>')
.replace(/<(\/)?i>/g, '<$1♠>')
.replace(/\s?<(♠+)>(?<=[^<>“]\s?<♠+>)\s?/g, ' <$1>')//thin space
.replace(/<\/(♠+)>\s+/g, '</$1>  ')//thin+hair space > normal space
.replace(/(<\/♠+>\s+)([\!\?\;\.\:\,]+)/g, '$2$1')
.replace(/<\/(♠+)>\s+(?=[’‘”“])/g, '</$1>  ')//sixth+thin space
.replace(/♠♠>/g, 'em>')
.replace(/♠>/g, 'i>')
//↑↑↑↑↑↑
.replace(/:(?<=\w\:)(?=[^\s\d\/])/g, ': ')
///↓↓↓↓ — three dots
.replace(/(?:\. ?…|…\.\.)/g, '….')
.replace(/ ?(?:\.\.\.|…|(?<!\. )\. \. \.(?! \.)) ?/g, '…')
.replace(/…(?<=\w…)…?\.?(\w)/g, '…⅞⅘ $1')//thin space
.replace(/⅞⅘(?:\s([TYVW]))/g, ' $1').replace(/⅞⅘/g, '')
.replace(/…(?<!\w…)…?\s(?=\w)/g, '…')
.replace(/…(?<=[^’](\b\w+)…)…?\s(\1)\B/gi, '…$1')//Bo…Bobby!!
//↓exceptions
.replace(/…(?<=So…)(?=Some\b)/, '… ')
.replace(/…(?<=No…)(?=Not\b)/, '… ')
//↑
.replace(/…(?<=\b(\w+)…)…?\s(\1)\b/g, '… $1')//sixth space
.replace(/…(?<=[^\s\w\…\"“‘\'\>\%]…)…?(?![\<\'\"’”\|])/g, ' …')
.replace(/…\.(?<=[\s“]…\.)\s/g, '…')
.replace(/…(?=[AJ])/g, '… ')//hair-s
.replace(/…([a-zA-Z][a-zA-Z\s]{1,20})…/g, '‥$1…')
.replace(/\bI…I(?=[A-Za-z])/g, 'I-I')
///↑↑↑↑
//↓↓ — two dots  => [\u2025] ‥
.replace(/\.(?<!\.\.)\.(?!\.)/g, '‥')
//↑↑
////↓↓↓↓↓
//’d => had
.replace(/’d\b(?<=\b[A-Za-z]+’d)\s(?=(?:(?:all|al(?:most|ready|so|ways)|completely|certainly|decisively|eve[nr]|evidently|easily|first|just|(?:actu|addition|basic|fin|initi|natur|origin|person|successf)[au]lly|never|not|only|previously|still|slowly|suddenly|then|long since)\s)?([a-z]+ed(?<!(?:e|\b[^])ed)|[bs]een|(?:br|f|th)ought|built|began|chosen|caught|drawn|[dg]one|found|felt|forgotten|fallen|gotten|got|given|grown|held|heard|kept|known|led|left|learnt|lost|made|met|now|obviously|paid|sp?ent|said|sunk|shown|smelt|taken|thrown|understood|woken|won)\b)/g, ' had ')
.replace(/’d(?<=\b[A-Za-z]+’d)\s(?=(?:(?:all|al(?:most|ready|so|ways)|completely|certainly|eve[nr]|evidently|easily|first|just|(?:actu|addition|basic|fin|initi|natur|origin|person|successf)[au]lly|never|not|only|previously|still|slowly|suddenly|then|long since)\s)?(?:had\s))/g, ' had ')
//’s => has
.replace(/’s\b(?<=\b[A-Za-z]+’s)\s(?=(?:(?:all|al(?:most|ready|so|ways)|completely|certainly|eve[nr]|evidently|easily|first|just|(?:actu|addition|basic|fin|initi|natur|origin|person|successf)[au]lly|never|not|only|previously|still|slowly|suddenly|then|long since)\s)?(?:(?:exist|happen|remain)ed|been|become|began|got|had)\b(?=\s))/g, ' has ')
.replace(/’s\b(?<=\b[A-Za-z]+’s)\s(?=(?:[a-z]+ed(?<!(?:e|\b[^])ed)|[bs]een|(?:br|f|th)ought|built|began|chosen|caught|drawn|[dg]one|found|felt|forgotten|fallen|gotten|got|given|grown|held|heard|kept|known|led|left|learnt|lost|made|met|now|obviously|paid|sp?ent|said|sunk|shown|smelt|taken|thrown|understood|woken|won)\s(?:me|them|us|her|him)\b)/g, ' has ')
//||has given us – he has invited us||
////↑↑↑↑↑
//↓↓↓ — 
.replace(/(?<=\(|\[)\s/g, '')
.replace(/ (?=\)|\])/g, '')
.replace(/\((?<=\w\()(?!\d)/g, ' (')// [  case missing on purpose
.replace(/(?<=\)|\])(?=\w\w)/g, ' ')
//↑↑↑

.replace(/-(?<=\b[A-Z]\-)(Class|Rank|Cup|Shirt|Plan|Grade|Spot)/g, (_, a)=>`-${a.toLowerCase()}`)
//↓↓↓↓↓ \w to avoid "A grade" at the start of a phrase. Not applied to the beginning of phrases on purpose, even for B or C grade etc..
.replace(/\b([A-Z]) (?<=(\w+|[\,\%]) \b[A-Z] )([Gg]rade|[Rr]ank)\b/g, (_, a,b,c)=>`${a}-${c.toLowerCase()}`)
//↑↑↑↑↑

.replace(/([\,\?\!]|\.(?!(?:com|it|net)\b))(?<=\b\w\w+\1)(?=[A-Za-z])/g, '$1 ')
.replace(/(?<=<p>)H(ehe|aha)([^\<\"”“\>]+”)/g, '\“H$1$2')//On MTLs it has often “ missing.
.replace(/—(?<=\w—)(?=\w)/g, ' — ')//sixth spaces
//↓↓ — *
.replace(/\* ?([^\s”“\*]+) ?[\*\”] ?/g, '*$1* ')
.replace(/\*(?<=\>\*) /g, '*')
.replace(/\*(?<=\>\*)([^\*\<\,\?\"”“’‘]{2,18}?) \*/g, '*$1*')
//↑↑
//↓↓↓↓↓
.replace(/<\/p>(?<=[^\.]\w<\/p>)(?!<p>[a-z])/g, '.</p>')//Dot missing at the end of <p>
//↑↑↑↑↑
//↓↓↓ fix missing “ or ” on simple|short paragraphs
.replace(/(?<=<p>[\"”“](?:[\w’]+))((?:\s[\w’]+){0,2}?)([\!\?\…\.]*)(?=<\/p>)/g, '$1$2”')
.replace(/(?<=\<p>)([\w’]+)((?:\s[\w’]+){0,2}?)(?=[\!\?\…\.]*[\"”“]<\/p>)/g, '“$1$2')
.replace(/(?<=<p>)([A-Za-z’]+\,?)([a-zA-Z\s’]+)([\.\!\…\?]*)”/g, '“$1$2$3”')
.replace(/“(?<=(?:<p>|\, )“)((?:\s?[A-Za-z’]+){1,6}?)([\!\…\?\.]+)(?=<\/p>)/g, '“$1$2”')
.replace(/“(?<=\<p>“)(\w+\,(?:\s?[A-Za-z’]+){1,6}[\!\…\?\.]+)([^<>“”]+)\s?”©©\s?(?=[^<>”“]+”<\/)/g, '“$1”$2 “')
.replace(/©©/g, '')
//test: ||<p>“Mm, kakaa!" Bob nodded. “Bla bla’s. Blabla…”||
//↑↑↑
//↓↓↓↓↓↓↓ thousands separator— n ≤9999 excluded—
//↑↑↑↑↑↑↑ alternative separators:
//100𝃳000//100༌000//100΄000//100𑀀000//100ॱ000//100ᱸ000//100ʹ000//100՛000

//↓ give p to tagless 
.replace(/(?<=<\/p>)(?=[^<>]+<)/g, '<p>')
//↑

.replace(/♪/, '');
    }

    if (options?.bionicReading) {
      text = text.replace(/&([^;]+);/g, decodeHtmlEntity);
      text = textVide(text);
    }

    if (options?.sourceId && sourceManager(options.sourceId).headers) {
      // Some documents might take a few seconds to be parsed, only do when necessary
      const loadedCheerio = loadCheerio(text);
      if (loadedCheerio('input[offline]').length === 0) {
        loadedCheerio('img').each((i, element) => {
          const src = loadedCheerio(element).attr('src');
          if (src) {
            loadedCheerio(element).attr({
              'src': LoadingImageSrc,
              'class': 'load-icon',
              'delayed-src': src,
            });
          }
        });
        text = loadedCheerio('body').html() || text;
      }
    }
  } else {
    text =
      "Chapter is empty.\n\nReport on <a href='https://github.com/LNReader/lnreader-sources/issues/new/choose'>github</a> if it's available in webview.";
  }
  return text;
};
