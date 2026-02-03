import os
import sys
import json
import requests

def send_telegram_message(text: str, parse_mode: str = "Markdown"):
    """Send a message to a Telegram bot chat."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")

    if not token or not chat_id:
        print("ERROR: Falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"ERROR enviando a Telegram: {e}")
        return False

def format_security_message(file_name, data):
    """Formatear mensaje de seguridad."""
    status = data.get("status", "ERROR")
    prob = data.get("probability", 0.0)
    lang = data.get("language", "unknown")
    
    if status == "VULNERABLE":
        emoji = "🚨"
        status_text = "*VULNERABLE*"
    elif status == "SAFE":
        emoji = "✅"
        status_text = "*SAFE*"
    else:
        emoji = "⚠️"
        status_text = "*ERROR*"
    
    return (
        f"{emoji} *Security Scan Result*\n\n"
        f"📄 *File:* `{file_name}`\n"
        f"🔤 *Language:* `{lang}`\n"
        f"{emoji} *Status:* {status_text}\n"
        f"📊 *Probability:* `{prob:.2%}`\n"
        f"🛡️ *OWASP:* {data.get('owasp_category', 'Unknown')}\n"
    )

def main():
    if len(sys.argv) < 3:
        print("Uso: python telegram_notify.py <archivo_analizado> <resultado_json>")
        sys.exit(1)

    file_name = sys.argv[1]
    result_json = sys.argv[2]

    try:
        data = json.loads(result_json)
    except Exception as e:
        print("ERROR al parsear JSON:", e)
        msg = (
            f"🚨 *Security Report*\n\n"
            f"📄 *File:* `{file_name}`\n"
            f"❌ *Status:* ERROR parsing\n"
            f"⚠️ *Details:* {str(e)}\n"
        )
        send_telegram_message(msg)
        sys.exit(1)

    msg = format_security_message(file_name, data)
    ok = send_telegram_message(msg)

    if ok:
        print("✅ Mensaje enviado a Telegram")
    else:
        print("❌ ERROR: No se pudo enviar mensaje")

if __name__ == "__main__":
    main()