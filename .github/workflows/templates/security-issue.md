# 🚨 fixing-required: Vulnerabilidades Detectadas

**PR:** #${{ github.event.pull_request.number }}
**Título:** ${{ github.event.pull_request.title }}
**Autor:** ${{ github.event.pull_request.user.login }}
**Rama origen:** ${{ github.event.pull_request.head.ref }}
**Rama destino:** ${{ github.event.pull_request.base.ref }}
**Fecha detección:** ${{ fromJSON('{}').date || 'now' | date: '%Y-%m-%d %H:%M UTC' }}

## 📊 Resultados del Escaneo de Seguridad

Se detectaron **${{ steps.security-scan.outputs.vulnerable_count }} archivo(s) vulnerable(s)** de ${{ steps.security-scan.outputs.total_files }} analizados.

### 🔍 Archivos Vulnerables Detectados

${{ fromJSON('{
  "content": steps.security-scan.outputs.vulnerable_files 
    ? "Los siguientes archivos contienen código vulnerable:"
    : "No se encontraron archivos vulnerables."
}').content }}

${{ steps.security-scan.outputs.vulnerable_files && fromJSON('{
  "files": steps.security-scan.outputs.vulnerable_files.split(";").filter(f => f)
}').files.map(file => {
  const [filename, probability, language, owasp] = file.split("|");
  const percent = Math.round(parseFloat(probability) * 100);
  return `### 📄 \`${filename}\`
- **Lenguaje:** ${language}
- **Probabilidad de vulnerabilidad:** ${percent}%
- **Categoría OWASP:** ${owasp}
- **Severidad:** ${percent > 80 ? "CRÍTICA 🔴" : percent > 60 ? "ALTA 🟠" : "MEDIA 🟡"}
`;
}).join("\n") }}

## 🛡️ Acciones Requeridas

1. **Revisar cada archivo** listado arriba
2. **Corregir las funciones peligrosas** identificadas
3. **Implementar sanitización adecuada**
4. **Verificar con el equipo** si es necesario
5. **Re-ejecutar el pipeline** después de las correcciones

## 🔧 Recomendaciones de Seguridad

- Usar consultas parametrizadas para SQL
- Validar y sanitizar todas las entradas de usuario
- Implementar CSP (Content Security Policy)
- Usar funciones seguras de manejo de memoria
- Evitar `eval()` y `exec()` en código dinámico

## 📝 Notas del Sistema

Este issue fue generado automáticamente por el sistema de CI/CD de seguridad.
El merge del PR ha sido **bloqueado automáticamente** hasta que se resuelvan estas vulnerabilidades.

**Etiquetas aplicadas:** `fixing-required`, `security`, `vulnerability`, `automated`

---
*🤖 Generado por GitHub Actions - Security Scan Pipeline*