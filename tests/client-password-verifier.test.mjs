import assert from "node:assert/strict";
import test from "node:test";

import { verifyEncryptedPassword } from "../src/utils/client-password-verifier.ts";
import { encryptContent } from "../src/utils/crypto-utils.ts";

test("review password verifier accepts the configured password", async () => {
	const token = encryptContent(
		"vocabulary-review-access",
		"correct horse battery staple",
		"vocabulary-review",
	);

	assert.equal(
		await verifyEncryptedPassword(
			token,
			"correct horse battery staple",
			"vocabulary-review-access",
		),
		true,
	);
});

test("review password verifier rejects a wrong password or purpose", async () => {
	const token = encryptContent(
		"vocabulary-review-access",
		"correct horse battery staple",
		"vocabulary-review",
	);

	assert.equal(
		await verifyEncryptedPassword(
			token,
			"wrong password",
			"vocabulary-review-access",
		),
		false,
	);
	assert.equal(
		await verifyEncryptedPassword(
			token,
			"correct horse battery staple",
			"other-purpose",
		),
		false,
	);
});
