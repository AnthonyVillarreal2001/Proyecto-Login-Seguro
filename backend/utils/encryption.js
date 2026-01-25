// backend/utils/encryption.js
const crypto = require('crypto');

// Clave de encriptación - debe ser exactamente 32 bytes para AES-256
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'supersecretkey32bytessupersecretkey';
const IV_LENGTH = 16; // Para AES, siempre 16 bytes

// Función para asegurar que la clave tenga 32 bytes
function ensureKeyLength(key) {
  if (key.length < 32) {
    // Pad con caracteres si es más corta
    return key.padEnd(32, '0').slice(0, 32);
  } else if (key.length > 32) {
    // Truncar si es más larga
    return key.slice(0, 32);
  }
  return key;
}

// Clave procesada con longitud correcta
const PROCESSED_KEY = ensureKeyLength(ENCRYPTION_KEY);

function encrypt(text) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(PROCESSED_KEY, 'utf8'), 
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Error en encrypt:', error.message);
    throw new Error('Error encriptando datos');
  }
}

function decrypt(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(PROCESSED_KEY, 'utf8'), 
      iv
    );
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error en decrypt:', error.message);
    throw new Error('Error desencriptando datos');
  }
}

function encryptFaceEmbedding(embeddingArray) {
  if (!Array.isArray(embeddingArray)) {
    throw new Error('El embedding debe ser un array');
  }
  
  try {
    // Convertir array a string JSON
    const embeddingString = JSON.stringify(embeddingArray);
    
    // Encriptar
    return encrypt(embeddingString);
  } catch (error) {
    console.error('Error en encryptFaceEmbedding:', error.message);
    throw new Error('Error encriptando embedding facial');
  }
}

function decryptFaceEmbedding(encryptedEmbedding) {
  if (!encryptedEmbedding) return null;
  
  try {
    // Desencriptar
    const decryptedString = decrypt(encryptedEmbedding);
    
    // Convertir de nuevo a array
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Error desencriptando embedding:', error.message);
    return null;
  }
}

// Función de prueba para verificar que la encriptación funciona
function testEncryption() {
  try {
    const testData = [1.2, 3.4, 5.6];
    console.log('Clave procesada:', PROCESSED_KEY);
    console.log('Longitud de clave:', PROCESSED_KEY.length);
    
    const encrypted = encryptFaceEmbedding(testData);
    console.log('Encriptado:', encrypted.substring(0, 50) + '...');
    
    const decrypted = decryptFaceEmbedding(encrypted);
    console.log('Desencriptado:', decrypted);
    
    console.log('✅ Prueba de encriptación exitosa');
    return true;
  } catch (error) {
    console.error('❌ Error en prueba de encriptación:', error.message);
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  encryptFaceEmbedding,
  decryptFaceEmbedding,
  testEncryption,
  ensureKeyLength
};