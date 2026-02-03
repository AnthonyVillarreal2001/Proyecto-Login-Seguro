

# vulnerable_code.py - CÓDIGO VULNERABLE PARA PRUEBAS

import pickle
import subprocess
import sqlite3
import sys
import os
from flask import Flask, request

app = Flask(__name__)

# 1. INYECCIÓN DE COMANDOS OS
def vulnerable_command_injection():
    user_input = input("Introduce tu nombre: ")
    # VULNERABLE: Ejecuta entrada directa del usuario
    os.system(f"echo Hola {user_input}")
    
    # Otra variante vulnerable
    subprocess.call(f"ping -c 1 {user_input}", shell=True)

# 2. INYECCIÓN SQL
def vulnerable_sql_injection():
    conn = sqlite3.connect('test.db')
    cursor = conn.cursor()
    
    user_id = input("Introduce ID de usuario: ")
    # VULNERABLE: Concatenación directa
    query = f"SELECT * FROM users WHERE id = {user_id}"
    cursor.execute(query)
    
    # Más vulnerable aún
    username = input("Usuario: ")
    password = input("Contraseña: ")
    cursor.execute(f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'")

# 3. DESERIALIZACIÓN NO SEGURA
def vulnerable_deserialization():
    data = input("Introduce datos serializados: ")
    # VULNERABLE: pickle.loads con datos no confiables
    obj = pickle.loads(data.encode())
    return obj

# 4. PATH TRAVERSAL
def vulnerable_file_access():
    filename = input("Nombre del archivo: ")
    # VULNERABLE: Acceso directo a archivos
    with open(filename, 'r') as f:
        return f.read()

# 5. XSS en Flask (si se usa con template)
@app.route('/search')
def search():
    query = request.args.get('q', '')
    # VULNERABLE: Devuelve input del usuario sin sanitizar
    return f'<h1>Resultados para: {query}</h1>'

# 6. USO DE EVAL
def vulnerable_eval():
    expression = input("Introduce expresión matemática: ")
    # VULNERABLE: eval con input del usuario
    result = eval(expression)
    return result

# 7. Contraseña hardcodeada
API_KEY = "supersecret123"
DATABASE_PASSWORD = "admin123"

if __name__ == "__main__":
    print("Ejecutando código vulnerable...")
    # vulnerable_command_injection()
    # vulnerable_sql_injection()
    # vulnerable_deserialization()
    # vulnerable_file_access()
    vulnerable_eval()