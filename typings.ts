type IJSON = Record<string, any>;

type IQuerierSync = (word: string) => string[] | string;
type IQuerierAsync = (word: string) => Promise<string[] | string>;

/**
 * All HTML tags as a union type
 * @example
 * const tag: AllHTMLTags = 'div'; // 自动补全会显示所有可用的标签
 */
export type AllHTMLTags = keyof HTMLElementTagNameMap;

export type ILang = 'en-US' | 'zh-CN';

export type I18n = Record<
  ILang,
  {
    error: {
      noWord: string;
      // englishWordOnly: string;
      notFound: (word: string) => string;
    };
  }
>;

interface IDictResult {
  translation: string[];
  basic: IBasic;
  query: string;
  errorCode: number;
  web: IWeb[];
}

interface IWeb {
  value: string[];
  key: string;
}

interface IBasic {
  'us-phonetic': string;
  phonetic: string;
  'uk-phonetic': string;
  explains: string[];
}

/** Extracted from `window.__NUXT__` in page https://dict.youdao.com/result?word=silhouette&lang=en */
export type __NUXT__ = {
  data: IData[];
};

export interface IData {
  q: string;
  wordData: WordData;
  currentLe: CurrentLe;
  le: string;
}

interface CurrentLe {
  language: string;
  name: string;
}

interface WordData {
  web_trans: Webtrans;
  oxfordAdvanceHtml: OxfordAdvanceHtml;
  ee: Ee;
  blng_sents_part: Blngsentspart;
  collins_primary: Collinsprimary;
  auth_sents_part: Authsentspart;
  simple: Simple;
  expand_ec: Expandec;
  etym: Etym;
  phrs: Phrs;
  oxford: OxfordAdvanceHtml;
  special: Special;
  syno: Syno2;
  input: string;
  music_sents: Musicsents;
  collins: Collins;
  meta: Meta;
  webster: OxfordAdvanceHtml;
  le: string;
  wikipedia_digest: Wikipediadigest;
  lang: string;
  ec: Ec;
  oxfordAdvance: OxfordAdvanceHtml;
}

interface Ec {
  web_trans: string[];
  special: Special2[];
  source: Source;
  word: Word4;
}

interface Word4 {
  usphone: string;
  ukphone: string;
  ukspeech: string;
  trs: Tr5[];
  wfs: Wf2[];
  'return-phrase': string;
  usspeech: string;
}

interface Wf2 {
  wf: Wf;
}

interface Tr5 {
  pos?: string;
  tran: string;
}

interface Special2 {
  nat: string;
  major: string;
}

interface Wikipediadigest {
  summarys: Summary3[];
  source: Source;
}

interface Summary3 {
  summary: string;
  key: string;
}

interface Meta {
  input: string;
  guessLanguage: string;
  isHasSimpleDict: string;
  le: string;
  lang: string;
  dicts: string[];
}

interface Collins {
  collins_entries: Collinsentry[];
}

interface Collinsentry {
  entries: Entries;
  phonetic: string;
  basic_entries: Basicentries;
  headword: string;
  star: string;
}

interface Basicentries {
  basic_entry: Basicentry[];
}

interface Basicentry {
  cet: string;
  headword: string;
}

interface Entries {
  entry: Entry3[];
}

interface Entry3 {
  tran_entry: Tranentry[];
}

interface Tranentry {
  pos_entry: Posentry;
  exam_sents: Examsents;
  tran: string;
}

interface Examsents {
  sent: Sent3[];
}

interface Sent3 {
  chn_sent: string;
  eng_sent: string;
}

interface Posentry {
  pos: string;
  pos_tips: string;
}

interface Musicsents {
  sents_data: Sentsdatum[];
  more: boolean;
  word: string;
}

interface Sentsdatum {
  songName: string;
  lyricTranslation: string;
  singer: string;
  coverImg: string;
  supportCount: number;
  lyric: string;
  link: string;
  lyricList: LyricList[];
  id: string;
  songId: string;
  decryptedSongId: string;
  playUrl: string;
}

interface LyricList {
  duration: number;
  lyricTranslation: string;
  lyric: string;
  start: number;
}

interface Syno2 {
  synos: Syno[];
  word: string;
}

