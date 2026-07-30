import {
	getContentManifest,
	jsonManifestResponse,
} from "@utils/content-manifest-runtime";
import type { APIRoute, GetStaticPaths } from "astro";

export const prerender = true;

export const getStaticPaths: GetStaticPaths = () => {
	return Object.entries(getContentManifest().yearly).map(
		([year, manifest]) => ({
			params: { year: `${year}.json` },
			props: { manifest },
		}),
	);
};

export const GET: APIRoute = ({ props }) => {
	return jsonManifestResponse(props.manifest);
};
