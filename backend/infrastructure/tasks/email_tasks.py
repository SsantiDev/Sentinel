from config.celery import app
from django.core.mail import EmailMultiAlternatives
from django.conf import settings


def _build_html(code: str, purpose: str) -> tuple[str, str]:
    if purpose == 'reset':
        title = "Recuperación de contraseña"
        subtitle = "Solicitaste restablecer tu contraseña en Sentinel."
        label = "Código de recuperación"
    else:
        title = "Verificación de cuenta"
        subtitle = "Gracias por registrarte en Sentinel. Usa el siguiente código para activar tu cuenta."
        label = "Código de verificación"

    digits = "".join(
        f'<span style="display:inline-block;width:48px;height:60px;line-height:60px;text-align:center;'
        f'font-size:28px;font-weight:900;background:#0f0f1a;color:#2ecc71;border:2px solid #2ecc71;'
        f'border-radius:10px;margin:0 4px;letter-spacing:0;">{d}</span>'
        for d in code
    )

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#13131f;border-radius:20px;border:1px solid rgba(46,204,113,0.15);overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0f1a14 0%,#0a2016 100%);padding:32px;text-align:center;border-bottom:1px solid rgba(46,204,113,0.1);">
          <div style="display:inline-block;width:56px;height:56px;background:rgba(46,204,113,0.1);border-radius:14px;line-height:56px;font-size:24px;margin-bottom:12px;">⬡</div>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:900;letter-spacing:2px;">SENTINEL</h1>
          <p style="margin:4px 0 0;color:#2ecc71;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Enterprise Service Monitoring</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px;">
          <h2 style="margin:0 0 8px;color:#ffffff;font-size:20px;font-weight:700;">{title}</h2>
          <p style="margin:0 0 28px;color:#8892a4;font-size:14px;line-height:1.6;">{subtitle}</p>

          <p style="margin:0 0 12px;color:#8892a4;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">{label}</p>
          <div style="text-align:center;margin:0 0 28px;">{digits}</div>

          <div style="background:rgba(46,204,113,0.05);border:1px solid rgba(46,204,113,0.15);border-radius:10px;padding:14px 16px;margin-bottom:24px;">
            <p style="margin:0;color:#8892a4;font-size:12px;line-height:1.5;">
              ⏱ Este código expira en <strong style="color:#2ecc71;">15 minutos</strong>.<br>
              Si no solicitaste esto, ignora este mensaje.
            </p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <p style="margin:0;color:#3d4555;font-size:11px;">© 2026 Sentinel Monitor · <a href="https://ssantiago.dev" style="color:#2ecc71;text-decoration:none;">ssantiago.dev</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = f"{title}\n\n{subtitle}\n\n{label}: {code}\n\nExpira en 15 minutos.\nSi no solicitaste esto, ignora este mensaje."
    return subject_line(purpose), plain, html


def subject_line(purpose: str) -> str:
    return "Recuperación de contraseña — Sentinel" if purpose == 'reset' else "Código de verificación — Sentinel"


@app.task
def send_otp_email(email: str, code: str, purpose: str) -> None:
    subject, plain, html = _build_html(code, purpose)
    msg = EmailMultiAlternatives(subject, plain, settings.DEFAULT_FROM_EMAIL, [email])
    msg.attach_alternative(html, "text/html")
    msg.send(fail_silently=False)
