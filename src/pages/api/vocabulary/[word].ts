import type { APIRoute, GetStaticPaths } from "astro";
import relationData from "../../../data/vocabulary-relations.json";
import type {
	VocabularyRelationData,
	VocabularyWordRelations,
} from "../../../components/features/english-learning/types";

const relations = relationData as VocabularyRelationData;

export const getStaticPaths: GetStaticPaths = () =>
	Object.entries(relations.words).map(([word, relation]) => ({
		params: { word },
		props: { relation },
	}));

export const GET: APIRoute = ({ props }) =>
	new Response(JSON.stringify(props.relation as VocabularyWordRelations), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=0, must-revalidate",
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
