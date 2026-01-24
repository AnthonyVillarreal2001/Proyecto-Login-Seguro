const UserModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const blacklist = require('../blacklist');
const bcrypt = require('bcrypt');

const userController = {
  async register(req, res) {
    const { name, email, password, role } = req.body;
    try {
      const existingUser = await UserModel.findUserByEmail(email);
      if (existingUser) return res.status(409).json({ error: 'Email ya registrado' });
      const user = await UserModel.createUser(name, email, password, role);
      res.status(201).json({ message: 'Usuario registrado', user });
    } catch (err) {
      console.error('Error en registro:', err);
      res.status(500).json({ error: 'Error al registrar' });
    }
  },
  async publicRegister(req, res) {
    const { name, email, password } = req.body;

    try {
      const existing = await UserModel.findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'El email ya está registrado' });
      }

      const user = await UserModel.createUser(name.trim(), email.trim().toLowerCase(), password);

      res.status(201).json({
        message: '¡Registro exitoso! Ahora puedes iniciar sesión.',
        userId: user.id
      });
    } catch (err) {
      console.error('Error en publicRegister:', err);
      res.status(500).json({ error: 'Error al registrar usuario' });
    }
  },
  async login(req, res) {
    const { email, fallbackPassword } = req.body;
    try {
      if (!email) return res.status(400).json({ error: 'Email requerido' });
      const user = await UserModel.findUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
      if (fallbackPassword) {
        const match = await bcrypt.compare(fallbackPassword, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Contraseña inválida' });
      } else {
        return res.status(400).json({ error: 'Contraseña requerida para login' });
      }
      const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, 'secret_key', { expiresIn: '30m' });
      res.json({ token, message: 'Login exitoso' });
    } catch (err) {
      console.error('Error en login:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  },
  async biometricLogin(req, res) {
    const { email, embedding } = req.body;
    try {
      const user = await UserModel.findUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
      const savedEmbedding = user.preferences?.faceEmbedding;
      if (!savedEmbedding) return res.status(401).json({ error: 'No hay biometría registrada' });
      const distance = euclideanDistance(savedEmbedding, embedding);
      if (distance < 0.6) {
        const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, 'secret_key', { expiresIn: '30m' });
        return res.json({ token, message: 'Login biométrico exitoso' });
      }
      return res.status(401).json({ error: 'Biometría no reconocida' });
    } catch (err) {
      console.error('Error en login biométrico:', err);
      res.status(500).json({ error: 'Error interno' });
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
  async getAllUsers(req, res) {
    const users = await UserModel.getAllUsers();
    res.json(users);
  },
  async editUser(req, res) {
    const { id } = req.params;
    const updates = req.body;
    if (updates.password) updates.password_hash = await bcrypt.hash(updates.password, 10);
    const updated = await UserModel.updateUser(id, updates);
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(updated);
  },
  async deleteUser(req, res) {
    const { id } = req.params;
    const deleted = await UserModel.deleteUser(id);
    if (!deleted) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado' });
  },
  async deleteBiometric(req, res) {
    const { id } = req.params;
    const user = await UserModel.findUserById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const preferences = { ...user.preferences, faceEmbedding: null };
    const updated = await UserModel.updateUser(id, { preferences });
    res.json({ message: 'Biometría eliminada', updated });
  },
  async getProfile(req, res) {
    const user = await UserModel.findUserByEmail(req.user.email);
    res.json(user);
  },
  async updatePreferences(req, res) {
    const { id } = req.user;
    const { preferences } = req.body;
    const updated = await UserModel.updateUser(id, { preferences });
    res.json(updated);
  },
  async saveFaceEmbedding(req, res) {
    const { embedding, password } = req.body;
    try {
      const user = await UserModel.findUserById(req.user.id);
      if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Contraseña inválida' });
      const preferences = { ...user.preferences, faceEmbedding: embedding };
      await UserModel.updateUser(user.id, { preferences });
      res.json({ success: true, message: 'Biometría registrada' });
    } catch (err) {
      console.error('Error guardando biometría:', err);
      res.status(500).json({ error: 'Error guardando biometría' });
    }
  },
  async removeFaceEmbedding(req, res) {
    const { password } = req.body;
    try {
      const user = await UserModel.findUserById(req.user.id);
      if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Contraseña inválida' });
      const preferences = { ...user.preferences, faceEmbedding: null };
      await UserModel.updateUser(user.id, { preferences });
      res.json({ success: true, message: 'Biometría eliminada' });
    } catch (err) {
      console.error('Error eliminando biometría:', err);
      res.status(500).json({ error: 'Error eliminando biometría' });
    }
  },
  async updateProfile(req, res) {
    const { name, email, password, currentPassword } = req.body;
    const user = await UserModel.findUserById(req.user.id);

    if (!await bcrypt.compare(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (password) updates.password_hash = await bcrypt.hash(password, 10);

    await UserModel.updateUser(req.user.id, updates);
    res.json({ message: 'Perfil actualizado' });
  }
};

// Función helper para distancia euclidiana (ya que no usamos face-api en backend)
function euclideanDistance(arr1, arr2) {
  return Math.sqrt(arr1.reduce((sum, val, i) => sum + Math.pow(val - arr2[i], 2), 0));
}

module.exports = userController;