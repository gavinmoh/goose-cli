#!/usr/bin/env node

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

const GITHUB_REPO = 'pressly/goose';
const GOOSE_VERSION = 'v3.25.0'

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
    return 'x86_64';
  }
  if (arch === 'arm64') {
    return 'arm64';
  }
  throw new Error(`Unsupported architecture: ${arch}`);
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const download = (url: string, dest: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'goose-npm' } }, (res) => {
      if (res.statusCode === 302 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }

      const totalSize = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      let startTime = Date.now();
      let lastChunkTime = startTime;
      let lastChunkSize = 0;

      const file = fs.createWriteStream(dest);
      res.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        lastChunkSize += chunk.length;
        const now = Date.now();
        const elapsedTime = (now - lastChunkTime) / 1000;

        if (elapsedTime >= 1 || downloadedSize === totalSize) {
          const speed = lastChunkSize / elapsedTime;
          const percentage = ((downloadedSize / totalSize) * 100).toFixed(2);
          process.stdout.write(
            `\rDownloading: ${percentage}% | ${formatBytes(downloadedSize, 2)} / ${formatBytes(totalSize, 2)} | ${formatBytes(speed, 2)}/s   `
          );
          lastChunkTime = now;
          lastChunkSize = 0;
        }
      });

      res.pipe(file);

      file.on('finish', () => {
        process.stdout.write('\n');
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

const parseChecksumsFile = (filePath: string): Map<string, string> => {
  const checksums = new Map<string, string>();

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    for (const line of lines) {
      // Ignore empty lines
      if (line.trim() === '') {
        continue;
      }

      const parts = line.split('  ');

      if (parts.length === 2) {
        const hash = parts[0];
        const filename = parts[1];
        checksums.set(filename, hash);
      }
    }
  } catch (err) {
    console.error(`Error reading or parsing file at ${filePath}:`, err);
  }

  return checksums
}

const getFileHash = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on("end", () => resolve(hash.digest('hex')))
    stream.on("error", error => reject(error.message))
    stream.pipe(hash)
  })
}

const main = async () => {
  // save as temporary file, verify checksum and then only rename
  const binDir = path.join(__dirname, '..', 'bin');
  const tempFilePath = path.join(binDir, "goose.temp")
  const checksumsPath = path.join(binDir, "checksums.txt");

  try {
    const platform = getPlatformMap();
    const arch = getArchMap();

    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // goose original file name on github release
    const originalFileName = `goose_${platform}_${arch}${platform === 'windows' ? '.exe' : ''}`

    // final filename
    const finalFileName = `goose${platform === 'windows' ? '.exe' : ''}`
    const finalFilePath = path.join(binDir, finalFileName)

    if (!fs.existsSync(finalFilePath)) {
      const checksumsUrl = `https://github.com/${GITHUB_REPO}/releases/download/${GOOSE_VERSION}/checksums.txt`;
      console.log(`Downloading checksums.txt from ${checksumsUrl}`);
      await download(checksumsUrl, checksumsPath);

      const url = `https://github.com/${GITHUB_REPO}/releases/download/${GOOSE_VERSION}/${originalFileName}`;
      console.log(`Downloading goose ${GOOSE_VERSION} from ${url}`);
      await download(url, tempFilePath);

      // verify checksum
      const checksums = parseChecksumsFile(checksumsPath)
      const expectedHash = checksums.get(originalFileName)
      const fileHash = await getFileHash(tempFilePath)

      if (fileHash !== expectedHash) {
        throw new Error("Failed to verify binary file checksum")
      }

      // rename temp file to final file and update permission
      fs.renameSync(tempFilePath, finalFilePath)
      fs.chmodSync(finalFilePath, 0o755);
    }

    const [, , ...args] = process.argv;
    const child = spawn(finalFilePath, args, { stdio: 'inherit' });
    child.on('close', (code) => {
      process.exit(code ?? 0);
    });
  } catch (err) {
    if (fs.existsSync(tempFilePath)) {
      fs.rmSync(tempFilePath)
    }
    console.error(err);
    process.exit(1);
  }
};

main();