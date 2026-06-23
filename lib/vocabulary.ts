import vocab from "../config/vocabulary.json";

export interface VocabEntry {
  term: string;
  category: string;
}

export function loadVocabulary(): VocabEntry[] {
  return vocab.terms as VocabEntry[];
}

export function vocabularyTerms(): string[] {
  return loadVocabulary().map((e) => e.term.toLowerCase());
}
