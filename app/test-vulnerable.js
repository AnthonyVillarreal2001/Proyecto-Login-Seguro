// vulnerable_server.js - SERVIDOR NODE.JS VULNERABLE

const express = require('express');
const fs = require('fs');
const child_process = require('child_process');
const app = express();
app.use(express.urlencoded({ extended: true }));

// CONFIGURACIÓN INSECURA
const secretKey = "mySuperSecretKey123";
const adminPassword = "password123";

// 1. INYECCIÓN DE COMANDOS
app.post('/ping', (req, res) => {
    const host = req.body.host;
    // VULNERABLE: Ejecución directa
    child_process.exec(`ping -c 4 ${host}`, (error, stdout) => {
        res.send(stdout);
    });
});

// 2. PATH TRAVERSAL
app.get('/file', (req, res) => {
    const filename = req.query.filename;
    // VULNERABLE: Lectura directa de archivos
    fs.readFile(filename, 'utf8', (err, data) => {
        res.send(data);
    });
});

// 3. INYECCIÓN SQL (simulada)
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    // VULNERABLE: Concatenación SQL
    const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
    
    // Simulación de ejecución
    console.log("Query ejecutada:", query);
    res.send('Login procesado');
});

// 4. XSS REFLEJADO
app.get('/search', (req, res) => {
    const query = req.query.q || '';
    // VULNERABLE: Sin sanitización
    res.send(`<h1>Resultados para: ${query}</h1>`);
});

// 5. DESERIALIZACIÓN VULNERABLE
app.post('/data', (req, res) => {
    const userData = req.body.data;
    // VULNERABLE: eval con datos del usuario
    const obj = eval(`(${userData})`);
    res.json(obj);
});

// 6. CORS MAL CONFIGURADO
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // VULNERABLE: Permite todos
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

// 7. JWT SECRET DÉBIL
const jwt = require('jsonwebtoken');
app.post('/getToken', (req, res) => {
    const user = req.body.user;
    // VULNERABLE: Secreto débil y hardcodeado
    const token = jwt.sign({ user }, 'weaksecret', { expiresIn: '1h' });
    res.json({ token });
});

// 8. EXPOSICIÓN DE ARCHIVOS SENSIBLES
app.get('/config', (req, res) => {
    // VULNERABLE: Expone archivos internos
    fs.readFile('.env', 'utf8', (err, data) => {
        res.send(data);
    });
});

// SERVIDOR
app.listen(3000, () => {
    console.log('Servidor vulnerable ejecutándose en puerto 3000');
    console.log('SECRET_KEY:', secretKey); // VULNERABLE: Log de secreto
});