interface Syno {
  pos: string;
  ws: string[];
  tran: string;
}

interface Special {
  summary: Summary2;
  'co-add': string;
  total: string;
  entries: Entry2[];
}

interface Entry2 {
  entry: Entry;
}

interface Entry {
  major: string;
  trs: Tr4[];
  num: number;
}

interface Tr4 {
  tr: Tr3;
}

interface Tr3 {
  nat: string;
  chnSent?: string;
  cite: string;
  docTitle?: string;
  engSent?: string;
  url?: string;
}

interface Summary2 {
  sources: Sources;
  text: string;
}

interface Sources {
  source: Source2;
}

interface Source2 {
  site: string;
  url: string;
}

interface Phrs {
  word: string;
  phrs: Phr[];
}

interface Phr {
  headword: string;
  translation: string;
}

interface Etym {
  etyms: Etyms;
  word: string;
}

interface Etyms {
  zh: Zh[];
}

interface Zh {
  source: string;
  word: string;
  value: string;
  url: string;
  desc: string;
}

interface Expandec {
  'return-phrase': string;
  source: Source;
  word: Word3[];
}

interface Word3 {
  transList: TransList[];
  pos: string;
  wfs?: Wf[];
}

interface Wf {
  name: string;
  value: string;
}

interface TransList {
  content: Content;
  trans: string;
}

interface Content {
  detailPos: string;
  sents?: Sent2[];
}

interface Sent2 {
  sentOrig: string;
  sourceType: string;
  sentSpeech: string;
  sentTrans: string;
  source: string;
  usages?: Usage[];
}

interface Usage {
  phrase: string;
  phraseTrans: string;
}

interface Simple {
  query: string;
  word: Word2[];
}

interface Word2 {
  usphone: string;
  ukphone: string;
  ukspeech: string;
  'return-phrase': string;
  usspeech: string;
}

interface Authsentspart {
  'sentence-count': number;
  more: string;
  sent: Sent[];
}

interface Sent {
  score: number;
  speech: string;
  'speech-size': string;
  source: string;
  url: string;
  foreign: string;
}

interface Collinsprimary {
  words: Words;
  gramcat: Gramcat[];
}

interface Gramcat {
  audiourl: string;
  pronunciation: string;
  senses: Sense2[];
  partofspeech: string;
  audio: string;
  forms: Form[];
}

interface Form {
  form: string;
}

interface Sense2 {
  examples: Example[];
  definition: string;
  lang: string;
  word: string;
}

interface Example {
  sense: Sense;
  example: string;
}

interface Sense {
  lang: string;
  word: string;
}

interface Words {
  indexforms: string[];
  word: string;
}

interface Blngsentspart {
  'sentence-count': number;
  'sentence-pair': Sentencepair[];
  more: string;
  'trs-classify': Trsclassify[];
}

interface Trsclassify {
  proportion: string;
  tr: string;
}

interface Sentencepair {
  sentence: string;
  'sentence-eng': string;
  'sentence-translation': string;
  'speech-size': string;
  'aligned-words': Alignedwords;
  source?: string;
  url: string;
  'sentence-speech': string;
}

interface Alignedwords {
  src: Src;
  tran: Src;
}

interface Src {
  chars: Char[];
}

interface Char {
  '@s': string;
  '@e': string;
  aligns: Aligns;
  '@id': string;
}

interface Aligns {
  sc: Sc[];
  tc: Sc[];
}

interface Sc {
  '@id': string;
}

interface Ee {
  source: Source;
  word: Word;
}

interface Word {
  trs: Tr2[];
  phone: string;
  speech: string;
  'return-phrase': string;
}

interface Tr2 {
  pos: string;
  tr: Tr[];
}

interface Tr {
  tran: string;
}

interface Source {
  name: string;
  url: string;
}

interface OxfordAdvanceHtml {
  encryptedData: string;
}

interface Webtrans {
  'web-translation': Webtranslation[];
}

interface Webtranslation {
  '@same'?: string;
  key: string;
  'key-speech': string;
  trans: Tran[];
}

interface Tran {
  summary?: Summary;
  value: string;
  support?: number;
  url?: string;
}

interface Summary {
  line: string[];
}
