const nodemailer = require('nodemailer');

function crearTransporter() {
  const pass = (process.env.EMAIL_PASS || '').replace(/\s/g, '');
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.EMAIL_USER, pass },
    tls: { rejectUnauthorized: false },
  });
}

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'https://tiendasaz.vercel.app';

// ── 1. Bienvenida empleado ─────────────────────────────────────────────────
async function enviarBienvenidaEmpleado({ nombre, correo, rfc, token }) {
  if (!correo) return;
  const link = `${FRONTEND_URL()}/set-password?token=${token}`;
  const t = crearTransporter();
  await t.sendMail({
    from: `"Abarrotes Sistema" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: '🛒 Bienvenido/a — Establece tu contraseña de acceso',
    html: `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:14px;">
      <div style="text-align:center;margin-bottom:20px;"><span style="font-size:40px;">🛒</span>
        <h2 style="color:#1e293b;margin:8px 0 0;">Bienvenido/a a Abarrotes</h2></div>
      <p style="color:#475569;font-size:15px;">Hola <strong>${nombre}</strong>, tu cuenta ha sido creada.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">
        <p style="margin:0;font-size:12px;color:#3b82f6;font-weight:600;text-transform:uppercase;">Tu RFC (usuario)</p>
        <p style="margin:6px 0 0;font-size:26px;font-weight:800;color:#1d4ed8;font-family:monospace;">${rfc}</p>
      </div>
      <p style="color:#475569;font-size:14px;">Haz clic para <strong>establecer tu contraseña</strong>:</p>
      <div style="text-align:center;margin:20px 0;">
        <a href="${link}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">🔐 Establecer mi contraseña</a>
      </div>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
        <p style="margin:0;font-size:12px;color:#92400e;">⏰ Este enlace expira en <strong>24 horas</strong>.</p>
      </div>
      <p style="color:#94a3b8;font-size:11px;margin-top:16px;word-break:break-all;">Si el botón no funciona: ${link}</p>
    </div>`
  });
}

// ── 2. Recuperación de contraseña ──────────────────────────────────────────
async function enviarRecuperacionContrasena({ nombre, correo, token }) {
  if (!correo) return;
  const link = `${FRONTEND_URL()}/reset-password?token=${token}`;
  const t = crearTransporter();
  await t.sendMail({
    from: `"Abarrotes Sistema" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: '🔑 Recuperar contraseña — Abarrotes',
    html: `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:14px;">
      <div style="text-align:center;margin-bottom:20px;"><span style="font-size:40px;">🔑</span>
        <h2 style="color:#1e293b;margin:8px 0 0;">Recuperar contraseña</h2></div>
      <p style="color:#475569;font-size:15px;">Hola <strong>${nombre}</strong>, recibimos una solicitud para restablecer tu contraseña.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${link}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">🔓 Restablecer mi contraseña</a>
      </div>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
        <p style="margin:0;font-size:12px;color:#92400e;">⏰ Expira en <strong>1 hora</strong>. Si no lo solicitaste, ignora este correo.</p>
      </div>
      <p style="color:#94a3b8;font-size:11px;margin-top:16px;word-break:break-all;">Si el botón no funciona: ${link}</p>
    </div>`
  });
}

// ── 3. Ticket de venta (admin o cliente) ───────────────────────────────────
async function enviarTicketVenta({ folio, fecha, cajero, tienda, items, subtotal, iva, total, correoDestino, nombreCliente, esAdmin }) {
  if (!correoDestino) return;
  const t = crearTransporter();

  const filas = items.map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${i.nombre_producto || i.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center;">${i.cantidad_venta}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">$${parseFloat(i.precio_unitario).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600;">$${(i.cantidad_venta * i.precio_unitario).toFixed(2)}</td>
    </tr>`).join('');

  const saludo = esAdmin
    ? `<p style="color:#64748b;font-size:13px;margin:0 0 16px;">Venta registrada — <strong>${cajero}</strong> en <strong>${tienda}</strong></p>`
    : `<p style="color:#64748b;font-size:13px;margin:0 0 16px;">Hola <strong>${nombreCliente}</strong>, gracias por tu compra en <strong>${tienda}</strong>.<br/>Tu cajero fue: <strong>${cajero}</strong></p>`;

  await t.sendMail({
    from: `"Abarrotes ${tienda}" <${process.env.EMAIL_USER}>`,
    to: correoDestino,
    subject: `🧾 ${esAdmin ? '[Admin] ' : ''}Ticket Venta #${folio} — ${tienda}`,
    html: `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:28px;border:1px solid #e2e8f0;border-radius:14px;">
      <div style="text-align:center;margin-bottom:16px;">
        <span style="font-size:36px;">🧾</span>
        <h2 style="color:#1e293b;margin:6px 0 0;">Ticket de Venta #${folio}</h2>
        <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">${fecha}</p>
      </div>
      ${saludo}
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase;">Producto</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#475569;text-transform:uppercase;">Cant.</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;text-transform:uppercase;">Precio</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;text-transform:uppercase;">Subtotal</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div style="margin-top:16px;text-align:right;padding:12px;background:#f8fafc;border-radius:8px;">
        <p style="font-size:13px;color:#475569;margin:4px 0;">Subtotal: <strong>$${parseFloat(subtotal).toFixed(2)}</strong></p>
        <p style="font-size:13px;color:#475569;margin:4px 0;">IVA (16%): <strong>$${parseFloat(iva).toFixed(2)}</strong></p>
        <p style="font-size:22px;color:#16a34a;font-weight:800;margin:10px 0 0;">TOTAL: $${parseFloat(total).toFixed(2)}</p>
      </div>
      ${!esAdmin ? '<p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">¡Gracias por tu preferencia! 🛒</p>' : ''}
    </div>`
  });
}

module.exports = { enviarBienvenidaEmpleado, enviarRecuperacionContrasena, enviarTicketVenta };