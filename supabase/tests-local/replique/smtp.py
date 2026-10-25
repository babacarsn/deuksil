# Capture des e-mails envoyés par l'authentification locale (aucun envoi réel).
import asyncio, json, email, os
from aiosmtpd.controller import Controller
OUT = os.environ.get('MAILS') or os.path.join(os.environ.get('REPLIQUE_DIR', '.'), 'run', 'mails.jsonl')
class H:
    async def handle_DATA(self, server, session, env):
        m = email.message_from_bytes(env.content)
        body = ''
        for part in (m.walk() if m.is_multipart() else [m]):
            if part.get_content_type() in ('text/plain', 'text/html'):
                body += part.get_payload(decode=True).decode('utf-8', 'replace')
        with open(OUT, 'a') as f: f.write(json.dumps({'to': env.rcpt_tos, 'subject': m['subject'], 'body': body}) + '\n')
        return '250 OK'
c = Controller(H(), hostname='127.0.0.1', port=2525); c.start()
asyncio.get_event_loop().run_forever()
