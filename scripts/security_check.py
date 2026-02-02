import sys
import joblib
import re
import json
from pathlib import Path

# ==============================
# LOAD MODEL + TFIDF
# ==============================
MODEL_PATH = Path(__file__).resolve().parent.parent / "ml" / "model.joblib"
VECTORIZER_PATH = Path(__file__).resolve().parent.parent / "ml" / "vectorizer.joblib"
FEATURE_COLUMNS_PATH = Path(__file__).resolve().parent.parent / "ml" / "feature_columns.joblib"

model = joblib.load(MODEL_PATH)
vectorizer = joblib.load(VECTORIZER_PATH)
feature_columns = joblib.load(FEATURE_COLUMNS_PATH)

# ==============================
# Feature maps (same as training)
# ==============================
dangerous_map = {
    "java": [
        "Runtime.getRuntime", "exec(", "Statement", "createStatement",
        "executeQuery", "executeUpdate", "Class.forName", "newInstance()",
        "ProcessBuilder", "URLClassLoader", "ScriptEngineManager",
        "readLine(", "readObject(", "XMLDecoder", "XStream"
    ],
    "csharp": [
        "Process.Start", "SqlCommand", "ExecuteReader", "ExecuteNonQuery",
        "Eval(", "File.ReadAllText", "BinaryFormatter", "Deserialize",
        "XmlDocument", "XmlReader", "DESCryptoServiceProvider",
        "MD5", "Random(", "LoadXml", "InnerXml"
    ],
    "c": [
        "strcpy", "strncpy(", "gets(", "scanf(", "sprintf(", "malloc(", "free(",
        "strcat(", "strlen(", "memcpy(", "system(", "popen(",
        "vsprintf(", "fscanf(", "sscanf("
    ],
    "python": [
        "eval(", "exec(", "os.system", "subprocess.Popen", "subprocess.call",
        "pickle.loads", "yaml.load(", "__import__", "compile(",
        "input(", "execfile(", "globals(", "locals(", "open("
    ],
    "javascript": [
        "eval(", "innerHTML", "document.write", "Function(", "setTimeout(",
        "var ", "setInterval(", "outerHTML", "insertAdjacentHTML",
        "execScript(", "dangerouslySetInnerHTML", "createContextualFragment"
    ],
}

sanitizers_map = {
    "java": ["PreparedStatement", "setString(", "setInt("],
    "csharp": ["SqlParameter", "AddWithValue"],
    "c": ["snprintf", "strncpy_s"],
    "python": ["shlex.quote", "escape", "html.escape"],
    "javascript": ["encodeURI", "encodeURIComponent", "DOMPurify.sanitize"],
}

# ==============================
# Language detector (IMPROVED)
# ==============================
def detect_language(code: str, filename: str = "") -> str:
    code_low = code.lower()
    
    # First check by file extension
    if filename:
        ext = Path(filename).suffix.lower()
        if ext == ".java":
            return "java"
        elif ext == ".cs":
            return "csharp"
        elif ext == ".py":
            return "python"
        elif ext == ".js":
            return "javascript"
        elif ext in [".c", ".h"]:
            return "c"
    
    # Fallback to content-based detection
    # Check C# BEFORE Java (both can have "public class")
    if "using System" in code or "Console.WriteLine" in code or "namespace " in code:
        return "csharp"
    if "public class" in code or "System.out.println" in code or "package " in code or "import java" in code:
        return "java"
    if "#include" in code_low or "malloc(" in code_low:
        return "c"
    if "def " in code or "import " in code:
        return "python"
    if "function " in code_low or "console.log" in code_low or "const " in code or "let " in code or "var " in code:
        return "javascript"

    return "unknown"

# ==============================
# Complexity estimation
# ==============================
def estimate_complexity(code: str) -> int:
    return sum(code.count(kw) for kw in [
        "if ", "for ", "while ", "switch", "case ", "try", "catch", "elif ", "else:"
    ])

# ==============================
# Build manual feature vector
# ==============================
def build_features(code: str, lang: str):
    feats = {}

    feats["length_chars"] = len(code)
    feats["num_lines"] = code.count("\n") + 1
    feats["num_tokens"] = len(re.findall(r"\w+", code))
    feats["complexity_score"] = estimate_complexity(code)

    # dangerous functions
    for d in dangerous_map.get(lang, []):
        feats[f"{lang}_danger_{d}"] = code.count(d)

    # sanitizers
    for s in sanitizers_map.get(lang, []):
        feats[f"{lang}_sanitize_{s}"] = code.count(s)

    feats[f"lang_{lang}"] = 1

    return feats

# ==============================
# MAIN EXECUTION
# ==============================
def main():
    if len(sys.argv) < 2:
        print("ERROR: Debes pasar un archivo de código.")
        sys.exit(1)

    file_path = sys.argv[1]

    if not Path(file_path).exists():
        print("ERROR: Archivo no encontrado:", file_path)
        sys.exit(1)

    # leer código
    code = Path(file_path).read_text(errors="ignore")

    # detectar lenguaje (pasando el nombre del archivo)
    lang = detect_language(code, file_path)

    # vector TF-IDF
    X_tfidf = vectorizer.transform([code])

    # manual features
    feats = build_features(code, lang)
    
    # Crear DataFrame y rellenar con las columnas esperadas
    import pandas as pd
    feat_df = pd.DataFrame([feats])
    # Reindexar para incluir todas las columnas del entrenamiento (con 0 para las faltantes)
    feat_df = feat_df.reindex(columns=feature_columns, fill_value=0)
    X_manual = feat_df.values

    # combinar
    from scipy.sparse import hstack
    X = hstack([X_tfidf, X_manual])

    # predicción
    pred = model.predict(X)[0]
    proba = model.predict_proba(X)[0][1]

    # HEURISTIC BOOST: If many dangerous functions found, override prediction
    danger_count = sum(code.count(d) for d in dangerous_map.get(lang, []))
    if danger_count >= 5:  # If 5 or more dangerous function usages
        pred = 1
        proba = max(proba, 0.75)  # Boost probability

    # Determine OWASP category based on dangerous functions found
    owasp_category = "Unknown"
    if pred == 1:
        if any(func in code for func in ["eval(", "exec(", "innerHTML", "document.write", "dangerouslySetInnerHTML"]):
            owasp_category = "A03:2021 - Injection (XSS/Code Injection)"
        elif any(func in code for func in ["executeQuery", "SqlCommand", "createStatement"]):
            owasp_category = "A03:2021 - Injection (SQL Injection)"
        elif any(func in code for func in ["pickle.loads", "readObject", "Deserialize", "XMLDecoder"]):
            owasp_category = "A08:2021 - Software and Data Integrity Failures"
        elif any(func in code for func in ["system(", "exec(", "Runtime.getRuntime", "Process.Start"]):
            owasp_category = "A03:2021 - Injection (Command Injection)"
        else:
            owasp_category = "A03:2021 - Injection"

    result = {
        "language": lang,
        "prediction": int(pred),
        "probability": float(proba),
        "status": "VULNERABLE" if pred == 1 else "SAFE",
        "dangerous_functions": danger_count,
        "owasp_category": owasp_category
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
