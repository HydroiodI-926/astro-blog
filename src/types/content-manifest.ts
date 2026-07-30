export interface ContentManifestSource {
	repository: string;
	branch: string;
	commit: string;
}

export interface ContentManifestAsset {
	type: "cover" | "image";
	source: string;
	sourcePath: string | null;
	target: string | null;
	url: string | null;
	external: boolean;
	exists: boolean | null;
}

export interface ContentManifestDocument {
	id: string;
	sourcePath: string;
	sourceUrl: string | null;
	contentHash: string;
	title: string;
	slug: string;
	url: string;
	date: string;
	lastmod: string;
	tags: string[];
	category: string;
	lang: string;
	draft: boolean;
	summary: string;
	assets: ContentManifestAsset[];
	publish: true;
}

export interface ContentManifestMetadata {
	schemaVersion: number;
	source: ContentManifestSource;
	generatedAt: string;
}

export interface ContentManifestSet {
	index: ContentManifestMetadata & {
		documentCount: number;
		excludedCount: number;
		latest: { url: string; limit: number };
		years: Array<{ year: number; count: number; url: string }>;
	};
	latest: ContentManifestMetadata & {
		limit: number;
		count: number;
		documents: ContentManifestDocument[];
	};
	yearly: Record<
		string,
		ContentManifestMetadata & {
			year: number;
			count: number;
			documents: ContentManifestDocument[];
		}
	>;
}
