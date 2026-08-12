export type MasteryLevel = "unfamiliar" | "familiar" | "mastered";

export interface VocabularyProgressRecord {
	mastery: number;
	lastReviewedAt: string | null;
}

export interface VocabularyEntry {
	id: string;
	batchId: string;
	page: number;
	number: number;
	word: string;
	phonetic: string;
	meaning: string;
	sourceTruncated: boolean;
}

export interface VocabularyBatch {
	id: string;
	title: string;
	sourceFile: string;
	sourceHash: string;
	uploadedAt: string;
	pageCount: number;
	entryCount: number;
	expectedPageCounts: number[];
	sourceTruncatedCount: number;
}

export interface VocabularyMeta {
	title: string;
	updatedAt: string;
	batchCount: number;
	entryCount: number;
	sourceTruncatedCount: number;
}

export interface VocabularyRelationLink {
	word: string;
	inLibrary: boolean;
	entryIds: string[];
	source?: "oewn" | "wiktextract";
}

export interface VocabularyFamilyLink extends VocabularyRelationLink {
	relation: "派生词" | "词形变化" | "相关词";
	source: "wiktextract";
}

export interface VocabularySameRootLink extends VocabularyRelationLink {
	sharedRoots: string[];
	source: "wiktextract";
}

export interface VocabularySynonymGroup {
	senseId: string;
	partOfSpeech: string;
	definition: string;
	words: VocabularyRelationLink[];
	source: "oewn";
}

export interface VocabularyWordRelations {
	word: string;
	etymology: string;
	roots: string[];
	family: VocabularyFamilyLink[];
	sameRoot: VocabularySameRootLink[];
	synonymGroups: VocabularySynonymGroup[];
}

export interface VocabularyRelationData {
	schemaVersion: number;
	generatedAt: string;
	sources: Record<
		"oewn" | "wiktextract",
		{ name: string; license: string; url: string }
	>;
	meta: {
		wordCount: number;
		withEtymology: number;
		withFamily: number;
		withSameRoot: number;
		withSynonyms: number;
		unresolvedWords: Array<{ word: string; reason: string }>;
	};
	words: Record<string, VocabularyWordRelations>;
}

export interface VocabularyTrackerProps {
	entries: VocabularyEntry[];
	batches: VocabularyBatch[];
	meta: VocabularyMeta;
	reviewUnlockToken?: string;
}
