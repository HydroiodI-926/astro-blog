import type { ContentManifestSet } from "@/types/content-manifest";
import { buildContentManifest } from "./content-manifest.js";

let productionManifest: ContentManifestSet | undefined;

export function getContentManifest(): ContentManifestSet {
	if (import.meta.env.DEV) {
		return buildContentManifest() as ContentManifestSet;
	}
	productionManifest ??= buildContentManifest() as ContentManifestSet;
	return productionManifest;
}

export function jsonManifestResponse(payload: unknown): Response {
	return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=300, must-revalidate",
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
}
