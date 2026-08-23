const { execSync } = require('child_process');
const url = 'libsql://oen-optik-oenoptik.aws-eu-west-1.turso.io';
const token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc1MDgxNzIsImlkIjoiMDFhMDE2OTQtYTIwMS03ZTJiLWIxMzAtOTIxYjRkYjQ4ZDdlIiwia2lkIjoicmFfNEdhdEl6aU9fVU5HdGRkb2luenBhbFhUWHJKM21ZNE9UbFpvSlpZVSIsInJpZCI6IjNhMTdlYmFlLTdjMDUtNDBjZC1hMzA2LWNhzcwOWVmYTA0ZCJ9.5BVCQKm6SDUEOIVRkq7p_fgiUCCh-sgGTU-SVmMRobwDqJSDcoEP6EcC5W5Gw5MRIXhMh7CLw-NsCmHKHEwqBw';

// Write to .env.local for Vercel
const fs = require('fs');
const envContent = `TURSO_DATABASE_URL=${url}\nTURSO_AUTH_TOKEN=${token}\n`;
fs.writeFileSync('.env.local', envContent);
console.log('Written to .env.local');
console.log('TURSO_DATABASE_URL=' + url);
console.log('TURSO_AUTH_TOKEN=' + token.substring(0, 20) + '...');
