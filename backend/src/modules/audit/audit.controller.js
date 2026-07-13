import pool from '../../config/db.js';

// ─── Table bootstrap ─────────────────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID,
        user_id      UUID,
        user_name    TEXT,
        action       TEXT,
        entity       TEXT,
        entity_id    TEXT,
        description  TEXT,
        ip_address   TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Patch missing columns on existing tables
    const cols = ['entity TEXT', 'entity_id TEXT', 'user_name TEXT', 'ip_address TEXT', 'description TEXT'];
    for (const col of cols) {
      const [name] = col.split(' ');
      await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ${col}`).catch(() => {});
    }
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(tenant_id, entity)`);
    console.log('[audit] Table ready');
  } catch (err) {
    console.error('[audit] Table bootstrap error:', err.message);
  }
})();

// ─── logAudit — fire-and-forget, never throws ────────────
export const logAudit = async (req, action, entity, entityId, description) => {
  try {
    const { tenantId, userId, name } = req.user || {};
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, user_id, user_name, action, entity, entity_id, description, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId || null, userId || null, name || null, action, entity, String(entityId || ''), description, ip]
    );
  } catch { /* never throws */ }
};

// ─── GET /api/audit ──────────────────────────────────────
export const getAuditLogs = async (req, res) => {
  const { tenantId } = req.user;
  const { entity, limit = 200 } = req.query;
  try {
    let q = `SELECT * FROM audit_logs WHERE tenant_id = $1`;
    const params = [tenantId];
    if (entity) { q += ` AND entity = $2`; params.push(entity); }
    q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(Number(limit) || 200, 500));
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE /api/audit/old ───────────────────────────────
export const clearOldLogs = async (req, res) => {
  const { tenantId } = req.user;
  try {
    const result = await pool.query(
      `DELETE FROM audit_logs WHERE tenant_id = $1 AND created_at < NOW() - INTERVAL '90 days'`,
      [tenantId]
    );
    res.json({ message: `Deleted ${result.rowCount} old log entries` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
