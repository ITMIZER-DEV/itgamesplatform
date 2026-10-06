const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Script de Deploy Automatizado It.Games
 * Executa: Prisma Generate -> Build Central -> Env Sync -> Vercel Deploy
 */

function run(command, desc) {
  console.log(`\n\x1b[36m▶ ${desc}...\x1b[0m`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`\x1b[32m✔ ${desc} concluído.\x1b[0m`);
    return true;
  } catch (err) {
    console.error(`\x1b[31m✘ Erro em "${desc}": ${err.message}\x1b[0m`);
    return false;
  }
}

console.log('\n\x1b[35m🚀 INICIANDO AUTOMAÇÃO DE DEPLOY VERCEL\x1b[0m');

// 1. Prisma Generate
if (!run('npx prisma generate', 'Sincronizando Tipos Prisma')) process.exit(1);

// 2. Build de Produção (Pre-flight)
if (!run('npm run build', 'Validando Build de Produção (Next.js)')) {
  console.log('\n\x1b[33m⚠️ O build local falhou. Corrija os erros acima antes de subir para a Vercel.\x1b[0m');
  process.exit(1);
}

// 3. Sync Env Vars
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  console.log('\n\x1b[36m📡 Sincronizando Variáveis de Ambiente...\x1b[0m');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      let value = valueParts.join('=').trim();
      
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }

      try {
        console.log(`   + ${key}...`);
        execSync(`npx vercel env add ${key} production --force`, { 
          input: value, 
          stdio: ['pipe', 'ignore', 'ignore'] 
        });
      } catch (err) {
        // Silencioso se falhar (provavelmente já existe ou erro de rede)
      }
    }
  }
}

// 4. Deploy Final
console.log('\n\x1b[35m✨ ENVIANDO PARA VERCEL (PROD)...\x1b[0m');
if (!run('npx vercel --prod --yes', 'Publicando na Vercel')) {
  process.exit(1);
}

console.log('\n\x1b[32m🎉 DEPLOY CONCLUÍDO COM SUCESSO!\x1b[0m\n');
