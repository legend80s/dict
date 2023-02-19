type IJSON = Record<string, any>;

type IQuerierSync = (word: string) => string[] | string
type IQuerierAsync = (word: string) => Promise<string[] | string>

type I18n = Record<ILang, {
  error: {
    noWord: string;
    englishWordOnly: string;
    notFound: string;
  };
}>

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
