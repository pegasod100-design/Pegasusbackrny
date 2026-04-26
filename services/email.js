const nodemailer = require('nodemailer');

// Crear transporter DENTRO de función para que lea .env ya cargado
// y limpiar espacios del App Password (Gmail los requiere sin espacios)
function crearTransporter() {
  const pass = (process.env.EMAIL_PASS || '').replace(/\s/g, ''); // quita todos los espacios
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,  // SSL
    auth: {
      user: process.env.EMAIL_USER,
      pass: pass,
    },
    tls: { rejectUnauthorized: false },
  });
}

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'https://tiendasaz.vercel.app';

// ── 1. Bienvenida con link para ESTABLECER contraseña ────────────────────────
async function enviarBienvenidaEmpleado({ nombre, correo, rfc, token }) {
  if (!correo) return;
  const link = `${FRONTEND_URL()}/set-password?token=${token}`;
  const transporter = crearTransporter();

  const html = `
  <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:14px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:40px;">🛒</span>
      <h2 style="color:#1e293b;margin:8px 0 0;">Bienvenido/a a Abarrotes</h2>
    </div>
    <p style="color:#475569;font-size:15px;">Hola <strong>${nombre}</strong>, tu cuenta ha sido creada.</p>
    <p style="color:#475569;font-size:14px;">Tu usuario de acceso es:</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">
      <p style="margin:0;font-size:12px;color:#3b82f6;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Tu RFC (usuario)</p>
      <p style="margin:6px 0 0;font-size:26px;font-weight:800;color:#1d4ed8;font-family:monospace;">${rfc}</p>
    </div>
    <p style="color:#475569;font-size:14px;">Haz clic en el botón para <strong>establecer tu contraseña</strong> y acceder al sistema:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
        🔐 Establecer mi contraseña
      </a>
    </div>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
      <p style="margin:0;font-size:12px;color:#92400e;">⏰ Este enlace expira en <strong>24 horas</strong>.</p>
    </div>
    <p style="color:#94a3b8;font-size:11px;margin-top:16px;word-break:break-all;">Si el botón no funciona, copia este enlace: ${link}</p>
  </div>`;

  await transporter.sendMail({
    from: `"Abarrotes Sistema" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: '🛒 Bienvenido/a — Establece tu contraseña de acceso',
    html,
  });
}

// ── 2. Recuperación de contraseña ────────────────────────────────────────────
async function enviarRecuperacionContrasena({ nombre, correo, token }) {
  if (!correo) return;
  const link = `${FRONTEND_URL()}/reset-password?token=${token}`;
  const transporter = crearTransporter();

  const html = `
  <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:14px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:40px;">🔑</span>
      <h2 style="color:#1e293b;margin:8px 0 0;">Recuperar contraseña</h2>
    </div>
    <p style="color:#475569;font-size:15px;">Hola <strong>${nombre}</strong>, recibimos una solicitud para restablecer tu contraseña.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
        🔓 Restablecer mi contraseña
      </a>
    </div>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
      <p style="margin:0;font-size:12px;color:#92400e;">⏰ Este enlace expira en <strong>1 hora</strong>. Si no solicitaste esto, ignora este correo.</p>
    </div>
    <p style="color:#94a3b8;font-size:11px;margin-top:16px;word-break:break-all;">Si el botón no funciona, copia este enlace: ${link}</p>
  </div>`;

  await transporter.sendMail({
    from: `"Abarrotes Sistema" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: '🔑 Recuperar contraseña — Abarrotes',
    html,
  });
}

// ── 3. Ticket de venta al administrador ──────────────────────────────────────
async function enviarTicketVenta({ folio, fecha, cajero, tienda, items, subtotal, iva, total, correoAdmin }) {
  if (!correoAdmin) return;
  const transporter = crearTransporter();

  const filas = items.map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${i.nombre_producto || i.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center;">${i.cantidad_venta}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">$${parseFloat(i.precio_unitario).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600;">$${(i.cantidad_venta * i.precio_unitario).toFixed(2)}</td>
    </tr>`).join('');

  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
    <h2 style="color:#1e293b;margin:0 0 4px;">🧾 Ticket Venta #${folio}</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 16px;">${fecha} · Tienda: <strong>${tienda}</strong> · Cajero: <strong>${cajero}</strong></p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;">Producto</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;color:#475569;">Cant.</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;">Precio</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;">Subtotal</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div style="margin-top:14px;text-align:right;">
      <p style="font-size:14px;color:#475569;margin:4px 0;">Subtotal: <strong>$${parseFloat(subtotal).toFixed(2)}</strong></p>
      <p style="font-size:14px;color:#475569;margin:4px 0;">IVA (16%): <strong>$${parseFloat(iva).toFixed(2)}</strong></p>
      <p style="font-size:22px;color:#16a34a;font-weight:800;margin:10px 0;">TOTAL: $${parseFloat(total).toFixed(2)}</p>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `"Abarrotes Sistema" <${process.env.EMAIL_USER}>`,
    to: correoAdmin,
    subject: `🧾 Venta #${folio} — ${tienda}`,
    html,
  });
}

module.exports = { enviarBienvenidaEmpleado, enviarRecuperacionContrasena, enviarTicketVenta };
