import CryptoJS from "crypto-js";
import { writeFile } from "node:fs/promises";

// Clé secrète (doit être la même côté serveur)
const secretKey = "your-secret-key";

// Chiffrement
export function encryptMessage(message, iv) {
  return CryptoJS.AES.encrypt(message.toString("hex"), secretKey, {
    iv,
  }).toString();
}

// Déchiffrement
export function decryptMessage(encryptedMessage, iv) {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, secretKey, { iv });
  return bytes.toString(CryptoJS.enc.Hex); // Renvoie le message en texte clair
}

// Fonction pour convertir FormData en Buffer
export async function formDataToBuffer(formData) {
  const boundary = `----FormDataBoundary${Math.random().toString(36).slice(2)}`;
  const chunks = [];

  // Construire les données multipartes manuellement
  for (const [key, value] of formData.entries()) {
    chunks.push(`--${boundary}\r\n`);
    if (value instanceof Blob) {
      chunks.push(
        `Content-Disposition: form-data; name="${key}"; filename="${value.name}"\r\n` +
          `Content-Type: ${value.type || "application/octet-stream"}\r\n\r\n`
      );
      const buffer = await value.arrayBuffer();
      chunks.push(Buffer.from(buffer));
    } else {
      chunks.push(
        `Content-Disposition: form-data; name="${key}"\r\n\r\n${value}`
      );
    }
    chunks.push("\r\n");
  }

  // Ajouter la fermeture du formulaire
  chunks.push(`--${boundary}--\r\n`);
  return {
    buffer: Buffer.concat(
      chunks.map((chunk) =>
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      )
    ),
    boundary,
  };
}

// Fonction pour convertir un Buffer en FormData
export function bufferToFormData(buffer, boundary) {
  const formData = new FormData();
  const parts = buffer.toString().split(`--${boundary}`);

  for (const part of parts) {
    if (part.includes("Content-Disposition")) {
      const [header, content, _] = part.split(/\r\n\r\n/);
      const nameMatch = header.match(/name="([^"]+)"/);
      const filenameMatch = header.match(/filename="([^"]+)"/);
      if (nameMatch) {
        const name = nameMatch[1];
        if (filenameMatch) {
          const filename = filenameMatch[1];
          const typeMatch = header.match(/Content-Type: ([^\s]+)/);
          const type = typeMatch ? typeMatch[1] : "application/octet-stream";
          const blob = new Blob([Buffer.from(content, "hex")], {
            type,
          });

          formData.append(name, blob, filename);
          console.log("file", name, filename);
        } else {
          formData.append(name, content.trim());
        }
      }
    }
  }

  return formData;
}
