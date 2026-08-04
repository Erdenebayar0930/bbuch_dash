import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";

// ✅ Base64URL руу хөрвүүлэх helper
function bufferToBase64URL(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ✅ Биометрийн дэмжлэг байгаа эсэх
export function isBiometricSupported() {
  return browserSupportsWebAuthn();
}

// ✅ Биометрийг идэвхжүүлэх (register)
export async function enableLocalBiometric(userId: string) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const options = {
    rp: { name: "My App", id: window.location.hostname },
    user: {
      id: bufferToBase64URL(new TextEncoder().encode(userId).buffer), // ✅ Base64URL
      name: "local-user",
      displayName: "Local User",
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
    },
    timeout: 60000,
    challenge: challenge, // ✅ ArrayBuffer
  };

  const credential = await startRegistration(options as any);
  localStorage.setItem("localPasskey", JSON.stringify(credential));
  localStorage.setItem("localLoggedIn", "true");
  alert("Fingerprint / Face ID идэвхжлээ");
}

// ✅ Биометрээр login
export async function loginWithLocalBiometric() {
  const saved = localStorage.getItem("localPasskey");
  if (!saved) {
    alert("Biometric бүртгэл байхгүй");
    return;
  }

  const credential = JSON.parse(saved);

  const assertion = await startAuthentication({
    challenge: crypto.getRandomValues(new Uint8Array(32)), // ✅ ArrayBuffer
    allowCredentials: [
      {
        id: credential.rawId, // ✅ rawId нь already ArrayBuffer эсвэл Base64URL
        type: "public-key",
      },
    ],
    userVerification: "required",
  } as any);

  localStorage.setItem("localLoggedIn", "true");
  alert("Fingerprint login амжилттай боллоо");
}

// ✅ Local session шалгах
export function isLocalLoggedIn() {
  return localStorage.getItem("localLoggedIn") === "true";
}

// ✅ Logout хийх
export function logoutLocalBiometric() {
  localStorage.removeItem("localPasskey");
  localStorage.removeItem("localLoggedIn");
}
