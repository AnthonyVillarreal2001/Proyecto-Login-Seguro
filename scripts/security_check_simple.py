import sys
import json
from pathlib import Path

# Mapas de patrones peligrosos por lenguaje
dangerous_patterns = {
    "java": {
        "SQL Injection": ["Statement", "createStatement", "executeQuery(\"", "executeUpdate(\"", "Statement.execute"],
        "Command Injection": ["Runtime.getRuntime", ".exec("],
        "XXE": ["DocumentBuilder", "SAXParser", "XMLReader"],
    },
    "csharp": {
        "SQL Injection": ["SqlCommand", "ExecuteReader", "ExecuteNonQuery"],
        "Command Injection": ["Process.Start", "Eval("],
        "Path Traversal": ["File.ReadAllText", "File.WriteAllText"],
    },
    "c": {
        "Buffer Overflow": ["strcpy(", "gets(", "scanf(", "sprintf("],
        "Memory Issues": ["malloc(", "free("],
    },
    "python": {
        "Code Injection": ["eval(", "exec("],
        "Command Injection": ["os.system(", "subprocess.Popen", "subprocess.call("],
        "Deserialization": ["pickle.loads(", "pickle.load(", "yaml.load("],
        "SQL Injection": ["execute(\"", "execute('", ".format("],
    },
    "javascript": {
        "Code Injection": ["eval("],
        "XSS": ["innerHTML", "document.write("],
        "Prototype Pollution": ["__proto__", "constructor.prototype"],
    }
}

# Patrones de sanitización por lenguaje
safe_patterns = {
    "java": ["PreparedStatement", "setString(", "setInt("],
    "csharp": ["SqlParameter", "AddWithValue", "Parameterized"],
    "c": ["snprintf(", "strncpy_s(", "fgets("],
    "python": ["cursor.execute(", "?", "%s", "escape(", "html.escape"],
    "javascript": ["textContent", "encodeURI", "DOMPurify.sanitize"],
}

def detect_language(code, filename=""):
    """Detecta el lenguaje del código basándose en extensión y contenido"""
    ext = Path(filename).suffix.lower() if filename else ""
    
    if ext == ".py":
        return "python"
    elif ext == ".java":
        return "java"
    elif ext == ".js":
        return "javascript"
    elif ext == ".cs":
        return "csharp"
    elif ext in [".c", ".h"]:
        return "c"
    
    c = code.lower()
    
    if "import " in code[:500] or "def " in code[:500] or "from " in code[:500]:
        return "python"
    if "public class" in c or "system.out.println" in c:
        return "java"
    if "using system" in c or "console.writeline" in c:
        return "csharp"
    if "function " in c or "const " in c or "let " in c or "var " in c:
        return "javascript"
    if "#include" in c:
        return "c"
    
    return "python"

def analyze_vulnerabilities(code, lang):
    """Analiza el código y detecta vulnerabilidades basadas en patrones"""
    vulnerabilities = []
    has_dangerous = False
    has_safe = False
    
    patterns = dangerous_patterns.get(lang, {})
    for vuln_type, keywords in patterns.items():
        for keyword in keywords:
            if keyword in code:
                has_dangerous = True
                vulnerabilities.append({
                    "type": vuln_type,
                    "pattern": keyword,
                    "severity": "HIGH"
                })
    
    # Verificar si hay patrones de sanitización
    safe = safe_patterns.get(lang, [])
    for pattern in safe:
        if pattern in code:
            has_safe = True
            break
    
    # Calcular score de vulnerabilidad
    if not vulnerabilities:
        probability = 0.0
        status = "SAFE"
    elif has_safe:
        probability = 0.4
        status = "WARNING"
    else:
        probability = 0.9
        status = "VULNERABLE"
    
    return {
        "vulnerable": len(vulnerabilities) > 0 and not has_safe,
        "probability": probability,
        "status": status,
        "vulnerabilities": vulnerabilities,
        "has_sanitization": has_safe
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Debes pasar un archivo de código."}))
        sys.exit(1)

    file = Path(sys.argv[1])
    
    if not file.exists():
        print(json.dumps({"error": f"Archivo no encontrado: {file}"}))
        sys.exit(1)
    
    code = file.read_text(errors="ignore")
    lang = detect_language(code, file.name)
    
    result = analyze_vulnerabilities(code, lang)
    
    output = {
        "language_detected": lang,
        "prediction": 1 if result["vulnerable"] else 0,
        "probability_vulnerable": result["probability"],
        "status": result["status"],
        "vulnerabilities_found": len(result["vulnerabilities"]),
        "vulnerabilities": result["vulnerabilities"][:5],
        "has_sanitization": result["has_sanitization"]
    }
    
    print(json.dumps(output))

if __name__ == "__main__":
    main()
