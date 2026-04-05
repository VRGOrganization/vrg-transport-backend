import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import * as path from 'path';


// 🔥 Define ambiente e carrega env correta
const env = process.env.NODE_ENV || 'development';

dotenv.config({
  path: path.resolve(__dirname, '../../.env.' + env),
});

// fallback opcional (caso não exista o específico)
dotenv.config();

console.log(`Ambiente: ${env}`);

const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question: string): Promise<string> =>
  new Promise((resolve) => rl.question(question, resolve));

async function seedAdmin() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      `MONGODB_URI não encontrado no ambiente (${env}). Verifique o arquivo .env.${env}`
    );
  }

  console.log('\nConectando ao MongoDB...');
  await mongoose.connect(uri);
  console.log('Conectado\n');

  const AdminModel = mongoose.model('Admin', AdminSchema);

  const name = await ask('Nome do admin: ');
  const username = await ask('Username: ');
  const password = await ask('Senha (mín. 8 caracteres): ');

  rl.close();

  if (!name.trim() || !username.trim() || !password.trim()) {
    console.error('\nTodos os campos são obrigatórios');
    await mongoose.disconnect();
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\nSenha deve ter no mínimo 8 caracteres');
    await mongoose.disconnect();
    process.exit(1);
  }

  const existing = await AdminModel.findOne({
    username: username.toLowerCase(),
  });

  if (existing) {
    console.error(`\nAdmin já existe`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await AdminModel.create({
    name: name.trim(),
    username: username.toLowerCase().trim(),
    password: hashedPassword,
  });

  console.log(`\nAdmin criado com sucesso `);
  await mongoose.disconnect();
}

seedAdmin().catch((err) => {
  console.error('\nErro:', err.message);
  process.exit(1);
});