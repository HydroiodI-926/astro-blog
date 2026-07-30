import {
	getContentManifest,
	jsonManifestResponse,
} from "@utils/content-manifest-runtime";
import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = () => {
	return jsonManifestResponse(getContentManifest().latest);
};
