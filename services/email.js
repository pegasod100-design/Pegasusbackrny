const nodemailer = require('nodemailer');

// Configurar transporter con las variables de entorno
// Usa Gmail con App Password (EMAIL_USER + EMAIL_PASS en .env)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,   // App Password de Gmail, no la contraseña normal
  },
});

// ── Email: Credenciales de empleado ─────────────────────────────────────────
async function enviarCredencialesEmpleado({ nombre, correo, rfc, contrasena }) {
  if (!correo) return;   // si no tiene correo, no enviamos

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#1e293b;margin:0 0 8px;">🛒 Abarrotes — Acceso al sistema</h2>
      <p style="color:#64748b;font-size:14px;">Hola <strong>${nombre}</strong>, tu cuenta ha sido creada/actualizada.</p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>RFC (usuario):</strong></p>
        <p style="font-size:20px;font-weight:800;color:#2563eb;font-family:monospace;margin:0;">${rfc}</p>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Contraseña inicial:</strong></p>
        <p style="font-size:20px;font-weight:800;color:#16a34a;font-family:monospace;margin:0;">${contrasena}</p>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Por seguridad, cambia tu contraseña después de iniciar sesión por primera vez.</p>
      <p style="color:#94a3b8;font-size:12px;">Si tienes dudas, contacta a tu administrador.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Abarrotes Sistema" <${process.env.EMAIL_USER}>`,
    to: correo,
    subject: '🛒 Tus credenciales de acceso — Abarrotes',
    html,
  });
}

// ── Email: Ticket de venta al administrador ──────────────────────────────────
async function enviarTicketVenta({ folio, fecha, cajero, tienda, items, subtotal, iva, total, correoAdmin }) {
  if (!correoAdmin) return;

  const filasProductos = items.map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${i.nombre_producto || i.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center;">${i.cantidad_venta}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">$${parseFloat(i.precio_unitario).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600;">$${(i.cantidad_venta * i.precio_unitario).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#1e293b;margin:0 0 4px;">🧾 Ticket de Venta #${folio}</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">${fecha} · Tienda: <strong>${tienda}</strong> · Cajero: <strong>${cajero}</strong></p>

      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase;">Producto</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#475569;text-transform:uppercase;">Cant.</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;text-transform:uppercase;">Precio</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;text-transform:uppercase;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${filasProductos}</tbody>
      </table>

      <div style="margin-top:16px;text-align:right;">
        <p style="font-size:14px;color:#475569;margin:4px 0;">Subtotal: <strong>$${parseFloat(subtotal).toFixed(2)}</strong></p>
        <p style="font-size:14px;color:#475569;margin:4px 0;">IVA (16%): <strong>$${parseFloat(iva).toFixed(2)}</strong></p>
        <p style="font-size:20px;color:#16a34a;font-weight:800;margin:8px 0;">TOTAL: $${parseFloat(total).toFixed(2)}</p>
      </div>

      <p style="color:#94a3b8;font-size:11px;margin-top:20px;border-top:1px solid #f1f5f9;padding-top:12px;">
        Este ticket fue generado automáticamente por el sistema Abarrotes.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Abarrotes Sistema" <${process.env.EMAIL_USER}>`,
    to: correoAdmin,
    subject: `🧾 Venta #${folio} — ${tienda}`,
    html,
  });
}

module.exports = { enviarCredencialesEmpleado, enviarTicketVenta };
