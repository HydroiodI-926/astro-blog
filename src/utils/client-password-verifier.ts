const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERIFY_PREFIX = "MIZUKI-VERIFY:";

function base64ToUint8Array(value: string) {
	const binary = atob(value);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function verifyEncryptedPassword(
	encryptedContent: string,
	password: string,
	expectedContent: string,
) {
	try {
		const raw = base64ToUint8Array(encryptedContent);
		const salt = raw.slice(0, SALT_LENGTH);
		const iv = raw.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
		const authTag = raw.slice(
			SALT_LENGTH + IV_LENGTH,
			SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
		);
		const ciphertext = raw.slice(
			SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
		);
		const encryptedWithTag = new Uint8Array(
			ciphertext.length + AUTH_TAG_LENGTH,
		);
		encryptedWithTag.set(ciphertext);
		encryptedWithTag.set(authTag, ciphertext.length);

		const encoder = new TextEncoder();
		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			encoder.encode(password),
			"PBKDF2",
			false,
			["deriveKey"],
		);
		const key = await crypto.subtle.deriveKey(
			{
				name: "PBKDF2",
				salt,
				iterations: PBKDF2_ITERATIONS,
				hash: "SHA-256",
			},
			keyMaterial,
			{ name: "AES-GCM", length: 256 },
			false,
			["decrypt"],
		);
		const decrypted = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv },
			key,
			encryptedWithTag,
		);
		const content = new TextDecoder().decode(decrypted);
		return content === `${VERIFY_PREFIX}${expectedContent}`;
	} catch {
		return false;
	}
}
