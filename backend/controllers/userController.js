const UserModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { startRegistration, startAuthentication, verifyRegistrationResponse, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const blacklist = require('../blacklist');
const bcrypt = require('bcrypt');

const rpID = 'localhost';  // Cambia a tu dominio en prod
const expectedOrigin = 'http://localhost:3000';

const userController = {
  async register(req, res) {
    const { name, email, password, role } = req.body;
    try {
      const user = await UserModel.createUser(name, email, password, role);
      res.status(201).json(user);
    } catch (err) {
      console.error('Error en registro:', err);
      res.status(500).json({ error: 'Error al registrar' });
    }
  },

  async login(req, res) {
    const { email, fallbackPassword, biometricResponse } = req.body;

    try {
      const user = await UserModel.findUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

      let verified = false;

      if (biometricResponse) {
        try {
          // Verificación biométrica
          // Necesitamos convertir de base64 si existen
          let credentialPublicKey = null;
          let credentialID = null;
          
          if (user.publicKey) {
            credentialPublicKey = Buffer.from(user.publicKey, 'base64');
          }
          
          if (user.credentialID) {
            credentialID = Buffer.from(user.credentialID, 'base64');
          }
          
          const verification = await verifyAuthenticationResponse({
            response: biometricResponse,
            expectedChallenge: user.challenge || 'default-challenge', // Necesitas guardar el challenge en el usuario
            authenticator: {
              credentialPublicKey,
              credentialID,
              counter: user.counter || 0
            },
            expectedOrigin,
            expectedRPID: rpID
          });

          if (verification.verified) {
            verified = true;
            await UserModel.updateUser(user.id, { counter: verification.authenticationInfo.newCounter });
          }
        } catch (biometricError) {
          console.error('Error en verificación biométrica:', biometricError);
          // Si falla la biometría, intentamos con contraseña si está disponible
          if (fallbackPassword) {
            verified = await bcrypt.compare(fallbackPassword, user.password_hash);
          }
        }
      } else if (fallbackPassword) {
        verified = await bcrypt.compare(fallbackPassword, user.password_hash);
      } else {
        return res.status(400).json({ error: 'Requiere contraseña o biometría' });
      }

      if (verified) {
        const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, 'secret_key', { expiresIn: '30m' });
        return res.json({ token, message: 'Login exitoso' });
      }

      return res.status(401).json({ error: 'Autenticación fallida' });
    } catch (err) {
      console.error('Error en login:', err);
      return res.status(500).json({ error: 'Error interno en servidor' });
    }
  },

  async logout(req, res) {
    const token = req.headers.authorization.split(' ')[1];
    blacklist.add(token);
    res.json({ message: 'Sesión cerrada' });
  },

  async searchUsers(req, res) {
    const { query } = req.query;
    const users = await UserModel.searchUsers(query);
    res.json(users);
  },

  async editUser(req, res) {
    const { id } = req.params;
    const updated = await UserModel.updateUser(id, req.body);
    res.json(updated);
  },

  async getProfile(req, res) {
    const user = await UserModel.findUserByEmail(req.user.email);  // De JWT
    res.json(user);
  },

  async updatePreferences(req, res) {
    const { id } = req.user;
    const updated = await UserModel.updatePreferences(id, req.body.preferences);
    res.json(updated);
  },

  async generateRegistrationOptions(req, res) {
    const { email } = req.body;
    try {
      const user = await UserModel.findUserByEmail(email);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      // Usar startRegistration (que es el nombre correcto en @simplewebauthn/server v13+)
      // O usar generateRegistrationOptions directamente si estás en una versión diferente
      const webauthn = require('@simplewebauthn/server');
      
      // Para @simplewebauthn/server v13+, usar startRegistration
      const options = await webauthn.generateRegistrationOptions({
        rpName: 'Secure App',
        rpID: rpID,
        userID: user.id.toString(),
        userName: user.email,
        userDisplayName: user.name,
        attestationType: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 } // RS256
        ]
      });

      // Guardar el challenge en el usuario
      await UserModel.updateUser(user.id, { challenge: options.challenge });
      
      res.json(options);
    } catch (err) {
      console.error('Error generando opciones:', err);
      res.status(500).json({ error: 'Error generando opciones de registro biométrico' });
    }
  },

  // Nuevo: Verifica registro biométrico y guarda credenciales en DB
  async verifyRegistration(req, res) {
    const { response, challenge } = req.body; // Challenge del frontend o sesión
    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge, // De sesión o frontend
        expectedOrigin,
        expectedRPID: rpID
      });

      if (verification.verified) {
        const { registrationInfo } = verification;
        const { credentialPublicKey, credentialID, counter } = registrationInfo;

        // Guarda en DB (asume usuario autenticado)
        const userId = req.user.id; // De JWT o sesión
        await UserModel.updateUser(userId, {
          credentialID: credentialID.toString('base64'),
          publicKey: credentialPublicKey.toString('base64'),
          counter
        });

        res.json({ success: true, message: 'Registro biométrico exitoso (facial/huella)' });
      } else {
        res.status(400).json({ error: 'Registro biométrico fallido' });
      }
    } catch (err) {
      res.status(500).json({ error: 'Error verificando registro biométrico' });
    }
  },
};

module.exports = userController;