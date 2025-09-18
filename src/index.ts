#!/usr/bin/env node

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';

const GITHUB_REPO = 'pressly/goose';

const getPlatformMap = () => {
  const platform = os.platform();
  if (platform === 'darwin') {
    return 'darwin';
  }
  if (platform === 'linux') {
    return 'linux';
  }
  if (platform === 'win32') {
    return 'windows';
  }
  throw new Error(`Unsupported platform: ${platform}`);
};

const getArchMap = () => {
  const arch = os.arch();
  if (arch === 'x64') {
    return 'amd64';
  }
  if (arch === 'arm64') {
    return 'arm64';
  }
  throw new Error(`Unsupported architecture: ${arch}`);
};

const download = (url: string, dest: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'goose-npm' } }, (res) => {
      if (res.statusCode === 302 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

const main = async () => {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;
    const platform = getPlatformMap();
    const arch = getArchMap();
    const binDir = path.join(__dirname, '..', 'bin');
    const exe = path.join(binDir, `goose${platform === 'windows' ? '.exe' : ''}`);

    if (!fs.existsSync(exe)) {
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }
      const url = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/goose_${platform}_${arch}`;
      console.log(`Downloading goose v${version} from ${url}`);
      await download(url, exe);
      fs.chmodSync(exe, 755);
    }

    const [, , ...args] = process.argv;
    const child = spawn(exe, args, { stdio: 'inherit' });
    child.on('close', (code) => {
      process.exit(code ?? 0);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

main();