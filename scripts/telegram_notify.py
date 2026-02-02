import os
import sys
import json
import requests

def send_telegram_message(text: str):
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
        "parse_mode": "Markdown"
    }

    response = requests.post(url, json=payload)
    return response.status_code == 200


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
        print("JSON recibido:", result_json)
        # Enviar mensaje de error
        msg = (
            f"🚨 *Reporte de Seguridad*\n\n"
            f"📄 *Archivo:* `{file_name}`\n"
            f"❌ *Estado:* ERROR al analizar\n"
            f"⚠️ *Detalles:* {str(e)}\n"
        )
        send_telegram_message(msg)
        sys.exit(1)

    lang = data.get("language_detected", "unknown")
    status = data.get("status", "ERROR")
    prob = data.get("probability_vulnerable", 0.0)
    prediction = data.get("prediction", 0)
    danger_count = data.get("dangerous_functions_found", 0)

    # Emoji según el estado
    if status == "VULNERABLE":
        emoji_status = "🚨"
        emoji_icon = "❌"
    elif status == "SAFE":
        emoji_status = "✅"
        emoji_icon = "✔️"
    else:
        emoji_status = "⚠️"
        emoji_icon = "❓"

    msg = (
        f"{emoji_status} *Reporte de Seguridad*\n\n"
        f"📄 *Archivo:* `{file_name}`\n"
        f"🔤 *Lenguaje:* `{lang}`\n"
        f"{emoji_icon} *Estado:* *{status}*\n"
        f"📊 *Probabilidad:* `{prob:.2%}`\n"
        f"⚠️ *Funciones peligrosas:* `{danger_count}`\n"
    )

    ok = send_telegram_message(msg)

    if ok:
        print("✅ Mensaje enviado a Telegram correctamente")
    else:
        print("❌ ERROR: No se pudo enviar mensaje a Telegram")


if __name__ == "__main__":
    main()
