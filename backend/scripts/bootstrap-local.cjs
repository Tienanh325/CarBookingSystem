const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const mysql = require('mysql2/promise');

(async () => {
  const stateDir = path.resolve(__dirname, '../../.local/mysql');
  const credentialsPath = path.join(stateDir, 'credentials.json');
  const previous = fs.existsSync(credentialsPath) ? JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) : null;
  const adminPassword = previous?.adminPassword || '';
  const connection = await mysql.createConnection({host:'127.0.0.1', port:3307, user:'root', password:adminPassword, multipleStatements:true});
  try {
    const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/bootstrap.mysql.sql'), 'utf8');
    await connection.query(sql);
    if (!previous) {
      const secret = crypto.randomBytes(32).toString('hex');
      await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [secret]);
      fs.writeFileSync(credentialsPath, JSON.stringify({adminPassword:secret}), {mode:0o600});
    }
    console.log('Project database bootstrapped on port 3307. Credentials are local and gitignored.');
  } finally { await connection.end(); }
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
